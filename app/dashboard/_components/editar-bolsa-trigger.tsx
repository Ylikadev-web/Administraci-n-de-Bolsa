"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { BolsaDialog } from "@/app/dashboard/_components/bolsa-dialog";

interface Bolsa {
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
}

export function EditarBolsaTrigger({
  bolsa,
  autoOpen = false,
  children,
}: {
  bolsa: Bolsa;
  autoOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(autoOpen);

  React.useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {children}
      </Button>
      <BolsaDialog
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        bolsa={bolsa}
      />
    </>
  );
}
