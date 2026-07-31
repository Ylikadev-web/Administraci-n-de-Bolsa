import { WalletCards } from "lucide-react";
import { NuevaBolsaButton } from "@/app/dashboard/_components/nueva-bolsa-button";

export function BolsaEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <WalletCards className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold">Aún no tienes bolsas</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Crea tu primera bolsa propia. Puedes empezar en 0 o con un monto
        inicial, y solo tú verás su saldo y movimientos. Si el
        administrador te asigna una bolsa o te agrega a la Bolsa General,
        también aparecerá aquí.
      </p>
      <div className="mt-4">
        <NuevaBolsaButton>Crear mi primera bolsa</NuevaBolsaButton>
      </div>
    </div>
  );
}
