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
