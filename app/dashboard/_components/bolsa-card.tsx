import Link from "next/link";
import { Lock, Users, Key, MoreHorizontal, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatMoney, cn } from "@/lib/utils";
import { BolsaIcon } from "@/app/dashboard/_components/bolsa-icon";
import { ArchivarBolsaMenuItem } from "@/app/dashboard/_components/archivar-bolsa-menu-item";

export async function BolsaCard({
  id,
  nombre,
  descripcion,
  color,
  icono,
  moneda,
  esGeneral,
  esAsignada,
  esMio,
  metaHabilitada,
  metaMonto,
}: {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  moneda: string;
  esGeneral: boolean;
  esAsignada: boolean;
  esMio: boolean;
  metaHabilitada: boolean;
  metaMonto: number | null;
}) {
  const supabase = createClient();
  const { data: saldoData } = await supabase.rpc("saldo_bolsa", {
    p_bolsa_id: id,
  });
  const saldoNum = saldoData ? Number(saldoData) : 0;

  const progreso =
    metaHabilitada && metaMonto && metaMonto > 0
      ? Math.min(100, Math.max(0, (saldoNum / metaMonto) * 100))
      : null;

  const puedeAdmin = esMio && !esGeneral && !esAsignada;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-colors hover:border-primary/40",
        esGeneral && "border-warning/40 bg-warning/5",
        esAsignada && "border-primary/30",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: color }}
      />
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <Link href={`/dashboard/bolsa/${id}`} className="flex flex-1 items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            <BolsaIcon name={icono} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold">{nombre}</h3>
              {esGeneral ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  <Users className="h-3 w-3" />
                  General
                </span>
              ) : esAsignada ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Key className="h-3 w-3" />
                  Asignada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Propia
                </span>
              )}
            </div>
            {descripcion && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {descripcion}
              </p>
            )}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild disabled={!puedeAdmin}>
              <Link href={`/dashboard/bolsa/${id}?edit=1`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </DropdownMenuItem>
            {puedeAdmin && (
              <>
                <DropdownMenuSeparator />
                <ArchivarBolsaMenuItem bolsaId={id} nombre={nombre} />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="pt-2">
        <Link href={`/dashboard/bolsa/${id}`} className="block">
          <p className="text-2xl font-semibold tracking-tight">
            {formatMoney(saldoNum, moneda)}
          </p>
          {progreso !== null && metaMonto && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta</span>
                <span>
                  {formatMoney(saldoNum, moneda)} / {formatMoney(metaMonto, moneda)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progreso}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}
