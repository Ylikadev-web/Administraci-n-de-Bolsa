-- =====================================================================
-- BOLSAS — Funciones y vistas para reportes contables.
-- Migración 002: saldos, contribuciones a la Bolsa General, deudas
-- entre usuarios, y creación transaccional de eventos compuestos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SIGNO CONTABLE DE CADA TIPO DE MOVIMIENTO
-- (define cómo cada tipo afecta el saldo de su bolsa)
-- ---------------------------------------------------------------------
create or replace function public.signo_movimiento(t tipo_movimiento)
returns smallint
language sql
immutable
as $$
  select case t
    when 'saldo_apertura'        then 1
    when 'ingreso'               then 1
    when 'aporte_recibido'       then 1
    when 'gasto'                 then -1
    when 'aporte_enviado'        then -1
    when 'retiro_externo'        then -1
    when 'transferencia_interna' then 0  -- se maneja por asiento: origen negativo, destino positivo (ver saldo)
    else 0
  end::smallint;
$$;

-- ---------------------------------------------------------------------
-- SALDO ACTUAL DE UNA BOLSA (solo movimientos activos).
-- Convención de transferencia_interna: dos filas por transfer_id, con
-- descripcion 'INTERN_OUT' en la bolsa origen y 'INTERN_IN' en destino.
-- Solo miembros de la bolsa reciben resultado; el resto obtiene NULL.
-- ---------------------------------------------------------------------
create or replace function public.saldo_bolsa(p_bolsa_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result numeric;
begin
  -- Bloqueamos consulta directa sin ser miembro.
  if v_uid is null then
    return null;
  end if;
  if not exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_id and usuario_id = v_uid
  ) then
    return null;
  end if;

  select coalesce(sum(
    case
      when m.tipo = 'transferencia_interna' then
        -- Convención: dos filas por transfer_id (INTERN_OUT en origen, INTERN_IN en destino).
        case
          when m.descripcion = 'INTERN_OUT' then -m.monto
          when m.descripcion = 'INTERN_IN'  then  m.monto
          else 0
        end
      else m.monto * public.signo_movimiento(m.tipo)
    end
  ), 0)
  into v_result
  from public.movimientos m
  where m.bolsa_id = p_bolsa_id
    and m.estado = 'activo';

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- VISTA: SALDO POR BOLSA
-- ---------------------------------------------------------------------
create or replace view public.v_saldos_bolsa as
select
  b.id                                  as bolsa_id,
  b.nombre                              as bolsa,
  b.es_general,
  b.archivada,
  b.moneda,
  public.saldo_bolsa(b.id)              as saldo,
  b.meta_habilitada,
  b.meta_monto,
  case
    when b.meta_habilitada and b.meta_monto > 0
    then round((public.saldo_bolsa(b.id) / b.meta_monto) * 100, 2)
    else null
  end                                   as progreso_meta_pct
from public.bolsas b;

comment on view public.v_saldos_bolsa is
  'Saldo y avance de meta por bolsa. Respeta RLS de bolsas por SELECT.';

-- ---------------------------------------------------------------------
-- VISTA: RESUMEN MES A MES POR BOLSA
-- ---------------------------------------------------------------------
create or replace view public.v_resumen_mensual_bolsa as
select
  m.bolsa_id,
  m.mes_contable,
  sum(case when m.tipo in ('ingreso','aporte_recibido','saldo_apertura') then m.monto else 0 end) as total_ingresos,
  sum(case when m.tipo in ('gasto','aporte_enviado','retiro_externo')     then m.monto else 0 end) as total_gastos,
  count(*) filter (where m.tipo in ('ingreso','aporte_recibido','saldo_apertura')) as num_ingresos,
  count(*) filter (where m.tipo in ('gasto','aporte_enviado','retiro_externo'))     as num_gastos
from public.movimientos m
where m.estado = 'activo'
group by m.bolsa_id, m.mes_contable;

-- ---------------------------------------------------------------------
-- VISTA: LIBRO DE CONTRIBUCIONES A LA BOLSA GENERAL
-- (aportes recibidos, agrupados por autor)
-- ---------------------------------------------------------------------
create or replace view public.v_contribuciones_bolsa_general as
select
  b.id                          as bolsa_id,
  m.autor_id                    as usuario_id,
  p.nombre                      as usuario,
  sum(m.monto) filter (
    where m.tipo = 'aporte_recibido'
  )                             as total_aportado,
  sum(m.monto) filter (
    where m.tipo = 'gasto'
  )                             as total_gastado_a_su_nombre,
  count(*) filter (where m.tipo = 'aporte_recibido') as num_aportes,
  count(*) filter (where m.tipo = 'gasto')           as num_gastos_propios
from public.bolsas b
join public.movimientos m on m.bolsa_id = b.id and m.estado = 'activo'
join public.perfiles p on p.id = m.autor_id
where b.es_general = true
group by b.id, m.autor_id, p.nombre;

comment on view public.v_contribuciones_bolsa_general is
  'Cuánto ha aportado cada usuario a la Bolsa General y cuánto ha gastado desde ahí (aparece con su nombre).';

