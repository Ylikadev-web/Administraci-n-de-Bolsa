"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  bolsaCreateSchema,
  bolsaUpdateSchema,
  type BolsaCreateInput,
  type BolsaUpdateInput,
} from "@/lib/schemas/bolsa";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function crearBolsa(
  input: BolsaCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = bolsaCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const {
    nombre,
    descripcion,
    color,
    icono,
    moneda,
    saldo_inicial,
    permite_saldo_negativo,
    meta_habilitada,
    meta_monto,
    meta_fecha,
  } = parsed.data;

  const { data, error } = await supabase.rpc("crear_bolsa_propia", {
    p_nombre: nombre,
    p_descripcion: descripcion || null,
    p_color: color,
    p_icono: icono || null,
    p_moneda: moneda,
    p_saldo_inicial: Number(saldo_inicial ?? 0),
    p_permite_saldo_negativo: permite_saldo_negativo,
    p_meta_habilitada: meta_habilitada,
    p_meta_monto: meta_habilitada && meta_monto ? Number(meta_monto) : null,
    p_meta_fecha: meta_habilitada ? meta_fecha || null : null,
    p_parent_id: null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear la bolsa" };
  }

  revalidatePath("/dashboard");
  return { ok: true, data: { id: data as unknown as string } };
}

export async function editarBolsa(
  input: BolsaUpdateInput,
): Promise<ActionResult> {
  const parsed = bolsaUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { id, ...rest } = parsed.data;
  const update: Record<string, unknown> = {};
  if (rest.nombre !== undefined) update.nombre = rest.nombre;
  if (rest.descripcion !== undefined) update.descripcion = rest.descripcion || null;
  if (rest.color !== undefined) update.color = rest.color;
  if (rest.icono !== undefined) update.icono = rest.icono || null;
  if (rest.permite_saldo_negativo !== undefined)
    update.permite_saldo_negativo = rest.permite_saldo_negativo;
  if (rest.meta_habilitada !== undefined) update.meta_habilitada = rest.meta_habilitada;
  if (rest.meta_monto !== undefined)
    update.meta_monto = rest.meta_monto ? String(rest.meta_monto) : null;
  if (rest.meta_fecha !== undefined) update.meta_fecha = rest.meta_fecha || null;

  const { error } = await supabase
    .from("bolsas")
    .update(update as never)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${id}`);
  return { ok: true, data: null };
}

export async function archivarBolsa(bolsaId: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("archivar_bolsa", {
    p_bolsa_id: bolsaId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true, data: null };
}
