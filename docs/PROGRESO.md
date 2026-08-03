# Progreso del sistema Bolsas

Actualizado: 2026-08-03

## Listo en app (≈ 65–70%)

| Módulo | Estado |
|--------|--------|
| Auth (contraseña + magic link) | ✅ |
| Dashboard de bolsas | ✅ |
| Bolsa propia / General / asignada | ✅ |
| Movimientos + aprobaciones | ✅ |
| Campana de notificaciones (Nesim) | ✅ |
| Privacidad por membresía (UI + SQL) | ✅ |
| Hardening API vistas (security_invoker + revoke anon) | ⏳ aplicar SQL en Studio |

## Qué falta desarrollar en UI (para ir “super avanzados”)

Orden recomendado (mayor impacto primero):

| # | Módulo | Por qué | Esfuerzo técnico |
|---|--------|---------|------------------|
| 1 | **Reportes** | No hay pantalla; solo tabla `plantillas_reporte` | Nueva ruta + filtros + export CSV/PDF |
| 2 | **Aportes** entre usuarios | RPC `crear_aporte` listo | Formulario + historial |
| 3 | **Préstamos** (“Me deben / Yo debo”) | Vistas SQL listas (tras fix seguridad) | Tabs + plazos + pagos |
| 4 | **Anular** movimiento con motivo | RPC listo | Acción + diálogo motivo |
| 5 | **Categorías** | Schema listo; UI manda `null` | CRUD + select en movimientos |
| 6 | Sub-bolsas / transferencias internas | Schema + RPC | UI compartimentos |
| 7 | Umbral saldo bajo + alertas | Config/RPC | Settings + aviso en campana |
| 8 | Email / Telegram | Tablas env | Integración canales |
| 9 | Cierre mensual | Schema | Flujo admin fin de mes |

## Sobre “Reportes”

No aparece en el menú porque **aún no está construido**. Es el siguiente bloque natural para cerrar el ciclo operativo (ver → mover → aprobar → reportar).

## Seguridad API (esta entrega)

Ver `docs/SEGURIDAD-API.md` y ejecutar `supabase/scripts/SEGURO_VISTAS_API.sql` en el SQL Editor.
