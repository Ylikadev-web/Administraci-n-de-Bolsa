-- =====================================================================
-- BOLSAS — Esquema v5
-- Migración 001: tipos, tablas base y comentarios.
--
-- Cambios respecto a versiones anteriores:
--   - Sin retiro_externo ni adelanto.
--   - Nesim = administrador (perfiles.es_admin).
--   - Sub-bolsas como compartimentos (bolsas.parent_id).
--   - Bolsas asignadas por Nesim (bolsas.assigned_by_admin).
--   - Categorías por usuario (sin catálogo por defecto).
--   - Movimientos con estado pendiente_aprobacion / activo / rechazado
--     / anulado, con fecha_solicitud y fecha_ejecucion.
--   - Préstamos con plazo y vínculo pago_deuda/reembolso <-> préstamo.
--   - Plantillas de reportes por usuario.
--   - Sin tabla de presupuestos.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ---------------------------------------------------------------------

create type public.tipo_movimiento as enum (
  'saldo_apertura',
  'ingreso',
  'gasto',
  'transferencia_interna',
  'aporte_enviado',
  'aporte_recibido'
);

create type public.naturaleza_aporte as enum (
  'prestamo',
  'pago_deuda',
  'reembolso',
  'cooperacion'
);

create type public.estado_movimiento as enum (
  'pendiente_aprobacion',
  'activo',
  'rechazado',
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

create type public.estado_solicitud_anulacion as enum (
  'pendiente',
  'aprobada',
  'rechazada'
);

-- ---------------------------------------------------------------------
-- USUARIOS Y PERFILES
-- ---------------------------------------------------------------------

create table public.perfiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  nombre       text not null,
  email        text not null unique,
  avatar_url   text,
  es_admin     boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.perfiles is
  'Datos editables del usuario. `es_admin=true` = administrador (Nesim). `activo=false` desactiva la cuenta.';

-- Preferencias por usuario.
create table public.preferencias_usuario (
  usuario_id                uuid primary key references public.perfiles (id) on delete cascade,
  zona_horaria              text not null default 'America/Mexico_City',
  moneda_default            text not null default 'MXN',
  tema                      text not null default 'system' check (tema in ('light','dark','system')),
  cierre_modo               modo_cierre not null default 'automatico',
  cierre_dia_mes            smallint not null default 1 check (cierre_dia_mes between 1 and 31),
  cierre_recordatorio_dias  smallint not null default 3,
  updated_at                timestamptz not null default now()
);

-- Configuración global del sistema (solo Nesim la modifica).
create table public.config_global (
  id                                    smallint primary key default 1 check (id = 1),
  umbral_saldo_bajo_bolsa_general_pct   numeric(5,2) not null default 10.00,
  updated_at                            timestamptz not null default now(),
  updated_by                            uuid references public.perfiles (id)
);

-- Canales de notificación por usuario.
create table public.canales_notificacion (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references public.perfiles (id) on delete cascade,
  canal              canal_notificacion not null,
  identificador      text not null,
  verificado         boolean not null default false,
  token_verificacion text,
  created_at         timestamptz not null default now(),
  unique (usuario_id, canal)
);

-- Suscripciones a eventos por canal.
create table public.suscripciones_evento (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  evento      text not null,   -- 'aporte_pendiente', 'saldo_bajo', 'prestamo_vencer', ...
  canal       canal_notificacion not null,
  activo      boolean not null default true,
  unique (usuario_id, evento, canal)
);

-- ---------------------------------------------------------------------
-- BOLSAS
-- ---------------------------------------------------------------------

create table public.bolsas (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  descripcion            text,
  color                  text not null default '#4f46e5',
  icono                  text,
  moneda                 text not null default 'MXN',
  es_general             boolean not null default false,
  parent_id              uuid references public.bolsas (id) on delete restrict,
  assigned_by_admin      uuid references public.perfiles (id),  -- si no es null, la bolsa la asignó Nesim
  archivada              boolean not null default false,
  archivada_at           timestamptz,
  permite_saldo_negativo boolean not null default false,
  meta_habilitada        boolean not null default false,
  meta_monto             numeric(14,2),
  meta_fecha             date,
  created_by             uuid not null references public.perfiles (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint meta_valida check (
    (meta_habilitada = false)
    or (meta_habilitada = true and meta_monto is not null and meta_monto > 0)
  ),
  constraint general_sin_meta check (
    not (es_general = true and meta_habilitada = true)
  ),
  constraint general_sin_parent check (
    not (es_general = true and parent_id is not null)
  )
);
comment on table public.bolsas is
  'Bolsa personal, asignada o general. Las sub-bolsas son compartimentos del padre (parent_id).';

-- Solo puede existir UNA bolsa general activa.
create unique index bolsas_una_general_activa
  on public.bolsas (es_general)
  where es_general = true and archivada = false;

-- Miembros (dueños/co-dueños) por bolsa. La Bolsa General usa esta
-- tabla para sus co-propietarios; las bolsas personales/asignadas
-- típicamente tienen un solo miembro (el dueño / asignado).
create table public.bolsa_miembros (
  bolsa_id   uuid not null references public.bolsas (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  added_by   uuid references public.perfiles (id),
  created_at timestamptz not null default now(),
  primary key (bolsa_id, usuario_id)
);

-- ---------------------------------------------------------------------
-- CATEGORÍAS (por usuario)
-- ---------------------------------------------------------------------
create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  nombre      text not null,
  tipo        text not null check (tipo in ('ingreso','gasto','ambos')),
  color       text not null default '#64748b',
  icono       text,
  created_at  timestamptz not null default now(),
  unique (usuario_id, nombre, tipo)
);
comment on table public.categorias is
  'Cada usuario mantiene su propio catálogo. Al eliminar, los movimientos que la usaban quedan como Sin categoría (categoria_id = NULL).';

-- ---------------------------------------------------------------------
-- MOVIMIENTOS (corazón contable)
-- ---------------------------------------------------------------------
create table public.movimientos (
  id                       uuid primary key default gen_random_uuid(),
  bolsa_id                 uuid not null references public.bolsas (id),
  tipo                     tipo_movimiento not null,
  monto                    numeric(14,2) not null check (monto > 0),
  moneda                   text not null default 'MXN',
  categoria_id             uuid references public.categorias (id) on delete set null,
  descripcion              text,
  fecha_solicitud          date not null default (now() at time zone 'utc')::date,
  fecha_ejecucion          date,
  estado                   estado_movimiento not null default 'activo',
  -- Autoría
  autor_id                 uuid not null references public.perfiles (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Aprobación
  aprobado_por             uuid references public.perfiles (id),
  aprobado_at              timestamptz,
  motivo_rechazo           text,
  -- Anulación
  anulado_at               timestamptz,
  anulado_por              uuid references public.perfiles (id),
  motivo_anulacion         text,
  -- Vínculos
  transfer_id              uuid,
  aporte_id                uuid,
  prestamo_id              uuid references public.movimientos (id) on delete set null,
  -- Préstamos
  plazo_dias               integer check (plazo_dias > 0),
  fecha_vencimiento        date,
  naturaleza_aporte        naturaleza_aporte,
  contraparte_bolsa_id     uuid references public.bolsas (id),
  contraparte_usuario_id   uuid references public.perfiles (id),
  -- Cierre
  mes_contable             date not null default date_trunc('month', now())::date,
  cerrado                  boolean not null default false,
  constraint estado_coherente check (
    (estado = 'anulado' and anulado_at is not null and anulado_por is not null and motivo_anulacion is not null)
    or (estado = 'rechazado' and motivo_rechazo is not null and aprobado_por is not null)
    or (estado = 'activo' and (anulado_at is null))
    or (estado = 'pendiente_aprobacion')
  ),
  constraint aporte_requiere_naturaleza check (
    (tipo not in ('aporte_enviado','aporte_recibido'))
    or (naturaleza_aporte is not null)
  ),
  constraint prestamo_requiere_plazo check (
    (naturaleza_aporte is distinct from 'prestamo') or (plazo_dias is not null)
  ),
  constraint pago_reembolso_requieren_prestamo check (
    (naturaleza_aporte is null or naturaleza_aporte in ('prestamo','cooperacion'))
    or (prestamo_id is not null)
  )
);

comment on table public.movimientos is
  'Cada evento contable. Nunca se elimina (solo se anula). Estados: pendiente_aprobacion / activo / rechazado / anulado. Solo `activo` cuenta para saldo.';

-- Índices para reportes.
create index movimientos_bolsa_fecha_idx    on public.movimientos (bolsa_id, fecha_solicitud desc);
create index movimientos_autor_idx          on public.movimientos (autor_id);
create index movimientos_estado_idx         on public.movimientos (estado);
create index movimientos_mes_contable_idx   on public.movimientos (mes_contable);
create index movimientos_tipo_idx           on public.movimientos (tipo);
create index movimientos_transfer_id_idx    on public.movimientos (transfer_id) where transfer_id is not null;
create index movimientos_aporte_id_idx      on public.movimientos (aporte_id)   where aporte_id is not null;
create index movimientos_prestamo_idx       on public.movimientos (prestamo_id) where prestamo_id is not null;
create index movimientos_vencimiento_idx    on public.movimientos (fecha_vencimiento)
  where naturaleza_aporte = 'prestamo' and estado = 'activo';

-- Solo un movimiento de apertura activo por bolsa.
create unique index movimientos_apertura_unica
  on public.movimientos (bolsa_id)
  where tipo = 'saldo_apertura' and estado = 'activo';

-- ---------------------------------------------------------------------
-- ADJUNTOS (comprobantes)
-- ---------------------------------------------------------------------
create table public.movimiento_adjuntos (
  id            uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references public.movimientos (id) on delete cascade,
  storage_path  text not null,
  nombre        text not null,
  mime_type     text,
  tamano_bytes  bigint,
  subido_por    uuid not null references public.perfiles (id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RECURRENTES (movimientos periódicos)
-- ---------------------------------------------------------------------
create table public.movimientos_recurrentes (
  id                uuid primary key default gen_random_uuid(),
  bolsa_id          uuid not null references public.bolsas (id) on delete cascade,
  tipo              tipo_movimiento not null,
  monto             numeric(14,2) not null check (monto > 0),
  categoria_id      uuid references public.categorias (id) on delete set null,
  descripcion       text,
  frecuencia        text not null check (frecuencia in ('diaria','semanal','quincenal','mensual','anual')),
  dia_del_mes       smallint check (dia_del_mes between 1 and 31),
  dia_de_la_semana  smallint check (dia_de_la_semana between 0 and 6),
  proxima_ejecucion date not null,
  activa            boolean not null default true,
  creada_por        uuid not null references public.perfiles (id),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SOLICITUDES DE ANULACIÓN
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- CIERRES MENSUALES
-- ---------------------------------------------------------------------
create table public.cierres_mensuales (
  id             uuid primary key default gen_random_uuid(),
  bolsa_id       uuid not null references public.bolsas (id),
  mes_contable   date not null,
  saldo_inicial  numeric(14,2) not null default 0,
  total_ingresos numeric(14,2) not null default 0,
  total_gastos   numeric(14,2) not null default 0,
  saldo_final    numeric(14,2) not null default 0,
  cerrado_por    uuid not null references public.perfiles (id),
  cerrado_at     timestamptz not null default now(),
  unique (bolsa_id, mes_contable)
);

-- ---------------------------------------------------------------------
-- PLANTILLAS DE REPORTES (por usuario, privadas)
-- ---------------------------------------------------------------------
create table public.plantillas_reporte (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  nombre      text not null,
  filtros     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (usuario_id, nombre)
);

-- ---------------------------------------------------------------------
-- AUDITORÍA
-- ---------------------------------------------------------------------
create table public.auditoria (
  id          bigserial primary key,
  entidad     text not null,      -- 'movimiento', 'bolsa', 'perfil', 'aprobacion', ...
  entidad_id  uuid not null,
  accion      text not null,      -- 'crear', 'aprobar', 'rechazar', 'anular', 'archivar', ...
  autor_id    uuid references public.perfiles (id),
  contexto    jsonb,
  created_at  timestamptz not null default now()
);
create index auditoria_entidad_idx on public.auditoria (entidad, entidad_id);
create index auditoria_autor_idx   on public.auditoria (autor_id);
create index auditoria_fecha_idx   on public.auditoria (created_at desc);

-- ---------------------------------------------------------------------
-- TRIGGERS de updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger perfiles_touch     before update on public.perfiles              for each row execute function public.set_updated_at();
create trigger preferencias_touch before update on public.preferencias_usuario  for each row execute function public.set_updated_at();
create trigger bolsas_touch       before update on public.bolsas                for each row execute function public.set_updated_at();
create trigger movimientos_touch  before update on public.movimientos           for each row execute function public.set_updated_at();
create trigger plantillas_touch   before update on public.plantillas_reporte    for each row execute function public.set_updated_at();

-- Config global inicial (una sola fila).
insert into public.config_global (id, umbral_saldo_bajo_bolsa_general_pct) values (1, 10.00);
