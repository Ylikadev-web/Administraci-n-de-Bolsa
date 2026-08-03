"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Download, Filter, FileBarChart2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { downloadCsv, movimientosToCsv } from "@/lib/reportes/csv";
import type {
  MovimientoReporte,
  ResumenReporte,
} from "@/lib/reportes/queries";
import type { BolsaListItem } from "@/lib/bolsas/access";
import type { EstadoMovimiento, TipoMovimiento } from "@/lib/supabase/types";

const TIPO_LABEL: Record<string, string> = {
  todos: "Todos los tipos",
  ingreso: "Ingreso",
  gasto: "Gasto",
  saldo_apertura: "Saldo inicial",
  aporte_enviado: "Aporte enviado",
  aporte_recibido: "Aporte recibido",
  transferencia_interna: "Transferencia",
};

const ESTADO_LABEL: Record<EstadoMovimiento | "todos", string> = {
  todos: "Todos los estados",
  activo: "Activo",
  pendiente_aprobacion: "Pendiente",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

function tipoLabel(tipo: TipoMovimiento): string {
  return TIPO_LABEL[tipo] ?? tipo;
}

function signo(tipo: TipoMovimiento): number {
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

export function ReportesClient({
  bolsas,
  items,
  resumen,
  initial,
  error,
}: {
  bolsas: BolsaListItem[];
  items: MovimientoReporte[];
  resumen: ResumenReporte;
  initial: {
    bolsa_id?: string;
    desde?: string;
    hasta?: string;
    tipo: string;
    estado: string;
  };
  error: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [bolsaId, setBolsaId] = React.useState(initial.bolsa_id ?? "");
  const [desde, setDesde] = React.useState(initial.desde ?? "");
  const [hasta, setHasta] = React.useState(initial.hasta ?? "");
  const [tipo, setTipo] = React.useState(initial.tipo);
  const [estado, setEstado] = React.useState(initial.estado);

  React.useEffect(() => {
    setBolsaId(initial.bolsa_id ?? "");
    setDesde(initial.desde ?? "");
    setHasta(initial.hasta ?? "");
    setTipo(initial.tipo);
    setEstado(initial.estado);
  }, [initial]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (bolsaId) params.set("bolsa_id", bolsaId);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (tipo && tipo !== "todos") params.set("tipo", tipo);
    if (estado && estado !== "activo") params.set("estado", estado);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const reset = () => {
    setBolsaId("");
    setDesde("");
    setHasta("");
    setTipo("todos");
    setEstado("activo");
    router.push(pathname);
  };

  const onExport = () => {
    const csv = movimientosToCsv(items);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`bolsas-reporte-${stamp}.csv`, csv);
  };

  const moneda =
    bolsas.find((b) => b.id === (initial.bolsa_id ?? bolsaId))?.moneda ??
    bolsas[0]?.moneda ??
    "MXN";

  return (
    <div className="space-y-6">
      <form
        onSubmit={apply}
        className="rounded-lg border bg-card p-4 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="bolsa_id">Bolsa</Label>
            <select
              id="bolsa_id"
              value={bolsaId}
              onChange={(e) => setBolsaId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Todas mis bolsas</option>
              {bolsas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input
              id="desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hasta">Hasta</Label>
            <Input
              id="hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estado">Estado</Label>
            <select
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {(
                Object.keys(ESTADO_LABEL) as Array<keyof typeof ESTADO_LABEL>
              ).map((k) => (
                <option key={k} value={k}>
                  {ESTADO_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Aplicar</Button>
          <Button type="button" variant="outline" onClick={reset}>
            Limpiar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onExport}
            disabled={items.length === 0}
            className="sm:ml-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumenCard label="Movimientos" value={String(resumen.cantidad)} />
        <ResumenCard
          label="Ingresos"
          value={formatMoney(resumen.totalIngresos, moneda)}
          tone="positive"
        />
        <ResumenCard
          label="Gastos"
          value={formatMoney(resumen.totalGastos, moneda)}
          tone="negative"
        />
        <ResumenCard
          label="Neto"
          value={formatMoney(resumen.neto, moneda)}
          tone={resumen.neto >= 0 ? "positive" : "negative"}
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-14 text-center">
          <FileBarChart2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Sin movimientos en este filtro</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajusta fechas, bolsa o tipo para ver resultados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Bolsa</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 font-medium">Autor</th>
                <th className="px-4 py-3 font-medium text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const s = signo(m.tipo);
                return (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(m.fecha_solicitud)}
                    </td>
                    <td className="px-4 py-3">{m.bolsa_nombre}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {tipoLabel(m.tipo)}
                        {m.estado !== "activo" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {ESTADO_LABEL[m.estado]}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px] truncate text-muted-foreground">
                      {m.descripcion || "Sin descripción"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.autor_nombre}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap",
                        s > 0 &&
                          "text-emerald-600 dark:text-emerald-400",
                        s < 0 && "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {s > 0 ? "+" : s < 0 ? "−" : ""}
                      {formatMoney(Number(m.monto), m.moneda)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length >= 500 && (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              Mostrando los últimos 500 registros. Acota el rango de fechas para
              ver más detalle.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResumenCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums tracking-tight",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}
