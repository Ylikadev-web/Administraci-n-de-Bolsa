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
  aporteCreateSchema,
  type AporteCreateInput,
} from "@/lib/schemas/aporte";
import { crearAporte } from "@/app/dashboard/bolsa/[id]/actions";
import type { DestinoAporte } from "@/lib/aportes/queries";

type Props = {
  bolsaOrigenId: string;
  moneda: string;
  destinos: DestinoAporte[];
};

export function AporteDialog({ bolsaOrigenId, moneda, destinos }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<AporteCreateInput>({
    resolver: zodResolver(aporteCreateSchema),
    defaultValues: {
      bolsa_origen: bolsaOrigenId,
      bolsa_destino: "",
      monto: 0,
      naturaleza: "cooperacion",
      descripcion: "",
      plazo_dias: "",
      prestamo_id: "",
      fecha_ejecucion: new Date().toISOString().slice(0, 10),
    },
  });

  const naturaleza = form.watch("naturaleza");

  React.useEffect(() => {
    if (open) {
      form.reset({
        bolsa_origen: bolsaOrigenId,
        bolsa_destino: destinos[0]?.bolsa_id ?? "",
        monto: 0,
        naturaleza: "cooperacion",
        descripcion: "",
        plazo_dias: "",
        prestamo_id: "",
        fecha_ejecucion: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, bolsaOrigenId, destinos, form]);

  const onSubmit = async (values: AporteCreateInput) => {
    const result = await crearAporte(values);
    if (!result.ok) {
      toast.error("No se pudo enviar el aporte", { description: result.error });
      return;
    }
    toast.success(
      values.naturaleza === "prestamo"
        ? "Préstamo enviado — el receptor debe aprobarlo"
        : "Aporte enviado — pendiente de aprobación del destino",
    );
    setOpen(false);
    router.refresh();
  };

  const disponibles = destinos.filter((d) => d.bolsa_id !== bolsaOrigenId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Aporte / préstamo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar aporte o préstamo</DialogTitle>
          <DialogDescription>
            Sale de esta bolsa de inmediato. El destino queda pendiente de
            aprobación. Moneda: {moneda}.
          </DialogDescription>
        </DialogHeader>

        {disponibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay bolsas destino disponibles.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="space-y-1.5">
              <Label htmlFor="naturaleza">Tipo</Label>
              <select
                id="naturaleza"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...form.register("naturaleza")}
              >
                <option value="cooperacion">Cooperación (aporte)</option>
                <option value="prestamo">Préstamo (con plazo)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bolsa_destino">Bolsa destino</Label>
              <select
                id="bolsa_destino"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...form.register("bolsa_destino")}
              >
                {disponibles.map((d) => (
                  <option key={d.bolsa_id} value={d.bolsa_id}>
                    {d.nombre}
                    {d.es_general
                      ? " (General)"
                      : ` · ${d.usuario_nombre}`}
                  </option>
                ))}
              </select>
              {form.formState.errors.bolsa_destino && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bolsa_destino.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                {...form.register("monto")}
              />
              {form.formState.errors.monto && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.monto.message}
                </p>
              )}
            </div>

            {naturaleza === "prestamo" && (
              <div className="space-y-1.5">
                <Label htmlFor="plazo_dias">Plazo (días)</Label>
                <Input
                  id="plazo_dias"
                  type="number"
                  min="1"
                  placeholder="Ej. 30"
                  {...form.register("plazo_dias")}
                />
                {form.formState.errors.plazo_dias && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.plazo_dias.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                rows={2}
                placeholder="Motivo del aporte o préstamo"
                {...form.register("descripcion")}
              />
              {form.formState.errors.descripcion && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.descripcion.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fecha_ejecucion">Fecha</Label>
              <Input
                id="fecha_ejecucion"
                type="date"
                {...form.register("fecha_ejecucion")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
