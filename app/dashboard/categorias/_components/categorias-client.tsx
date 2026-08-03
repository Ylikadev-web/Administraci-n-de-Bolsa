"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  categoriaSchema,
  type CategoriaInput,
} from "@/lib/schemas/categoria";
import {
  crearCategoria,
  eliminarCategoria,
} from "@/app/dashboard/categorias/actions";
import type { CategoriaItem } from "@/lib/categorias/queries";

const TIPO_LABEL = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  ambos: "Ambos",
} as const;

export function CategoriasClient({ items }: { items: CategoriaItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const form = useForm<CategoriaInput>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nombre: "", tipo: "gasto", color: "#64748b" },
  });

  const onCreate = async (values: CategoriaInput) => {
    const result = await crearCategoria(values);
    if (!result.ok) {
      toast.error("No se pudo crear", { description: result.error });
      return;
    }
    toast.success("Categoría creada");
    form.reset({ nombre: "", tipo: "gasto", color: "#64748b" });
    router.refresh();
  };

  const onDelete = async (id: string) => {
    setBusyId(id);
    const result = await eliminarCategoria(id);
    setBusyId(null);
    if (!result.ok) {
      toast.error("No se pudo eliminar", { description: result.error });
      return;
    }
    toast.success("Categoría eliminada");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={form.handleSubmit(onCreate)}
        className="rounded-lg border bg-card p-4 space-y-3"
      >
        <p className="text-sm font-medium">Nueva categoría</p>
        <div className="grid gap-3 sm:grid-cols-[1fr,140px,100px,auto]">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-cat">Nombre</Label>
            <Input
              id="nombre-cat"
              placeholder="Ej. Comida, Sueldo…"
              {...form.register("nombre")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo-cat">Tipo</Label>
            <select
              id="tipo-cat"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...form.register("tipo")}
            >
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color-cat">Color</Label>
            <Input id="color-cat" type="color" {...form.register("color")} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </>
              )}
            </Button>
          </div>
        </div>
        {form.formState.errors.nombre && (
          <p className="text-xs text-destructive">
            {form.formState.errors.nombre.message}
          </p>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <p className="font-medium">Sin categorías aún</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea categorías para clasificar ingresos y gastos.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIPO_LABEL[c.tipo]}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={busyId === c.id}
                onClick={() => onDelete(c.id)}
              >
                {busyId === c.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
