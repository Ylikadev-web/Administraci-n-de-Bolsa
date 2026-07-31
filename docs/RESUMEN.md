# Resumen del proyecto — Bolsas (v2)

> Versión ejecutiva del documento. La versión completa con preguntas
> abiertas está en [`Bolsas-Resumen.pdf`](./Bolsas-Resumen.pdf).

![Diagrama de flujo del sistema](./diagrama-flujo-sistema.png)

## Qué es

**Bolsas** es una aplicación web para gestionar finanzas compartidas
entre miembros de un grupo. Cada persona maneja sus propias bolsas
privadas y todos comparten una **Bolsa General cuyos movimientos
requieren aprobación del administrador**.

**Nesim es el administrador del sistema.** Solo él puede agregar nuevos
usuarios y solo él autoriza los movimientos de la Bolsa General.

## Qué cambió respecto a la v1

- **No existe "Retiro externo".** El efectivo que un usuario saca se
  registra como gasto en la categoría correspondiente.
- **No existe la naturaleza "Adelanto"** en aportes.
- **Nesim = Administrador.** Puede agregar usuarios, aprueba/rechaza
  movimientos de la Bolsa General y configura el umbral de saldo bajo
  de la General.
- **Aprobación obligatoria en Bolsa General.** Todo movimiento pasa por
  la bandeja de Nesim. Rechazo exige motivo escrito. Los movimientos
  del propio Nesim se auto-aprueban.
- **Sub-bolsas.** Cada bolsa puede tener sub-bolsas con las mismas
  propiedades.
- **Préstamos con plazo.** Los aportes entre usuarios son préstamos por
  defecto y se registran con plazo (7, 15, 30, 60 días o personalizado).
  El sistema lleva la contabilidad de cada préstamo con vencimiento.
- **Fecha de solicitud + fecha de ejecución** en cada movimiento.
- **Alerta de saldo bajo solo aplica a la Bolsa General.**
- **Categorías totalmente editables** por los usuarios: crear, editar y
  desactivar. Los movimientos históricos preservan la categoría con la
  que se registraron.
- **Reportes configurables** por bolsa, sub-bolsa, categoría, tipo,
  autor, rango de fechas y estado.
- **No hay topes presupuestales** en esta versión.

## Reglas de oro

- Privacidad primero: cada dueño solo ve su bolsa y sub-bolsas.
- La Bolsa General es visible para todos sus co-dueños; todo pasa por
  Nesim.
- Aportar sí, retirar de bolsa ajena no.
- Nada se elimina: los movimientos se anulan, las bolsas se archivan
  (con saldo cero).
- Los saldos se calculan a partir de los movimientos activos, nunca se
  guardan como número fijo.
- Auditoría completa con autor y hora en cada acción.

## Preguntas abiertas para cerrar

Ver la sección **"Preguntas abiertas para cerrar el modelo"** en el
[PDF](./Bolsas-Resumen.pdf). Son 10 decisiones puntuales sobre:

1. Modelado de sub-bolsas (compartimento vs anidada independiente).
2. Eliminar categoría = borrar de verdad vs desactivar.
3. Alcance de la aprobación en Bolsa General (solo entradas o todo).
4. Auto-aprobación para movimientos del propio Nesim.
5. Notificaciones de préstamos por vencer.
6. Amarrar pago de deuda / reembolso a un préstamo específico.
7. Destinatarios de la alerta de saldo bajo de la Bolsa General.
8. Catálogo inicial de categorías.
9. Quién puede crear sub-bolsas en la Bolsa General.
10. Guardar reportes como plantillas por usuario.
