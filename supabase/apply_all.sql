-- =====================================================================
-- BOLSAS — Esquema contable
-- Migración 001: Tipos, tablas base y comentarios.
-- Diseñado como "sobres virtuales" (Opción A) con partida doble
-- implícita, sin borrado (solo anulación) y saldos calculados.
-- =====================================================================

-- Extensiones necesarias.
create extension if not exists "pgcrypto";

-- =====================================================================
-- TIPOS ENUMERADOS
-- =====================================================================

create type public.tipo_movimiento as enum (
  'saldo_apertura',
  'ingreso',
  'gasto',
  'transferencia_interna',
  'aporte_recibido',
  'aporte_enviado',
  'retiro_externo'
);

create type public.naturaleza_aporte as enum (
  'prestamo',
  'pago_deuda',
  'reembolso',
  'cooperacion',
  'adelanto'
);

create type public.estado_movimiento as enum (
  'activo',
  'anulado'
);

create type public.canal_notificacion as enum (
  'email',
  'telegram',
  'whatsapp'
);

create type public.modo_cierre as enum (
  'automatico',
  'manual'
);

create type public.rol_bolsa as enum (
  'dueno',
  'co_dueno'
);

create type public.estado_solicitud_anulacion as enum (
  'pendiente',
  'aprobada',
  'rechazada'
);

-- =====================================================================
-- USUARIOS Y PERFILES
-- =====================================================================

-- Cada usuario en auth.users tiene un perfil aquí.
create table public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nombre        text not null,
  email         text not null unique,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.perfiles is 'Datos editables del usuario. El id coincide con auth.users.id.';

-- Preferencias por usuario (tema, cierre mensual, notificaciones, etc.).
create table public.preferencias_usuario (
  usuario_id                uuid primary key references public.perfiles (id) on delete cascade,
  zona_horaria              text not null default 'America/Mexico_City',
  moneda_default            text not null default 'MXN',
  tema                      text not null default 'system' check (tema in ('light', 'dark', 'system')),
  cierre_modo               modo_cierre not null default 'automatico',
  cierre_dia_mes            smallint not null default 1 check (cierre_dia_mes between 1 and 31),
  cierre_recordatorio_dias  smallint not null default 3,
  notif_saldo_bajo_umbral   numeric(5,2) not null default 10.00,
  updated_at                timestamptz not null default now()
);
comment on table public.preferencias_usuario is 'Configuración por usuario que no tiene naturaleza contable.';

-- Vinculación de canales de notificación (email, telegram, whatsapp).
create table public.canales_notificacion (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.perfiles (id) on delete cascade,
  canal             canal_notificacion not null,
  identificador     text not null, -- email, telegram_chat_id, whatsapp phone
  verificado        boolean not null default false,
  token_verificacion text,
  created_at        timestamptz not null default now(),
  unique (usuario_id, canal)
);
comment on table public.canales_notificacion is 'Un usuario puede tener un canal por tipo; solo se envían notificaciones a canales verificados.';

-- Suscripción a eventos por canal.
create table public.suscripciones_evento (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  evento       text not null, -- 'aporte_recibido', 'saldo_bajo', 'cierre_mensual', ...
  canal        canal_notificacion not null,
  activo       boolean not null default true,
  unique (usuario_id, evento, canal)
);

-- =====================================================================
-- BOLSAS
-- =====================================================================

create table public.bolsas (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  descripcion           text,
  color                 text not null default '#4f46e5',
  icono                 text,
  moneda                text not null default 'MXN',
  es_general            boolean not null default false,
  archivada             boolean not null default false,
  archivada_at          timestamptz,
  permite_saldo_negativo boolean not null default false,
  meta_habilitada       boolean not null default false,
  meta_monto            numeric(14,2),
  meta_fecha            date,
  created_by            uuid not null references public.perfiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint solo_una_general check (
    (es_general = false) or (archivada = false)
  ),
  constraint meta_valida check (
    (meta_habilitada = false)
    or (meta_habilitada = true and meta_monto is not null and meta_monto > 0)
  ),
  constraint general_sin_meta check (
    not (es_general = true and meta_habilitada = true)
  )
);
comment on table public.bolsas is
  'Bolsa personal o general. Es general las ven todos los co-dueños; las personales solo su dueño. Al archivar deben tener saldo = 0.';

