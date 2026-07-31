-- =====================================================================
-- BOLSAS v5 — Row Level Security
-- =====================================================================

alter table public.perfiles                enable row level security;
alter table public.preferencias_usuario    enable row level security;
alter table public.config_global           enable row level security;
alter table public.canales_notificacion    enable row level security;
alter table public.suscripciones_evento    enable row level security;
alter table public.bolsas                  enable row level security;
alter table public.bolsa_miembros          enable row level security;
alter table public.categorias              enable row level security;
alter table public.movimientos             enable row level security;
alter table public.movimiento_adjuntos     enable row level security;
alter table public.movimientos_recurrentes enable row level security;
alter table public.solicitudes_anulacion   enable row level security;
alter table public.cierres_mensuales       enable row level security;
alter table public.plantillas_reporte      enable row level security;
alter table public.auditoria               enable row level security;

-- ---------------------------------------------------------------------
-- PERFILES
-- ---------------------------------------------------------------------
create policy "perfiles: leer todos"
  on public.perfiles for select to authenticated using (true);
create policy "perfiles: actualizar el mío"
  on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "perfiles: insertar solo el mío"
  on public.perfiles for insert to authenticated
  with check (id = auth.uid());
create policy "perfiles: admin actualiza flags de otros"
  on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- PREFERENCIAS
-- ---------------------------------------------------------------------
create policy "preferencias: solo mías"
  on public.preferencias_usuario for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- CONFIG GLOBAL
-- ---------------------------------------------------------------------
create policy "config: todos leen"
  on public.config_global for select to authenticated using (true);
create policy "config: solo admin actualiza"
  on public.config_global for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- CANALES + SUSCRIPCIONES
-- ---------------------------------------------------------------------
create policy "canales: solo míos"
  on public.canales_notificacion for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "suscripciones: solo mías"
  on public.suscripciones_evento for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- BOLSAS
-- ---------------------------------------------------------------------
create policy "bolsas: ver si soy miembro o admin"
  on public.bolsas for select to authenticated
  using (public.es_miembro_bolsa(id) or public.es_admin());

-- Crear directamente solo bolsas propias (no general/asignadas).
create policy "bolsas: crear propia"
  on public.bolsas for insert to authenticated
  with check (
    created_by = auth.uid()
    and es_general = false
    and assigned_by_admin is null
  );

create policy "bolsas: editar si soy dueño (bolsas propias)"
  on public.bolsas for update to authenticated
  using (
    public.es_miembro_bolsa(id)
    and es_general = false
    and assigned_by_admin is null
  )
  with check (
    public.es_miembro_bolsa(id)
    and es_general = false
    and assigned_by_admin is null
  );

create policy "bolsas: admin edita todas"
  on public.bolsas for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- BOLSA_MIEMBROS
-- ---------------------------------------------------------------------
create policy "bolsa_miembros: ver si comparto la bolsa"
  on public.bolsa_miembros for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id) or public.es_admin());

-- El admin agrega miembros a cualquier bolsa; en bolsas propias solo el dueño.
create policy "bolsa_miembros: insertar"
  on public.bolsa_miembros for insert to authenticated
  with check (
    public.es_admin()
    or (public.es_miembro_bolsa(bolsa_id)
        and not exists (select 1 from public.bolsas b where b.id = bolsa_id and (b.es_general or b.assigned_by_admin is not null)))
  );

create policy "bolsa_miembros: eliminar"
  on public.bolsa_miembros for delete to authenticated
  using (
    (public.es_admin() and usuario_id <> auth.uid())
    or (public.es_miembro_bolsa(bolsa_id)
        and usuario_id <> auth.uid()
        and not exists (select 1 from public.bolsas b where b.id = bolsa_id and (b.es_general or b.assigned_by_admin is not null)))
  );

-- ---------------------------------------------------------------------
-- CATEGORÍAS (por usuario)
-- ---------------------------------------------------------------------
create policy "categorias: leer las mías"
  on public.categorias for select to authenticated
  using (usuario_id = auth.uid());
create policy "categorias: crear las mías"
  on public.categorias for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "categorias: editar las mías"
  on public.categorias for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "categorias: eliminar las mías"
  on public.categorias for delete to authenticated
  using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- MOVIMIENTOS
