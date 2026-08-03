"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus } from "lucide-react";

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
import { cn } from "@/lib/utils";
import {
  movimientoCreateSchema,
  type MovimientoCreateInput,
} from "@/lib/schemas/movimiento";
import { registrarMovimiento } from "@/app/dashboard/bolsa/[id]/actions";
import type { CategoriaItem } from "@/lib/categorias/queries";

type Props = {
  bolsaId: string;
  moneda: string;
  requiereAprobacion: boolean;
  categorias: CategoriaItem[];
};

export function MovimientoDialog({
  bolsaId,
  moneda,
  requiereAprobacion,
  categorias,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<MovimientoCreateInput>({
    resolver: zodResolver(movimientoCreateSchema),
    defaultValues: {
      bolsa_id: bolsaId,
      tipo: "ingreso",
      monto: 0,
      categoria_id: "",
      descripcion: "",
      fecha_ejecucion: new Date().toISOString().slice(0, 10),
    },
  });

  const tipo = form.watch("tipo");

  const categoriasFiltradas = categorias.filter(
    (c) => c.tipo === "ambos" || c.tipo === tipo,
  );

  React.useEffect(() => {
    if (open) {
      form.reset({
        bolsa_id: bolsaId,
        tipo: "ingreso",
        monto: 0,
        categoria_id: "",
        descripcion: "",
        fecha_ejecucion: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, bolsaId, form]);

  React.useEffect(() => {
    const current = form.getValues("categoria_id");
    if (
      current &&
      !categoriasFiltradas.some((c) => c.id === current)
    ) {
      form.setValue("categoria_id", "");
    }
  }, [tipo, categoriasFiltradas, form]);

  const onSubmit = async (values: MovimientoCreateInput) => {
    const result = await registrarMovimiento(values);
    if (!result.ok) {
      toast.error("No se pudo registrar", { description: result.error });
      return;
    }
    toast.success(
      requiereAprobacion
        ? "Solicitud enviada — pendiente de aprobación"
        : values.tipo === "ingreso"
          ? "Ingreso registrado"
          : "Gasto registrado",
    );
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Registrar movimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>
            {requiereAprobacion
              ? "Este movimiento quedará pendiente hasta que el administrador lo apruebe."
              : "Se aplica de inmediato al saldo de la bolsa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("bolsa_id")} />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                form.setValue("tipo", "ingreso", { shouldValidate: true })
              }
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                tipo === "ingreso"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <ArrowDownLeft className="h-4 w-4" />
              Ingreso
            </button>
            <button
              type="button"
              onClick={() =>
                form.setValue("tipo", "gasto", { shouldValidate: true })
              }
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                tipo === "gasto"
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              Gasto
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto">Monto ({moneda})</Label>
            <Input
              id="monto"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...form.register("monto")}
            />
            {form.formState.errors.monto && (
              <p className="text-xs text-destructive">
                {form.formState.errors.monto.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="categoria_id">Categoría (opcional)</Label>
              <Link
                href="/dashboard/categorias"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Gestionar
              </Link>
            </div>
            <select
              id="categoria_id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("categoria_id")}
            >
              <option value="">Sin categoría</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              rows={2}
              placeholder="Ej. salario, comida, transporte…"
              {...form.register("descripcion")}
            />
          </div>

          <div className="space-y-2">
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
                  Guardando…
                </>
              ) : requiereAprobacion ? (
                "Solicitar"
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
