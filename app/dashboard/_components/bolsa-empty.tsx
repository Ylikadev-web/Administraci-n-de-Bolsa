import { WalletCards } from "lucide-react";
import { NuevaBolsaButton } from "@/app/dashboard/_components/nueva-bolsa-button";
import { CrearBolsaGeneralButton } from "@/app/dashboard/_components/crear-bolsa-general-button";

export function BolsaEmpty({
  esAdmin = false,
  usuarios = [],
}: {
  esAdmin?: boolean;
  usuarios?: { id: string; nombre: string; email: string }[];
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <WalletCards className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">Aún no tienes bolsas</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {esAdmin
          ? "Empieza creando la Bolsa General compartida o una bolsa propia. También puedes asignar bolsas a Moisés o Itzyk."
          : "Crea tu primera bolsa propia. Solo tú verás su saldo y movimientos. Si te agregan a la Bolsa General o te asignan una bolsa, también aparecerá aquí."}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {esAdmin && <CrearBolsaGeneralButton usuarios={usuarios} />}
        <NuevaBolsaButton>Crear mi primera bolsa</NuevaBolsaButton>
      </div>
    </div>
  );
}
