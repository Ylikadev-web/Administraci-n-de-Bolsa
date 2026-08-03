"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

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
import { cn, formatDate, formatMoney } from "@/lib/utils";
import type { SolicitudPendiente } from "@/lib/notificaciones/pendientes";
import {
  aprobarMovimientos,
  rechazarMovimientos,
} from "@/app/dashboard/bolsa/[id]/actions";

export function NotificationBell({
  items: initialItems,
}: {
  items: SolicitudPendiente[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState(initialItems);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setItems(initialItems);
    setSelected(new Set());
  }, [initialItems]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const selectedItems = items
    .filter((i) => selected.has(i.id))
    .map((i) => ({ movimientoId: i.id, bolsaId: i.bolsa_id }));

  const onApprove = async () => {
    if (!selectedItems.length) {
      toast.error("Selecciona al menos una solicitud");
      return;
    }
    setBusy(true);
    const res = await aprobarMovimientos(selectedItems);
    setBusy(false);
    if (!res.ok) {
      toast.error("No se pudo aprobar", { description: res.error });
      return;
    }
    toast.success(
      res.data.fail
        ? `Aprobadas ${res.data.ok}, fallaron ${res.data.fail}`
        : `Aprobadas ${res.data.ok}`,
    );
    setSelected(new Set());
    setOpen(false);
    router.refresh();
  };

  const onRejectConfirm = async () => {
    if (!selectedItems.length) return;
    setBusy(true);
    const res = await rechazarMovimientos(selectedItems, motivo);
    setBusy(false);
    if (!res.ok) {
      toast.error("No se pudo rechazar", { description: res.error });
      return;
    }
    toast.success(
      res.data.fail
        ? `Rechazadas ${res.data.ok}, fallaron ${res.data.fail}`
        : `Rechazadas ${res.data.ok}`,
    );
    setMotivo("");
    setRejectOpen(false);
    setSelected(new Set());
    setOpen(false);
    router.refresh();
  };

  const count = items.length;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(100vw-2rem,24rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Solicitudes</p>
              <p className="text-xs text-muted-foreground">
                {count === 0
                  ? "Sin pendientes"
                  : `${count} pendiente${count === 1 ? "" : "s"} de aprobación`}
              </p>
            </div>
            {count > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={toggleAll}
              >
                {selected.size === items.length ? "Quitar todo" : "Seleccionar todo"}
              </button>
            )}
          </div>

          {count === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No hay solicitudes nuevas.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y">
              {items.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <li key={m.id} className="px-3 py-2.5 hover:bg-muted/40">
                    <label className="flex cursor-pointer gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {m.autor?.nombre ?? "Usuario"} ·{" "}
                            {m.bolsa?.nombre ?? "Bolsa"}
                          </p>
                          <p
                            className={cn(
                              "shrink-0 text-sm font-semibold tabular-nums",
                              m.tipo === "gasto"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {m.tipo === "gasto" ? "−" : "+"}
                            {formatMoney(
                              Number(m.monto),
                              m.bolsa?.moneda ?? "MXN",
                            )}
                          </p>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.tipo} · {m.descripcion || "Sin descripción"} ·{" "}
                          {formatDate(m.fecha_solicitud)}
                        </p>
                        <Link
                          href={`/dashboard/bolsa/${m.bolsa_id}`}
                          className="mt-1 inline-block text-[11px] text-primary hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Ver bolsa
                        </Link>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {count > 0 && (
            <div className="flex gap-2 border-t p-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={busy || selected.size === 0}
                onClick={onApprove}
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3.5 w-3.5" />
                )}
                Aprobar{selected.size ? ` (${selected.size})` : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-400"
                disabled={busy || selected.size === 0}
                onClick={() => setRejectOpen(true)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Rechazar{selected.size ? ` (${selected.size})` : ""}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Rechazar {selected.size} solicitud{selected.size === 1 ? "" : "es"}
            </DialogTitle>
            <DialogDescription>
              El motivo se aplica a todas las seleccionadas (mínimo 3 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-bulk">Motivo</Label>
            <Textarea
              id="motivo-bulk"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. falta comprobante, monto incorrecto…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy || motivo.trim().length < 3}
              onClick={onRejectConfirm}
            >
              {busy ? (
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
    </div>
  );
}
