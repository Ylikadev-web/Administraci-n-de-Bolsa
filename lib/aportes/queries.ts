import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DestinoAporte = {
  bolsa_id: string;
  nombre: string;
  moneda: string;
  usuario_id: string;
  usuario_nombre: string;
  es_general: boolean;
};

export type PrestamoItem = {
  prestamo_id: string;
  acreedor_id: string;
  acreedor_nombre: string;
  deudor_id: string;
  deudor_nombre: string;
  bolsa_origen_id: string;
  bolsa_destino_id: string | null;
  monto_original: number;
  monto_pagado: number;
  saldo_pendiente: number;
  plazo_dias: number | null;
  fecha_ejecucion: string | null;
  fecha_vencimiento: string | null;
  estado_vencimiento: string;
  descripcion: string | null;
  moneda: string;
  rol: "acreedor" | "deudor";
};

/** Destinos posibles para aporte/préstamo. RPC si existe; si no, admin filtrado. */
export async function listDestinosAporte(
  userId: string,
  excludeBolsaId?: string,
): Promise<{ items: DestinoAporte[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("listar_destinos_aporte");

  if (!error && data) {
    const items = (data as DestinoAporte[]).filter(
      (d) => d.bolsa_id !== excludeBolsaId,
    );
    return { items, error: null };
  }

  try {
    const admin = createAdminClient();
    const [{ data: mis }, { data: propias }, { data: perfiles }] =
      await Promise.all([
        admin
          .from("bolsa_miembros")
          .select(
            "bolsa_id, bolsas!inner(id, nombre, moneda, es_general, archivada, parent_id, created_by)",
          )
          .eq("usuario_id", userId),
        admin
          .from("bolsas")
          .select("id, nombre, moneda, es_general, created_by")
          .eq("archivada", false)
          .is("parent_id", null)
          .eq("es_general", false)
          .is("assigned_by_admin", null)
          .neq("created_by", userId),
        admin.from("perfiles").select("id, nombre").eq("activo", true),
      ]);

    const nombreById = new Map(
      (perfiles ?? []).map((p) => {
        const row = p as { id: string; nombre: string };
        return [row.id, row.nombre] as const;
      }),
    );

    const map = new Map<string, DestinoAporte>();

    for (const row of mis ?? []) {
      const b = row.bolsas as unknown as {
        id: string;
        nombre: string;
        moneda: string;
        es_general: boolean;
        archivada: boolean;
        parent_id: string | null;
        created_by: string;
      };
      if (!b || b.archivada || b.parent_id) continue;
      if (b.id === excludeBolsaId) continue;
      map.set(b.id, {
        bolsa_id: b.id,
        nombre: b.nombre,
        moneda: b.moneda,
        usuario_id: b.created_by,
        usuario_nombre: b.es_general
          ? "General"
          : (nombreById.get(b.created_by) ?? "Miembro"),
        es_general: b.es_general,
      });
    }

    for (const b of propias ?? []) {
      const row = b as {
        id: string;
        nombre: string;
        moneda: string;
        created_by: string;
      };
      if (row.id === excludeBolsaId) continue;
      map.set(row.id, {
        bolsa_id: row.id,
        nombre: row.nombre,
        moneda: row.moneda,
        usuario_id: row.created_by,
        usuario_nombre: nombreById.get(row.created_by) ?? "Usuario",
        es_general: false,
      });
    }

    return { items: Array.from(map.values()), error: null };
  } catch (e) {
    return {
      items: [],
      error: error?.message ?? (e instanceof Error ? e.message : "Error"),
    };
  }
}

function estadoVencimiento(fecha: string | null): string {
  if (!fecha) return "sin_vencimiento";
  const d = new Date(fecha + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencido";
  if (diff <= 3) return "proximo_3d";
  if (diff <= 7) return "proximo_7d";
  return "al_corriente";
}

export async function listMisPrestamos(
  userId: string,
): Promise<{ items: PrestamoItem[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mis_prestamos");

  if (!error && data) {
    const items = (data as Record<string, unknown>[]).map((r) => ({
      prestamo_id: String(r.prestamo_id),
      acreedor_id: String(r.acreedor_id),
      acreedor_nombre: String(r.acreedor_nombre),
      deudor_id: String(r.deudor_id),
      deudor_nombre: String(r.deudor_nombre ?? "—"),
      bolsa_origen_id: String(r.bolsa_origen_id),
      bolsa_destino_id: r.bolsa_destino_id
        ? String(r.bolsa_destino_id)
        : null,
      monto_original: Number(r.monto_original),
      monto_pagado: Number(r.monto_pagado),
      saldo_pendiente: Number(r.saldo_pendiente),
      plazo_dias: r.plazo_dias == null ? null : Number(r.plazo_dias),
      fecha_ejecucion: r.fecha_ejecucion
        ? String(r.fecha_ejecucion)
        : null,
      fecha_vencimiento: r.fecha_vencimiento
        ? String(r.fecha_vencimiento)
        : null,
      estado_vencimiento: String(r.estado_vencimiento),
      descripcion: r.descripcion ? String(r.descripcion) : null,
      moneda: String(r.moneda ?? "MXN"),
      rol: r.rol === "acreedor" ? ("acreedor" as const) : ("deudor" as const),
    }));
    return { items, error: null };
  }

  // Fallback admin
  try {
    const admin = createAdminClient();
    const { data: loans, error: qErr } = await admin
      .from("movimientos")
      .select(
        `
        id, autor_id, contraparte_usuario_id, bolsa_id, contraparte_bolsa_id,
        monto, plazo_dias, fecha_ejecucion, fecha_vencimiento, descripcion, moneda
      `,
      )
      .eq("tipo", "aporte_enviado")
      .eq("naturaleza_aporte", "prestamo")
      .eq("estado", "activo")
      .or(`autor_id.eq.${userId},contraparte_usuario_id.eq.${userId}`)
      .order("fecha_ejecucion", { ascending: false });

    if (qErr) return { items: [], error: qErr.message };

    const { data: perfiles } = await admin
      .from("perfiles")
      .select("id, nombre");
    const nombreById = new Map(
      (perfiles ?? []).map((p) => {
        const row = p as { id: string; nombre: string };
        return [row.id, row.nombre] as const;
      }),
    );

    const ids = (loans ?? []).map((l) => (l as { id: string }).id);
    const pagosByLoan = new Map<string, number>();
    if (ids.length) {
      const { data: pagos } = await admin
        .from("movimientos")
        .select("prestamo_id, monto")
        .in("prestamo_id", ids)
        .eq("estado", "activo")
        .eq("tipo", "aporte_enviado")
        .in("naturaleza_aporte", ["pago_deuda", "reembolso"]);
      for (const p of pagos ?? []) {
        const row = p as { prestamo_id: string; monto: string };
        pagosByLoan.set(
          row.prestamo_id,
          (pagosByLoan.get(row.prestamo_id) ?? 0) + Number(row.monto),
        );
      }
    }

    const items: PrestamoItem[] = (loans ?? []).map((raw) => {
      const l = raw as {
        id: string;
        autor_id: string;
        contraparte_usuario_id: string;
        bolsa_id: string;
        contraparte_bolsa_id: string | null;
        monto: string;
        plazo_dias: number | null;
        fecha_ejecucion: string | null;
        fecha_vencimiento: string | null;
        descripcion: string | null;
        moneda: string;
      };
      const pagado = pagosByLoan.get(l.id) ?? 0;
      const original = Number(l.monto);
      return {
        prestamo_id: l.id,
        acreedor_id: l.autor_id,
        acreedor_nombre: nombreById.get(l.autor_id) ?? "—",
        deudor_id: l.contraparte_usuario_id,
        deudor_nombre: nombreById.get(l.contraparte_usuario_id) ?? "—",
        bolsa_origen_id: l.bolsa_id,
        bolsa_destino_id: l.contraparte_bolsa_id,
        monto_original: original,
        monto_pagado: pagado,
        saldo_pendiente: original - pagado,
        plazo_dias: l.plazo_dias,
        fecha_ejecucion: l.fecha_ejecucion,
        fecha_vencimiento: l.fecha_vencimiento,
        estado_vencimiento: estadoVencimiento(l.fecha_vencimiento),
        descripcion: l.descripcion,
        moneda: l.moneda || "MXN",
        rol: l.autor_id === userId ? "acreedor" : "deudor",
      };
    });

    return { items, error: null };
  } catch (e) {
    return {
      items: [],
      error: error?.message ?? (e instanceof Error ? e.message : "Error"),
    };
  }
}
