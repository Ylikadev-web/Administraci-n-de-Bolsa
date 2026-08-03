import { z } from "zod";

export const aporteCreateSchema = z
  .object({
    bolsa_origen: z.string().uuid("Bolsa origen inválida"),
    bolsa_destino: z.string().uuid("Bolsa destino inválida"),
    monto: z.coerce
      .number({ invalid_type_error: "Monto inválido" })
      .positive("El monto debe ser mayor a 0"),
    naturaleza: z.enum(["cooperacion", "prestamo", "pago_deuda", "reembolso"], {
      required_error: "Elige el tipo de aporte",
    }),
    descripcion: z
      .string()
      .trim()
      .min(1, "La descripción es obligatoria")
      .max(500, "Máximo 500 caracteres"),
    plazo_dias: z.coerce.number().int().positive().optional().or(z.literal("")),
    prestamo_id: z.string().uuid().optional().or(z.literal("")),
    fecha_ejecucion: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Fecha inválida (YYYY-MM-DD)",
      ),
  })
  .superRefine((val, ctx) => {
    if (val.bolsa_origen === val.bolsa_destino) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Origen y destino deben ser distintos",
        path: ["bolsa_destino"],
      });
    }
    if (val.naturaleza === "prestamo") {
      const plazo =
        val.plazo_dias === "" || val.plazo_dias == null
          ? null
          : Number(val.plazo_dias);
      if (!plazo || plazo <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Los préstamos requieren plazo en días",
          path: ["plazo_dias"],
        });
      }
    }
    if (val.naturaleza === "pago_deuda" || val.naturaleza === "reembolso") {
      if (!val.prestamo_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona el préstamo a saldar",
          path: ["prestamo_id"],
        });
      }
    }
  });

export type AporteCreateInput = z.infer<typeof aporteCreateSchema>;

export const anularSchema = z.object({
  movimiento_id: z.string().uuid(),
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo debe tener al menos 3 caracteres")
    .max(500, "Máximo 500 caracteres"),
});

export type AnularInput = z.infer<typeof anularSchema>;
