"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { archivarBolsa } from "@/app/dashboard/actions";

export function ArchivarBolsaMenuItem({
  bolsaId,
  nombre,
}: {
  bolsaId: string;
  nombre: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  const handle = () => {
    startTransition(async () => {
      const res = await archivarBolsa(bolsaId);
      if (!res.ok) {
        toast.error("No se pudo archivar", { description: res.error });
        return;
      }
      toast.success("Bolsa archivada");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-destructive focus:text-destructive"
      >
        <Archive className="mr-2 h-4 w-4" />
        Archivar
      </DropdownMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archivar &quot;{nombre}&quot;</DialogTitle>
            <DialogDescription>
              La bolsa desaparecerá de tu lista, pero su historial se
              conservará. Para archivar, el saldo debe ser exactamente 0.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handle}
              disabled={pending}
            >
              {pending ? "Archivando..." : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
