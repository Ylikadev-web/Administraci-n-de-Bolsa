-- =====================================================================
-- BOLSAS v5 — Funciones y vistas
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de rol y pertenencia
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select es_admin from public.perfiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.es_miembro_bolsa(p_bolsa_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_id and usuario_id = auth.uid()
  );
$$;

create or replace function public.es_bolsa_asignada(p_bolsa_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.bolsas
    where id = p_bolsa_id and assigned_by_admin is not null
  );
$$;

-- ---------------------------------------------------------------------
-- Signo contable de cada tipo
-- Nota: 'transferencia_interna' se maneja con convención de descripción.
-- ---------------------------------------------------------------------
create or replace function public.signo_movimiento(t tipo_movimiento)
returns smallint
language sql immutable
as $$
  select case t
    when 'saldo_apertura'  then 1
    when 'ingreso'         then 1
    when 'aporte_recibido' then 1
    when 'gasto'           then -1
    when 'aporte_enviado'  then -1
    else 0
  end::smallint;
$$;

-- ---------------------------------------------------------------------
-- SALDO DE BOLSA
-- Solo movimientos 'activo' + convención INTERN_OUT/INTERN_IN para
-- transferencia_interna. Devuelve NULL para no miembros.
-- Nota: para bolsas con sub-bolsas (parent), este saldo es el "directo"
-- de la bolsa; para el saldo total incluyendo sub-bolsas usar saldo_total.
-- ---------------------------------------------------------------------
create or replace function public.saldo_bolsa(p_bolsa_id uuid)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result numeric;
begin
  if v_uid is null then return null; end if;
  if not public.es_miembro_bolsa(p_bolsa_id) and not public.es_admin() then
    return null;
  end if;

  select coalesce(sum(
    case
      when m.tipo = 'transferencia_interna' then
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

-- Saldo total incluyendo sub-bolsas (compartimentos).
create or replace function public.saldo_total_bolsa(p_bolsa_id uuid)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v_sum numeric := coalesce(public.saldo_bolsa(p_bolsa_id), 0);
  child_row record;
begin
  for child_row in
    select id from public.bolsas
    where parent_id = p_bolsa_id and archivada = false
  loop
    v_sum := v_sum + coalesce(public.saldo_total_bolsa(child_row.id), 0);
  end loop;
  return v_sum;
end;
$$;

-- ---------------------------------------------------------------------
-- VISTAS
-- ---------------------------------------------------------------------
create or replace view public.v_saldos_bolsa as
select
  b.id                              as bolsa_id,
  b.nombre                          as bolsa,
  b.parent_id,
  b.es_general,
  b.assigned_by_admin,
  b.archivada,
  b.moneda,
  public.saldo_bolsa(b.id)          as saldo_directo,
  public.saldo_total_bolsa(b.id)    as saldo_total,
  b.meta_habilitada,
  b.meta_monto,
  case
    when b.meta_habilitada and b.meta_monto > 0
    then round((public.saldo_total_bolsa(b.id) / b.meta_monto) * 100, 2)
    else null
  end                               as progreso_meta_pct
from public.bolsas b;

create or replace view public.v_resumen_mensual_bolsa as
select
  m.bolsa_id,
  m.mes_contable,
  sum(case when m.tipo in ('ingreso','aporte_recibido','saldo_apertura') then m.monto else 0 end) as total_ingresos,
  sum(case when m.tipo in ('gasto','aporte_enviado')                     then m.monto else 0 end) as total_gastos,
  count(*) filter (where m.tipo in ('ingreso','aporte_recibido','saldo_apertura')) as num_ingresos,
  count(*) filter (where m.tipo in ('gasto','aporte_enviado'))                     as num_gastos
from public.movimientos m
where m.estado = 'activo'
group by m.bolsa_id, m.mes_contable;

-- Contribuciones a la Bolsa General por usuario.
create or replace view public.v_contribuciones_bolsa_general as
select
  b.id                                                              as bolsa_id,
  m.autor_id                                                        as usuario_id,
  p.nombre                                                          as usuario,
  sum(m.monto) filter (where m.tipo = 'aporte_recibido')            as total_aportado,
  sum(m.monto) filter (where m.tipo = 'gasto')                      as total_gastado,
  count(*) filter (where m.tipo = 'aporte_recibido')                as num_aportes,
  count(*) filter (where m.tipo = 'gasto')                          as num_gastos
from public.bolsas b
join public.movimientos m on m.bolsa_id = b.id and m.estado = 'activo'
join public.perfiles p on p.id = m.autor_id
where b.es_general = true
group by b.id, m.autor_id, p.nombre;

-- Balance de préstamos por par de usuarios (solo activos).
create or replace view public.v_prestamos_activos as
select
  m.id                              as prestamo_id,
  m.autor_id                        as acreedor_id,      -- quien envió el aporte (aporte_enviado)
  m.contraparte_usuario_id          as deudor_id,        -- dueño de la bolsa receptora
  m.monto                           as monto_original,
  m.plazo_dias,
  m.fecha_ejecucion,
  m.fecha_vencimiento,
  coalesce(
    (select sum(pago.monto)
     from public.movimientos pago
     where pago.prestamo_id = m.id
       and pago.estado = 'activo'
       and pago.naturaleza_aporte in ('pago_deuda','reembolso')),
    0
  )                                 as monto_pagado,
  m.monto - coalesce(
    (select sum(pago.monto)
     from public.movimientos pago
     where pago.prestamo_id = m.id
       and pago.estado = 'activo'
       and pago.naturaleza_aporte in ('pago_deuda','reembolso')),
    0
  )                                 as saldo_pendiente,
  case
    when m.fecha_vencimiento is null then 'sin_vencimiento'
    when m.fecha_vencimiento < current_date then 'vencido'
    when m.fecha_vencimiento <= current_date + 3 then 'proximo_3d'
    when m.fecha_vencimiento <= current_date + 7 then 'proximo_7d'
    else 'al_corriente'
  end                               as estado_vencimiento
from public.movimientos m
where m.tipo = 'aporte_enviado'
  and m.naturaleza_aporte = 'prestamo'
  and m.estado = 'activo';

-- Deudas netas entre pares (a partir de préstamos activos con saldo).
create or replace view public.v_deudas_entre_usuarios as
select
  acreedor_id,
  deudor_id,
  sum(saldo_pendiente) as total_debido
from public.v_prestamos_activos
where saldo_pendiente > 0
group by acreedor_id, deudor_id;

-- =====================================================================
-- FUNCIONES DE ESCRITURA
-- =====================================================================

-- ---------------------------------------------------------------------
-- Crear bolsa (personal propia).
-- ---------------------------------------------------------------------
create or replace function public.crear_bolsa_propia(
  p_nombre                text,
  p_descripcion           text,
  p_color                 text,
  p_icono                 text,
  p_moneda                text,
  p_saldo_inicial         numeric,
  p_permite_saldo_negativo boolean,
  p_meta_habilitada       boolean,
  p_meta_monto            numeric,
  p_meta_fecha            date,
  p_parent_id             uuid
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bolsa_id uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_parent_id is not null then
    -- Solo puedo crear sub-bolsas de bolsas donde soy miembro.
    if not public.es_miembro_bolsa(p_parent_id) then
      raise exception 'No puedes crear sub-bolsa dentro de una bolsa que no es tuya';
    end if;
    -- No permitir sub-bolsas de la Bolsa General si no soy admin.
    if exists (select 1 from public.bolsas where id = p_parent_id and es_general = true)
       and not public.es_admin() then
      raise exception 'Solo el administrador crea sub-bolsas dentro de la Bolsa General';
    end if;
    -- No permitir sub-bolsas de una bolsa asignada si no soy admin.
    if exists (select 1 from public.bolsas where id = p_parent_id and assigned_by_admin is not null)
       and not public.es_admin() then
      raise exception 'Solo el administrador crea sub-bolsas dentro de una bolsa asignada';
    end if;
  end if;

  insert into public.bolsas (nombre, descripcion, color, icono, moneda,
                             es_general, parent_id, permite_saldo_negativo,
                             meta_habilitada, meta_monto, meta_fecha, created_by)
  values (p_nombre, p_descripcion, coalesce(p_color, '#4f46e5'), p_icono,
          coalesce(p_moneda, 'MXN'), false, p_parent_id,
          coalesce(p_permite_saldo_negativo, false),
          coalesce(p_meta_habilitada, false), p_meta_monto, p_meta_fecha, v_uid)
  returning id into v_bolsa_id;

  insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
  values (v_bolsa_id, v_uid, v_uid);

  if p_saldo_inicial is not null and p_saldo_inicial > 0 then
    insert into public.movimientos (bolsa_id, tipo, monto, moneda, descripcion,
                                    autor_id, fecha_ejecucion, estado)
    values (v_bolsa_id, 'saldo_apertura', p_saldo_inicial,
            coalesce(p_moneda, 'MXN'), 'Saldo inicial',
            v_uid, current_date, 'activo');
  end if;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id)
  values ('bolsa', v_bolsa_id, 'crear_propia', v_uid);

  return v_bolsa_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Asignar una bolsa a un usuario (solo Nesim admin).
-- ---------------------------------------------------------------------
create or replace function public.asignar_bolsa_a_usuario(
  p_nombre                text,
  p_descripcion           text,
  p_color                 text,
  p_icono                 text,
  p_moneda                text,
  p_usuario_asignado      uuid,
  p_saldo_inicial         numeric,
  p_permite_saldo_negativo boolean
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bolsa_id uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede asignar bolsas';
  end if;

  insert into public.bolsas (nombre, descripcion, color, icono, moneda,
                             assigned_by_admin, permite_saldo_negativo, created_by)
  values (p_nombre, p_descripcion, coalesce(p_color, '#4f46e5'), p_icono,
          coalesce(p_moneda, 'MXN'), v_uid,
          coalesce(p_permite_saldo_negativo, false), v_uid)
  returning id into v_bolsa_id;

  insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
  values (v_bolsa_id, p_usuario_asignado, v_uid);

  if p_saldo_inicial is not null and p_saldo_inicial > 0 then
    insert into public.movimientos (bolsa_id, tipo, monto, moneda, descripcion,
                                    autor_id, fecha_ejecucion, estado, aprobado_por, aprobado_at)
    values (v_bolsa_id, 'saldo_apertura', p_saldo_inicial,
            coalesce(p_moneda, 'MXN'), 'Saldo inicial asignado por admin',
            v_uid, current_date, 'activo', v_uid, now());
  end if;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('bolsa', v_bolsa_id, 'asignar', v_uid,
          jsonb_build_object('usuario_asignado', p_usuario_asignado));

  return v_bolsa_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Crear la Bolsa General (solo si no existe una activa; solo admin).
-- ---------------------------------------------------------------------
create or replace function public.crear_bolsa_general(
  p_nombre    text default 'Bolsa General',
  p_color     text default '#eab308',
  p_icono     text default 'users',
  p_moneda    text default 'MXN',
  p_co_owners uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bolsa_id uuid;
  v_owner uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede crear la Bolsa General';
  end if;
  if exists (select 1 from public.bolsas where es_general = true and archivada = false) then
    raise exception 'Ya existe una Bolsa General activa';
  end if;

  insert into public.bolsas (nombre, descripcion, color, icono, moneda, es_general, created_by)
  values (p_nombre, 'Bolsa compartida con aprobación del administrador',
          p_color, p_icono, p_moneda, true, v_uid)
  returning id into v_bolsa_id;

  -- El admin es co-dueño por defecto.
  insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
  values (v_bolsa_id, v_uid, v_uid)
  on conflict do nothing;

  foreach v_owner in array p_co_owners
  loop
    insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
    values (v_bolsa_id, v_owner, v_uid)
    on conflict do nothing;
  end loop;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('bolsa', v_bolsa_id, 'crear_general', v_uid,
          jsonb_build_object('co_owners', p_co_owners));

  return v_bolsa_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Registrar movimiento simple (ingreso / gasto / saldo_apertura).
-- Determina si el movimiento va activo o pendiente_aprobacion según:
--   - Si la bolsa es asignada por admin y el usuario NO es admin ->
--     queda pendiente.
--   - Si la bolsa es la Bolsa General y el usuario NO es admin ->
--     queda pendiente.
--   - En cualquier otro caso -> activo.
-- ---------------------------------------------------------------------
create or replace function public.registrar_movimiento(
  p_bolsa_id       uuid,
  p_tipo           tipo_movimiento,
  p_monto          numeric,
  p_categoria_id   uuid,
  p_descripcion    text,
  p_fecha_ejecucion date default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mov_id uuid;
  v_estado estado_movimiento;
  v_es_general boolean;
  v_es_asignada boolean;
  v_permite_negativo boolean;
  v_moneda text;
  v_saldo numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if p_tipo not in ('saldo_apertura','ingreso','gasto') then
    raise exception 'Este endpoint solo acepta saldo_apertura, ingreso o gasto';
  end if;
  if not public.es_miembro_bolsa(p_bolsa_id) then
    raise exception 'No tienes acceso a esta bolsa';
  end if;

  select es_general, (assigned_by_admin is not null), permite_saldo_negativo, moneda
    into v_es_general, v_es_asignada, v_permite_negativo, v_moneda
  from public.bolsas where id = p_bolsa_id;

  -- Determinar estado inicial.
  if (v_es_general or v_es_asignada) and not public.es_admin() then
    v_estado := 'pendiente_aprobacion';
  else
    v_estado := 'activo';
  end if;

  -- Validar saldo si el movimiento se ejecuta al momento y es gasto.
  if v_estado = 'activo' and p_tipo = 'gasto' and not v_permite_negativo then
    v_saldo := public.saldo_bolsa(p_bolsa_id);
    if v_saldo < p_monto then
      raise exception 'Saldo insuficiente (disponible: %)', v_saldo;
    end if;
  end if;

  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, categoria_id, descripcion,
    autor_id, estado, fecha_ejecucion,
    aprobado_por, aprobado_at
  ) values (
    p_bolsa_id, p_tipo, p_monto, coalesce(v_moneda, 'MXN'),
    p_categoria_id, p_descripcion,
    v_uid, v_estado,
    case when v_estado = 'activo' then coalesce(p_fecha_ejecucion, current_date) else null end,
    case when v_estado = 'activo' and public.es_admin() and (v_es_general or v_es_asignada) then v_uid else null end,
    case when v_estado = 'activo' and public.es_admin() and (v_es_general or v_es_asignada) then now() else null end
  )
  returning id into v_mov_id;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('movimiento', v_mov_id,
          case when v_estado = 'pendiente_aprobacion' then 'solicitar' else 'crear' end,
          v_uid,
          jsonb_build_object('tipo', p_tipo, 'monto', p_monto, 'bolsa', p_bolsa_id, 'estado', v_estado));

  return v_mov_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Aprobar un movimiento pendiente.
-- ---------------------------------------------------------------------
create or replace function public.aprobar_movimiento(p_movimiento_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mov public.movimientos%rowtype;
  v_es_general boolean;
  v_es_asignada boolean;
  v_es_dueno boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_mov from public.movimientos where id = p_movimiento_id;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if v_mov.estado <> 'pendiente_aprobacion' then
    raise exception 'El movimiento no está pendiente de aprobación';
  end if;

  select b.es_general, (b.assigned_by_admin is not null)
    into v_es_general, v_es_asignada
  from public.bolsas b where b.id = v_mov.bolsa_id;

  -- Quién puede aprobar:
  if v_es_general or v_es_asignada then
    if not public.es_admin() then
      raise exception 'Solo el administrador aprueba movimientos en esta bolsa';
    end if;
  else
    -- Bolsa propia -> el dueño (miembro) aprueba (solo aplica a aporte_recibido).
    if not public.es_miembro_bolsa(v_mov.bolsa_id) then
      raise exception 'Solo el dueño de la bolsa aprueba movimientos entrantes';
    end if;
  end if;

  update public.movimientos
     set estado = 'activo',
         aprobado_por = v_uid,
         aprobado_at = now(),
         fecha_ejecucion = coalesce(fecha_ejecucion, current_date)
   where id = p_movimiento_id;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id)
  values ('movimiento', p_movimiento_id, 'aprobar', v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- Rechazar un movimiento pendiente.
-- Si tiene aporte_id (par sender/receiver), también reversa al remitente.
-- ---------------------------------------------------------------------
create or replace function public.rechazar_movimiento(p_movimiento_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mov public.movimientos%rowtype;
  v_es_general boolean;
  v_es_asignada boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'El motivo del rechazo es obligatorio (mínimo 3 caracteres)';
  end if;

  select * into v_mov from public.movimientos where id = p_movimiento_id;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if v_mov.estado <> 'pendiente_aprobacion' then
    raise exception 'El movimiento no está pendiente de aprobación';
  end if;

  select b.es_general, (b.assigned_by_admin is not null)
    into v_es_general, v_es_asignada
  from public.bolsas b where b.id = v_mov.bolsa_id;

  if v_es_general or v_es_asignada then
    if not public.es_admin() then
      raise exception 'Solo el administrador rechaza en esta bolsa';
    end if;
  else
    if not public.es_miembro_bolsa(v_mov.bolsa_id) then
      raise exception 'Solo el dueño rechaza en su bolsa';
    end if;
  end if;

  update public.movimientos
     set estado = 'rechazado',
         aprobado_por = v_uid,
         aprobado_at = now(),
         motivo_rechazo = p_motivo
   where id = p_movimiento_id;

  -- Reversar el par si es un aporte que ya salió del remitente.
  if v_mov.aporte_id is not null and v_mov.tipo = 'aporte_recibido' then
    -- Anular el movimiento del remitente y crear una reversión que le devuelva el saldo.
    update public.movimientos
      set estado = 'anulado',
          anulado_at = now(),
          anulado_por = v_uid,
          motivo_anulacion = 'Aporte rechazado por el receptor: ' || p_motivo
      where aporte_id = v_mov.aporte_id
        and tipo = 'aporte_enviado';
  end if;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('movimiento', p_movimiento_id, 'rechazar', v_uid,
          jsonb_build_object('motivo', p_motivo));
end;
$$;

-- ---------------------------------------------------------------------
-- Crear aporte (préstamo, pago_deuda, reembolso o cooperación).
-- Genera partida doble; el aporte_recibido queda pendiente_aprobacion
-- (aprueba el dueño de la bolsa receptora, o Nesim si es General/asignada).
-- ---------------------------------------------------------------------
create or replace function public.crear_aporte(
  p_bolsa_origen        uuid,
  p_bolsa_destino       uuid,
  p_monto               numeric,
  p_naturaleza          naturaleza_aporte,
  p_descripcion         text,
  p_plazo_dias          integer default null,
  p_prestamo_id         uuid default null,
  p_fecha_ejecucion     date default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_aporte_id uuid := gen_random_uuid();
  v_mov_out_id uuid;
  v_mov_in_id uuid;
  v_saldo_origen numeric;
  v_permite_negativo boolean;
  v_moneda text;
  v_dueno_destino uuid;
  v_fecha_venc date;
  v_prestamo public.movimientos%rowtype;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Monto inválido'; end if;
  if p_bolsa_origen = p_bolsa_destino then raise exception 'Origen y destino deben ser distintos'; end if;
  if p_descripcion is null or length(trim(p_descripcion)) = 0 then raise exception 'La descripción es obligatoria'; end if;

  -- Bolsa origen debe ser mía (miembro).
  if not public.es_miembro_bolsa(p_bolsa_origen) then
    raise exception 'No tienes acceso a la bolsa de origen';
  end if;

  -- Validar consistencia por naturaleza.
  if p_naturaleza = 'prestamo' and (p_plazo_dias is null or p_plazo_dias <= 0) then
    raise exception 'Los préstamos requieren un plazo en días';
  end if;
  if p_naturaleza in ('pago_deuda','reembolso') then
    if p_prestamo_id is null then
      raise exception 'Debes especificar a qué préstamo se amarra el pago/reembolso';
    end if;
    select * into v_prestamo from public.movimientos where id = p_prestamo_id;
    if not found or v_prestamo.naturaleza_aporte <> 'prestamo' or v_prestamo.tipo <> 'aporte_enviado' then
      raise exception 'Préstamo no encontrado o inválido';
    end if;
    -- El que paga debe ser el deudor original (dueño de la bolsa destino del préstamo original).
    if v_prestamo.contraparte_usuario_id <> v_uid then
      raise exception 'Solo el deudor puede saldar este préstamo';
    end if;
  end if;

  -- Dueño de la bolsa destino (para contraparte).
  select bm.usuario_id into v_dueno_destino
  from public.bolsa_miembros bm
  where bm.bolsa_id = p_bolsa_destino
  order by bm.created_at asc
  limit 1;
  if v_dueno_destino is null then raise exception 'Bolsa destino inválida'; end if;

  select permite_saldo_negativo, moneda into v_permite_negativo, v_moneda
  from public.bolsas where id = p_bolsa_origen;

  v_saldo_origen := public.saldo_bolsa(p_bolsa_origen);
  if not v_permite_negativo and v_saldo_origen < p_monto then
    raise exception 'Saldo insuficiente (disponible: %)', v_saldo_origen;
  end if;

  if p_naturaleza = 'prestamo' then
    v_fecha_venc := current_date + p_plazo_dias;
  end if;

  -- Movimiento saliente (en la bolsa del remitente) → activo (sale inmediato).
  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, descripcion,
    autor_id, aporte_id, prestamo_id,
    naturaleza_aporte, contraparte_bolsa_id, contraparte_usuario_id,
    plazo_dias, fecha_vencimiento,
    estado, fecha_ejecucion
  ) values (
    p_bolsa_origen, 'aporte_enviado', p_monto, v_moneda, p_descripcion,
    v_uid, v_aporte_id, p_prestamo_id,
    p_naturaleza, p_bolsa_destino, v_dueno_destino,
    p_plazo_dias, v_fecha_venc,
    'activo', coalesce(p_fecha_ejecucion, current_date)
  ) returning id into v_mov_out_id;

  -- Movimiento entrante (en la bolsa destino) → pendiente_aprobacion
  -- (aprueba el dueño de la bolsa destino; si es General/asignada, aprueba Nesim).
  insert into public.movimientos (
    bolsa_id, tipo, monto, moneda, descripcion,
    autor_id, aporte_id, prestamo_id,
    naturaleza_aporte, contraparte_bolsa_id, contraparte_usuario_id,
    plazo_dias, fecha_vencimiento,
    estado
  ) values (
    p_bolsa_destino, 'aporte_recibido', p_monto, v_moneda, p_descripcion,
    v_uid, v_aporte_id, p_prestamo_id,
    p_naturaleza, p_bolsa_origen, v_uid,
    p_plazo_dias, v_fecha_venc,
    'pendiente_aprobacion'
  ) returning id into v_mov_in_id;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('aporte', v_aporte_id, 'crear', v_uid,
          jsonb_build_object('origen', p_bolsa_origen, 'destino', p_bolsa_destino,
                             'monto', p_monto, 'naturaleza', p_naturaleza));

  return v_aporte_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancelar aporte pendiente (por el remitente, mientras siga pendiente).
-- ---------------------------------------------------------------------
create or replace function public.cancelar_aporte_pendiente(p_aporte_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out public.movimientos%rowtype;
  v_in public.movimientos%rowtype;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_out from public.movimientos
    where aporte_id = p_aporte_id and tipo = 'aporte_enviado' limit 1;
  select * into v_in  from public.movimientos
    where aporte_id = p_aporte_id and tipo = 'aporte_recibido' limit 1;

  if v_out.autor_id <> v_uid then
    raise exception 'Solo el remitente puede cancelar el aporte';
  end if;
  if v_in.estado <> 'pendiente_aprobacion' then
    raise exception 'El aporte ya fue procesado por el receptor';
  end if;

  update public.movimientos
    set estado = 'anulado',
        anulado_at = now(),
        anulado_por = v_uid,
        motivo_anulacion = 'Cancelado por el remitente'
    where aporte_id = p_aporte_id;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id)
  values ('aporte', p_aporte_id, 'cancelar_remitente', v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- Transferencia interna entre bolsas del mismo dueño (o entre bolsa y
-- sus sub-bolsas).
-- ---------------------------------------------------------------------
create or replace function public.crear_transferencia_interna(
  p_bolsa_origen   uuid,
  p_bolsa_destino  uuid,
  p_monto          numeric,
  p_descripcion    text default null,
  p_fecha          date default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_transfer_id uuid := gen_random_uuid();
  v_saldo_origen numeric;
  v_permite_negativo boolean;
  v_moneda text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Monto inválido'; end if;
  if p_bolsa_origen = p_bolsa_destino then raise exception 'Origen y destino deben ser distintos'; end if;
  if not public.es_miembro_bolsa(p_bolsa_origen) then raise exception 'Sin acceso a origen'; end if;
  if not public.es_miembro_bolsa(p_bolsa_destino) then raise exception 'Sin acceso a destino'; end if;

  select permite_saldo_negativo, moneda into v_permite_negativo, v_moneda
  from public.bolsas where id = p_bolsa_origen;

  v_saldo_origen := public.saldo_bolsa(p_bolsa_origen);
  if not v_permite_negativo and v_saldo_origen < p_monto then
    raise exception 'Saldo insuficiente en origen (disponible: %)', v_saldo_origen;
  end if;

  insert into public.movimientos (bolsa_id, tipo, monto, moneda, descripcion,
                                  autor_id, transfer_id, contraparte_bolsa_id, fecha_ejecucion, estado)
  values (p_bolsa_origen, 'transferencia_interna', p_monto, v_moneda,
          'INTERN_OUT', v_uid, v_transfer_id, p_bolsa_destino,
          coalesce(p_fecha, current_date), 'activo');

  insert into public.movimientos (bolsa_id, tipo, monto, moneda, descripcion,
                                  autor_id, transfer_id, contraparte_bolsa_id, fecha_ejecucion, estado)
  values (p_bolsa_destino, 'transferencia_interna', p_monto, v_moneda,
          'INTERN_IN', v_uid, v_transfer_id, p_bolsa_origen,
          coalesce(p_fecha, current_date), 'activo');

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('movimiento', v_transfer_id, 'crear_transferencia', v_uid,
          jsonb_build_object('origen', p_bolsa_origen, 'destino', p_bolsa_destino, 'monto', p_monto, 'nota', p_descripcion));

  return v_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Anular movimiento (solo autor, y no si está pendiente ni cerrado).
-- Nota: si el movimiento está en Bolsa General o asignada y ya fue
-- aprobado, la anulación queda como 'pendiente_aprobacion' nuevamente
-- y necesita re-aprobación por Nesim (recomendación v4).
-- ---------------------------------------------------------------------
create or replace function public.anular_movimiento(
  p_movimiento_id uuid,
  p_motivo        text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mov public.movimientos%rowtype;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Motivo de anulación obligatorio (mínimo 3 caracteres)';
  end if;

  select * into v_mov from public.movimientos where id = p_movimiento_id;
  if not found then raise exception 'Movimiento no encontrado'; end if;
  if v_mov.autor_id <> v_uid and not public.es_admin() then
    raise exception 'Solo el autor puede anular su movimiento';
  end if;
  if v_mov.estado <> 'activo' then
    raise exception 'Solo se pueden anular movimientos activos';
  end if;
  if v_mov.cerrado then raise exception 'Movimiento en mes cerrado'; end if;

  update public.movimientos
    set estado = 'anulado', anulado_at = now(), anulado_por = v_uid, motivo_anulacion = p_motivo
    where id = p_movimiento_id;

  if v_mov.transfer_id is not null then
    update public.movimientos
      set estado = 'anulado', anulado_at = now(), anulado_por = v_uid, motivo_anulacion = p_motivo
      where transfer_id = v_mov.transfer_id and id <> p_movimiento_id;
  end if;
  if v_mov.aporte_id is not null then
    update public.movimientos
      set estado = 'anulado', anulado_at = now(), anulado_por = v_uid, motivo_anulacion = p_motivo
      where aporte_id = v_mov.aporte_id and id <> p_movimiento_id;
  end if;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('movimiento', p_movimiento_id, 'anular', v_uid, jsonb_build_object('motivo', p_motivo));
end;
$$;

-- ---------------------------------------------------------------------
-- Archivar bolsa (saldo debe ser 0, no admite Bolsa General).
-- ---------------------------------------------------------------------
create or replace function public.archivar_bolsa(p_bolsa_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_es_general boolean;
  v_assigned uuid;
  v_saldo numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not public.es_miembro_bolsa(p_bolsa_id) and not public.es_admin() then
    raise exception 'Sin acceso a esta bolsa';
  end if;
  select es_general, assigned_by_admin into v_es_general, v_assigned
    from public.bolsas where id = p_bolsa_id;
  if v_es_general then raise exception 'La Bolsa General no se puede archivar'; end if;
  if v_assigned is not null and not public.es_admin() then
    raise exception 'Solo el administrador archiva bolsas asignadas';
  end if;

  v_saldo := public.saldo_total_bolsa(p_bolsa_id);
  if v_saldo <> 0 then
    raise exception 'La bolsa debe tener saldo total 0 para archivarse (actual: %)', v_saldo;
  end if;

  update public.bolsas set archivada = true, archivada_at = now() where id = p_bolsa_id;
  update public.bolsas set archivada = true, archivada_at = now() where parent_id = p_bolsa_id and archivada = false;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id)
  values ('bolsa', p_bolsa_id, 'archivar', v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- Actualizar umbral de saldo bajo (solo admin).
-- ---------------------------------------------------------------------
create or replace function public.actualizar_umbral_saldo_bajo(p_pct numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede configurar el umbral';
  end if;
  if p_pct < 0 or p_pct > 100 then
    raise exception 'El porcentaje debe estar entre 0 y 100';
  end if;

  update public.config_global
    set umbral_saldo_bajo_bolsa_general_pct = p_pct,
        updated_at = now(),
        updated_by = auth.uid()
    where id = 1;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values ('config', '00000000-0000-0000-0000-000000000001'::uuid,
          'actualizar_umbral', auth.uid(),
          jsonb_build_object('pct', p_pct));
end;
$$;