-- ---------------------------------------------------------------------
-- VISTA: BALANCE DE DEUDAS ENTRE USUARIOS
-- (a partir de aportes con naturaleza 'prestamo' o 'adelanto' menos los 'pago_deuda' / 'reembolso')
-- ---------------------------------------------------------------------
create or replace view public.v_deudas_entre_usuarios as
with aportes as (
  select
    m.autor_id            as acreedor,   -- quien envía el aporte
    m.contraparte_usuario_id as deudor,  -- dueño de la bolsa receptora
    m.naturaleza_aporte,
    m.monto
  from public.movimientos m
  where m.estado = 'activo'
    and m.tipo = 'aporte_enviado'
    and m.contraparte_usuario_id is not null
)
select
  acreedor,
  deudor,
  sum(case
        when naturaleza_aporte in ('prestamo','adelanto') then monto
        when naturaleza_aporte in ('pago_deuda','reembolso') then -monto
        else 0
      end) as saldo_deuda
from aportes
group by acreedor, deudor
having sum(case
             when naturaleza_aporte in ('prestamo','adelanto') then monto
             when naturaleza_aporte in ('pago_deuda','reembolso') then -monto
             else 0
           end) <> 0;

comment on view public.v_deudas_entre_usuarios is
  'Saldo neto de deudas: acreedor tiene por cobrar `saldo_deuda` al deudor.';

-- =====================================================================
-- FUNCIONES DE ESCRITURA (crean eventos compuestos con partida doble)
-- =====================================================================

-- ---------------------------------------------------------------------
-- CREAR TRANSFERENCIA INTERNA (entre mis propias bolsas)
-- ---------------------------------------------------------------------
create or replace function public.crear_transferencia_interna(
  p_bolsa_origen   uuid,
  p_bolsa_destino  uuid,
  p_monto          numeric,
  p_descripcion    text default null,
  p_fecha          date  default null
)
returns uuid  -- transfer_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_transfer_id uuid := gen_random_uuid();
  v_saldo_origen numeric;
  v_permite_negativo boolean;
  v_moneda text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;
  if p_bolsa_origen = p_bolsa_destino then
    raise exception 'Origen y destino deben ser bolsas distintas';
  end if;

  -- Ambas bolsas deben pertenecer al usuario autenticado.
  if not exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_origen and usuario_id = v_uid
  ) then
    raise exception 'No tienes acceso a la bolsa de origen';
  end if;
  if not exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_destino and usuario_id = v_uid
  ) then
    raise exception 'No tienes acceso a la bolsa de destino';
  end if;

  select permite_saldo_negativo, moneda into v_permite_negativo, v_moneda
  from public.bolsas where id = p_bolsa_origen;

  v_saldo_origen := public.saldo_bolsa(p_bolsa_origen);

  if not v_permite_negativo and v_saldo_origen < p_monto then
    raise exception 'Saldo insuficiente en la bolsa de origen (disponible: %)', v_saldo_origen;
  end if;

  -- Asiento de salida
  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, descripcion, fecha_movimiento,
    autor_id, transfer_id, contraparte_bolsa_id
  ) values (
    p_bolsa_origen, 'transferencia_interna', p_monto, v_moneda,
    'INTERN_OUT', coalesce(p_fecha, current_date),
    v_uid, v_transfer_id, p_bolsa_destino
  );

  -- Asiento de entrada
  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, descripcion, fecha_movimiento,
    autor_id, transfer_id, contraparte_bolsa_id
  ) values (
    p_bolsa_destino, 'transferencia_interna', p_monto, v_moneda,
    'INTERN_IN', coalesce(p_fecha, current_date),
    v_uid, v_transfer_id, p_bolsa_origen
  );

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('movimiento', v_transfer_id, 'crear_transferencia', v_uid,
    jsonb_build_object(
      'origen', p_bolsa_origen,
      'destino', p_bolsa_destino,
      'monto', p_monto,
      'descripcion', p_descripcion
    ));

  return v_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- CREAR APORTE ENTRE USUARIOS