-- Índice único: solo puede existir UNA bolsa general no archivada.
create unique index bolsas_una_general_activa
  on public.bolsas (es_general)
  where es_general = true and archivada = false;

-- Miembros (dueños/co-dueños) por bolsa.
create table public.bolsa_miembros (
  bolsa_id     uuid not null references public.bolsas (id) on delete cascade,
  usuario_id   uuid not null references public.perfiles (id) on delete cascade,
  rol          rol_bolsa not null default 'dueno',
  added_by     uuid references public.perfiles (id),
  created_at   timestamptz not null default now(),
  primary key (bolsa_id, usuario_id)
);
comment on table public.bolsa_miembros is
  'Bolsas personales tienen 1 dueño. La Bolsa General tiene co-dueños (3 usuarios).';

-- =====================================================================
-- CATEGORÍAS DE INGRESO / GASTO
-- =====================================================================

create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo          text not null check (tipo in ('ingreso', 'gasto', 'ambos')),
  color         text not null default '#64748b',
  icono         text,
  es_sistema    boolean not null default false, -- provistas por semilla, no borrables
  activa        boolean not null default true,
  creada_por    uuid references public.perfiles (id),
  created_at    timestamptz not null default now()
);
comment on table public.categorias is 'Catálogo compartido de categorías. No se eliminan: se marcan inactivas.';

-- =====================================================================
-- MOVIMIENTOS (el corazón contable)
-- =====================================================================

create table public.movimientos (
  id                    uuid primary key default gen_random_uuid(),
  bolsa_id              uuid not null references public.bolsas (id),
  tipo                  tipo_movimiento not null,
  monto                 numeric(14,2) not null check (monto > 0),
  moneda                text not null default 'MXN',
  categoria_id          uuid references public.categorias (id),
  descripcion           text,
  fecha_movimiento      date not null default (now() at time zone 'utc')::date,
  estado                estado_movimiento not null default 'activo',
  -- Trazabilidad
  autor_id              uuid not null references public.perfiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Anulación
  anulado_at            timestamptz,
  anulado_por           uuid references public.perfiles (id),
  motivo_anulacion      text,
  -- Vínculos entre asientos
  transfer_id           uuid, -- une dos movimientos de transferencia_interna
  aporte_id             uuid, -- une aporte_enviado con aporte_recibido
  -- Metadatos por tipo
  naturaleza_aporte     naturaleza_aporte, -- solo cuando tipo es aporte_*
  contraparte_bolsa_id  uuid references public.bolsas (id), -- bolsa destino/origen del par
  contraparte_usuario_id uuid references public.perfiles (id),
  -- Cierre
  mes_contable          date not null default date_trunc('month', now())::date,
  cerrado               boolean not null default false,
  constraint anulacion_consistente check (
    (estado = 'anulado' and anulado_at is not null and anulado_por is not null and motivo_anulacion is not null)
    or (estado = 'activo' and anulado_at is null and anulado_por is null and motivo_anulacion is null)
  ),
  constraint aporte_requiere_naturaleza check (
    (tipo not in ('aporte_enviado', 'aporte_recibido')) or (naturaleza_aporte is not null)
  ),
  constraint apertura_solo_una check (true) -- placeholder, se refuerza con índice único abajo
);
comment on table public.movimientos is
  'Cada evento contable. Nunca se elimina (solo se anula). Los pares de movimientos (transferencia, aporte) comparten transfer_id/aporte_id.';

-- Índices críticos para reportes.
create index movimientos_bolsa_fecha_idx on public.movimientos (bolsa_id, fecha_movimiento desc);
create index movimientos_autor_idx on public.movimientos (autor_id);
create index movimientos_estado_idx on public.movimientos (estado);
create index movimientos_mes_contable_idx on public.movimientos (mes_contable);
create index movimientos_tipo_idx on public.movimientos (tipo);
create index movimientos_transfer_id_idx on public.movimientos (transfer_id) where transfer_id is not null;
create index movimientos_aporte_id_idx on public.movimientos (aporte_id) where aporte_id is not null;

