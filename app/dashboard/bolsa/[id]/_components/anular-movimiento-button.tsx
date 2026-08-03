"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleSlash, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { anularMovimiento } from "@/app/dashboard/bolsa/[id]/actions";

type Props = {
  movimientoId: string;
  bolsaId: string;
};

export function AnularMovimientoButton({ movimientoId, bolsaId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const onConfirm = async () => {
    setBusy(true);
    const result = await anularMovimiento(
      { movimiento_id: movimientoId, motivo },
      bolsaId,
    );
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo anular", { description: result.error });
      return;
    }
    toast.success("Movimiento anulado");
    setOpen(false);
    setMotivo("");
    router.refresh();
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <CircleSlash className="mr-1 h-3.5 w-3.5" />
        Anular
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Anular movimiento</DialogTitle>
            <DialogDescription>
              El movimiento deja de contar en el saldo. Indica el motivo
              (mínimo 3 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-anular">Motivo</Label>
            <Textarea
              id="motivo-anular"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. duplicado, error de monto…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy || motivo.trim().length < 3}
              onClick={onConfirm}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Anulando…
                </>
              ) : (
                "Confirmar anulación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
