# Progreso del sistema Bolsas

Actualizado: 2026-08-03

## Listo en app (≈ 90%)

| Módulo | Estado |
|--------|--------|
| Auth | ✅ |
| Dashboard / bolsas propia·general·asignada | ✅ |
| Movimientos + aprobaciones + campana | ✅ |
| Privacidad + hardening API vistas | ✅ |
| Reportes (filtros + CSV) | ✅ |
| **Aportes / préstamos** (dialog en bolsa) | ✅ |
| **Préstamos** Me deben / Yo debo + pagar | ✅ |
| **Anular** movimiento con motivo | ✅ |

## Qué falta (≈ 10%)

| Módulo | Notas |
|--------|--------|
| Categorías | Schema listo; UI aún manda `null` |
| Sub-bolsas / transferencias internas | Schema + RPC; sin UI |
| Alertas saldo bajo / email-Telegram | Config; sin UI |
| Cierre mensual | Schema; sin UI |
| Plantillas de reporte guardadas | Tabla lista |

## SQL opcional (mejor rendimiento / sin service role)

Ejecutar en SQL Editor si aún no:

`supabase/scripts/APORTES_PRESTAMOS_HELPERS.sql`

(RPCs `listar_destinos_aporte` y `mis_prestamos`. La app tiene fallback con service role.)
