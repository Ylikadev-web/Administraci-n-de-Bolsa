-- =====================================================================
-- BOOTSTRAP — Crear la Bolsa General entre los 3 usuarios.
-- Ejecutar UNA SOLA VEZ después de que Nesim, Moisés e Itzyk hayan
-- entrado por primera vez con Magic Link (así ya existen sus perfiles).
--
-- Reemplaza los correos por los reales antes de ejecutar en SQL Editor.
-- =====================================================================

do $$
declare
  v_nesim  uuid;
  v_moises uuid;
  v_itzyk  uuid;
  v_general uuid;
  v_creator uuid;
begin
  select id into v_nesim  from public.perfiles where email = 'nesim@example.com';
  select id into v_moises from public.perfiles where email = 'moises@example.com';
  select id into v_itzyk  from public.perfiles where email = 'itzyk@example.com';

  if v_nesim is null or v_moises is null or v_itzyk is null then
    raise exception 'Faltan perfiles: asegúrate de que los 3 usuarios hayan iniciado sesión al menos una vez.';
  end if;

  -- Si ya existe una Bolsa General activa, no hacemos nada.
  if exists (select 1 from public.bolsas where es_general = true and archivada = false) then
    raise notice 'Ya existe una Bolsa General activa. Nada que hacer.';
    return;
  end if;

  v_creator := v_nesim;

  insert into public.bolsas (nombre, descripcion, color, icono, es_general, created_by)
  values ('Bolsa General', 'Bolsa compartida entre los 3 co-dueños', '#eab308', 'users', true, v_creator)
  returning id into v_general;

  insert into public.bolsa_miembros (bolsa_id, usuario_id, rol, added_by) values
    (v_general, v_nesim,  'co_dueno', v_creator),
    (v_general, v_moises, 'co_dueno', v_creator),
    (v_general, v_itzyk,  'co_dueno', v_creator);

  raise notice 'Bolsa General creada: %', v_general;
end;
$$ language plpgsql;
