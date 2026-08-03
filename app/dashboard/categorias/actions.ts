"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  categoriaSchema,
  umbralSchema,
  type CategoriaInput,
} from "@/lib/schemas/categoria";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function crearCategoria(
  input: CategoriaInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = categoriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      usuario_id: user.id,
      nombre: parsed.data.nombre,
      tipo: parsed.data.tipo,
      color: parsed.data.color ?? "#64748b",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo crear la categoría",
    };
  }

  revalidatePath("/dashboard/categorias");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function eliminarCategoria(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/categorias");
  revalidatePath("/dashboard");
  return { ok: true, data: null };
}

export async function actualizarUmbralSaldo(
  pct: number,
): Promise<ActionResult> {
  const parsed = umbralSchema.safeParse({ pct });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Inválido" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("actualizar_umbral_saldo_bajo", {
    p_pct: parsed.data.pct,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/configuracion");
  return { ok: true, data: null };
}
