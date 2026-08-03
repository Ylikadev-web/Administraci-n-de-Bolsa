# Progreso del sistema Bolsas

Actualizado: 2026-08-03

## Listo en app (≈ 75%)

| Módulo | Estado |
|--------|--------|
| Auth (contraseña + magic link) | ✅ |
| Dashboard de bolsas | ✅ |
| Bolsa propia / General / asignada | ✅ |
| Movimientos + aprobaciones | ✅ |
| Campana de notificaciones (Nesim) | ✅ |
| Privacidad por membresía | ✅ |
| Hardening API vistas (security_invoker) | ✅ (SQL aplicado) |
| **Reportes** (filtros + resumen + CSV) | ✅ |

## Qué falta (≈ 25%)

| # | Módulo | Notas |
|---|--------|--------|
| 1 | Aportes entre usuarios | RPC listo; sin UI |
| 2 | Préstamos (Me deben / Yo debo) | Vistas SQL listas; sin UI |
| 3 | Anular movimiento con motivo | RPC listo; sin UI |
| 4 | Categorías | Schema listo; UI manda `null` |
| 5 | Sub-bolsas / transferencias | Schema + RPC; sin UI |
| 6 | Alertas saldo bajo / email-Telegram | Config; sin UI |
| 7 | Cierre mensual | Schema; sin UI |
| 8 | Plantillas de reporte guardadas | Tabla lista; UI aún no guarda |

## Reportes

Ruta: `/dashboard/reportes` (enlace en el header).

- Filtra por bolsa, fechas, tipo y estado
- Solo bolsas donde eres miembro
- Resumen: ingresos / gastos / neto
- Exportar CSV (Excel)