-- Solo un movimiento de apertura por bolsa (activo).
create unique index movimientos_apertura_unica
  on public.movimientos (bolsa_id)
  where tipo = 'saldo_apertura' and estado = 'activo';

-- =====================================================================
-- ADJUNTOS (comprobantes)
-- =====================================================================

create table public.movimiento_adjuntos (
  id             uuid primary key default gen_random_uuid(),
  movimiento_id  uuid not null references public.movimientos (id) on delete cascade,
  storage_path   text not null, -- ruta en el bucket 'comprobantes'
  nombre         text not null,
  mime_type      text,
  tamano_bytes   bigint,
  subido_por     uuid not null references public.perfiles (id),
  created_at     timestamptz not null default now()
);

-- =====================================================================
-- MOVIMIENTOS RECURRENTES (plantillas)
-- =====================================================================

create table public.movimientos_recurrentes (
  id                  uuid primary key default gen_random_uuid(),
  bolsa_id            uuid not null references public.bolsas (id) on delete cascade,
  tipo                tipo_movimiento not null,
  monto               numeric(14,2) not null check (monto > 0),
  categoria_id        uuid references public.categorias (id),
  descripcion         text,
  -- Frecuencia
  frecuencia          text not null check (frecuencia in ('diaria', 'semanal', 'quincenal', 'mensual', 'anual')),
  dia_del_mes         smallint check (dia_del_mes between 1 and 31),
  dia_de_la_semana    smallint check (dia_de_la_semana between 0 and 6),
  proxima_ejecucion   date not null,
  activa              boolean not null default true,
  creada_por          uuid not null references public.perfiles (id),
  created_at          timestamptz not null default now()
);
comment on table public.movimientos_recurrentes is
  'Plantillas que generan movimientos automáticamente. El usuario elige cuáles activar.';

-- =====================================================================
-- PRESUPUESTOS (opcionales, por categoría y periodo)
-- =====================================================================

create table public.presupuestos (
  id             uuid primary key default gen_random_uuid(),
  bolsa_id       uuid not null references public.bolsas (id) on delete cascade,
  categoria_id   uuid not null references public.categorias (id),
  monto_maximo   numeric(14,2) not null check (monto_maximo > 0),
  periodo_inicio date not null,
  periodo_fin    date not null,
  activo         boolean not null default true,
  created_by     uuid not null references public.perfiles (id),
  created_at     timestamptz not null default now(),
  constraint periodo_valido check (periodo_fin >= periodo_inicio)
);

-- =====================================================================
-- SOLICITUDES DE ANULACIÓN
-- =====================================================================

create table public.solicitudes_anulacion (
  id             uuid primary key default gen_random_uuid(),
  movimiento_id  uuid not null references public.movimientos (id),
  solicitante_id uuid not null references public.perfiles (id),
  motivo         text not null,
  estado         estado_solicitud_anulacion not null default 'pendiente',
  resuelta_por   uuid references public.perfiles (id),
  resuelta_at    timestamptz,
  respuesta      text,
  created_at     timestamptz not null default now()
);

-- =====================================================================
-- CIERRES MENSUALES
-- =====================================================================

create table public.cierres_mensuales (
  id             uuid primary key default gen_random_uuid(),
  bolsa_id       uuid not null references public.bolsas (id),
  mes_contable   date not null, -- primer día del mes
  saldo_inicial  numeric(14,2) not null default 0,
  total_ingresos numeric(14,2) not null default 0,
  total_gastos   numeric(14,2) not null default 0,
  saldo_final    numeric(14,2) not null default 0,
  cerrado_por    uuid not null references public.perfiles (id),
  cerrado_at     timestamptz not null default now(),
  unique (bolsa_id, mes_contable)
);
comment on table public.cierres_mensuales is
  'Al cerrar un mes, los movimientos de ese mes quedan inmutables (movimientos.cerrado = true).';

-- =====================================================================
-- BITÁCORA DE AUDITORÍA
-- =====================================================================

create table public.auditoria (
  id           bigserial primary key,
  entidad      text not null, -- 'movimiento', 'bolsa', 'perfil', ...
  entidad_id   uuid not null,
  accion       text not null, -- 'crear', 'editar', 'anular', 'archivar', ...
  autor_id     uuid references public.perfiles (id),
  contexto     jsonb,
  created_at   timestamptz not null default now()
);
create index auditoria_entidad_idx on public.auditoria (entidad, entidad_id);
create index auditoria_autor_idx on public.auditoria (autor_id);
create index auditoria_fecha_idx on public.auditoria (created_at desc);

