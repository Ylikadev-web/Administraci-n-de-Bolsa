import { z } from "zod";

export const categoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(60, "Máximo 60 caracteres"),
  tipo: z.enum(["ingreso", "gasto", "ambos"], {
    required_error: "Elige el tipo",
  }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido")
    .default("#64748b"),
});

export type CategoriaInput = z.infer<typeof categoriaSchema>;

export const transferenciaSchema = z.object({
  bolsa_origen: z.string().uuid("Bolsa origen inválida"),
  bolsa_destino: z.string().uuid("Bolsa destino inválida"),
  monto: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0"),
  descripcion: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
  fecha: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Fecha inválida",
    ),
});

export type TransferenciaInput = z.infer<typeof transferenciaSchema>;

export const cerrarMesSchema = z.object({
  bolsa_id: z.string().uuid(),
  mes_contable: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Mes inválido"),
});

export type CerrarMesInput = z.infer<typeof cerrarMesSchema>;

export const umbralSchema = z.object({
  pct: z.coerce
    .number({ invalid_type_error: "Porcentaje inválido" })
    .min(0, "Mínimo 0")
    .max(100, "Máximo 100"),
});
