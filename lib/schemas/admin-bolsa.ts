import { z } from "zod";
import { COLORES_BOLSA, ICONOS_BOLSA } from "@/lib/schemas/bolsa";

export const bolsaGeneralSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(60, "Máximo 60 caracteres")
    .default("Bolsa General"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default(COLORES_BOLSA[9]),
  icono: z.string().default("users"),
  moneda: z.string().length(3).default("MXN"),
  co_owner_ids: z.array(z.string().uuid()).default([]),
});

export type BolsaGeneralInput = z.infer<typeof bolsaGeneralSchema>;

export const asignarBolsaSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(60, "Máximo 60 caracteres"),
  descripcion: z.string().max(280).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icono: z.string().min(1).max(40).optional().nullable(),
  moneda: z.string().length(3).default("MXN"),
  usuario_asignado: z.string().uuid("Selecciona un usuario"),
  saldo_inicial: z.coerce.number().min(0).default(0),
  permite_saldo_negativo: z.boolean().default(false),
});

export type AsignarBolsaInput = z.infer<typeof asignarBolsaSchema>;

export { COLORES_BOLSA, ICONOS_BOLSA };