-- =====================================================================
-- Triggers para updated_at
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger perfiles_touch    before update on public.perfiles      for each row execute function public.set_updated_at();
create trigger preferencias_touch before update on public.preferencias_usuario for each row execute function public.set_updated_at();
create trigger bolsas_touch      before update on public.bolsas        for each row execute function public.set_updated_at();
create trigger movimientos_touch before update on public.movimientos   for each row execute function public.set_updated_at();
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
-- =====================================================================
-- BOLSAS — Row Level Security (RLS)
-- Migración 003: activa RLS en TODAS las tablas y define políticas
-- estrictas. Nadie ve saldos ni movimientos de bolsas ajenas, excepto
-- la Bolsa General (visible para sus co-dueños).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: ¿es el usuario autenticado miembro de la bolsa?
-- ---------------------------------------------------------------------
create or replace function public.es_miembro_bolsa(p_bolsa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_id
      and usuario_id = auth.uid()
  );
$$;

create or replace function public.es_dueno_bolsa(p_bolsa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bolsa_miembros
    where bolsa_id = p_bolsa_id
      and usuario_id = auth.uid()
      and rol = 'dueno'
  );
$$;

-- =====================================================================
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- =====================================================================
alter table public.perfiles                enable row level security;
alter table public.preferencias_usuario    enable row level security;
alter table public.canales_notificacion    enable row level security;
alter table public.suscripciones_evento    enable row level security;
alter table public.bolsas                  enable row level security;
alter table public.bolsa_miembros          enable row level security;
alter table public.categorias              enable row level security;
alter table public.movimientos             enable row level security;
alter table public.movimiento_adjuntos     enable row level security;
alter table public.movimientos_recurrentes enable row level security;
alter table public.presupuestos            enable row level security;
alter table public.solicitudes_anulacion   enable row level security;
alter table public.cierres_mensuales       enable row level security;
alter table public.auditoria               enable row level security;

-- =====================================================================
-- PERFILES
-- Cada uno lee/edita el suyo. Los perfiles ajenos: solo lectura de
-- campos públicos (nombre, avatar) para poder aportar y ver autores.
-- =====================================================================
create policy "perfiles: leer todos (nombre/avatar públicos)"
  on public.perfiles for select
  to authenticated
  using (true);

create policy "perfiles: actualizar solo el mío"
  on public.perfiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "perfiles: insertar solo el mío"
  on public.perfiles for insert
  to authenticated
  with check (id = auth.uid());

-- =====================================================================
-- PREFERENCIAS DE USUARIO
-- =====================================================================
create policy "preferencias: solo mías"
  on public.preferencias_usuario for all
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- =====================================================================
-- CANALES / SUSCRIPCIONES
-- =====================================================================
create policy "canales_notificacion: solo míos"
  on public.canales_notificacion for all
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "suscripciones_evento: solo mías"
  on public.suscripciones_evento for all
  to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- =====================================================================
-- BOLSAS
-- Un usuario solo ve bolsas donde es miembro. La Bolsa General es
-- visible por serlo de sus 3 co-dueños.
-- =====================================================================
create policy "bolsas: ver si soy miembro"
  on public.bolsas for select
  to authenticated
  using (public.es_miembro_bolsa(id));

create policy "bolsas: insertar (yo la creo)"
  on public.bolsas for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "bolsas: editar si soy dueño"
  on public.bolsas for update
  to authenticated
  using (public.es_dueno_bolsa(id))
  with check (public.es_dueno_bolsa(id));

-- No DELETE: se archivan con función.

-- =====================================================================
-- BOLSA_MIEMBROS
-- Ver los miembros de bolsas donde yo también soy miembro.
-- Un dueño agrega/remueve miembros de sus bolsas (no aplica en general,
-- eso se administra por seed / función especial).
-- =====================================================================
create policy "bolsa_miembros: ver si comparto la bolsa"
  on public.bolsa_miembros for select
  to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

