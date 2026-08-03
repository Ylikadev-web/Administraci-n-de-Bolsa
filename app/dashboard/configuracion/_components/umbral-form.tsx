"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarUmbralSaldo } from "@/app/dashboard/categorias/actions";

export function UmbralForm({ initialPct }: { initialPct: number }) {
  const router = useRouter();
  const [pct, setPct] = React.useState(String(initialPct));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setPct(String(initialPct));
  }, [initialPct]);

  const onSave = async () => {
    setBusy(true);
    const result = await actualizarUmbralSaldo(Number(pct));
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo guardar", { description: result.error });
      return;
    }
    toast.success("Umbral actualizado");
    router.refresh();
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 max-w-md">
      <div>
        <p className="font-medium">Umbral de saldo bajo (Bolsa General)</p>
        <p className="text-sm text-muted-foreground">
          Porcentaje sobre el saldo de referencia para alertas futuras.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="umbral">Porcentaje (%)</Label>
          <Input
            id="umbral"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
        </div>
        <Button onClick={onSave} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
