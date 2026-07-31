import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Users, Key, Plus, MoreVertical, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { BolsaIcon } from "@/app/dashboard/_components/bolsa-icon";
import { EditarBolsaTrigger } from "@/app/dashboard/_components/editar-bolsa-trigger";
import { formatMoney } from "@/lib/utils";
import type { Bolsa } from "@/lib/supabase/types";

export default async function BolsaDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { edit?: string };
}) {
  const supabase = createClient();
  const { data: bolsa } = await supabase
    .from("bolsas")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<Bolsa>();

  if (!bolsa) notFound();

  const { data: saldoRaw } = await supabase.rpc("saldo_bolsa", {
    p_bolsa_id: bolsa.id,
  });
  const saldo = saldoRaw ? Number(saldoRaw) : 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const esMio = user?.id === bolsa.created_by;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-4 rounded-lg border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: bolsa.color }}
          >
            <BolsaIcon name={bolsa.icono} className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {bolsa.nombre}
              </h1>
              {bolsa.es_general ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                  <Users className="h-3 w-3" />
                  Bolsa General
                </span>
              ) : bolsa.assigned_by_admin ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  <Key className="h-3 w-3" />
                  Asignada por administrador
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Propia
                </span>
              )}
            </div>
            {bolsa.descripcion && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {bolsa.descripcion}
              </p>
            )}
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatMoney(saldo, bolsa.moneda)}
            </p>
            <p className="text-xs text-muted-foreground">Saldo actual</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled title="Se habilita en el próximo PR">
            <Plus className="mr-2 h-4 w-4" />
            Registrar movimiento
          </Button>
          {esMio && !bolsa.es_general && !bolsa.assigned_by_admin && (
            <EditarBolsaTrigger
              autoOpen={searchParams?.edit === "1"}
              bolsa={{
                id: bolsa.id,
                nombre: bolsa.nombre,
                descripcion: bolsa.descripcion,
                color: bolsa.color,
                icono: bolsa.icono,
                moneda: bolsa.moneda,
                permite_saldo_negativo: bolsa.permite_saldo_negativo,
                meta_habilitada: bolsa.meta_habilitada,
                meta_monto: bolsa.meta_monto,
                meta_fecha: bolsa.meta_fecha,
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </EditarBolsaTrigger>
          )}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MoreVertical className="h-5 w-5" />
          </div>
          <h2 className="font-semibold">Movimientos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El listado con drawer lateral llega en el próximo PR.
          </p>
        </div>
        <aside className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Reglas de esta bolsa</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              {bolsa.es_general
                ? "Todos los movimientos pasan por la aprobación del administrador."
                : bolsa.assigned_by_admin
                ? "Solo puedes solicitar ingresos y gastos; el administrador aprueba."
                : "Tú registras movimientos libremente en tu bolsa propia."}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              {bolsa.permite_saldo_negativo
                ? "Permite saldo negativo."
                : "No permite saldo negativo."}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              Los movimientos no se eliminan, solo se anulan con motivo.
            </li>
            {bolsa.meta_habilitada && bolsa.meta_monto && (
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                Meta: {formatMoney(Number(bolsa.meta_monto), bolsa.moneda)}
                {bolsa.meta_fecha && ` para ${bolsa.meta_fecha}`}
              </li>
            )}
          </ul>
        </aside>
      </section>
    </div>
  );
}