-- ---------------------------------------------------------------------
create policy "movimientos: ver si soy miembro o admin en General"
  on public.movimientos for select to authenticated
  using (
    public.es_miembro_bolsa(bolsa_id)
    or (public.es_admin() and exists (
      select 1 from public.bolsas b
      where b.id = bolsa_id and (b.es_general or b.assigned_by_admin is not null)
    ))
  );

-- INSERT directo desde el cliente (solo para tipos simples).
-- Los aportes y transferencias pasan por funciones SECURITY DEFINER.
create policy "movimientos: insertar simples"
  on public.movimientos for insert to authenticated
  with check (
    autor_id = auth.uid()
    and public.es_miembro_bolsa(bolsa_id)
    and tipo in ('ingreso','gasto','saldo_apertura')
  );

-- No UPDATE ni DELETE desde cliente.

-- ---------------------------------------------------------------------
-- ADJUNTOS
-- ---------------------------------------------------------------------
create policy "adjuntos: ver si soy miembro del movimiento"
  on public.movimiento_adjuntos for select to authenticated
  using (
    exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id
        and (public.es_miembro_bolsa(m.bolsa_id) or public.es_admin())
    )
  );
create policy "adjuntos: subir a mis movimientos"
  on public.movimiento_adjuntos for insert to authenticated
  with check (
    subido_por = auth.uid()
    and exists (select 1 from public.movimientos m
                where m.id = movimiento_id and m.autor_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- RECURRENTES
-- ---------------------------------------------------------------------
create policy "recurrentes: ver si soy miembro"
  on public.movimientos_recurrentes for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id));
create policy "recurrentes: crear en mis bolsas"
  on public.movimientos_recurrentes for insert to authenticated
  with check (creada_por = auth.uid() and public.es_miembro_bolsa(bolsa_id));
create policy "recurrentes: editar propias"
  on public.movimientos_recurrentes for update to authenticated
  using (creada_por = auth.uid()) with check (creada_por = auth.uid());

-- ---------------------------------------------------------------------
-- SOLICITUDES DE ANULACIÓN
-- ---------------------------------------------------------------------
create policy "solicitudes: ver las mías o dirigidas a mí"
  on public.solicitudes_anulacion for select to authenticated
  using (
    solicitante_id = auth.uid()
    or exists (select 1 from public.movimientos m
               where m.id = movimiento_id and m.autor_id = auth.uid())
  );
create policy "solicitudes: crear"
  on public.solicitudes_anulacion for insert to authenticated
  with check (
    solicitante_id = auth.uid()
    and exists (select 1 from public.movimientos m
                where m.id = movimiento_id
                  and public.es_miembro_bolsa(m.bolsa_id)
                  and m.autor_id <> auth.uid())
  );
create policy "solicitudes: resolver (solo autor del mov.)"
  on public.solicitudes_anulacion for update to authenticated
  using (
    exists (select 1 from public.movimientos m
            where m.id = movimiento_id and m.autor_id = auth.uid())
  )
  with check (
    exists (select 1 from public.movimientos m
            where m.id = movimiento_id and m.autor_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- CIERRES
-- ---------------------------------------------------------------------
create policy "cierres: ver si soy miembro"
  on public.cierres_mensuales for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id) or public.es_admin());
create policy "cierres: crear si soy miembro"
  on public.cierres_mensuales for insert to authenticated
  with check (cerrado_por = auth.uid() and public.es_miembro_bolsa(bolsa_id));

-- ---------------------------------------------------------------------
-- PLANTILLAS DE REPORTES
-- ---------------------------------------------------------------------
create policy "plantillas: solo mías"
  on public.plantillas_reporte for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- AUDITORÍA
-- ---------------------------------------------------------------------
create policy "auditoria: ver mis acciones o de bolsas donde soy miembro"
  on public.auditoria for select to authenticated
  using (
    autor_id = auth.uid()
    or public.es_admin()
    or (entidad = 'bolsa' and public.es_miembro_bolsa(entidad_id))
    or (entidad = 'movimiento' and exists (
        select 1 from public.movimientos m
        where m.id = auditoria.entidad_id and public.es_miembro_bolsa(m.bolsa_id)
    ))
    or (entidad = 'aporte' and exists (
        select 1 from public.movimientos m
        where m.aporte_id = auditoria.entidad_id and public.es_miembro_bolsa(m.bolsa_id)
    ))
  );
