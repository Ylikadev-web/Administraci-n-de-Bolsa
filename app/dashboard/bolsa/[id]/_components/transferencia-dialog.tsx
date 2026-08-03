"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  transferenciaSchema,
  type TransferenciaInput,
} from "@/lib/schemas/categoria";
import { crearTransferencia } from "@/app/dashboard/bolsa/[id]/actions";
import type { BolsaListItem } from "@/lib/bolsas/access";

type Props = {
  bolsaOrigenId: string;
  moneda: string;
  misBolsas: BolsaListItem[];
};

export function TransferenciaDialog({
  bolsaOrigenId,
  moneda,
  misBolsas,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const destinos = misBolsas.filter((b) => b.id !== bolsaOrigenId);

  const form = useForm<TransferenciaInput>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      bolsa_origen: bolsaOrigenId,
      bolsa_destino: destinos[0]?.id ?? "",
      monto: 0,
      descripcion: "",
      fecha: new Date().toISOString().slice(0, 10),
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        bolsa_origen: bolsaOrigenId,
        bolsa_destino: destinos[0]?.id ?? "",
        monto: 0,
        descripcion: "",
        fecha: new Date().toISOString().slice(0, 10),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bolsaOrigenId]);

  const onSubmit = async (values: TransferenciaInput) => {
    const result = await crearTransferencia(values);
    if (!result.ok) {
      toast.error("No se pudo transferir", { description: result.error });
      return;
    }
    toast.success("Transferencia realizada");
    setOpen(false);
    router.refresh();
  };

  if (destinos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferencia interna</DialogTitle>
          <DialogDescription>
            Mueve saldo entre tus bolsas. Se aplica de inmediato. Moneda:{" "}
            {moneda}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="destino-tr">Bolsa destino</Label>
            <select
              id="destino-tr"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("bolsa_destino")}
            >
              {destinos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monto-tr">Monto</Label>
            <Input
              id="monto-tr"
              type="number"
              step="0.01"
              min="0.01"
              {...form.register("monto")}
            />
            {form.formState.errors.monto && (
              <p className="text-xs text-destructive">
                {form.formState.errors.monto.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc-tr">Nota (opcional)</Label>
            <Textarea id="desc-tr" rows={2} {...form.register("descripcion")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha-tr">Fecha</Label>
            <Input id="fecha-tr" type="date" {...form.register("fecha")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transfiriendo…
                </>
              ) : (
                "Transferir"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
