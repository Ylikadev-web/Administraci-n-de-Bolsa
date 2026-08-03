import { z } from "zod";

export const reporteFiltrosSchema = z.object({
  bolsa_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  desde: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha desde inválida")
    .transform((v) => (v ? v : undefined)),
  hasta: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha hasta inválida")
    .transform((v) => (v ? v : undefined)),
  tipo: z
    .enum([
      "todos",
      "ingreso",
      "gasto",
      "saldo_apertura",
      "aporte_enviado",
      "aporte_recibido",
      "transferencia_interna",
    ])
    .default("todos"),
  estado: z
    .enum(["activo", "pendiente_aprobacion", "rechazado", "anulado", "todos"])
    .default("activo"),
});

export type ReporteFiltros = z.infer<typeof reporteFiltrosSchema>;
