import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { Wallet } from "lucide-react";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-dvh">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <span className="text-lg font-semibold tracking-tight">Bolsas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:inline">
            {user.email}
          </span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <section className="container py-12">
        <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Ya estás dentro</h1>
          <p className="mt-2 text-muted-foreground">
            El sistema de bolsas se activará cuando conectemos el proyecto
            Supabase. Sigue las instrucciones del README para provisionar la
            base de datos y las variables de entorno.
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" disabled>
              Ver mis bolsas (próximo PR)
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
