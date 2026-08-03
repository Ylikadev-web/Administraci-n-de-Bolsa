import { z } from "zod";

export const movimientoCreateSchema = z.object({
  bolsa_id: z.string().uuid("Bolsa inválida"),
  tipo: z.enum(["ingreso", "gasto"], {
    required_error: "Elige ingreso o gasto",
  }),
  monto: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0"),
  descripcion: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  fecha_ejecucion: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Fecha inválida (YYYY-MM-DD)",
    ),
});

export type MovimientoCreateInput = z.infer<typeof movimientoCreateSchema>;

export const rechazoSchema = z.object({
  movimiento_id: z.string().uuid(),
  motivo: z
    .string()
    .trim()
    .min(3, "El motivo debe tener al menos 3 caracteres")
    .max(500, "Máximo 500 caracteres"),
});

export type RechazoInput = z.infer<typeof rechazoSchema>;
