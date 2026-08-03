-- Helpers para UI de aportes / préstamos (seguridad: solo auth.uid())
-- También en scripts/APORTES_PRESTAMOS_HELPERS.sql para SQL Editor.

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
  -- Bolsa General (si existe y está activa)
  select
    b.id,
    b.nombre,
    b.moneda,
    coalesce(
      (select bm.usuario_id from public.bolsa_miembros bm
       where bm.bolsa_id = b.id order by bm.created_at asc limit 1),
      b.created_by
    ),
    coalesce(
      (select p.nombre from public.bolsa_miembros bm
       join public.perfiles p on p.id = bm.usuario_id
       where bm.bolsa_id = b.id order by bm.created_at asc limit 1),
      'General'
    ),
    true
  from public.bolsas b
  where b.es_general = true
    and b.archivada = false
    and b.parent_id is null

  union all

  -- Bolsas propias de otros usuarios (para poder aportar / prestar)
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

  union all

  -- Bolsas asignadas de otros donde yo también soy miembro (admin)
  select
    b.id,
    b.nombre,
    b.moneda,
    b.created_by,
    p.nombre,
    false
  from public.bolsas b
  join public.perfiles p on p.id = b.created_by
  join public.bolsa_miembros me on me.bolsa_id = b.id and me.usuario_id = v_uid
  where b.archivada = false
    and b.parent_id is null
    and b.assigned_by_admin is not null
    and b.created_by <> v_uid;
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
    pd.nombre as deudor_nombre,
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
    ), 0) as monto_pagado,
    m.monto - coalesce((
      select sum(pago.monto)
      from public.movimientos pago
      where pago.prestamo_id = m.id
        and pago.estado = 'activo'
        and pago.naturaleza_aporte in ('pago_deuda', 'reembolso')
        and pago.tipo = 'aporte_enviado'
    ), 0) as saldo_pendiente,
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
    case
      when m.autor_id = v_uid then 'acreedor'
      else 'deudor'
    end as rol
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
