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

  // Crear la bolsa personal.
  const { data: bolsa, error: bolsaError } = await supabase
    .from("bolsas")
    .insert({
      nombre,
      descripcion: descripcion || null,
      color,
      icono: icono || null,
      moneda,
      es_general: false,
      permite_saldo_negativo,
      meta_habilitada,
      meta_monto: meta_habilitada && meta_monto ? String(meta_monto) : null,
      meta_fecha: meta_habilitada ? meta_fecha || null : null,
      created_by: user.id,
    } as never)
    .select("id")
    .returns<{ id: string }[]>()
    .single();

  if (bolsaError || !bolsa) {
    return { ok: false, error: bolsaError?.message ?? "No se pudo crear la bolsa" };
  }

  // Asignar como dueño.
  const { error: miembroError } = await supabase
    .from("bolsa_miembros")
    .insert({
      bolsa_id: bolsa.id,
      usuario_id: user.id,
      rol: "dueno",
      added_by: user.id,
    } as never);

  if (miembroError) {
    return { ok: false, error: miembroError.message };
  }

  // Saldo de apertura opcional.
  if (saldo_inicial > 0) {
    const { error: aperturaError } = await supabase.from("movimientos").insert({
      bolsa_id: bolsa.id,
      tipo: "saldo_apertura",
      monto: String(saldo_inicial),
      moneda,
      descripcion: "Saldo inicial de la bolsa",
      autor_id: user.id,
    } as never);
    if (aperturaError) {
      return { ok: false, error: aperturaError.message };
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, data: { id: bolsa.id } };
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
