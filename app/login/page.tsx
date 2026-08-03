import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Entrar — Bolsas",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { reason?: string };
}) {
  const sessionReset = searchParams?.reason === "session";

  return (
    <main className="min-h-dvh">
      <header className="container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <span className="text-lg font-semibold tracking-tight">Bolsas</span>
        </Link>
        <ThemeToggle />
      </header>
      <div className="container flex justify-center py-12 md:py-24">
        <div className="w-full max-w-sm">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Bienvenido de vuelta
            </h1>
            <p className="text-sm text-muted-foreground">
              Entra con tu correo y contraseña, o pide un enlace mágico.
            </p>
          </div>
          {sessionReset && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs text-amber-800 dark:text-amber-200">
              Sesión reiniciada. Si viste un error de JWT/hora: en Windows
              activa &quot;Ajustar la hora automáticamente&quot; y luego entra de
              nuevo.
            </div>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
