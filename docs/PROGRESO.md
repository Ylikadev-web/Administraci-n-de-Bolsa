# Progreso del sistema Bolsas

Actualizado: 2026-08-03

## Listo en producción / app (≈ 65%)

| Módulo | Estado |
|--------|--------|
| Auth (contraseña + magic link) | ✅ |
| Dashboard de bolsas | ✅ |
| Bolsa propia (CRUD, movimientos, saldo) | ✅ |
| Bolsa General (crear, co-owners, aprobación) | ✅ |
| Bolsa asignada (admin → usuario) | ✅ |
| Privacidad por membresía (UI + script SQL) | ✅ |
| Aprobar/rechazar en detalle de bolsa | ✅ |
| **Campana de notificaciones (Nesim)** | ✅ (este PR) |
| Aprobar/rechazar varias desde la campana | ✅ (este PR) |

## Falta desarrollar (≈ 35%)

| Módulo | Notas |
|--------|--------|
| **Reportes** | Solo existe tabla `plantillas_reporte` en BD. **No hay pantalla ni menú.** |
| Aportes entre usuarios | RPC `crear_aporte` listo; sin UI |
| Préstamos (plazos, pestaña “Me deben / Yo debo”) | Vistas SQL listas; sin UI |
| Anular movimientos | RPC listo; sin UI |
| Categorías de gasto/ingreso | Schema listo; UI siempre manda `null` |
| Sub-bolsas / compartimentos | Schema `parent_id`; sin UI |
| Transferencias internas | RPC listo; sin UI |
| Umbral saldo bajo + alertas | RPC/config; sin UI |
| Notificaciones email/Telegram | Tablas/env; no conectado |
| Cierre mensual | Schema; sin UI |

## Sobre “Reportes”

No lo ves porque **aún no está construido en la app**. El diseño del producto lo contempla (plantillas privadas por usuario, exportes), pero la UI y la generación de PDF/Excel no se han implementado.

Orden sugerido para lo que falta:
1. Reportes básicos (movimientos por bolsa / periodo / usuario)
2. Aportes + préstamos
3. Anulación con motivo
4. Categorías
5. Alertas / canales
