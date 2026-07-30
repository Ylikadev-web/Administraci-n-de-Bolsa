# Base de datos — instrucciones rápidas

## Aplicar todo el esquema de un jalón

1. Entra a tu proyecto Supabase → **SQL Editor** → **New query**.
2. Abre el archivo [`apply_all.sql`](./apply_all.sql) en tu editor local
   (VS Code, Cursor, etc.) y **copia todo su contenido**.
3. Pégalo en el SQL Editor y presiona **Run** (botón verde arriba a la
   derecha, atajo `Cmd/Ctrl + Enter`).
4. Deberías ver "Success. No rows returned" — significa que se
   crearon todas las tablas, funciones, vistas, políticas y semillas.

Si prefieres aplicarlo por archivos individuales para ver el progreso,
usa los 4 archivos en [`migrations/`](./migrations/) en orden numérico.

## Crear la Bolsa General entre los 3 usuarios

Una vez que **Nesim, Moisés e Itzyk** hayan entrado al menos una vez a
la webapp con Magic Link (para que sus perfiles existan en
`public.perfiles`):

1. Abre [`scripts/bootstrap_bolsa_general.sql`](./scripts/bootstrap_bolsa_general.sql).
2. Reemplaza los correos de ejemplo por los reales.
3. Pégalo en SQL Editor y ejecuta.

## Verificar que todo quedó bien

En el SQL Editor, corre esta consulta:

```sql
select
  (select count(*) from public.categorias where es_sistema) as categorias_sistema,
  (select count(*) from public.perfiles)                    as perfiles,
  (select count(*) from public.bolsas)                      as bolsas,
  (select count(*) from information_schema.tables
     where table_schema = 'public')                         as tablas_publicas;
```

Esperado tras aplicar `apply_all.sql`:

- `categorias_sistema` = **17**
- `tablas_publicas` = **14** (o similar)
- `perfiles` = 0 hasta que alguien entre
- `bolsas` = 0 hasta que se cree la Bolsa General

## Regenerar tipos TypeScript (opcional, para desarrollo)

Requiere Supabase CLI y un Personal Access Token
(<https://supabase.com/dashboard/account/tokens>).

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
npx supabase gen types typescript \
  --project-id chzzzvyljkqsofpjyqgr \
  > lib/supabase/types.ts
```
