"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";

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
import { cn } from "@/lib/utils";
import {
  bolsaGeneralSchema,
  COLORES_BOLSA,
  type BolsaGeneralInput,
} from "@/lib/schemas/admin-bolsa";
import { crearBolsaGeneral } from "@/app/dashboard/actions";

type UsuarioOpt = { id: string; nombre: string; email: string };

export function CrearBolsaGeneralButton({
  usuarios,
}: {
  usuarios: UsuarioOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<BolsaGeneralInput>({
    resolver: zodResolver(bolsaGeneralSchema),
    defaultValues: {
      nombre: "Bolsa General",
      color: "#eab308",
      icono: "users",
      moneda: "MXN",
      co_owner_ids: usuarios.map((u) => u.id),
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        nombre: "Bolsa General",
        color: "#eab308",
        icono: "users",
        moneda: "MXN",
        co_owner_ids: usuarios.map((u) => u.id),
      });
    }
  }, [open, usuarios, form]);

  const coOwners = form.watch("co_owner_ids") ?? [];
  const color = form.watch("color");

  const toggleOwner = (id: string) => {
    const set = new Set(coOwners);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    form.setValue("co_owner_ids", Array.from(set), { shouldValidate: true });
  };

  const onSubmit = async (values: BolsaGeneralInput) => {
    const res = await crearBolsaGeneral(values);
    if (!res.ok) {
      toast.error("No se pudo crear la Bolsa General", { description: res.error });
      return;
    }
    toast.success("Bolsa General creada");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          Crear Bolsa General
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Bolsa General</DialogTitle>
          <DialogDescription>
            Solo puede existir una Bolsa General activa. Tú quedas como
            co-propietario automáticamente; elige quién más participa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre-general">Nombre</Label>
            <Input id="nombre-general" {...form.register("nombre")} />
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
                    "h-7 w-7 rounded-full border-2 transition-all",
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent opacity-80 hover:opacity-100",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Co-propietarios</Label>
            <ul className="space-y-2 rounded-lg border p-3">
              {usuarios.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No hay otros usuarios activos todavía.
                </li>
              ) : (
                usuarios.map((u) => {
                  const checked = coOwners.includes(u.id);
                  return (
                    <li key={u.id}>
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOwner(u.id)}
                          className="h-4 w-4 rounded border"
                        />
                        <span className="font-medium">{u.nombre}</span>
                        <span className="text-muted-foreground">{u.email}</span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                "Crear Bolsa General"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
