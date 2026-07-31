"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  asignarBolsaSchema,
  COLORES_BOLSA,
  type AsignarBolsaInput,
} from "@/lib/schemas/admin-bolsa";
import { asignarBolsa } from "@/app/dashboard/actions";

type UsuarioOpt = { id: string; nombre: string; email: string };

export function AsignarBolsaButton({ usuarios }: { usuarios: UsuarioOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<AsignarBolsaInput>({
    resolver: zodResolver(asignarBolsaSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      color: COLORES_BOLSA[0],
      icono: "wallet",
      moneda: "MXN",
      usuario_asignado: "",
      saldo_inicial: 0,
      permite_saldo_negativo: false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        nombre: "",
        descripcion: "",
        color: COLORES_BOLSA[0],
        icono: "wallet",
        moneda: "MXN",
        usuario_asignado: usuarios[0]?.id ?? "",
        saldo_inicial: 0,
        permite_saldo_negativo: false,
      });
    }
  }, [open, usuarios, form]);

  const color = form.watch("color");
  const permiteNeg = form.watch("permite_saldo_negativo");

  const onSubmit = async (values: AsignarBolsaInput) => {
    const res = await asignarBolsa(values);
    if (!res.ok) {
      toast.error("No se pudo asignar la bolsa", { description: res.error });
      return;
    }
    toast.success("Bolsa asignada");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="mr-2 h-4 w-4" />
          Asignar bolsa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar bolsa a un usuario</DialogTitle>
          <DialogDescription>
            El usuario podrá solicitar ingresos y gastos; tú apruebas cada
            movimiento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usuario_asignado">Usuario</Label>
            <select
              id="usuario_asignado"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("usuario_asignado")}
            >
              <option value="">Selecciona…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.email})
                </option>
              ))}
            </select>
            {form.formState.errors.usuario_asignado && (
              <p className="text-xs text-destructive">
                {form.formState.errors.usuario_asignado.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre-asignada">Nombre</Label>
            <Input
              id="nombre-asignada"
              placeholder="Ej. Viáticos Moisés"
              {...form.register("nombre")}
            />
            {form.formState.errors.nombre && (
              <p className="text-xs text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc-asignada">Descripción (opcional)</Label>
            <Textarea id="desc-asignada" rows={2} {...form.register("descripcion")} />
          </div>

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
                    "h-7 w-7 rounded-full border-2",
                    color === c ? "scale-110 border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="saldo-asig">Saldo inicial</Label>
            <Input
              id="saldo-asig"
              type="number"
              step="0.01"
              min="0"
              {...form.register("saldo_inicial")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Permitir saldo negativo</p>
              <p className="text-xs text-muted-foreground">
                Si está apagado, no se aprueban gastos sin fondos.
              </p>
            </div>
            <Switch
              checked={permiteNeg}
              onCheckedChange={(v) => form.setValue("permite_saldo_negativo", v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asignando…
                </>
              ) : (
                "Asignar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
