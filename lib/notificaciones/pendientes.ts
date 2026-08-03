import { createClient } from "@/lib/supabase/server";

export type SolicitudPendiente = {
  id: string;
  tipo: string;
  monto: string;
  descripcion: string | null;
  fecha_solicitud: string;
  bolsa_id: string;
  bolsa: { nombre: string; moneda: string } | null;
  autor: { nombre: string } | null;
};

export async function getSolicitudesPendientesAdmin(
  userId: string,
): Promise<{ esAdmin: boolean; items: SolicitudPendiente[] }> {
  const supabase = createClient();
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("es_admin")
    .eq("id", userId)
    .maybeSingle<{ es_admin: boolean }>();

  if (!perfil?.es_admin) {
    return { esAdmin: false, items: [] };
  }

  const { data } = await supabase
    .from("movimientos")
    .select(
      "id, tipo, monto, descripcion, fecha_solicitud, bolsa_id, bolsa:bolsas(nombre, moneda), autor:perfiles!movimientos_autor_id_fkey(nombre)",
    )
    .eq("estado", "pendiente_aprobacion")
    .order("fecha_solicitud", { ascending: true })
    .limit(50)
    .returns<SolicitudPendiente[]>();

  return { esAdmin: true, items: data ?? [] };
}
