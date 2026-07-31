-- =====================================================================
-- BOOTSTRAP COMPLETO — Crea los 3 usuarios (con contraseña) + admin +
-- Bolsa General en una sola ejecución. Pensado para usarse cuando los
-- usuarios se manejan con correos ficticios que no existen en la vida
-- real, así que en lugar de Magic Link entran con email + contraseña.
--
-- Instrucciones:
--   1. Cambia las contraseñas de ejemplo antes de ejecutar.
--   2. Pega este script en el SQL Editor y ejecuta.
--   3. Al terminar, apunta los correos y contraseñas: los usuarios
--      entran en la app con "Entrar con contraseña" (login actualizado).
-- =====================================================================

do $$
declare
  -- Cambia estas contraseñas por unas que solo ustedes conozcan.
  v_pass_nesim   text := 'nesim-bolsa-2026';
  v_pass_moises  text := 'moises-bolsa-2026';
  v_pass_itzyk   text := 'itzyk-bolsa-2026';

  -- Emails "de trabajo" (no tienen que existir).
  v_email_nesim  text := 'nesim@bolsa.com';
  v_email_moises text := 'moises@bolsa.com';
  v_email_itzyk  text := 'itzyk@bolsa.com';

  v_uid_nesim  uuid;
  v_uid_moises uuid;
  v_uid_itzyk  uuid;
  v_general    uuid;
begin
  -- -------------------------------------------------------------------
  -- 1) Crear los 3 usuarios en auth.users si no existen.
  -- El trigger on_auth_user_created popula automáticamente
  -- public.perfiles y public.preferencias_usuario.
  -- -------------------------------------------------------------------
  if not exists (select 1 from auth.users where email = v_email_nesim) then
    v_uid_nesim := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_uid_nesim, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email_nesim, crypt(v_pass_nesim, gen_salt('bf')), now(),
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Nesim"}'::jsonb,
      '', '', '', ''
    );
  else
    select id into v_uid_nesim from auth.users where email = v_email_nesim;
  end if;

  if not exists (select 1 from auth.users where email = v_email_moises) then
    v_uid_moises := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_uid_moises, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email_moises, crypt(v_pass_moises, gen_salt('bf')), now(),
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Moisés"}'::jsonb,
      '', '', '', ''
    );
  else
    select id into v_uid_moises from auth.users where email = v_email_moises;
  end if;

  if not exists (select 1 from auth.users where email = v_email_itzyk) then
    v_uid_itzyk := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_uid_itzyk, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email_itzyk, crypt(v_pass_itzyk, gen_salt('bf')), now(),
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nombre":"Itzyk"}'::jsonb,
      '', '', '', ''
    );
  else
    select id into v_uid_itzyk from auth.users where email = v_email_itzyk;
  end if;

  -- Safety net: si por alguna razón el trigger de perfil no corrió,
  -- creamos los perfiles y preferencias manualmente.
  insert into public.perfiles (id, nombre, email)
  select v_uid_nesim,  'Nesim',  v_email_nesim
  where not exists (select 1 from public.perfiles where id = v_uid_nesim);
  insert into public.perfiles (id, nombre, email)
  select v_uid_moises, 'Moisés', v_email_moises
  where not exists (select 1 from public.perfiles where id = v_uid_moises);
  insert into public.perfiles (id, nombre, email)
  select v_uid_itzyk,  'Itzyk',  v_email_itzyk
  where not exists (select 1 from public.perfiles where id = v_uid_itzyk);

  insert into public.preferencias_usuario (usuario_id) select v_uid_nesim
  where not exists (select 1 from public.preferencias_usuario where usuario_id = v_uid_nesim);
  insert into public.preferencias_usuario (usuario_id) select v_uid_moises
  where not exists (select 1 from public.preferencias_usuario where usuario_id = v_uid_moises);
  insert into public.preferencias_usuario (usuario_id) select v_uid_itzyk
  where not exists (select 1 from public.preferencias_usuario where usuario_id = v_uid_itzyk);

  -- -------------------------------------------------------------------
  -- 2) Marcar a Nesim como administrador.
  -- -------------------------------------------------------------------
  update public.perfiles set es_admin = true where id = v_uid_nesim;

  -- -------------------------------------------------------------------
  -- 3) Crear la Bolsa General con los 3 co-propietarios.
  -- -------------------------------------------------------------------
  if not exists (select 1 from public.bolsas where es_general = true and archivada = false) then
    insert into public.bolsas (nombre, descripcion, color, icono, moneda, es_general, created_by)
    values (
      'Bolsa General',
      'Bolsa compartida con aprobación del administrador',
      '#eab308', 'users', 'MXN', true, v_uid_nesim
    ) returning id into v_general;

    insert into public.bolsa_miembros (bolsa_id, usuario_id, added_by) values
      (v_general, v_uid_nesim,  v_uid_nesim),
      (v_general, v_uid_moises, v_uid_nesim),
      (v_general, v_uid_itzyk,  v_uid_nesim);

    raise notice 'Bolsa General creada: %', v_general;
  else
    raise notice 'Ya existe una Bolsa General activa, no se crea otra.';
  end if;

  -- -------------------------------------------------------------------
  -- Resumen
  -- -------------------------------------------------------------------
  raise notice '================================================';
  raise notice ' BOOTSTRAP COMPLETO';
  raise notice '================================================';
  raise notice ' Nesim   → % / % (admin)', v_email_nesim,  v_pass_nesim;
  raise notice ' Moisés  → % / %', v_email_moises, v_pass_moises;
  raise notice ' Itzyk   → % / %', v_email_itzyk,  v_pass_itzyk;
  raise notice '';
  raise notice ' Cambia las contraseñas desde el perfil una vez adentro.';
end $$ language plpgsql;
