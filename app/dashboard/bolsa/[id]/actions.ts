"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  movimientoCreateSchema,
  rechazoSchema,
  type MovimientoCreateInput,
  type RechazoInput,
} from "@/lib/schemas/movimiento";
import {
  aporteCreateSchema,
  anularSchema,
  type AporteCreateInput,
  type AnularInput,
} from "@/lib/schemas/aporte";
import {
  transferenciaSchema,
  cerrarMesSchema,
  type TransferenciaInput,
  type CerrarMesInput,
} from "@/lib/schemas/categoria";

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

  const { bolsa_id, tipo, monto, descripcion, fecha_ejecucion, categoria_id } =
    parsed.data;

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
    p_categoria_id: categoria_id ?? null,
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

export async function crearAporte(
  input: AporteCreateInput,
): Promise<ActionResult<{ aporteId: string }>> {
  const parsed = aporteCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const d = parsed.data;
  const args: {
    p_bolsa_origen: string;
    p_bolsa_destino: string;
    p_monto: number;
    p_naturaleza: "cooperacion" | "prestamo" | "pago_deuda" | "reembolso";
    p_descripcion: string;
    p_plazo_dias?: number;
    p_prestamo_id?: string;
    p_fecha_ejecucion?: string;
  } = {
    p_bolsa_origen: d.bolsa_origen,
    p_bolsa_destino: d.bolsa_destino,
    p_monto: d.monto,
    p_naturaleza: d.naturaleza,
    p_descripcion: d.descripcion.trim(),
  };
  if (
    d.naturaleza === "prestamo" &&
    typeof d.plazo_dias === "number" &&
    d.plazo_dias > 0
  ) {
    args.p_plazo_dias = d.plazo_dias;
  }
  if (
    (d.naturaleza === "pago_deuda" || d.naturaleza === "reembolso") &&
    d.prestamo_id &&
    d.prestamo_id !== ""
  ) {
    args.p_prestamo_id = d.prestamo_id;
  }
  if (d.fecha_ejecucion?.trim()) {
    args.p_fecha_ejecucion = d.fecha_ejecucion.trim();
  }

  const { data, error } = await supabase.rpc("crear_aporte", args);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear el aporte" };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${d.bolsa_origen}`);
  revalidatePath(`/dashboard/bolsa/${d.bolsa_destino}`);
  revalidatePath("/dashboard/prestamos");
  revalidatePath("/dashboard/reportes");
  return { ok: true, data: { aporteId: data as unknown as string } };
}

