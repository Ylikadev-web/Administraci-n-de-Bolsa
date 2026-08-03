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

export async function aprobarMovimientos(
  items: { movimientoId: string; bolsaId: string }[],
): Promise<ActionResult<{ ok: number; fail: number; errors: string[] }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (!items.length) return { ok: false, error: "No hay solicitudes seleccionadas" };

  let okCount = 0;
  const errors: string[] = [];
  const bolsaIds = new Set<string>();

  for (const item of items) {
    const { error } = await supabase.rpc("aprobar_movimiento", {
      p_movimiento_id: item.movimientoId,
    });
    if (error) errors.push(error.message);
    else {
      okCount += 1;
      bolsaIds.add(item.bolsaId);
    }
  }

  revalidatePath("/dashboard");
  for (const id of bolsaIds) revalidatePath(`/dashboard/bolsa/${id}`);

  if (okCount === 0) {
    return { ok: false, error: errors[0] ?? "No se pudo aprobar" };
  }
  return { ok: true, data: { ok: okCount, fail: errors.length, errors } };
}

export async function rechazarMovimientos(
  items: { movimientoId: string; bolsaId: string }[],
  motivo: string,
): Promise<ActionResult<{ ok: number; fail: number; errors: string[] }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  if (!items.length) return { ok: false, error: "No hay solicitudes seleccionadas" };

  const parsedMotivo = rechazoSchema.shape.motivo.safeParse(motivo);
  if (!parsedMotivo.success) {
    return {
      ok: false,
      error: parsedMotivo.error.errors[0]?.message ?? "Motivo inválido",
    };
  }

  let okCount = 0;
  const errors: string[] = [];
  const bolsaIds = new Set<string>();

  for (const item of items) {
    const { error } = await supabase.rpc("rechazar_movimiento", {
      p_movimiento_id: item.movimientoId,
      p_motivo: parsedMotivo.data,
    });
    if (error) errors.push(error.message);
    else {
      okCount += 1;
      bolsaIds.add(item.bolsaId);
    }
  }

  revalidatePath("/dashboard");
  for (const id of bolsaIds) revalidatePath(`/dashboard/bolsa/${id}`);

  if (okCount === 0) {
    return { ok: false, error: errors[0] ?? "No se pudo rechazar" };
  }
  return { ok: true, data: { ok: okCount, fail: errors.length, errors } };
}
