-- =====================================================================
-- BOOTSTRAP — Pasos iniciales tras aplicar el esquema.
-- Ejecutar en orden después de que los 3 usuarios (Nesim, Moisés,
-- Itzyk) hayan entrado con Magic Link al menos una vez.
--
-- Reemplaza los correos por los reales antes de ejecutar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Marcar a Nesim como administrador.
-- ---------------------------------------------------------------------
update public.perfiles
   set es_admin = true
 where email = 'nesim@example.com';

-- Verificar:
-- select id, email, es_admin from public.perfiles where email = 'nesim@example.com';

-- ---------------------------------------------------------------------
-- 2) Crear la Bolsa General (Nesim la crea; escoge co-propietarios).
-- Esto solo funciona ejecutado como Nesim (via auth.uid()); desde el
-- SQL Editor con service_role, ajustar RLS o usar el bloque manual:
-- ---------------------------------------------------------------------
do $$
declare
  v_nesim  uuid;
  v_moises uuid;
  v_itzyk  uuid;
  v_general uuid;
begin
  select id into v_nesim  from public.perfiles where email = 'nesim@example.com';
  select id into v_moises from public.perfiles where email = 'moises@example.com';
  select id into v_itzyk  from public.perfiles where email = 'itzyk@example.com';

  if v_nesim is null or v_moises is null or v_itzyk is null then
    raise exception 'Faltan perfiles. Asegúrate de que los 3 usuarios hayan iniciado sesión al menos una vez.';
  end if;

  if exists (select 1 from public.bolsas where es_general = true and archivada = false) then
    raise notice 'Ya existe una Bolsa General activa. Nada que hacer.';
    return;
  end if;

  insert into public.bolsas (nombre, descripcion, color, icono, moneda, es_general, created_by)
  values ('Bolsa General',
          'Bolsa compartida con aprobación del administrador',
          '#eab308', 'users', 'MXN', true, v_nesim)
  returning id into v_general;

  insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by) values
    (v_general, v_nesim,  v_nesim),
    (v_general, v_moises, v_nesim),
    (v_general, v_itzyk,  v_nesim);

  raise notice 'Bolsa General creada: %', v_general;
end;
$$ language plpgsql;