-- (yo envío dinero a la bolsa de otro usuario)
-- ---------------------------------------------------------------------
create or replace function public.crear_aporte(
  p_bolsa_origen        uuid,           -- mi bolsa (de donde sale)
  p_bolsa_destino       uuid,           -- bolsa del otro usuario
  p_monto               numeric,
  p_naturaleza          naturaleza_aporte,
  p_descripcion         text,
  p_fecha               date default null
)
returns uuid -- aporte_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_aporte_id uuid := gen_random_uuid();
  v_saldo_origen numeric;
  v_permite_negativo boolean;
  v_moneda text;
  v_dueno_destino uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;
  if p_bolsa_origen = p_bolsa_destino then
    raise exception 'Origen y destino deben ser distintos';
  end if;
  if p_descripcion is null or length(trim(p_descripcion)) = 0 then
    raise exception 'La descripción del aporte es obligatoria';
  end if;

  -- La bolsa origen debe ser mía.
  if not exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_origen and usuario_id = v_uid
  ) then
    raise exception 'No tienes acceso a la bolsa de origen';
  end if;

  -- Encontrar el dueño de la bolsa destino (para registrar contraparte).
  select bm.usuario_id into v_dueno_destino
  from public.bolsa_miembros bm
  join public.bolsas b on b.id = bm.bolsa_id
  where bm.bolsa_id = p_bolsa_destino
    and (bm.rol = 'dueno' or b.es_general = true)
  order by bm.rol asc
  limit 1;

  if v_dueno_destino is null then
    raise exception 'La bolsa de destino no existe';
  end if;

  select permite_saldo_negativo, moneda into v_permite_negativo, v_moneda
  from public.bolsas where id = p_bolsa_origen;

  v_saldo_origen := public.saldo_bolsa(p_bolsa_origen);
  if not v_permite_negativo and v_saldo_origen < p_monto then
    raise exception 'Saldo insuficiente para aportar (disponible: %)', v_saldo_origen;
  end if;

  -- Asiento en mi bolsa: aporte_enviado
  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, descripcion, fecha_movimiento,
    autor_id, aporte_id, naturaleza_aporte, contraparte_bolsa_id, contraparte_usuario_id
  ) values (
    p_bolsa_origen, 'aporte_enviado', p_monto, v_moneda, p_descripcion,
    coalesce(p_fecha, current_date),
    v_uid, v_aporte_id, p_naturaleza, p_bolsa_destino, v_dueno_destino
  );

  -- Asiento en la bolsa destino: aporte_recibido
  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, descripcion, fecha_movimiento,
    autor_id, aporte_id, naturaleza_aporte, contraparte_bolsa_id, contraparte_usuario_id
  ) values (
    p_bolsa_destino, 'aporte_recibido', p_monto, v_moneda, p_descripcion,
    coalesce(p_fecha, current_date),
    v_uid, v_aporte_id, p_naturaleza, p_bolsa_origen, v_uid
  );

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('aporte', v_aporte_id, 'crear_aporte', v_uid,
    jsonb_build_object(
      'origen', p_bolsa_origen,
      'destino', p_bolsa_destino,
      'monto', p_monto,
      'naturaleza', p_naturaleza,
      'descripcion', p_descripcion
    ));

  return v_aporte_id;
end;
$$;

-- ---------------------------------------------------------------------
-- ANULAR MOVIMIENTO (solo el autor puede)
-- Anula también su contraparte si es transferencia o aporte.
-- ---------------------------------------------------------------------
create or replace function public.anular_movimiento(
  p_movimiento_id uuid,
  p_motivo        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mov public.movimientos%rowtype;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Debes indicar un motivo de anulación';
  end if;

  select * into v_mov from public.movimientos where id = p_movimiento_id;
  if not found then
    raise exception 'Movimiento no encontrado';
  end if;
  if v_mov.autor_id <> v_uid then
    raise exception 'Solo el autor puede anular su movimiento (usa la solicitud de anulación)';
  end if;
  if v_mov.estado = 'anulado' then
    raise exception 'El movimiento ya está anulado';
  end if;
  if v_mov.cerrado then
    raise exception 'No se puede anular un movimiento de un mes cerrado';
  end if;

  -- Anular el principal.
  update public.movimientos
    set estado = 'anulado',
        anulado_at = now(),
        anulado_por = v_uid,
        motivo_anulacion = p_motivo
    where id = p_movimiento_id;

  -- Anular la contraparte si aplica.
  if v_mov.transfer_id is not null then
    update public.movimientos
      set estado = 'anulado',
          anulado_at = now(),
          anulado_por = v_uid,
          motivo_anulacion = p_motivo
      where transfer_id = v_mov.transfer_id and id <> p_movimiento_id;
  end if;
  if v_mov.aporte_id is not null then
    update public.movimientos
      set estado = 'anulado',
          anulado_at = now(),
          anulado_por = v_uid,
          motivo_anulacion = p_motivo
      where aporte_id = v_mov.aporte_id and id <> p_movimiento_id;
  end if;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('movimiento', p_movimiento_id, 'anular', v_uid,
    jsonb_build_object('motivo', p_motivo));
end;
$$;

-- ---------------------------------------------------------------------
-- ARCHIVAR BOLSA (requiere saldo = 0)
-- ---------------------------------------------------------------------
create or replace function public.archivar_bolsa(p_bolsa_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_es_general boolean;
  v_saldo numeric;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  -- Debe ser miembro dueño.
  if not exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_id and usuario_id = v_uid and rol = 'dueno'
  ) then
    raise exception 'Solo el dueño puede archivar una bolsa';
  end if;

  select es_general into v_es_general from public.bolsas where id = p_bolsa_id;
  if v_es_general then
    raise exception 'La Bolsa General no se puede archivar';
  end if;

  v_saldo := public.saldo_bolsa(p_bolsa_id);
  if v_saldo <> 0 then
    raise exception 'No se puede archivar una bolsa con saldo distinto de 0 (saldo actual: %)', v_saldo;
  end if;

  update public.bolsas
    set archivada = true, archivada_at = now()
    where id = p_bolsa_id;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id)
  values ('bolsa', p_bolsa_id, 'archivar', v_uid);
end;
$$;
