# Progreso del sistema Bolsas

Actualizado: 2026-08-03

## Listo en app (≈ 95%)

| Módulo | Estado |
|--------|--------|
| Auth, dashboard, bolsas, movimientos, aprobaciones, campana | ✅ |
| Privacidad + API vistas | ✅ |
| Reportes | ✅ |
| Aportes / préstamos / anulación | ✅ |
| **Categorías** (CRUD + select en movimiento) | ✅ |
| **Transferencias** internas entre mis bolsas | ✅ |
| **Cierre mensual** (mes anterior) | ✅ |
| **Umbral saldo bajo** (admin / Config) | ✅ |

## Qué falta (mínimo)

| Módulo | Notas |
|--------|--------|
| Sub-bolsas (compartimentos UI) | Schema `parent_id`; transferencias ya cubren mover saldo |
| Alertas email / Telegram | Tablas; no conectado a canal real |
| Plantillas de reporte guardadas | Tabla lista; filtros ya en UI |
| Cierre automático por calendario | Prefs existen; hoy el cierre es manual |

## SQL opcional

- `supabase/scripts/CERRAR_MES_BOLSA.sql` — RPC `cerrar_mes_bolsa` (hay fallback service role)
- `supabase/scripts/APORTES_PRESTAMOS_HELPERS.sql` — si aún no lo corriste
