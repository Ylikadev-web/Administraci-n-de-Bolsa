import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BolsaCard } from "@/app/dashboard/_components/bolsa-card";
import { BolsaEmpty } from "@/app/dashboard/_components/bolsa-empty";
import { NuevaBolsaButton } from "@/app/dashboard/_components/nueva-bolsa-button";

interface BolsaListItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  moneda: string;
  es_general: boolean;
  assigned_by_admin: string | null;
  meta_habilitada: boolean;
  meta_monto: string | null;
  created_by: string;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bolsas, error } = await supabase
    .from("bolsas")
    .select(
      "id, nombre, descripcion, color, icono, moneda, es_general, assigned_by_admin, meta_habilitada, meta_monto, created_by",
    )
    .eq("archivada", false)
    .is("parent_id", null)
    .order("es_general", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<BolsaListItem[]>();

  const items = bolsas ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis bolsas</h1>
          <p className="text-sm text-muted-foreground">
            Solo ves tus bolsas personales y la Bolsa General.
          </p>
        </div>
        <NuevaBolsaButton>
          <Plus className="mr-2 h-4 w-4" />
          Nueva bolsa
        </NuevaBolsaButton>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">No pudimos cargar las bolsas.</p>
          <p className="mt-1 text-xs opacity-80">{error.message}</p>
          <p className="mt-2 text-xs">
            ¿Ya aplicaste las migraciones de <code>supabase/apply_all.sql</code>?
          </p>
        </div>
      )}

      {items.length === 0 && !error ? (
        <BolsaEmpty />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => (
            <BolsaCard
              key={b.id}
              id={b.id}
              nombre={b.nombre}
              descripcion={b.descripcion}
              color={b.color}
              icono={b.icono}
              moneda={b.moneda}
              esGeneral={b.es_general}
              esAsignada={b.assigned_by_admin !== null}
              esMio={b.created_by === user?.id}
              metaHabilitada={b.meta_habilitada}
              metaMonto={b.meta_monto ? Number(b.meta_monto) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
