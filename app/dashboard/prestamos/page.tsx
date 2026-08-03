import { createClient } from "@/lib/supabase/server";
import { listMisBolsas } from "@/lib/bolsas/access";
import { listMisPrestamos } from "@/lib/aportes/queries";
import { PrestamosClient } from "@/app/dashboard/prestamos/_components/prestamos-client";
import { humanizeSupabaseError } from "@/lib/errors";

export default async function PrestamosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ items, error }, { items: bolsas }] = await Promise.all([
    listMisPrestamos(user.id),
    listMisBolsas(user.id),
  ]);

  const meDeben = items.filter((p) => p.rol === "acreedor");
  const yoDebo = items.filter((p) => p.rol === "deudor");
  const friendly = error ? humanizeSupabaseError(error) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Préstamos</h1>
        <p className="text-sm text-muted-foreground">
          Me deben / Yo debo. Los pagos se registran como aporte y el acreedor
          debe aprobar el ingreso.
        </p>
      </div>

      {friendly && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">{friendly.title}</p>
          <p className="mt-1 text-xs opacity-90">{friendly.detail}</p>
        </div>
      )}

      <PrestamosClient
        meDeben={meDeben}
        yoDebo={yoDebo}
        misBolsas={bolsas}
        userId={user.id}
      />
    </div>
  );
}
