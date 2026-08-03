import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UmbralForm } from "@/app/dashboard/configuracion/_components/umbral-form";

export default async function ConfiguracionPage() {
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

  if (!perfil?.es_admin) redirect("/dashboard");

  const { data: config } = await supabase
    .from("config_global")
    .select("umbral_saldo_bajo_bolsa_general_pct")
    .eq("id", 1)
    .maybeSingle<{ umbral_saldo_bajo_bolsa_general_pct: string }>();

  const pct = Number(config?.umbral_saldo_bajo_bolsa_general_pct ?? 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes globales (solo administrador).
        </p>
      </div>
      <UmbralForm initialPct={pct} />
    </div>
  );
}
