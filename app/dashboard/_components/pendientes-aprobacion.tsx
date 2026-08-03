import Link from "next/link";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatDate } from "@/lib/utils";

type Pendiente = {
  id: string;
  tipo: string;
  monto: string;
  descripcion: string | null;
  fecha_solicitud: string;
  bolsa_id: string;
  bolsa: { nombre: string; moneda: string } | null;
  autor: { nombre: string } | null;
};

export async function PendientesAprobacion() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("es_admin")
    .eq("id", user.id)
    .maybeSingle<{ es_admin: boolean }>();

  if (!perfil?.es_admin) return null;

  const { data } = await supabase
    .from("movimientos")
    .select(
      "id, tipo, monto, descripcion, fecha_solicitud, bolsa_id, bolsa:bolsas(nombre, moneda), autor:perfiles!movimientos_autor_id_fkey(nombre)",
    )
    .eq("estado", "pendiente_aprobacion")
    .order("fecha_solicitud", { ascending: true })
    .limit(10)
    .returns<Pendiente[]>();

  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h2 className="font-semibold">Pendientes de aprobación</h2>
        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`/dashboard/bolsa/${m.bolsa_id}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-background/60"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.autor?.nombre ?? "Usuario"} · {m.bolsa?.nombre ?? "Bolsa"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.tipo} · {m.descripcion || "Sin descripción"} ·{" "}
                  {formatDate(m.fecha_solicitud)}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatMoney(Number(m.monto), m.bolsa?.moneda ?? "MXN")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
