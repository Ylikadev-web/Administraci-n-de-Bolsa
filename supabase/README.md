# Base de datos — instrucciones rápidas (esquema v5)

## Aplicar el esquema completo

1. Abre tu proyecto Supabase → **SQL Editor** → **New query**.
2. Copia el contenido de [`apply_all.sql`](./apply_all.sql) y pégalo.
3. Presiona **Run** (`Cmd/Ctrl + Enter`).
4. Debería ver "Success. No rows returned".

Si prefieres aplicar por archivos, ejecuta en orden los 4 archivos de
[`migrations/`](./migrations/).

## Bootstrap (una sola vez)

Cuando los tres usuarios (Nesim, Moisés, Itzyk) hayan iniciado sesión
al menos una vez con Magic Link:

1. Abre [`scripts/bootstrap.sql`](./scripts/bootstrap.sql).
2. Cambia los correos de ejemplo por los reales.
3. Pega en SQL Editor y ejecuta.

Esto marca a Nesim como administrador y crea la Bolsa General con los
tres como co-propietarios.

## Verificar

```sql
select
  (select count(*) from public.perfiles)                    as perfiles,
  (select count(*) from public.perfiles where es_admin)      as admins,
  (select count(*) from public.bolsas where es_general)      as bolsa_general,
  (select count(*) from information_schema.tables
     where table_schema = 'public')                          as tablas_publicas;
```

Esperado tras el bootstrap:

- `perfiles` = 3
- `admins` = 1 (Nesim)
- `bolsa_general` = 1
- `tablas_publicas` = ~15
