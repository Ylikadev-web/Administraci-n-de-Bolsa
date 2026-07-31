-- =====================================================================
-- BOLSAS v5 — Triggers de auth (perfil automático)
-- =====================================================================

-- Al crear un usuario en auth.users, generamos su perfil y preferencias.
-- Si el correo del nuevo usuario coincide con la variable `admin_email`
-- (configurable), lo marcamos como administrador automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_es_admin boolean := false;
  v_admin_email text;
begin
  -- Leer email admin desde config si existe (no lo tenemos aún, así que
  -- lo dejamos para el bootstrap). Por defecto ningún usuario es admin
  -- automáticamente; el primero se marca con el script de bootstrap.
  v_admin_email := null;
  if v_admin_email is not null and new.email = v_admin_email then
    v_es_admin := true;
  end if;

  insert into public.perfiles (id, email, nombre, es_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    v_es_admin
  );
  insert into public.preferencias_usuario (usuario_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
