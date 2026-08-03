-- Cerrar mes contable de una bolsa (marca movimientos.cerrado + inserta resumen)

create or replace function public.cerrar_mes_bolsa(
  p_bolsa_id uuid,
  p_mes_contable date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mes date := date_trunc('month', p_mes_contable)::date;
  v_cierre_id uuid;
  v_ingresos numeric := 0;
  v_gastos numeric := 0;
  v_saldo_final numeric := 0;
  v_saldo_inicial numeric := 0;
  v_ya uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not public.es_miembro_bolsa(p_bolsa_id) then
    raise exception 'No tienes acceso a esta bolsa';
  end if;
  -- Solo meses ya terminados (no el mes en curso)
  if v_mes >= date_trunc('month', current_date)::date then
    raise exception 'Solo puedes cerrar meses anteriores al actual';
  end if;

  select id into v_ya
  from public.cierres_mensuales
  where bolsa_id = p_bolsa_id and mes_contable = v_mes;
  if v_ya is not null then
    raise exception 'Ese mes ya está cerrado';
  end if;

  select
    coalesce(sum(case when m.tipo in ('ingreso','aporte_recibido','saldo_apertura') then m.monto else 0 end), 0),
    coalesce(sum(case when m.tipo in ('gasto','aporte_enviado') then m.monto else 0 end), 0)
  into v_ingresos, v_gastos
  from public.movimientos m
  where m.bolsa_id = p_bolsa_id
    and m.mes_contable = v_mes
    and m.estado = 'activo';

  -- Saldo al cierre del mes = saldo de todos los activos con fecha_ejecucion/mes <= fin de mes
  -- Aproximación: saldo_inicial = saldo_total actual - neto de meses posteriores + ajuste
  -- Más simple y auditable: saldo_final del mes = ingresos - gastos del mes + saldo al inicio
  -- saldo_inicial = suma signo de activos con mes_contable < v_mes
  select coalesce(sum(
    case
      when m.tipo = 'transferencia_interna' then
        case
          when m.descripcion = 'INTERN_OUT' then -m.monto
          when m.descripcion = 'INTERN_IN' then m.monto
          else 0
        end
      else m.monto * public.signo_movimiento(m.tipo)
    end
  ), 0)
  into v_saldo_inicial
  from public.movimientos m
  where m.bolsa_id = p_bolsa_id
    and m.estado = 'activo'
    and m.mes_contable < v_mes;

  v_saldo_final := v_saldo_inicial + v_ingresos - v_gastos
    + coalesce((
      select sum(
        case
          when m.descripcion = 'INTERN_OUT' then -m.monto
          when m.descripcion = 'INTERN_IN' then m.monto
          else 0
        end
      )
      from public.movimientos m
      where m.bolsa_id = p_bolsa_id
        and m.mes_contable = v_mes
        and m.estado = 'activo'
        and m.tipo = 'transferencia_interna'
    ), 0);

  insert into public.cierres_mensuales (
    bolsa_id, mes_contable, saldo_inicial, total_ingresos, total_gastos,
    saldo_final, cerrado_por
  ) values (
    p_bolsa_id, v_mes, v_saldo_inicial, v_ingresos, v_gastos,
    v_saldo_final, v_uid
  )
  returning id into v_cierre_id;

  update public.movimientos
    set cerrado = true
  where bolsa_id = p_bolsa_id
    and mes_contable = v_mes
    and estado = 'activo'
    and cerrado = false;

  insert into public.auditoria (entidad, entidad_id, accion, autor_id, contexto)
  values (
    'bolsa', p_bolsa_id, 'cerrar_mes', v_uid,
    jsonb_build_object(
      'mes', v_mes,
      'ingresos', v_ingresos,
      'gastos', v_gastos,
      'saldo_final', v_saldo_final,
      'cierre_id', v_cierre_id
    )
  );

  return v_cierre_id;
end;
$$;

revoke all on function public.cerrar_mes_bolsa(uuid, date) from public;
revoke all on function public.cerrar_mes_bolsa(uuid, date) from anon;
grant execute on function public.cerrar_mes_bolsa(uuid, date) to authenticated;
grant execute on function public.cerrar_mes_bolsa(uuid, date) to service_role;
