import { createClient } from "@/lib/supabase/server";
import { listMisBolsas } from "@/lib/bolsas/access";
import { reporteFiltrosSchema } from "@/lib/schemas/reporte";
import {
  queryMovimientosReporte,
  resumenDeMovimientos,
} from "@/lib/reportes/queries";
import { ReportesClient } from "@/app/dashboard/reportes/_components/reportes-client";
import { humanizeSupabaseError } from "@/lib/errors";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const raw = {
    bolsa_id: first(searchParams.bolsa_id) ?? "",
    desde: first(searchParams.desde) ?? "",
    hasta: first(searchParams.hasta) ?? "",
    tipo: first(searchParams.tipo) ?? "todos",
    estado: first(searchParams.estado) ?? "activo",
  };

  const parsed = reporteFiltrosSchema.safeParse(raw);
  const filtros = parsed.success
    ? parsed.data
    : reporteFiltrosSchema.parse({
        tipo: "todos",
        estado: "activo",
      });

  const [{ items: bolsas, error: bolsasError }, reporte] = await Promise.all([
    listMisBolsas(user.id),
    queryMovimientosReporte(user.id, filtros),
  ]);

  const errorMsg =
    (bolsasError && humanizeSupabaseError(bolsasError).title) ||
    (reporte.error &&
      (humanizeSupabaseError(reporte.error).title || reporte.error)) ||
    (!parsed.success ? "Filtros inválidos" : null);

  const resumen = resumenDeMovimientos(reporte.items);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Movimientos de tus bolsas por periodo, tipo y estado. Exporta a CSV
          para Excel.
        </p>
      </div>

      <ReportesClient
        bolsas={bolsas}
        items={reporte.items}
        resumen={resumen}
        initial={{
          bolsa_id: filtros.bolsa_id,
          desde: filtros.desde,
          hasta: filtros.hasta,
          tipo: filtros.tipo,
          estado: filtros.estado,
        }}
        error={errorMsg}
      />
    </div>
  );
}
