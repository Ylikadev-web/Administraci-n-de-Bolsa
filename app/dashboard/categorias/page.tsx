import { listMisCategorias } from "@/lib/categorias/queries";
import { createClient } from "@/lib/supabase/server";
import { CategoriasClient } from "@/app/dashboard/categorias/_components/categorias-client";

export default async function CategoriasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { items } = await listMisCategorias(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Clasifica tus ingresos y gastos. Solo tú las ves y usas.
        </p>
      </div>
      <CategoriasClient items={items} />
    </div>
  );
}
