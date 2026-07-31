# Resumen del proyecto — Bolsas (v3, lógica cerrada)

> La versión completa está en [`Bolsas-Resumen.pdf`](./Bolsas-Resumen.pdf).

![Diagrama de flujo del sistema](./diagrama-flujo-sistema.png)

## Modelo

**Bolsas** es una app web para administrar finanzas compartidas entre
miembros de un grupo. Cada persona maneja sus propias bolsas privadas y
todos comparten una **Bolsa General cuyos movimientos requieren
aprobación de Nesim** (administrador).

## Decisiones finales de la lógica

- **Sub-bolsas = compartimentos del padre.** El saldo del padre incluye
  el de sus sub-bolsas; asignar dinero a una sub-bolsa no cambia el
  total de la bolsa madre.
- **Categorías: crear, editar y eliminar de verdad.** Los movimientos
  que apuntaban a una categoría eliminada quedan como *Sin categoría*.
- **Aprobación en Bolsa General: todos los movimientos** (entradas,
  salidas, aportes, transferencias). Nesim se auto-aprueba con marca en
  auditoría.
- **Préstamos con recordatorios**: 7 días antes, 3 días antes, el día
  del vencimiento, y cada semana después de vencido hasta que se salde.
- **Pago de deuda y reembolso se amarran a un préstamo específico** que
  se cierra automáticamente cuando el saldo llega a cero.
- **Pestaña de Préstamos** por usuario: "Me deben", "Yo debo" y
  "Cerrados", con estados *Al corriente / Próximo a vencer / Vencido /
  Cerrado*.
- **Alerta de saldo bajo en Bolsa General**: umbral configurable solo
  por Nesim; la alerta llega a los tres co-dueños.
- **Sub-bolsas de la Bolsa General**: solo Nesim las crea y edita.
- **Plantillas de reportes** privadas por usuario.
- **Catálogo empresarial de categorías** (19 gastos + 7 ingresos)
  como punto de partida.

## Estas siguen sin definirse (5 preguntas finas en el PDF)

1. Rubro específico del catálogo empresarial.
2. Nesim admin: ¿puede desactivar y/o transferir el rol de admin?
3. Bolsas privadas de Nesim: ¿mantienen su privacidad como las demás?
4. Al agregar un usuario nuevo: ¿co-dueño de la Bolsa General por
   defecto, o Nesim marca uno a uno?
5. Anular un movimiento ya aprobado en la Bolsa General: ¿requiere
   nueva aprobación?

Todas con recomendación en el PDF.
