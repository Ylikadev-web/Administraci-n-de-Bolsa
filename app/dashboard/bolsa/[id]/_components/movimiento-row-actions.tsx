"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

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
import {
  aprobarMovimiento,
  rechazarMovimiento,
} from "@/app/dashboard/bolsa/[id]/actions";

type Props = {
  movimientoId: string;
  bolsaId: string;
};

export function MovimientoRowActions({ movimientoId, bolsaId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const onApprove = async () => {
    setBusy("approve");
    const result = await aprobarMovimiento(movimientoId, bolsaId);
    setBusy(null);
    if (!result.ok) {
      toast.error("No se pudo aprobar", { description: result.error });
      return;
    }
    toast.success("Movimiento aprobado");
    router.refresh();
  };

  const onReject = async () => {
    setBusy("reject");
    const result = await rechazarMovimiento(
      { movimiento_id: movimientoId, motivo },
      bolsaId,
    );
    setBusy(null);
    if (!result.ok) {
      toast.error("No se pudo rechazar", { description: result.error });
      return;
    }
    toast.success("Movimiento rechazado");
    setRejectOpen(false);
    setMotivo("");
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
          disabled={busy !== null}
          onClick={onApprove}
        >
          {busy === "approve" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" />
          )}
          Aprobar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
          disabled={busy !== null}
          onClick={() => setRejectOpen(true)}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Rechazar
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rechazar movimiento</DialogTitle>
            <DialogDescription>
              Indica el motivo (mínimo 3 caracteres). El solicitante lo verá.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. monto incorrecto, falta comprobante…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy === "reject" || motivo.trim().length < 3}
              onClick={onReject}
            >
              {busy === "reject" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rechazando…
                </>
              ) : (
                "Confirmar rechazo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
