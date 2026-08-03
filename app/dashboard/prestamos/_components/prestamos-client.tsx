"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import type { PrestamoItem } from "@/lib/aportes/queries";
import type { BolsaListItem } from "@/lib/bolsas/access";
import { crearAporte } from "@/app/dashboard/bolsa/[id]/actions";

const VENC_LABEL: Record<string, string> = {
  sin_vencimiento: "Sin vencimiento",
  al_corriente: "Al corriente",
  proximo_7d: "Vence en ≤7 días",
  proximo_3d: "Vence en ≤3 días",
  vencido: "Vencido",
};

export function PrestamosClient({
  meDeben,
  yoDebo,
  misBolsas,
  userId,
}: {
  meDeben: PrestamoItem[];
  yoDebo: PrestamoItem[];
  misBolsas: BolsaListItem[];
  userId: string;
}) {
  const [tab, setTab] = React.useState<"me" | "yo">("me");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("me")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "me"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Me deben ({meDeben.filter((p) => p.saldo_pendiente > 0).length})
        </button>
        <button
          type="button"
          onClick={() => setTab("yo")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "yo"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Yo debo ({yoDebo.filter((p) => p.saldo_pendiente > 0).length})
        </button>
      </div>

      {tab === "me" ? (
        <PrestamoList
          items={meDeben}
          empty="Nadie te debe préstamos activos."
          mode="acreedor"
          misBolsas={misBolsas}
          userId={userId}
        />
      ) : (
        <PrestamoList
          items={yoDebo}
          empty="No tienes deudas de préstamo pendientes."
          mode="deudor"
          misBolsas={misBolsas}
          userId={userId}
        />
      )}
    </div>
  );
}

function PrestamoList({
  items,
  empty,
  mode,
  misBolsas,
  userId,
}: {
  items: PrestamoItem[];
  empty: string;
  mode: "acreedor" | "deudor";
  misBolsas: BolsaListItem[];
  userId: string;
}) {
  const activos = items.filter((p) => p.saldo_pendiente > 0.001);
  if (activos.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-6 py-12 text-center">
        <p className="font-medium">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {activos.map((p) => (
        <li
          key={p.prestamo_id}
          className="rounded-lg border bg-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {mode === "acreedor"
                ? `${p.deudor_nombre} te debe`
                : `Debes a ${p.acreedor_nombre}`}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {p.descripcion || "Sin descripción"}
            </p>
            <p className="text-xs text-muted-foreground">
              Original {formatMoney(p.monto_original, p.moneda)}
              {" · "}Pagado {formatMoney(p.monto_pagado, p.moneda)}
              {p.fecha_vencimiento
                ? ` · Vence ${formatDate(p.fecha_vencimiento)}`
                : ""}
              {" · "}
              <span
                className={cn(
                  p.estado_vencimiento === "vencido" &&
                    "text-rose-600 dark:text-rose-400",
                  (p.estado_vencimiento === "proximo_3d" ||
                    p.estado_vencimiento === "proximo_7d") &&
                    "text-amber-600 dark:text-amber-400",
                )}
              >
                {VENC_LABEL[p.estado_vencimiento] ?? p.estado_vencimiento}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(p.saldo_pendiente, p.moneda)}
            </p>
            {mode === "deudor" && (
              <PagarPrestamoButton
                prestamo={p}
                misBolsas={misBolsas}
                userId={userId}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PagarPrestamoButton({
  prestamo,
  misBolsas,
  userId,
}: {
  prestamo: PrestamoItem;
  misBolsas: BolsaListItem[];
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const defaultOrigen =
    prestamo.bolsa_destino_id &&
    misBolsas.some((b) => b.id === prestamo.bolsa_destino_id)
      ? prestamo.bolsa_destino_id
      : misBolsas[0]?.id ?? "";
  const [origen, setOrigen] = React.useState(defaultOrigen);
  const [monto, setMonto] = React.useState(
    String(Math.round(prestamo.saldo_pendiente * 100) / 100),
  );
  const [descripcion, setDescripcion] = React.useState(
    `Pago de préstamo a ${prestamo.acreedor_nombre}`,
  );

  React.useEffect(() => {
    if (open) {
      setOrigen(defaultOrigen);
      setMonto(String(Math.round(prestamo.saldo_pendiente * 100) / 100));
      setDescripcion(`Pago de préstamo a ${prestamo.acreedor_nombre}`);
    }
  }, [open, defaultOrigen, prestamo]);

  const onPay = async () => {
    if (!origen) {
      toast.error("Elige una bolsa de origen");
      return;
    }
    const amount = Number(monto);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setBusy(true);
    const result = await crearAporte({
      bolsa_origen: origen,
      bolsa_destino: prestamo.bolsa_origen_id,
      monto: amount,
      naturaleza: "pago_deuda",
      descripcion,
      prestamo_id: prestamo.prestamo_id,
      plazo_dias: "",
      fecha_ejecucion: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error("No se pudo registrar el pago", {
        description: result.error,
      });
      return;
    }
    toast.success("Pago enviado — el acreedor debe aprobar el ingreso");
    setOpen(false);
    router.refresh();
  };

  void userId;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Pagar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar préstamo</DialogTitle>
            <DialogDescription>
              Sale de tu bolsa ahora. {prestamo.acreedor_nombre} verá un
              aporte pendiente de aprobación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="origen-pago">Desde bolsa</Label>
              <select
                id="origen-pago"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
              >
                {misBolsas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monto-pago">Monto</Label>
              <Input
                id="monto-pago"
                type="number"
                step="0.01"
                min="0"
                max={prestamo.saldo_pendiente}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc-pago">Descripción</Label>
              <Textarea
                id="desc-pago"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={onPay}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Confirmar pago"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
