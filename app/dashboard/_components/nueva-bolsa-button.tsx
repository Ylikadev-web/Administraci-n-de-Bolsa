"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { BolsaDialog } from "@/app/dashboard/_components/bolsa-dialog";

export function NuevaBolsaButton({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{children}</Button>
      <BolsaDialog
        open={open}
        onOpenChange={setOpen}
        mode="create"
      />
    </>
  );
}
