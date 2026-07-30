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
