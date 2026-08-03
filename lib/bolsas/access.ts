import { createClient } from "@/lib/supabase/server";

export type BolsaListItem = {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  moneda: string;
  es_general: boolean;
  assigned_by_admin: string | null;
  meta_habilitada: boolean;
  meta_monto: string | null;
  created_by: string;
};

/**
 * Lista SOLO bolsas donde el usuario autenticado es miembro.
 * No confiar en bypass admin de RLS: la privacidad financiera exige
 * membresía explícita (bolsa_miembros).
 */
export async function listMisBolsas(userId: string): Promise<{
  items: BolsaListItem[];
  error: string | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("bolsa_miembros")
    .select(
      `
      bolsa_id,
      bolsas!inner (
        id, nombre, descripcion, color, icono, moneda,
        es_general, assigned_by_admin, meta_habilitada, meta_monto,
        created_by, archivada, parent_id
      )
    `,
    )
    .eq("usuario_id", userId);

  if (error) {
    return { items: [], error: error.message };
  }

  const items = (data ?? [])
    .map((row) => {
      const b = row.bolsas as unknown as BolsaListItem & {
        archivada: boolean;
        parent_id: string | null;
      };
      return b;
    })
    .filter((b) => b && !b.archivada && b.parent_id === null)
    .sort((a, b) => {
      if (a.es_general !== b.es_general) return a.es_general ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });

  return { items, error: null };
}

/** true solo si el usuario es miembro de la bolsa. */
export async function soyMiembroDeBolsa(
  userId: string,
  bolsaId: string,
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("bolsa_miembros")
    .select("bolsa_id")
    .eq("usuario_id", userId)
    .eq("bolsa_id", bolsaId)
    .maybeSingle();
  return Boolean(data);
}
