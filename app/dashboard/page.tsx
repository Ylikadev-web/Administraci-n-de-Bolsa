import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listMisBolsas } from "@/lib/bolsas/access";
import { humanizeSupabaseError } from "@/lib/errors";
import { BolsaCard } from "@/app/dashboard/_components/bolsa-card";
import { BolsaEmpty } from "@/app/dashboard/_components/bolsa-empty";
import { NuevaBolsaButton } from "@/app/dashboard/_components/nueva-bolsa-button";
import { PendientesAprobacion } from "@/app/dashboard/_components/pendientes-aprobacion";
import { CrearBolsaGeneralButton } from "@/app/dashboard/_components/crear-bolsa-general-button";
import { AsignarBolsaButton } from "@/app/dashboard/_components/asignar-bolsa-button";
import { SessionRecoverButton } from "@/app/dashboard/_components/session-recover-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ items, error }, { data: perfil }, { data: otrosUsuarios }] =
    await Promise.all([
      listMisBolsas(user.id),
      supabase
        .from("perfiles")
        .select("es_admin")
        .eq("id", user.id)
        .maybeSingle<{ es_admin: boolean }>(),
      supabase
        .from("perfiles")
        .select("id, nombre, email")
        .eq("activo", true)
        .neq("id", user.id)
        .order("nombre")
        .returns<{ id: string; nombre: string; email: string }[]>(),
    ]);

  const esAdmin = Boolean(perfil?.es_admin);
  const tieneGeneral = items.some((b) => b.es_general);
  const usuarios = otrosUsuarios ?? [];
  const friendly = error ? humanizeSupabaseError(error) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis bolsas</h1>
          <p className="text-sm text-muted-foreground">
            Solo ves bolsas donde eres miembro. Las bolsas propias de otros
            usuarios son privadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {esAdmin && !tieneGeneral && (
            <CrearBolsaGeneralButton usuarios={usuarios} />
          )}
          {esAdmin && <AsignarBolsaButton usuarios={usuarios} />}
          <NuevaBolsaButton>
            <Plus className="mr-2 h-4 w-4" />
            Nueva bolsa propia
          </NuevaBolsaButton>
        </div>
      </div>

      <PendientesAprobacion />

      {friendly && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">{friendly.title}</p>
          <p className="mt-1 text-xs opacity-90">{friendly.detail}</p>
          {friendly.isSession && <SessionRecoverButton />}
        </div>
      )}

      {items.length === 0 && !error ? (
        <BolsaEmpty esAdmin={esAdmin} usuarios={usuarios} />
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
              esMio={b.created_by === user.id && b.assigned_by_admin === null && !b.es_general}
              metaHabilitada={b.meta_habilitada}
              metaMonto={b.meta_monto ? Number(b.meta_monto) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