create policy "bolsa_miembros: insertar si soy dueño"
  on public.bolsa_miembros for insert
  to authenticated
  with check (public.es_dueno_bolsa(bolsa_id));

create policy "bolsa_miembros: eliminar si soy dueño"
  on public.bolsa_miembros for delete
  to authenticated
  using (public.es_dueno_bolsa(bolsa_id) and usuario_id <> auth.uid());

-- =====================================================================
-- CATEGORÍAS
-- Catálogo compartido: todos leen; cualquier autenticado crea; solo
-- quien creó (o nadie, si es de sistema) marca como inactiva.
-- =====================================================================
create policy "categorias: todos leen"
  on public.categorias for select
  to authenticated
  using (true);

create policy "categorias: cualquiera crea"
  on public.categorias for insert
  to authenticated
  with check (creada_por = auth.uid() and es_sistema = false);

create policy "categorias: solo el autor edita las suyas"
  on public.categorias for update
  to authenticated
  using (creada_por = auth.uid() and es_sistema = false)
  with check (creada_por = auth.uid() and es_sistema = false);

-- =====================================================================
-- MOVIMIENTOS
-- Solo se ven los de bolsas donde soy miembro. Insertar: solo el autor
-- y solo en bolsas donde soy miembro. Update/Delete: bloqueado — se
-- anula con función anular_movimiento.
-- =====================================================================
create policy "movimientos: ver si soy miembro de la bolsa"
  on public.movimientos for select
  to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

-- Insertar solo con funciones (por eso limitamos a service_role vía policy estricta).
-- Como las funciones son SECURITY DEFINER, no necesitan que el usuario tenga INSERT.
-- Aún así, dejamos INSERT para movimientos simples (ingreso/gasto) via API directa:
create policy "movimientos: insertar en bolsas donde soy miembro"
  on public.movimientos for insert
  to authenticated
  with check (
    autor_id = auth.uid()
    and public.es_miembro_bolsa(bolsa_id)
    and tipo in ('ingreso', 'gasto', 'saldo_apertura', 'retiro_externo')
  );

-- No UPDATE ni DELETE desde el cliente. Anulación via función.

-- =====================================================================
-- ADJUNTOS
-- =====================================================================
create policy "adjuntos: ver si soy miembro de la bolsa del movimiento"
  on public.movimiento_adjuntos for select
  to authenticated
  using (
    exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id
        and public.es_miembro_bolsa(m.bolsa_id)
    )
  );

create policy "adjuntos: subir a mis movimientos"
  on public.movimiento_adjuntos for insert
  to authenticated
  with check (
    subido_por = auth.uid()
    and exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id
        and m.autor_id = auth.uid()
    )
  );

-- =====================================================================
-- RECURRENTES
-- =====================================================================
create policy "recurrentes: ver si soy miembro"
  on public.movimientos_recurrentes for select
  to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

create policy "recurrentes: crear si soy miembro"
  on public.movimientos_recurrentes for insert
  to authenticated
  with check (creada_por = auth.uid() and public.es_miembro_bolsa(bolsa_id));

create policy "recurrentes: editar propios"
  on public.movimientos_recurrentes for update
  to authenticated
  using (creada_por = auth.uid())
  with check (creada_por = auth.uid());

-- =====================================================================
-- PRESUPUESTOS
-- =====================================================================
create policy "presupuestos: ver si soy miembro"
  on public.presupuestos for select
  to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

create policy "presupuestos: crear si soy miembro"
  on public.presupuestos for insert
  to authenticated
  with check (created_by = auth.uid() and public.es_miembro_bolsa(bolsa_id));

create policy "presupuestos: editar propios"
  on public.presupuestos for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- =====================================================================
-- SOLICITUDES DE ANULACIÓN
-- Se ve la que yo pedí O la que va dirigida a mí (mi movimiento).
-- =====================================================================
create policy "solicitudes: ver las mías o las de mis movimientos"
  on public.solicitudes_anulacion for select
  to authenticated
  using (
    solicitante_id = auth.uid()
    or exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id and m.autor_id = auth.uid()
    )
  );

