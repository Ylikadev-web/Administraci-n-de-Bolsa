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
