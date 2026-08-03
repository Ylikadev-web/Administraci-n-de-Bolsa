-- =====================================================================
-- FIX PRIVACIDAD v5.1
-- Problema: policy "bolsas: ver si soy miembro o admin" permitía a Nesim
-- ver bolsas propias ajenas. Eso viola privacidad financiera.
--
-- Solución:
--   1) Ver bolsas SOLO si soy miembro.
--   2) Al asignar una bolsa, el admin también queda como miembro
--      (para aprobar movimientos sin bypass global).
--   3) saldo_bolsa / saldo_total solo para miembros.
-- =====================================================================

-- 1) Asignar: admin también es miembro
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
  if p_usuario_asignado is null then
    raise exception 'Debes indicar el usuario asignado';
  end if;
  if p_usuario_asignado = v_uid then
    raise exception 'Usa "Nueva bolsa" para crear una bolsa propia';
  end if;

  insert into public.bolsas (nombre, descripcion, color, icono, moneda,
                             assigned_by_admin, permite_saldo_negativo, created_by)
  values (p_nombre, p_descripcion, coalesce(p_color, '#4f46e5'), p_icono,
          coalesce(p_moneda, 'MXN'), v_uid,
          coalesce(p_permite_saldo_negativo, false), v_uid)
  returning id into v_bolsa_id;

  -- Asignado + admin (para ver/aprobar sin romper privacidad global)
  insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
  values (v_bolsa_id, p_usuario_asignado, v_uid)
  on conflict do nothing;

  insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
  values (v_bolsa_id, v_uid, v_uid)
  on conflict do nothing;

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

-- 2) Saldo solo para miembros (sin bypass admin)
create or replace function public.saldo_bolsa(p_bolsa_id uuid)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result numeric;
begin
  if v_uid is null then return null; end if;
  if not public.es_miembro_bolsa(p_bolsa_id) then
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

-- 3) Policies: solo miembros ven bolsas
drop policy if exists "bolsas: ver si soy miembro o admin" on public.bolsas;
create policy "bolsas: ver solo si soy miembro"
  on public.bolsas for select to authenticated
  using (public.es_miembro_bolsa(id));

drop policy if exists "bolsa_miembros: ver si comparto la bolsa" on public.bolsa_miembros;
create policy "bolsa_miembros: ver si soy miembro"
  on public.bolsa_miembros for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

-- Movimientos: miembros; admin solo en general/asignada donde ya es miembro
-- (tras el fix de asignar, admin es miembro). Se elimina bypass amplio.
drop policy if exists "movimientos: ver si soy miembro o admin en General" on public.movimientos;
create policy "movimientos: ver si soy miembro"
  on public.movimientos for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

drop policy if exists "cierres: ver si soy miembro" on public.cierres_mensuales;
create policy "cierres: ver si soy miembro"
  on public.cierres_mensuales for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

drop policy if exists "adjuntos: ver si soy miembro del movimiento" on public.movimiento_adjuntos;
create policy "adjuntos: ver si soy miembro del movimiento"
  on public.movimiento_adjuntos for select to authenticated
  using (
    exists (
      select 1 from public.movimientos m
      where m.id = movimiento_id
        and public.es_miembro_bolsa(m.bolsa_id)
    )
  );

-- Auditoría: sin bypass admin global de todo
drop policy if exists "auditoria: ver mis acciones o de bolsas donde soy miembro" on public.auditoria;
create policy "auditoria: ver mis acciones o de mis bolsas"
  on public.auditoria for select to authenticated
  using (
    autor_id = auth.uid()
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

-- Admin sigue pudiendo EDITAR metadata de bolsas asignadas/general (no propias ajenas)
drop policy if exists "bolsas: admin edita todas" on public.bolsas;
create policy "bolsas: admin edita general y asignadas"
  on public.bolsas for update to authenticated
  using (
    public.es_admin()
    and (es_general = true or assigned_by_admin is not null)
  )
  with check (
    public.es_admin()
    and (es_general = true or assigned_by_admin is not null)
  );

-- Datos de remediación (idempotente): si quedó una "Bolsa Moisés" creada
-- por error como propia de Nesim, conviértela en asignada.
DO $$
DECLARE
  v_admin uuid;
  v_moises uuid;
  v_bag uuid;
BEGIN
  select id into v_admin from public.perfiles where email = 'nesim@bolsa.com';
  select id into v_moises from public.perfiles where email = 'moises@bolsa.com';
  select id into v_bag from public.bolsas
    where nombre ilike 'Bolsa Moisés%' and created_by = v_admin and archivada = false
    order by created_at desc limit 1;
  if v_bag is not null and v_moises is not null then
    update public.bolsas set assigned_by_admin = v_admin where id = v_bag;
    insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by)
    values (v_bag, v_moises, v_admin)
    on conflict do nothing;
  end if;
END $$;
