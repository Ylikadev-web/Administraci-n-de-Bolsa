-- Helpers para UI de aportes / préstamos (solo auth.uid())
-- Ejecutar también en SQL Editor: scripts/APORTES_PRESTAMOS_HELPERS.sql

create or replace function public.listar_destinos_aporte()
returns table (
  bolsa_id uuid,
  nombre text,
  moneda text,
  usuario_id uuid,
  usuario_nombre text,
  es_general boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  return query
  select distinct on (x.bolsa_id)
    x.bolsa_id,
    x.nombre,
    x.moneda,
    x.usuario_id,
    x.usuario_nombre,
    x.es_general
  from (
    -- Bolsas donde ya soy miembro (General, propias, asignadas)
    select
      b.id as bolsa_id,
      b.nombre,
      b.moneda,
      coalesce(
        (select bm2.usuario_id from public.bolsa_miembros bm2
         where bm2.bolsa_id = b.id and bm2.usuario_id <> v_uid
         order by bm2.created_at asc limit 1),
        b.created_by
      ) as usuario_id,
      coalesce(
        (select p2.nombre from public.bolsa_miembros bm2
         join public.perfiles p2 on p2.id = bm2.usuario_id
         where bm2.bolsa_id = b.id and bm2.usuario_id <> v_uid
         order by bm2.created_at asc limit 1),
        (select p3.nombre from public.perfiles p3 where p3.id = b.created_by)
      ) as usuario_nombre,
      b.es_general
    from public.bolsa_miembros bm
    join public.bolsas b on b.id = bm.bolsa_id
    where bm.usuario_id = v_uid
      and b.archivada = false
      and b.parent_id is null

    union all

    -- Propias de otros (aunque no sea miembro) — necesarias para prestar/aportar
    select
      b.id,
      b.nombre,
      b.moneda,
      b.created_by,
      p.nombre,
      false
    from public.bolsas b
    join public.perfiles p on p.id = b.created_by
    where b.archivada = false
      and b.parent_id is null
      and b.es_general = false
      and b.assigned_by_admin is null
      and b.created_by <> v_uid
      and p.activo = true
  ) x
  order by x.bolsa_id, x.es_general desc;
end;
$$;

revoke all on function public.listar_destinos_aporte() from public;
revoke all on function public.listar_destinos_aporte() from anon;
grant execute on function public.listar_destinos_aporte() to authenticated;
grant execute on function public.listar_destinos_aporte() to service_role;

create or replace function public.mis_prestamos()
returns table (
  prestamo_id uuid,
  acreedor_id uuid,
  acreedor_nombre text,
  deudor_id uuid,
  deudor_nombre text,
  bolsa_origen_id uuid,
  bolsa_destino_id uuid,
  monto_original numeric,
  monto_pagado numeric,
  saldo_pendiente numeric,
  plazo_dias integer,
  fecha_ejecucion date,
  fecha_vencimiento date,
  estado_vencimiento text,
  descripcion text,
  moneda text,
  rol text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  return query
  select
    m.id as prestamo_id,
    m.autor_id as acreedor_id,
    pa.nombre as acreedor_nombre,
    m.contraparte_usuario_id as deudor_id,
    coalesce(pd.nombre, '—') as deudor_nombre,
    m.bolsa_id as bolsa_origen_id,
    m.contraparte_bolsa_id as bolsa_destino_id,
    m.monto as monto_original,
    coalesce((
      select sum(pago.monto)
      from public.movimientos pago
      where pago.prestamo_id = m.id
        and pago.estado = 'activo'
        and pago.naturaleza_aporte in ('pago_deuda', 'reembolso')
        and pago.tipo = 'aporte_enviado'
    ), 0)::numeric as monto_pagado,
    (m.monto - coalesce((
      select sum(pago.monto)
      from public.movimientos pago
      where pago.prestamo_id = m.id
        and pago.estado = 'activo'
        and pago.naturaleza_aporte in ('pago_deuda', 'reembolso')
        and pago.tipo = 'aporte_enviado'
    ), 0))::numeric as saldo_pendiente,
    m.plazo_dias,
    m.fecha_ejecucion,
    m.fecha_vencimiento,
    case
      when m.fecha_vencimiento is null then 'sin_vencimiento'
      when m.fecha_vencimiento < current_date then 'vencido'
      when m.fecha_vencimiento <= current_date + 3 then 'proximo_3d'
      when m.fecha_vencimiento <= current_date + 7 then 'proximo_7d'
      else 'al_corriente'
    end as estado_vencimiento,
    m.descripcion,
    m.moneda,
    case when m.autor_id = v_uid then 'acreedor' else 'deudor' end as rol
  from public.movimientos m
  join public.perfiles pa on pa.id = m.autor_id
  left join public.perfiles pd on pd.id = m.contraparte_usuario_id
  where m.tipo = 'aporte_enviado'
    and m.naturaleza_aporte = 'prestamo'
    and m.estado = 'activo'
    and (m.autor_id = v_uid or m.contraparte_usuario_id = v_uid)
  order by m.fecha_ejecucion desc nulls last, m.created_at desc;
end;
$$;

revoke all on function public.mis_prestamos() from public;
revoke all on function public.mis_prestamos() from anon;
grant execute on function public.mis_prestamos() to authenticated;
grant execute on function public.mis_prestamos() to service_role;
