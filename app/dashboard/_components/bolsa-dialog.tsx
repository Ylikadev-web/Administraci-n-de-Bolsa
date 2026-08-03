"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BolsaIcon, BOLSA_ICONS_LIST } from "@/app/dashboard/_components/bolsa-icon";
import { cn } from "@/lib/utils";
import {
  bolsaCreateSchema,
  COLORES_BOLSA,
  type BolsaCreateInput,
} from "@/lib/schemas/bolsa";
import { crearBolsa, editarBolsa } from "@/app/dashboard/actions";

type BolsaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | { mode: "create"; bolsa?: undefined }
  | {
      mode: "edit";
      bolsa: {
        id: string;
        nombre: string;
        descripcion: string | null;
        color: string;
        icono: string | null;
        moneda: string;
        permite_saldo_negativo: boolean;
        meta_habilitada: boolean;
        meta_monto: string | null;
        meta_fecha: string | null;
      };
    }
);

export function BolsaDialog(props: BolsaDialogProps) {
  const { open, onOpenChange, mode } = props;
  const router = useRouter();

  const defaults = React.useMemo<BolsaCreateInput>(() => {
    if (mode === "edit" && props.bolsa) {
      return {
        nombre: props.bolsa.nombre,
        descripcion: props.bolsa.descripcion ?? "",
        color: props.bolsa.color,
        icono: props.bolsa.icono ?? "wallet",
        moneda: props.bolsa.moneda,
        saldo_inicial: 0,
        permite_saldo_negativo: props.bolsa.permite_saldo_negativo,
        meta_habilitada: props.bolsa.meta_habilitada,
        meta_monto: props.bolsa.meta_monto ? Number(props.bolsa.meta_monto) : null,
        meta_fecha: props.bolsa.meta_fecha ?? "",
      };
    }
    return {
      nombre: "",
      descripcion: "",
      color: COLORES_BOLSA[0],
      icono: "wallet",
      moneda: "MXN",
      saldo_inicial: 0,
      permite_saldo_negativo: false,
      meta_habilitada: false,
      meta_monto: null,
      meta_fecha: "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, (props as { bolsa?: { id: string } }).bolsa?.id]);

  const form = useForm<BolsaCreateInput>({
    resolver: zodResolver(bolsaCreateSchema),
    defaultValues: defaults,
  });

  React.useEffect(() => {
    if (open) form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults]);

  const color = form.watch("color");
  const icono = form.watch("icono");
  const metaHabilitada = form.watch("meta_habilitada");

  const onSubmit = async (values: BolsaCreateInput) => {
    if (mode === "create") {
      const res = await crearBolsa(values);
      if (!res.ok) {
        toast.error("No pudimos crear la bolsa", { description: res.error });
        return;
      }
      toast.success("Bolsa creada");
      onOpenChange(false);
      router.refresh();
    } else {
      const res = await editarBolsa({
        id: props.bolsa!.id,
        nombre: values.nombre,
        descripcion: values.descripcion,
        color: values.color,
        icono: values.icono,
        permite_saldo_negativo: values.permite_saldo_negativo,
        meta_habilitada: values.meta_habilitada,
        meta_monto: values.meta_monto ?? null,
        meta_fecha: values.meta_fecha ?? null,
      });
      if (!res.ok) {
        toast.error("No pudimos guardar los cambios", { description: res.error });
        return;
      }
      toast.success("Bolsa actualizada");
      onOpenChange(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva bolsa propia" : "Editar bolsa"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Queda a tu nombre: solo tú eres miembro. Si quieres dar una bolsa a Moisés o Itzyk, usa «Asignar bolsa», no este formulario."
              : "Actualiza los datos visuales y las reglas de tu bolsa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-white shadow-sm transition-colors"
              style={{ backgroundColor: color }}
            >
              <BolsaIcon name={icono} className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Vista previa</p>
              <p className="text-xs text-muted-foreground">
                Así se verá el ícono y color en tu lista.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              placeholder="Ej. Ahorro para viaje"
              {...form.register("nombre")}
            />
            {form.formState.errors.nombre && (
              <p className="text-xs text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              rows={2}
              placeholder="Ej. Reserva para el viaje de diciembre"
              {...form.register("descripcion")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORES_BOLSA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => form.setValue("color", c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      color === c
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1.5">
                {BOLSA_ICONS_LIST.map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ícono ${i}`}
                    onClick={() => form.setValue("icono", i)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                      icono === i
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <BolsaIcon name={i} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="saldo_inicial">Saldo inicial (opcional)</Label>
              <Input
                id="saldo_inicial"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                {...form.register("saldo_inicial")}
              />
              <p className="text-xs text-muted-foreground">
                Si es distinto de 0, se registrará como un movimiento tipo
                &quot;saldo de apertura&quot;.
              </p>
            </div>
          )}

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="flex-1 space-y-0.5">
              <Label
                htmlFor="permite_saldo_negativo"
                className="cursor-pointer"
              >
                Permitir saldo negativo
              </Label>
              <p className="text-xs text-muted-foreground">
                Útil si esta bolsa representa una tarjeta de crédito.
              </p>
            </div>
            <Switch
              id="permite_saldo_negativo"
              checked={form.watch("permite_saldo_negativo")}
              onCheckedChange={(v) => form.setValue("permite_saldo_negativo", v)}
            />
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-0.5">
                <Label htmlFor="meta_habilitada" className="cursor-pointer">
                  Poner una meta de ahorro
                </Label>
                <p className="text-xs text-muted-foreground">
                  Muestra el progreso hacia el objetivo en la tarjeta.
                </p>
              </div>
              <Switch
                id="meta_habilitada"
                checked={metaHabilitada}
                onCheckedChange={(v) => form.setValue("meta_habilitada", v)}
              />
            </div>
            {metaHabilitada && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meta_monto">Monto meta</Label>
                  <Input
                    id="meta_monto"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="10000.00"
                    {...form.register("meta_monto")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_fecha">Fecha objetivo</Label>
                  <Input
                    id="meta_fecha"
                    type="date"
                    {...form.register("meta_fecha")}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === "create" ? "Crear bolsa" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
