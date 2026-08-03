import type { MovimientoReporte } from "@/lib/reportes/queries";

const TIPO_LABEL: Record<string, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  saldo_apertura: "Saldo inicial",
  aporte_enviado: "Aporte enviado",
  aporte_recibido: "Aporte recibido",
  transferencia_interna: "Transferencia",
};

const ESTADO_LABEL: Record<string, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  return escapeCsv(String(value));
}

/** Genera CSV (UTF-8 con BOM) listo para descargar en Excel. */
export function movimientosToCsv(items: MovimientoReporte[]): string {
  const headers = [
    "Fecha solicitud",
    "Fecha ejecución",
    "Bolsa",
    "Tipo",
    "Monto",
    "Moneda",
    "Estado",
    "Descripción",
    "Autor",
  ];

  const lines = [headers.join(",")];
  for (const m of items) {
    lines.push(
      [
        cell(m.fecha_solicitud.slice(0, 10)),
        cell(m.fecha_ejecucion ?? ""),
        cell(m.bolsa_nombre),
        cell(TIPO_LABEL[m.tipo] ?? m.tipo),
        cell(m.monto),
        cell(m.moneda),
        cell(ESTADO_LABEL[m.estado] ?? m.estado),
        cell(m.descripcion ?? ""),
        cell(m.autor_nombre),
      ].join(","),
    );
  }

  return `\uFEFF${lines.join("\n")}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
