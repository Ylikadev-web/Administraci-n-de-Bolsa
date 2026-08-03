-- =====================================================================
-- SEGURO: vistas API + revocar acceso anónimo
-- Problema: las vistas en public se crearon como security definer
-- (badge UNRESTRICTED en Studio) y bypassean RLS. Con la anon key
-- cualquiera podía leer nombres de bolsas, totales mensuales, etc.
--
-- Fix:
--   1) security_invoker = true → respetan RLS del caller
--   2) REVOKE a rol anon en tablas/vistas/funciones públicas
-- =====================================================================

-- 1) Vistas: forzar security invoker (Postgres 15+)
alter view public.v_saldos_bolsa                 set (security_invoker = true);
alter view public.v_resumen_mensual_bolsa        set (security_invoker = true);
alter view public.v_contribuciones_bolsa_general set (security_invoker = true);
alter view public.v_prestamos_activos            set (security_invoker = true);
alter view public.v_deudas_entre_usuarios        set (security_invoker = true);

-- 2) Quitar acceso al rol anon (sin JWT de usuario)
--    Las tablas ya tienen RLS; esto es defensa en profundidad.
--    authenticated + service_role siguen con grants.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Reafirmar grants para roles legítimos
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Vistas: solo lectura para authenticated (no anon)
grant select on
  public.v_saldos_bolsa,
  public.v_resumen_mensual_bolsa,
  public.v_contribuciones_bolsa_general,
  public.v_prestamos_activos,
  public.v_deudas_entre_usuarios
to authenticated;

grant select on
  public.v_saldos_bolsa,
  public.v_resumen_mensual_bolsa,
  public.v_contribuciones_bolsa_general,
  public.v_prestamos_activos,
  public.v_deudas_entre_usuarios
to service_role;

-- 3) Defaults: objetos nuevos no heredan grants a anon
alter default privileges in schema public
  revoke all on tables from anon;
alter default privileges in schema public
  revoke all on sequences from anon;
alter default privileges in schema public
  revoke execute on functions from anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
