drop policy if exists "bolsas: ver si soy miembro o admin" on public.bolsas;
create policy "bolsas: ver solo si soy miembro"
  on public.bolsas for select to authenticated
  using (public.es_miembro_bolsa(id));

drop policy if exists "bolsa_miembros: ver si comparto la bolsa" on public.bolsa_miembros;
create policy "bolsa_miembros: ver si soy miembro"
  on public.bolsa_miembros for select to authenticated
  using (public.es_miembro_bolsa(bolsa_id));

create or replace function public.saldo_bolsa(p_bolsa_id uuid)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result numeric;
begin
  if v_uid is null then return null; end if;
  if not public.es_miembro_bolsa(p_bolsa_id) then
    return null;
  end if;
  select coalesce(sum(
    case
      when m.tipo = 'transferencia_interna' then
        case
          when m.descripcion = 'INTERN_OUT' then -m.monto
          when m.descripcion = 'INTERN_IN'  then  m.monto
          else 0
        end
      else m.monto * public.signo_movimiento(m.tipo)
    end
  ), 0)
  into v_result
  from public.movimientos m
  where m.bolsa_id = p_bolsa_id and m.estado = 'activo';
  return v_result;
end;
$$;
