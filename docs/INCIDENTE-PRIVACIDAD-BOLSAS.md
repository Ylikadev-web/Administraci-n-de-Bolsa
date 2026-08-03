# Incidente: privacidad y bolsas (revisión compañera)

**Fecha:** 2026-08-03  
**Severidad:** Alta (privacidad) / Media (UX de creación) / **Sin bug de saldo cruzado**

---

## Qué encontró la revisión

| Hallazgo reportado | ¿Bug de sistema? | Qué pasó en realidad |
|--------------------|------------------|----------------------|
| Itzyk no ve “su” bolsa | **No hay bolsa de Itzyk** | Nadie creó ni asignó una bolsa personal a Itzyk. Solo es co-propietario de **Bolsa comunal**. |
| Nesim ve bolsas de los demás | **Sí (RLS) + error de uso** | 1) Policy antigua: admin podía `SELECT` todas las bolsas. 2) “Bolsa Moisés” se creó con **Nueva bolsa propia** (dueño = Nesim), no con **Asignar bolsa**. |
| Gasto 500 en Nesim restó en General | **No** | Los movimientos están en bolsas distintas (ver abajo). |

---

## Cómo se crearon las bolsas (auditoría de datos)

| Bolsa | Tipo real | Miembros al crear | Quién la creó |
|-------|-----------|-------------------|---------------|
| Bolsa comunal | General (`es_general=true`) | Nesim, Moisés, Itzyk | Nesim (Crear Bolsa General) ✓ |
| Nesim | Propia de Nesim | Solo Nesim | Nesim (Nueva bolsa) ✓ |
| Bolsa Moisés | **Propia de Nesim** (mal) | Solo Nesim | Nesim usó “Nueva bolsa” y le puso nombre “Bolsa Moisés” ✗ |

**Error de uso:** para dar una bolsa a Moisés hay que usar **Asignar bolsa**, no “Nueva bolsa propia” con el nombre de otra persona.  
Por eso Moisés no la veía e Itzyk nunca tuvo una.

---

## Movimientos y saldos (certificados en BD)

### Bolsa “Nesim” (`ceea3a18-…`)
| Tipo | Monto | Descripción | Estado |
|------|-------|-------------|--------|
| ingreso | 1,000 | Saldo inicial | activo |
| gasto | 500 | Compra bases | activo |
| **Saldo** | **500** | | |

### Bolsa comunal / General (`9d218dcc-…`)
| Tipo | Monto | Descripción | Estado |
|------|-------|-------------|--------|
| ingreso | 10,000 | Saldo inicial | activo |
| gasto | 5,000 | Pago bases AO | activo |
| **Saldo** | **5,000** | | |

El −500 de Nesim **no** está registrado en General. En General hay un gasto **aparte** de 5,000. No hay contaminación contable entre bolsas: `saldo_bolsa` filtra por `bolsa_id`.

---

## Correcciones aplicadas

1. **App:** el dashboard lista bolsas **solo por membresía** (`bolsa_miembros`), no “todo lo que ve el admin”.  
2. **App:** detalle de bolsa exige membresía → `404` si no eres miembro (aunque RLS antigua permita leer).  
3. **UX:** botón renombrado a **Nueva bolsa propia** + aviso de usar **Asignar bolsa** para terceros.  
4. **Datos:** “Bolsa Moisés” convertida a **asignada** y Moisés agregado como miembro (ya la ve).  
5. **SQL:** migración `20260731000005_fix_privacidad_rls.sql` + script `supabase/scripts/fix_privacidad_ahora.sql` para cerrar el bypass admin en la BD.

### Estado de visibilidad tras remediación de datos

| Usuario | Ve |
|---------|-----|
| Nesim | Bolsa comunal, Nesim, Bolsa Moisés (asignada) |
| Moisés | Bolsa comunal, Bolsa Moisés |
| Itzyk | Bolsa comunal **únicamente** (correcto hasta que le asignen o cree una propia) |

---

## Acción requerida en Supabase (DDL)

En **SQL Editor** del proyecto, ejecutar el contenido de:

`supabase/scripts/fix_privacidad_ahora.sql`

Eso elimina el bypass `es_admin()` en `SELECT` de bolsas y alinea `asignar_bolsa_a_usuario` / `saldo_bolsa` con privacidad por membresía.

---

## Cómo operar bien (Nesim)

| Quiero… | Usar |
|---------|------|
| Bolsa solo mía | **Nueva bolsa propia** |
| Bolsa para Moisés o Itzyk | **Asignar bolsa** (elige usuario) |
| Caja compartida | **Crear Bolsa General** (una sola) |

Itzyk hoy debe: o bien **crear su propia bolsa** al entrar, o Nesim debe **Asignarle** una.