export async function anularMovimiento(
  input: AnularInput,
  bolsaId: string,
): Promise<ActionResult> {
  const parsed = anularSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("anular_movimiento", {
    p_movimiento_id: parsed.data.movimiento_id,
    p_motivo: parsed.data.motivo,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${bolsaId}`);
  revalidatePath("/dashboard/prestamos");
  revalidatePath("/dashboard/reportes");
  return { ok: true, data: null };
}

export async function cancelarAportePendiente(
  aporteId: string,
  bolsaId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("cancelar_aporte_pendiente", {
    p_aporte_id: aporteId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${bolsaId}`);
  revalidatePath("/dashboard/prestamos");
  return { ok: true, data: null };
}

export async function crearTransferencia(
  input: TransferenciaInput,
): Promise<ActionResult<{ transferId: string }>> {
  const parsed = transferenciaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }
  if (parsed.data.bolsa_origen === parsed.data.bolsa_destino) {
    return { ok: false, error: "Origen y destino deben ser distintos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const d = parsed.data;
  const args: {
    p_bolsa_origen: string;
    p_bolsa_destino: string;
    p_monto: number;
    p_descripcion?: string;
    p_fecha?: string;
  } = {
    p_bolsa_origen: d.bolsa_origen,
    p_bolsa_destino: d.bolsa_destino,
    p_monto: d.monto,
  };
  if (d.descripcion?.trim()) args.p_descripcion = d.descripcion.trim();
  if (d.fecha?.trim()) args.p_fecha = d.fecha.trim();

  const { data, error } = await supabase.rpc("crear_transferencia_interna", args);
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo transferir",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/bolsa/${d.bolsa_origen}`);
  revalidatePath(`/dashboard/bolsa/${d.bolsa_destino}`);
  revalidatePath("/dashboard/reportes");
  return { ok: true, data: { transferId: data as unknown as string } };
}

export async function cerrarMesBolsa(
  input: CerrarMesInput,
): Promise<ActionResult<{ cierreId: string }>> {
  const parsed = cerrarMesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data, error } = await supabase.rpc("cerrar_mes_bolsa", {
    p_bolsa_id: parsed.data.bolsa_id,
    p_mes_contable: parsed.data.mes_contable,
  });

  if (!error && data) {
    revalidatePath(`/dashboard/bolsa/${parsed.data.bolsa_id}`);
    revalidatePath("/dashboard/reportes");
    return { ok: true, data: { cierreId: data as unknown as string } };
  }

  // Fallback service role si el RPC aún no está en la DB
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const mes = parsed.data.mes_contable.slice(0, 8) + "01";
    const bolsaId = parsed.data.bolsa_id;

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const mesDate = new Date(mes + "T00:00:00");
    if (mesDate >= currentMonth) {
      return { ok: false, error: "Solo puedes cerrar meses anteriores al actual" };
    }

    const { data: existing } = await admin
      .from("cierres_mensuales")
      .select("id")
      .eq("bolsa_id", bolsaId)
      .eq("mes_contable", mes)
      .maybeSingle();
    if (existing) return { ok: false, error: "Ese mes ya está cerrado" };

    const { data: movs } = await admin
      .from("movimientos")
      .select("tipo, monto, descripcion, estado, mes_contable")
      .eq("bolsa_id", bolsaId)
      .eq("estado", "activo");

    let saldoInicial = 0;
    let ingresos = 0;
    let gastos = 0;
    let transferNet = 0;
    for (const raw of movs ?? []) {
      const m = raw as {
        tipo: string;
        monto: string;
        descripcion: string | null;
        mes_contable: string;
      };
      const monto = Number(m.monto);
      const mesMov = String(m.mes_contable).slice(0, 10);
      if (mesMov < mes) {
        if (m.tipo === "transferencia_interna") {
          if (m.descripcion === "INTERN_OUT") saldoInicial -= monto;
          else if (m.descripcion === "INTERN_IN") saldoInicial += monto;
        } else if (
          m.tipo === "ingreso" ||
          m.tipo === "aporte_recibido" ||
          m.tipo === "saldo_apertura"
        ) {
          saldoInicial += monto;
        } else if (m.tipo === "gasto" || m.tipo === "aporte_enviado") {
          saldoInicial -= monto;
        }
      } else if (mesMov === mes) {
        if (m.tipo === "transferencia_interna") {
          if (m.descripcion === "INTERN_OUT") transferNet -= monto;
          else if (m.descripcion === "INTERN_IN") transferNet += monto;
        } else if (
          m.tipo === "ingreso" ||
          m.tipo === "aporte_recibido" ||
          m.tipo === "saldo_apertura"
        ) {
          ingresos += monto;
        } else if (m.tipo === "gasto" || m.tipo === "aporte_enviado") {
          gastos += monto;
        }
      }
    }
    const saldoFinal = saldoInicial + ingresos - gastos + transferNet;

    const { data: cierre, error: insErr } = await admin
      .from("cierres_mensuales")
      .insert({
        bolsa_id: bolsaId,
        mes_contable: mes,
        saldo_inicial: saldoInicial,
        total_ingresos: ingresos,
        total_gastos: gastos,
        saldo_final: saldoFinal,
        cerrado_por: user.id,
      })
      .select("id")
      .single();

    if (insErr || !cierre) {
      return {
        ok: false,
        error: insErr?.message ?? error?.message ?? "No se pudo cerrar el mes",
      };
    }

    await admin
      .from("movimientos")
      .update({ cerrado: true })
      .eq("bolsa_id", bolsaId)
      .eq("mes_contable", mes)
      .eq("estado", "activo")
      .eq("cerrado", false);

    revalidatePath(`/dashboard/bolsa/${bolsaId}`);
    revalidatePath("/dashboard/reportes");
    return { ok: true, data: { cierreId: (cierre as { id: string }).id } };
  } catch (e) {
    return {
      ok: false,
      error:
        error?.message ??
        (e instanceof Error ? e.message : "No se pudo cerrar el mes"),
    };
  }
}
