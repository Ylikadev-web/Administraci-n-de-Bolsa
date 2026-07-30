import Link from "next/link";
import { ArrowRight, Lock, Eye, Gift, X, FolderArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Landing() {
  return (
    <main className="min-h-dvh">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <span className="text-lg font-semibold tracking-tight">Bolsas</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/login">
              Entrar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="container flex flex-col items-center gap-6 py-16 text-center md:py-24">
        <span className="rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Sistema privado para 3 usuarios
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Cada quien maneja lo suyo. <br />
          Lo compartido es de los tres.
        </h1>
        <p className="max-w-2xl text-balance text-muted-foreground md:text-lg">
          Bolsas personales privadas, una Bolsa General visible para todos,
          aportes entre usuarios con trazabilidad contable, y saldos siempre
          correctos.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">
              Ingresar con mi correo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-4 pb-24 md:grid-cols-2 lg:grid-cols-3">
        <Rule icon={<Lock className="h-5 w-5" />} title="Bolsas privadas">
          Cada dueño ve únicamente su saldo y sus movimientos.
        </Rule>
        <Rule icon={<Eye className="h-5 w-5" />} title="Bolsa General visible">
          Los tres pueden gestionar, con auditoría por autor.
        </Rule>
        <Rule icon={<Gift className="h-5 w-5" />} title="Aportar sí">
          Cualquiera puede sumar saldo a la bolsa de otro con motivo formal.
        </Rule>
        <Rule icon={<X className="h-5 w-5" />} title="Retirar de bolsa ajena, no">
          Solo el dueño saca dinero de su propia bolsa.
        </Rule>
        <Rule icon={<FolderArchive className="h-5 w-5" />} title="Nada se elimina">
          Movimientos se anulan, bolsas se archivan.
        </Rule>
        <Rule icon={<Lock className="h-5 w-5" />} title="RLS + Auditoría">
          Seguridad a nivel de base de datos y bitácora completa.
        </Rule>
      </section>
    </main>
  );
}

function Rule({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