create policy "solicitudes: crear (yo solicito)"
  on public.solicitudes_anulacion for insert
  to authenticated
  with check (
    solicitante_id = auth.uid()
    and exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id
        and public.es_miembro_bolsa(m.bolsa_id)
        and m.autor_id <> auth.uid()
    )
  );

create policy "solicitudes: solo el autor del mov. resuelve"
  on public.solicitudes_anulacion for update
  to authenticated
  using (
    exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id and m.autor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id and m.autor_id = auth.uid()
    )
  );

-- =====================================================================
-- CIERRES MENSUALES
-- =====================================================================
create policy "cierres: ver si soy miembro"
  on public.cierres_mensuales for select
  to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

create policy "cierres: crear si soy miembro"
  on public.cierres_mensuales for insert
  to authenticated
  with check (cerrado_por = auth.uid() and public.es_miembro_bolsa(bolsa_id));

-- =====================================================================
-- AUDITORÍA
-- Puedo ver auditoría de mis propias acciones + auditoría de la Bolsa
-- General (para transparencia entre los 3 co-dueños).
-- =====================================================================
create policy "auditoria: ver mis acciones o de bolsas donde soy miembro"
  on public.auditoria for select
  to authenticated
  using (
    autor_id = auth.uid()
    or (
      entidad in ('bolsa', 'movimiento', 'aporte')
      and (
        (entidad = 'bolsa' and public.es_miembro_bolsa(entidad_id))
        or (entidad = 'movimiento' and exists (
              select 1 from public.movimientos m
              where m.id = auditoria.entidad_id and public.es_miembro_bolsa(m.bolsa_id)
            ))
        or (entidad = 'aporte' and exists (
              select 1 from public.movimientos m
              where m.aporte_id = auditoria.entidad_id and public.es_miembro_bolsa(m.bolsa_id)
            ))
      )
    )
  );

-- Nadie inserta manualmente en auditoría (solo funciones SECURITY DEFINER).
-- =====================================================================
-- BOLSAS — Triggers de auth y semillas iniciales.
-- Migración 004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Al crear un usuario en auth.users, generamos su perfil y preferencias.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
  );
  insert into public.preferencias_usuario (usuario_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Categorías de sistema (compartidas entre los 3 usuarios)
-- ---------------------------------------------------------------------
insert into public.categorias (nombre, tipo, color, icono, es_sistema) values
  ('Alimentación',       'gasto',   '#f97316', 'utensils',      true),
  ('Servicios (agua/luz)', 'gasto', '#0ea5e9', 'plug',          true),
  ('Renta / Hipoteca',   'gasto',   '#8b5cf6', 'home',          true),
  ('Transporte',         'gasto',   '#84cc16', 'car',           true),
  ('Salud',              'gasto',   '#ef4444', 'heart-pulse',   true),
  ('Educación',          'gasto',   '#06b6d4', 'graduation-cap',true),
  ('Ocio / Entretenimiento', 'gasto', '#ec4899', 'gamepad-2',   true),
  ('Suscripciones',      'gasto',   '#a855f7', 'repeat',        true),
  ('Ropa',               'gasto',   '#f43f5e', 'shirt',         true),
  ('Impuestos',          'gasto',   '#64748b', 'landmark',      true),
  ('Otros gastos',       'gasto',   '#475569', 'circle-ellipsis', true),
  ('Salario',            'ingreso', '#22c55e', 'briefcase',     true),
  ('Bonos / Comisiones', 'ingreso', '#10b981', 'gift',          true),
  ('Ventas',             'ingreso', '#14b8a6', 'store',         true),
  ('Intereses',          'ingreso', '#3b82f6', 'trending-up',   true),
  ('Reembolsos',         'ingreso', '#0ea5e9', 'undo-2',        true),
  ('Otros ingresos',     'ingreso', '#059669', 'circle-plus',   true);

-- ---------------------------------------------------------------------
-- Suscripciones de eventos por defecto (se disparan al crear el perfil)
-- Insertadas por trigger cuando el usuario configure canales.
-- ---------------------------------------------------------------------

-- Nota: la BOLSA GENERAL con los tres co-dueños (Nesim, Moisés, Itzyk)
-- se creará después de que ellos entren por primera vez con Magic Link
-- (para que sus auth.users existan). Ver script de bootstrap en el README.
