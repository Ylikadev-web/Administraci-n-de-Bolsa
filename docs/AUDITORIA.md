# Auditoría general — Bolsas

**Fecha:** 2026-07-31  
**Entorno de producción:** https://bolsas-rose.vercel.app  
**Resultado QA automatizado:** **51/51 PASS** (ver `docs/qa-results.json`)  
**Estado de datos:** bolsas demo eliminadas; Nesim crea la Bolsa General desde 0 en la UI.

---

## 1. Resumen ejecutivo

| Lente | Veredicto |
|-------|-----------|
| **Fullstack senior** | Núcleo auth + bolsas (propia / general / asignada) + movimientos + aprobaciones + RLS **íntegro** en API y listo en UI para el flujo operativo diario. |
| **Contador experto** | El saldo se deriva solo de movimientos `activo`; pendientes no contaminan saldo; signos ingreso/gasto correctos; sobregiro bloqueado; General y asignadas con doble control (solicitud → aprobación). |

**Acción pedida por el cliente (cumplida):**
- Sin bolsas demo en la base.
- Nesim puede **Crear Bolsa General** y **Asignar bolsa** desde el dashboard (botones admin).

---

## 2. Alcance de la auditoría

### 2.1 Qué se certificó (en producción + API live)

1. Autenticación (password) de los 3 usuarios  
2. Roles (`es_admin`)  
3. Crear Bolsa General desde cero + co-propietarios + unicidad  
4. CRUD bolsa propia (crear, editar, archivar con saldo 0)  
5. Asignar bolsa a usuario  
6. Movimientos ingreso/gasto  
7. Flujo de aprobación / rechazo  
8. RLS de lectura y escritura  
9. Invariantes contables de saldo  
10. Deploy Vercel (login sin credenciales expuestas)

### 2.2 Fuera de alcance UI (existen en SQL / docs, no en pantallas)

| Módulo | Estado |
|--------|--------|
| Aportes / préstamos con plazo | Solo RPC |
| Anulación de movimientos | Solo RPC |
| Categorías de usuario | Schema sí; UI pasa `null` |
| Sub-bolsas (`parent_id`) | Schema sí; UI no |
| Transferencias internas | Solo RPC |
| Reportes / plantillas | Solo schema |
| Umbral saldo bajo General | Solo RPC |
| Notificaciones email/Telegram | Schema / env opcionales |
| Magic Link E2E en prod | Requiere Site URL + Redirect en Supabase Auth |

---

## 3. Resultados por categoría (QA)

### A. Autenticación — Fullstack

| Caso | Resultado |
|------|----------|
| Login Nesim / Moisés / Itzyk | PASS |
| Perfil Nesim `es_admin=true` | PASS |
| Perfiles no-admin | PASS |
| Login prod sin “Cuentas de prueba” | PASS |
| Fix env estático en cliente (`process.env.NEXT_PUBLIC_*`) | PASS (desplegado) |

**Riesgo residual:** Magic Link falla si en Supabase Auth no están Site URL / Redirect = `https://bolsas-rose.vercel.app` (+ `/auth/callback`).

### B. Bolsa General — Fullstack + Contable

| Caso | Resultado |
|------|----------|
| BD inicia sin bolsas | PASS |
| Solo admin crea General | PASS |
| Nesim crea General desde 0 con co-owners | PASS |
| Segunda General activa bloqueada | PASS |
| 3 miembros (Nesim, Moisés, Itzyk) | PASS |
| Los 3 la ven (RLS) | PASS |
| Saldo inicial = 0 | PASS |

**UI nueva:** botón **Crear Bolsa General** (solo admin, solo si no hay General activa).

### C. Bolsa propia — Fullstack + Contable

| Caso | Resultado |
|------|----------|
| Crear con saldo inicial 1000 | PASS |
| Saldo = 1000 | PASS |
| Ingreso +250 / gasto −100 → saldo 1150 | PASS |
| Gasto > saldo rechazado | PASS |
| Monto 0 rechazado | PASS |
| Moisés no ve / no edita bolsa de Nesim | PASS |
| Archivar con saldo ≠ 0 bloqueado | PASS |
| Archivar con saldo 0 OK | PASS |

### D. Aprobaciones (General) — Contable

| Caso | Resultado |
|------|----------|
| Gasto de Moisés → `pendiente_aprobacion` | PASS |
| Pendiente **no** mueve saldo | PASS |
| Moisés no puede aprobar | PASS |
| Rechazo con motivo ≥ 3 | PASS |
| Motivo corto rechazado | PASS |
| Tras rechazo saldo intacto | PASS |
| Aprobar ingreso 500 → saldo 500 | PASS |
| Gasto de Nesim en General auto-activo (−50 → 450) | PASS |

### E. Bolsa asignada — Fullstack + Contable

| Caso | Resultado |
|------|----------|
| Nesim asigna a Moisés con 200 | PASS |
| Moisés ve / Itzyk no ve | PASS |
| Gasto Moisés pendiente; saldo sigue 200 | PASS |
| Nesim aprueba → saldo 170 | PASS |
| Moisés no puede asignar | PASS |

**UI nueva:** botón **Asignar bolsa**.

