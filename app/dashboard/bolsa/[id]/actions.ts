"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  movimientoCreateSchema,
  rechazoSchema,
  type MovimientoCreateInput,
  type RechazoInput,
} from "@/lib/schemas/movimiento";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function registrarMovimiento(
  input: MovimientoCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = movimientoCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { bolsa_id, tipo, monto, descripcion, fecha_ejecucion } = parsed.data;

  const args: {
    p_bolsa_id: string;
    p_tipo: "ingreso" | "gasto";
    p_monto: number;
    p_categoria_id: string | null;
    p_descripcion: string | null;
    p_fecha_ejecucion?: string;
  } = {
    p_bolsa_id: bolsa_id,
    p_tipo: tipo,
    p_monto: monto,
    p_categoria_id: null,
    p_descripcion: descripcion?.trim() ? descripcion.trim() : null,
  };
  if (fecha_ejecucion?.trim()) {
    args.p_fecha_ejecucion = fecha_ejecucion.trim();
  }

  const { data, error } = await supabase.rpc("registrar_movimiento", args);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo registrar el movimiento" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${bolsa_id}`);
  return { ok: true, data: { id: data as unknown as string } };
}

export async function aprobarMovimiento(
  movimientoId: string,
  bolsaId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("aprobar_movimiento", {
    p_movimiento_id: movimientoId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${bolsaId}`);
  return { ok: true, data: null };
}

export async function rechazarMovimiento(
  input: RechazoInput,
  bolsaId: string,
): Promise<ActionResult> {
  const parsed = rechazoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("rechazar_movimiento", {
    p_movimiento_id: parsed.data.movimiento_id,
    p_motivo: parsed.data.motivo,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${bolsaId}`);
  return { ok: true, data: null };
}
