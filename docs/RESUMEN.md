# Resumen del proyecto — Bolsas

![Diagrama de flujo del sistema](./diagrama-flujo-sistema.png)

## Qué es

**Bolsas** es una webapp de gestión financiera compartida diseñada para
un grupo cerrado de **tres usuarios** (Nesim, Moisés e Itzyk).

Combina dos ideas que normalmente están separadas:

- **Finanzas personales privadas**: cada usuario administra sus propios
  "sobres virtuales" (bolsas) para organizar su dinero. Ni el saldo ni
  los movimientos de una bolsa personal son visibles para los otros.
- **Fondo compartido con transparencia total**: existe una **Bolsa
  General** que los tres gestionan en conjunto, y donde cada movimiento
  queda registrado con el nombre de quien lo hizo.

Encima de eso, la aplicación permite **aportar** dinero a la bolsa de
otro usuario con una razón contable formal (préstamo, reembolso, etc.),
y lleva de forma automática el estado de cuentas entre los tres.

## Cómo funciona en 6 puntos

1. **Autenticación por Magic Link**. Cada usuario entra con su correo,
   no hay contraseñas que gestionar.
2. **Cada bolsa tiene un dueño**. La creación de una bolsa personal la
   convierte automáticamente en privada de su dueño. La Bolsa General
   se crea una única vez y sus tres co-dueños son los usuarios reales.
3. **Movimientos con 7 tipos claros**: `saldo_apertura`, `ingreso`,
   `gasto`, `transferencia_interna` (entre mis bolsas), `aporte_enviado`,
   `aporte_recibido`, `retiro_externo` (dinero al mundo real que no es
   gasto). Cada uno con signo contable definido.
4. **Aportar a otro usuario** exige elegir **naturaleza**: `prestamo`,
   `pago_deuda`, `reembolso`, `cooperacion`, `adelanto`. A partir de eso
   el sistema mantiene solo el balance neto entre pares (deudas).
5. **Nada se elimina**: los movimientos se **anulan** con motivo, autor
   y timestamp. Las bolsas se **archivan** (requieren saldo = 0).
6. **Saldos calculados**: nunca se almacenan. Se derivan de los
   movimientos activos mediante la función `saldo_bolsa()`. Imposible
   que se desincronicen.

## Privacidad y seguridad

- **Row Level Security (RLS)** activa en todas las tablas. La política
  de privacidad vive en Postgres, no en el frontend.
- Un usuario **no puede leer ni escribir** en una bolsa donde no es
  miembro, ni siquiera si conoce el UUID.
- La Bolsa General es visible por sus co-dueños y solo por ellos.
- Todas las operaciones sensibles (transferencias, aportes, anulaciones,
  archivar bolsa) pasan por funciones `SECURITY DEFINER` con validación
  explícita: monto, contraparte, autoría, saldo suficiente.
- Bitácora completa en `public.auditoria` con autor, timestamp y
  contexto JSON.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui |
| Estado / Data | TanStack Query, React Hook Form, Zod |
| Backend | Supabase (Postgres + Auth + RLS + Realtime + Storage) |
| Notificaciones | Resend (correo), Bot de Telegram propio, Twilio/Meta (WhatsApp fase 3) |
| Hosting | Vercel |

## Modelo contable resumido

- **Bolsas** = sobres virtuales. Pueden tener meta de ahorro y toggle de
  saldo negativo permitido (útil si representa una tarjeta de crédito).
- **Categorías** compartidas (17 de sistema + las que agreguen los
  usuarios). Nunca se eliminan, se marcan inactivas.
- **Partida doble implícita** en transferencias entre bolsas propias y
  en aportes entre usuarios: dos filas enlazadas por `transfer_id` /
  `aporte_id`, creadas atómicamente. Anular una anula la otra.
- **Cierre mensual** configurable: cada usuario elige día y modo
  (automático / manual). Los movimientos de un mes cerrado quedan
  inmutables; los ajustes van en el mes nuevo.
- **Vistas de reportes ya listas**:
  - `v_saldos_bolsa` — saldo y avance de meta por bolsa.
  - `v_resumen_mensual_bolsa` — ingresos/gastos por mes por bolsa.
  - `v_contribuciones_bolsa_general` — quién aportó cuánto y a nombre
    de quién se gastó en la General.
  - `v_deudas_entre_usuarios` — balance neto acreedor↔deudor.

## Personalización por usuario

Cada usuario configura desde su perfil:

- Día del cierre mensual (1, último día o personalizado).
- Modo del cierre (automático o manual con recordatorio N días antes).
- Umbral de "saldo bajo" en % para alertar.
- Canales de notificación por evento (correo / Telegram / WhatsApp).
- Zona horaria (default `America/Mexico_City`).
- Tema visual (claro / oscuro / sistema).

## Estado actual del proyecto

| PR | Contenido | Estado |
|----|-----------|--------|
| **#1** | Setup base: Next.js, auth Magic Link, esquema completo Supabase con RLS, funciones contables, seeds. | Draft, pendiente aplicar `supabase/apply_all.sql` en el dashboard. |
| **#2** | Dashboard real: lista de bolsas con saldos en vivo, crear/editar/archivar con selector de color e ícono, meta opcional, saldo inicial opcional. Página de detalle de bolsa. | Draft, depende de #1. |

## Roadmap corto (próximos PRs)

1. **#3 · Movimientos** — Registrar ingreso/gasto/transferencia interna/
   retiro externo. Lista con filtros + drawer lateral master-detail sin
   abandonar la vista de bolsa. Anular movimiento + solicitar anulación.
2. **#4 · Aportes entre usuarios** — Diálogo de aportar con naturaleza,
   libro de contribuciones de la Bolsa General, estado de deudas entre
   usuarios.
3. **#5 · Cierre mensual y reportes** — Preferencias por usuario,
   ejecución del cierre, reportes mensuales exportables.
4. **#6 · Notificaciones** — Resend (correo) + Bot de Telegram para
   eventos: aporte recibido, saldo bajo, cierre mensual, solicitud de
   anulación.
5. **#7 · Comprobantes, presupuestos, metas, recurrencia** — Adjuntar
   fotos de tickets, topes mensuales por categoría, movimientos
   recurrentes.
6. **#8 · WhatsApp** — Fase final (requiere Twilio o Meta Cloud API).

## Recordatorio de seguridad

Las claves del proyecto Supabase (URL, publishable key, y sobre todo la
`service_role JWT`) quedaron pegadas en el chat de este agente. La
`service_role` **omite toda la RLS**. Ir a Supabase Dashboard → Project
Settings → API → **Rotate** en cuanto sea posible, y actualizar el
`.env.local` / secrets de Vercel con el nuevo valor.
