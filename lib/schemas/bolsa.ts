import { z } from "zod";

export const COLORES_BOLSA = [
  "#4f46e5", // índigo
  "#0ea5e9", // cielo
  "#10b981", // esmeralda
  "#f59e0b", // ámbar
  "#ef4444", // rojo
  "#a855f7", // púrpura
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#64748b", // slate
  "#eab308", // amarillo (default para Bolsa General)
] as const;

export const ICONOS_BOLSA = [
  "wallet",
  "piggy-bank",
  "briefcase",
  "home",
  "car",
  "plane",
  "gift",
  "heart",
  "gem",
  "coffee",
  "book",
  "sparkles",
  "users",
] as const;

export const bolsaCreateSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(60, "Máximo 60 caracteres"),
  descripcion: z.string().max(280, "Máximo 280 caracteres").optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
  icono: z.string().min(1).max(40).optional().nullable(),
  moneda: z.string().length(3).default("MXN"),
  saldo_inicial: z.coerce
    .number()
    .min(0, "El saldo inicial no puede ser negativo")
    .default(0),
  permite_saldo_negativo: z.boolean().default(false),
  meta_habilitada: z.boolean().default(false),
  meta_monto: z.coerce.number().positive().optional().nullable(),
  meta_fecha: z.string().optional().nullable(),
});

export type BolsaCreateInput = z.infer<typeof bolsaCreateSchema>;

export const bolsaUpdateSchema = bolsaCreateSchema
  .omit({ saldo_inicial: true, moneda: true })
  .partial()
  .extend({
    id: z.string().uuid(),
  });

export type BolsaUpdateInput = z.infer<typeof bolsaUpdateSchema>;
