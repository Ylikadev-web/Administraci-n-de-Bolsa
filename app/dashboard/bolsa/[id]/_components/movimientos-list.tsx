import { ArrowDownLeft, ArrowUpRight, Clock, Ban, CircleSlash } from "lucide-react";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import type { EstadoMovimiento, TipoMovimiento } from "@/lib/supabase/types";
import { MovimientoRowActions } from "@/app/dashboard/bolsa/[id]/_components/movimiento-row-actions";
import { AnularMovimientoButton } from "@/app/dashboard/bolsa/[id]/_components/anular-movimiento-button";

export type MovimientoListItem = {
  id: string;
  tipo: TipoMovimiento;
  monto: string;
  descripcion: string | null;
  estado: EstadoMovimiento;
  fecha_solicitud: string;
  fecha_ejecucion: string | null;
  motivo_rechazo: string | null;
  autor_id: string;
  autor?: { nombre: string } | null;
};

const ESTADO_LABEL: Record<EstadoMovimiento, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

function TipoIcon({ tipo }: { tipo: TipoMovimiento }) {
  const positive =
    tipo === "ingreso" ||
    tipo === "saldo_apertura" ||
    tipo === "aporte_recibido";
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg",
        positive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      {positive ? (
        <ArrowDownLeft className="h-4 w-4" />
      ) : (
        <ArrowUpRight className="h-4 w-4" />
      )}
    </div>
  );
}

function tipoLabel(tipo: TipoMovimiento, descripcion?: string | null): string {
  switch (tipo) {
    case "ingreso":
      return "Ingreso";
    case "gasto":
      return "Gasto";
    case "saldo_apertura":
      return "Saldo inicial";
    case "aporte_enviado":
      return "Aporte enviado";
    case "aporte_recibido":
      return "Aporte recibido";
    case "transferencia_interna":
      if (descripcion === "INTERN_OUT") return "Transferencia salida";
      if (descripcion === "INTERN_IN") return "Transferencia entrada";
      return "Transferencia";
    default:
      return tipo;
  }
}

function signo(tipo: TipoMovimiento, descripcion?: string | null): number {
  if (tipo === "transferencia_interna") {
    if (descripcion === "INTERN_OUT") return -1;
    if (descripcion === "INTERN_IN") return 1;
    return 0;
  }
  if (
    tipo === "ingreso" ||
    tipo === "saldo_apertura" ||
    tipo === "aporte_recibido"
  ) {
    return 1;
  }
  if (tipo === "gasto" || tipo === "aporte_enviado") return -1;
  return 0;
}

export function MovimientosList({
  items,
  moneda,
  bolsaId,
  puedeAprobar,
  currentUserId,
  esAdmin,
}: {
  items: MovimientoListItem[];
  moneda: string;
  bolsaId: string;
  puedeAprobar: boolean;
  currentUserId: string;
  esAdmin: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-6 py-12 text-center">
        <p className="font-medium">Sin movimientos aún</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra un ingreso o un gasto para empezar.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y">
        {items.map((m) => {
          const s = signo(m.tipo, m.descripcion);
          const pendiente = m.estado === "pendiente_aprobacion";
          return (
            <li
              key={m.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <TipoIcon tipo={m.tipo} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {tipoLabel(m.tipo, m.descripcion)}
                    </p>
                    <EstadoBadge estado={m.estado} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {m.tipo === "transferencia_interna"
                      ? "Entre tus bolsas"
                      : m.descripcion?.trim() || "Sin descripción"}
                    {m.autor?.nombre ? ` · ${m.autor.nombre}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.fecha_ejecucion
                      ? formatDate(m.fecha_ejecucion)
                      : `Solicitado ${formatDate(m.fecha_solicitud)}`}
                    {m.motivo_rechazo ? ` · ${m.motivo_rechazo}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                <p
                  className={cn(
                    "text-base font-semibold tabular-nums",
                    m.estado === "rechazado" || m.estado === "anulado"
                      ? "text-muted-foreground line-through"
                      : s > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : s < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "",
                  )}
                >
                  {s > 0 ? "+" : s < 0 ? "−" : ""}
                  {formatMoney(Math.abs(Number(m.monto)), moneda)}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {pendiente && puedeAprobar && (
                    <MovimientoRowActions
                      movimientoId={m.id}
                      bolsaId={bolsaId}
                    />
                  )}
                  {m.estado === "activo" &&
                    (m.autor_id === currentUserId || esAdmin) && (
                      <AnularMovimientoButton
                        movimientoId={m.id}
                        bolsaId={bolsaId}
                      />
                    )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoMovimiento }) {
  if (estado === "activo") return null;
  const styles: Record<EstadoMovimiento, string> = {
    activo: "",
    pendiente_aprobacion:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    rechazado: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    anulado: "bg-muted text-muted-foreground",
  };
  const Icon =
    estado === "pendiente_aprobacion"
      ? Clock
      : estado === "rechazado"
        ? Ban
        : CircleSlash;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        styles[estado],
      )}
    >
      <Icon className="h-3 w-3" />
      {ESTADO_LABEL[estado]}
    </span>
  );
}
