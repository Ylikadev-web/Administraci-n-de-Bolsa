import { createClient } from "@/lib/supabase/server";

export type CategoriaItem = {
  id: string;
  nombre: string;
  tipo: "ingreso" | "gasto" | "ambos";
  color: string;
};

export async function listMisCategorias(
  userId: string,
): Promise<{ items: CategoriaItem[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre, tipo, color")
    .eq("usuario_id", userId)
    .order("nombre");

  if (error) return { items: [], error: error.message };
  return {
    items: (data ?? []) as CategoriaItem[],
    error: null,
  };
}
