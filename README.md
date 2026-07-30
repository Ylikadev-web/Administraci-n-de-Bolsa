# Bolsas

Sistema de bolsas privadas y compartidas para 3 usuarios (Nesim, Moisés e
Itzyk), con contabilidad auditable, aportes trazables entre usuarios y
saldos siempre calculados desde los movimientos.

Este PR entrega el **setup base**: proyecto Next.js listo, esquema completo
de la base de datos con RLS y funciones contables, autenticación por
Magic Link y estructura de UI con tema claro/oscuro.

---

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + RLS + Realtime + Storage)
- **Data**: TanStack Query + Zod + React Hook Form
- **Hosting sugerido**: Vercel

---

## Requisitos previos

- Node.js 20 o superior (probado con 22).
- Cuenta en [Supabase](https://supabase.com) (tier gratuito basta).
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) si quieres
  trabajar con base de datos local.

---

## Puesta en marcha (paso a paso)

### 1. Crear el proyecto Supabase

1. Entra a <https://supabase.com/dashboard>.
2. New Project → nombre `bolsas`, región cercana (US East / Central), y
   guarda la contraseña de la base de datos.
3. En **Project Settings → API** copia:
   - `URL`
   - `anon public key`
   - `service_role key` (guárdala segura, no la subas a git)

### 2. Configurar variables de entorno

Copia el archivo de ejemplo y llénalo:

```bash
cp .env.example .env.local
```

Rellena al menos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (en local: `http://localhost:3000`)

Los otros (Resend, Telegram, Twilio) son opcionales en esta fase.

### 3. Aplicar las migraciones a Supabase

Opción A — **desde el dashboard** (más sencillo):

1. Ve a **SQL Editor** en tu proyecto Supabase.
2. Pega y ejecuta, en orden, cada archivo de `supabase/migrations/`:
   1. `20260730000001_schema_base.sql`
   2. `20260730000002_funciones_y_vistas.sql`
   3. `20260730000003_rls_policies.sql`
   4. `20260730000004_triggers_y_seeds.sql`

Opción B — **con Supabase CLI**:

```bash
npx supabase link --project-ref <TU_PROJECT_REF>
npx supabase db push
```

### 4. Configurar los correos autorizados (opcional pero recomendado)

En **Auth → Providers → Email** deja habilitado el "Magic Link". Si quieres
limitar a solo los 3 usuarios, agrega sus correos en **Auth → URL
Configuration → Redirect URLs**.

Un truco útil mientras están probando: en **Auth → Rate limits** puedes
aumentar el número de OTPs por hora.

### 5. Instalar dependencias y correr

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Prueba con "Entrar" y tu correo. Recibirás
un enlace mágico; al hacer clic entras al dashboard.

### 6. Crear la Bolsa General entre los 3

Después de que los tres (Nesim, Moisés, Itzyk) hayan entrado al menos
una vez con Magic Link (para que sus perfiles existan en `public.perfiles`):

1. Edita `supabase/scripts/bootstrap_bolsa_general.sql` para poner los
   correos reales de los 3.
2. Pégalo en **SQL Editor** y ejecuta.

Listo. La Bolsa General ya existe y es visible para los tres.

---

## Modelo contable en dos frases

- **Bolsas personales** son privadas (RLS estricta). Solo el dueño ve saldo
  y movimientos. La **Bolsa General** es visible para sus tres co-dueños,
  y cada movimiento queda con el nombre de quien lo hizo.
- Nada se elimina: los movimientos se **anulan** (con motivo, autor y
  timestamp), las bolsas se **archivan** solo si su saldo es cero.

Los saldos **no se guardan** como campos: se calculan con la función
`public.saldo_bolsa(uuid)` a partir de los movimientos activos. Esto
elimina cualquier posibilidad de que el saldo se desincronice.

### Tipos de movimiento

| Tipo | Efecto en saldo | Uso |
|---|---|---|
| `saldo_apertura` | + | El monto inicial de la bolsa (único por bolsa) |
| `ingreso` | + | Entrada desde fuera del sistema (salario, venta) |
| `gasto` | − | Salida hacia fuera del sistema |
| `transferencia_interna` | ± | Movimiento entre dos bolsas mías |
| `aporte_enviado` | − | Dinero que envío a la bolsa de otro usuario |
| `aporte_recibido` | + | Dinero que otro usuario aportó a mi bolsa |
| `retiro_externo` | − | Efectivo que saco fuera del sistema (no es gasto) |

### Naturaleza de aportes (obligatoria al aportar)

- **`prestamo`**: te presto, me lo debes.
- **`pago_deuda`**: te estoy pagando lo que te debía.
- **`reembolso`**: pagaste algo mío, te lo devuelvo.
- **`cooperacion`**: aporte compartido acordado (no genera deuda).
- **`adelanto`**: dinero por adelantado por servicio/compra futura.

El sistema mantiene automáticamente `v_deudas_entre_usuarios` con el
balance neto entre pares.

---

## Estructura del repositorio

```
app/                     # Rutas Next.js (App Router)
  auth/callback/         # Callback de Magic Link
  dashboard/             # Placeholder; se llena en el próximo PR
  login/                 # Pantalla de login
components/
  providers/             # Theme + Query
  ui/                    # Componentes base (button, input, etc.)
lib/
  supabase/              # Clientes browser/server/middleware
  utils.ts               # Helpers (formato dinero, fechas)
supabase/
  config.toml            # Config para Supabase CLI local
  migrations/            # 001-004 (esquema, funciones, RLS, seeds)
  scripts/               # bootstrap_bolsa_general.sql
```

---

## Próximos PRs (roadmap corto)

1. **CRUD de bolsas + saldos** (dashboard real, tarjetas de bolsa, tema).
2. **Movimientos** (ingreso/gasto/transferencia interna + drawer lateral).
3. **Aportes entre usuarios** + libro de contribuciones de la General.
4. **Anulaciones** y solicitudes de anulación.
5. **Cierre mensual** configurable + reportes básicos.
6. **Notificaciones** por correo (Resend) y Telegram.
7. **Comprobantes** (Storage) + presupuestos + metas + recurrencia.
8. **WhatsApp** (fase final, requiere cuenta Twilio o Meta Cloud API).

---

## Comandos útiles

```bash
npm run dev         # Servidor de desarrollo
npm run build       # Build de producción
npm run lint        # Linter
npm run typecheck   # Verificación de tipos
```

---

## Seguridad

- Todas las tablas tienen **Row Level Security** activada.
- Un usuario **jamás** puede leer movimientos de una bolsa donde no es
  miembro; la lógica está en la base de datos, no en el frontend.
- Todas las escrituras contables sensibles (transferencias, aportes,
  anulaciones, archivar) pasan por funciones `SECURITY DEFINER` con
  validación explícita.
- La bitácora en `public.auditoria` registra autor + timestamp + contexto
  JSON para cada acción sensible.