### F. Producción

| Caso | Resultado |
|------|----------|
| `GET /login` 200 | PASS |
| Sin demos en UI de login | PASS |

### G. Limpieza post-QA

Tras certificar, se borraron de nuevo bolsas/movimientos de prueba. La app queda **vacía de bolsas** para que Nesim opere desde cero en la UI real.

---

## 4. Dictamen contable (experto)

### 4.1 Libro mayor implícito

- **Fuente de verdad:** tabla `movimientos` con `estado`.  
- **Saldo:** `saldo_bolsa(id)` = Σ (monto × signo) solo si `estado = 'activo'`.  
- **Signos:** `saldo_apertura` / `ingreso` / `aporte_recibido` = +1; `gasto` / `aporte_enviado` = −1.

### 4.2 Controles observados

| Control | Evaluación |
|---------|------------|
| No hay saldo almacenado denormalizado que se desincronice | Correcto |
| Solicitudes pendientes no alteran disponibilidad | Correcto |
| Rechazo no genera asiento inverso (nunca hubo asiento activo) | Correcto |
| Sobregiro impedido en ejecución inmediata | Correcto |
| General no archivable | Correcto (protege cuenta compartida) |
| Archivo solo con saldo 0 | Correcto (cierre limpio) |

### 4.3 Observaciones contables / producto abierto

1. **Aprobación de gasto en General/asignada:** el RPC de aprobación no revalida saldo insuficiente al momento de aprobar (solo al auto-activar). Riesgo si hay varios pendientes que sumen más que el saldo. *Recomendación:* validar saldo en `aprobar_movimiento` para gastos.  
2. **Aportes/préstamos** aún no están en UI; la contabilidad de deudas netas (`v_deudas_entre_usuarios`) no es usable por el usuario final.  
3. **Sin categoría** en movimientos UI: aceptable por producto (“Sin categoría”), pero limita reportes por rubro.  
4. **Anulación** post-aprobación no está en UI; riesgo operativo si hay error humano.

---

## 5. Dictamen fullstack (senior)

### 5.1 Fortalezas

- RLS + `security definer` RPCs alineados con reglas de negocio.  
- Separación clara propia / asignada / general en UI.  
- Sesión browser corregida (env estático).  
- Deploy Vercel con env cifradas.

### 5.2 Deuda / gaps de producto

- Aportes, préstamos, anulación, categorías, sub-bolsas, reportes, umbral: backend sí, frontend no.  
- Panel de pendientes no aprueba in-situ (hay que entrar a la bolsa).  
- Landing menciona aportes que aún no existen en UI (copy desactualizado).  
- Conexión GitHub↔Vercel falló al linkear; deploys actuales son por CLI.

### 5.3 Bugs corregidos en esta pasada

| Bug | Fix |
|-----|-----|
| Login prod no arrancaba (`process.env[name]` dinámico) | Literales `NEXT_PUBLIC_*` en `lib/supabase/client.ts` |
| Credenciales en login | Eliminadas |
| Sin UI para General / asignar | Botones admin + actions |
| Datos demo | Wipe + QA deja BD limpia |

---

## 6. Matriz de botones / inputs (UI actual)

| Pantalla | Control | Comportamiento certificado |
|----------|---------|----------------------------|
| Login | Tabs Contraseña / Enlace mágico | UI OK; password E2E API OK |
| Login | Correo / Contraseña / Entrar | OK tras fix env |
| Dashboard | Nueva bolsa | Crea propia vía RPC |
| Dashboard | Crear Bolsa General (admin) | Nuevo — API certificada |
| Dashboard | Asignar bolsa (admin) | Nuevo — API certificada |
| Dashboard | Pendientes (admin) | Lista + link a bolsa |
| Card bolsa | Abrir detalle / menú editar-archivar | Propia: sí; otras: restringido |
| Detalle | Registrar movimiento | Ingreso/gasto + fecha + descripción |
| Detalle | Aprobar / Rechazar | Solo admin en General/asignada |
| Detalle | Editar | Solo propia del dueño |
| Header | Tema / Logout / Avatar | Presentes |

---

## 7. Cómo usar el sistema ahora (Nesim)

1. Entra a https://bolsas-rose.vercel.app  
2. **Crear Bolsa General** → marca co-propietarios → crear  
3. **Nueva bolsa** para tus bolsas personales  
4. **Asignar bolsa** si quieres dar una a Moisés/Itzyk  
5. Aprueba pendientes desde el aviso del dashboard o dentro de la bolsa  

---

## 8. Evidencia

- Script: `scripts/qa_audit.py`  
- Resultados: `docs/qa-results.json` (51 PASS / 0 FAIL)  
- PR: https://github.com/Ylikadev-web/Administraci-n-de-Bolsa/pull/4  

---

## 9. Conclusión

El **núcleo operativo y contable** (auth, tres tipos de bolsa, movimientos, aprobaciones, RLS, saldos) está **certificado**. La plataforma queda **sin demos**, con Nesim capacitado para levantar la Bolsa General desde cero en la UI. Los módulos avanzados (aportes/préstamos/anulaciones/reportes) siguen como siguiente fase de producto, no como bloqueadores del uso diario actual.
