"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SessionRecoverButton({
  label = "Cerrar sesión y volver a entrar",
}: {
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-3"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.assign("/login?reason=session");
      }}
    >
      {label}
    </Button>
  );
}
