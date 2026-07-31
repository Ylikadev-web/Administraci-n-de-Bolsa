# Resumen del proyecto — Bolsas (v4)

> La versión completa está en [`Bolsas-Resumen.pdf`](./Bolsas-Resumen.pdf).

![Diagrama de flujo del sistema](./diagrama-flujo-sistema.png)

## Modelo

**Bolsas** es una app web para administrar finanzas compartidas entre
miembros de un grupo. Cada persona maneja sus propias bolsas privadas
y todos comparten una Bolsa General.

## Cambios de v4 respecto a v3

- **Sin catálogo de categorías por defecto.** Cada usuario crea las
  suyas si quiere, o describe el movimiento con **texto libre** y
  aparece como *Sin categoría* en los reportes.
- **Doble control por aprobación:**
  - En la **Bolsa General**, todo movimiento pasa por Nesim.
  - En las **bolsas privadas**, los aportes recibidos desde otros
    usuarios pasan por el dueño de la bolsa receptora.
- **Alta de usuarios**: al agregar un usuario nuevo, Nesim decide en
  el momento si es co-propietario de la Bolsa General.

## Reglas nucleares

- **Privacidad primero**: cada dueño solo ve su bolsa y sub-bolsas.
- **Nadie mete dinero sin permiso**: Bolsa General → Nesim; bolsa
  privada → dueño.
- **Aportar sí, retirar no**.
- **Nada se elimina** (movimientos se anulan, bolsas se archivan con
  saldo 0). Categorías sí se eliminan; los movimientos que las usaban
  quedan como *Sin categoría*.
- **Saldos calculados** desde los movimientos activos.
- **Sub-bolsas = compartimentos del padre** (el saldo padre incluye
  las sub-bolsas).

## Otros elementos

- **Aportes son préstamos por defecto** con plazo 7 / 15 / 30 / 60
  días o personalizado.
- **Pago de deuda y reembolso** se amarran a un préstamo específico.
- **Recordatorios de préstamo**: 7 días, 3 días antes, día del
  vencimiento y semanal después hasta que se cierre.
- **Pestaña Préstamos** por usuario con "Me deben", "Yo debo" y
  "Cerrados".
- **Alerta de saldo bajo** solo en la Bolsa General; umbral solo
  Nesim, aviso a los tres.
- **Reportes configurables** con **plantillas privadas** por usuario.

## Preguntas por resolver (6 en el PDF)

1. Aporte pendiente: ¿saldo del remitente se descuenta al instante o
   queda reservado?
2. Aporte pendiente: ¿el remitente puede cancelarlo antes de que el
   receptor decida?
3. Rechazo de aporte: ¿motivo escrito obligatorio?
4. Nesim admin: ¿puede desactivar usuarios y transferir el rol?
5. Bolsas privadas de Nesim: ¿mantienen privacidad como las demás?
6. Anular un movimiento ya aprobado en la Bolsa General: ¿requiere
   nueva aprobación de Nesim?

Todas con recomendación en el PDF.
