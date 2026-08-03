# Base de datos — instrucciones rápidas (esquema v5)

## 1. Aplicar el esquema completo

1. Abre tu proyecto Supabase → **SQL Editor** → **New query**.
2. Copia todo el contenido de [`apply_all.sql`](./apply_all.sql) y pégalo.
3. Presiona **Run**.
4. Deberías ver "Success. No rows returned".

## 2. Crear los 3 usuarios y la Bolsa General

Hay dos formas según cómo quieran manejar el acceso.

### Opción A — Emails ficticios + contraseña (recomendada si no quieren usar correos reales)

Un solo script crea los 3 usuarios en `auth.users`, marca a Nesim
como admin y crea la Bolsa General con los 3 co-propietarios.

1. Abre [`scripts/bootstrap_completo.sql`](./scripts/bootstrap_completo.sql).
2. Cambia las **contraseñas de ejemplo** por unas propias (las variables
   `v_pass_nesim`, `v_pass_moises`, `v_pass_itzyk` al inicio del bloque).
3. Cambia los correos si quieres otros nombres (por defecto
   `nesim@bolsa.com`, `moises@bolsa.com`, `itzyk@bolsa.com`).
4. Pega el bloque en SQL Editor y ejecuta.
5. Al terminar, la salida "Messages" del SQL Editor muestra los tres
   pares correo/contraseña. Guárdalos y compártelos con cada usuario.
6. En la app, cada uno entra con **email + contraseña** (el login soporta
   ambos métodos).

### Opción B — Emails reales + Magic Link

Solo si cada usuario tiene un correo real donde recibir el enlace.

1. Cada persona entra a la app y solicita Magic Link con su correo real.
2. Después de que los 3 hayan entrado al menos una vez, ejecuta
   [`scripts/bootstrap.sql`](./scripts/bootstrap.sql) reemplazando los
   correos por los reales. Ese script solo marca al admin y crea la
   Bolsa General (los perfiles ya existirán por el flujo de Magic Link).

## 3. Verificar

```sql
select
  (select count(*) from public.perfiles)                        as perfiles,
  (select count(*) from public.perfiles where es_admin)          as admins,
  (select count(*) from public.bolsas where es_general and not archivada) as bolsa_general;
```

Esperado tras el bootstrap:

- `perfiles` = 3
- `admins` = 1 (Nesim)
- `bolsa_general` = 1

## 4. Seguridad API (vistas UNRESTRICTED)

Si en Table Editor las vistas muestran badge **UNRESTRICTED**, ejecuta de inmediato:

[`scripts/SEGURO_VISTAS_API.sql`](./scripts/SEGURO_VISTAS_API.sql)

Detalle: [`docs/SEGURIDAD-API.md`](../docs/SEGURIDAD-API.md).

## Cambiar contraseñas después


En Supabase Dashboard → **Authentication → Users** → editar el usuario
→ "Send password recovery" (si el correo es real) o "Change password"
directamente. Alternativamente, cuando el perfil tenga edición desde la
app (próximo PR), cada usuario podrá cambiar la suya.
