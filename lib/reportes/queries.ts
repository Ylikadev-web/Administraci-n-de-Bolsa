import { createClient } from "@/lib/supabase/server";
import { listMisBolsas } from "@/lib/bolsas/access";
import type { ReporteFiltros } from "@/lib/schemas/reporte";
import type { EstadoMovimiento, TipoMovimiento } from "@/lib/supabase/types";

export type MovimientoReporte = {
  id: string;
  bolsa_id: string;
  bolsa_nombre: string;
  tipo: TipoMovimiento;
  monto: string;
  moneda: string;
  descripcion: string | null;
  estado: EstadoMovimiento;
  fecha_solicitud: string;
  fecha_ejecucion: string | null;
  autor_nombre: string;
};

export type ResumenReporte = {
  totalIngresos: number;
  totalGastos: number;
  neto: number;
  cantidad: number;
};

const INGRESO_TIPOS: TipoMovimiento[] = [
  "ingreso",
  "saldo_apertura",
  "aporte_recibido",
];
const GASTO_TIPOS: TipoMovimiento[] = ["gasto", "aporte_enviado"];

function signo(tipo: TipoMovimiento): number {
  if (INGRESO_TIPOS.includes(tipo)) return 1;
  if (GASTO_TIPOS.includes(tipo)) return -1;
  return 0;
}

export function resumenDeMovimientos(
  items: MovimientoReporte[],
): ResumenReporte {
  let totalIngresos = 0;
  let totalGastos = 0;
  for (const m of items) {
    const monto = Number(m.monto) || 0;
    const s = signo(m.tipo);
    if (s > 0) totalIngresos += monto;
    else if (s < 0) totalGastos += monto;
  }
  return {
    totalIngresos,
    totalGastos,
    neto: totalIngresos - totalGastos,
    cantidad: items.length,
  };
}

/**
 * Movimientos de bolsas donde el usuario es miembro, con filtros.
 * Nunca consulta bolsas ajenas (usa listMisBolsas).
 */
export async function queryMovimientosReporte(
  userId: string,
  filtros: ReporteFiltros,
): Promise<{ items: MovimientoReporte[]; error: string | null }> {
  const { items: bolsas, error: bolsasError } = await listMisBolsas(userId);
  if (bolsasError) return { items: [], error: bolsasError };
  if (bolsas.length === 0) return { items: [], error: null };

  let bolsaIds = bolsas.map((b) => b.id);
  if (filtros.bolsa_id) {
    if (!bolsaIds.includes(filtros.bolsa_id)) {
      return { items: [], error: "No tienes acceso a esa bolsa" };
    }
    bolsaIds = [filtros.bolsa_id];
  }

  const nombreById = new Map(bolsas.map((b) => [b.id, b.nombre]));
  const supabase = createClient();

  let q = supabase
    .from("movimientos")
    .select(
      `
      id, bolsa_id, tipo, monto, moneda, descripcion, estado,
      fecha_solicitud, fecha_ejecucion, autor_id,
      autor:perfiles!movimientos_autor_id_fkey(nombre)
    `,
    )
    .in("bolsa_id", bolsaIds)
    .order("fecha_solicitud", { ascending: false })
    .limit(500);

  if (filtros.estado !== "todos") {
    q = q.eq("estado", filtros.estado);
  }
  if (filtros.tipo !== "todos") {
    q = q.eq("tipo", filtros.tipo);
  }
  if (filtros.desde) {
    q = q.gte("fecha_solicitud", `${filtros.desde}T00:00:00`);
  }
  if (filtros.hasta) {
    q = q.lte("fecha_solicitud", `${filtros.hasta}T23:59:59.999`);
  }

  const { data, error } = await q;
  if (error) return { items: [], error: error.message };

  const items: MovimientoReporte[] = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      bolsa_id: string;
      tipo: TipoMovimiento;
      monto: string;
      moneda: string;
      descripcion: string | null;
      estado: EstadoMovimiento;
      fecha_solicitud: string;
      fecha_ejecucion: string | null;
      autor: { nombre: string } | { nombre: string }[] | null;
    };
    const autor = Array.isArray(r.autor) ? r.autor[0] : r.autor;
    return {
      id: r.id,
      bolsa_id: r.bolsa_id,
      bolsa_nombre: nombreById.get(r.bolsa_id) ?? "Bolsa",
      tipo: r.tipo,
      monto: r.monto,
      moneda: r.moneda,
      descripcion: r.descripcion,
      estado: r.estado,
      fecha_solicitud: r.fecha_solicitud,
      fecha_ejecucion: r.fecha_ejecucion,
      autor_nombre: autor?.nombre ?? "—",
    };
  });

  return { items, error: null };
}
