# Seguridad API — vistas y rol anon

**Fecha:** 2026-08-03  
**Script urgente:** `supabase/scripts/SEGURO_VISTAS_API.sql`

## Qué pasaba

En el Table Editor de Supabase:

| Señal | Significado |
|-------|-------------|
| Ícono de globo en tablas | Normal: están en el schema `public` expuesto al Data API. La protección real es **RLS**. |
| Badge **UNRESTRICTED** en vistas | Peligroso: la vista corre como dueño y **bypassea RLS**. |

Con solo la `anon` key (sin login) se podía leer:

- Nombres de todas las bolsas (`v_saldos_bolsa`)
- Totales de ingresos/gastos por mes (`v_resumen_mensual_bolsa`)
- Contribuciones / gastos en General (`v_contribuciones_bolsa_general`)

Las tablas con RLS ya devolvían `[]` sin JWT; el agujero eran las **vistas**.

## Fix

1. `ALTER VIEW … SET (security_invoker = true)` en las 5 vistas → respetan RLS del usuario.
2. `REVOKE` de permisos al rol `anon` en tablas, secuencias y funciones de `public`.
3. `authenticated` y `service_role` conservan acceso (con RLS).

## Cómo aplicar (obligatorio en el proyecto live)

1. Abre [SQL Editor](https://supabase.com/dashboard/project/chzzzvyljkqsofpjyqgr/sql/new)
2. Pega y ejecuta el contenido de `supabase/scripts/SEGURO_VISTAS_API.sql`
3. Verifica: las vistas ya no deben mostrar **UNRESTRICTED**
4. Prueba pública (sin login) a `/rest/v1/v_saldos_bolsa` → vacío o 401/permiso denegado

## Nota sobre el globo

Las tablas seguirán con ícono de API mientras vivan en `public`. Eso **no** significa “cualquiera lee los datos” si RLS + revoke anon están aplicados. Solo mueve a un schema privado lo que nunca deba pasar por PostgREST.
