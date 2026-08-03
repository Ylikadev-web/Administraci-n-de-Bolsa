"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cerrarMesBolsa } from "@/app/dashboard/bolsa/[id]/actions";

function mesAnterior(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function labelMes(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export function CerrarMesButton({
  bolsaId,
  yaCerrado,
}: {
  bolsaId: string;
  yaCerrado: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const mes = mesAnterior();

  const onConfirm = async () => {
    setBusy(true);
    const result = await cerrarMesBolsa({
      bolsa_id: bolsaId,
      mes_contable: mes,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo cerrar el mes", { description: result.error });
      return;
    }
    toast.success(`Mes cerrado: ${labelMes(mes)}`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={yaCerrado}>
          <CalendarClock className="mr-2 h-4 w-4" />
          {yaCerrado ? "Mes anterior cerrado" : "Cerrar mes anterior"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cerrar {labelMes(mes)}</DialogTitle>
          <DialogDescription>
            Los movimientos activos de ese mes quedarán bloqueados (no se
            podrán anular). Se guarda un resumen en cierres mensuales.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 text-sm">
          <Label>Mes a cerrar</Label>
          <p className="font-medium capitalize">{labelMes(mes)}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cerrando…
              </>
            ) : (
              "Confirmar cierre"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
