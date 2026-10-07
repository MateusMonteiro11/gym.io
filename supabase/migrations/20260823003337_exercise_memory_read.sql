-- Gym.io V3.1 - Exercise Memory.
--
-- Additive read-only surface for the latest V2-materialized set of each
-- canonical exercise requested by the authenticated user.

create index historico_exercicios_memoria_exercicio_idx
  on public.historico_exercicios (
    id_exercicio,
    criado_em desc,
    id_historico_exercicio desc
  )
  include (
    id_historico,
    carga_utilizada,
    repeticoes_feitas
  )
  where concluido is true;

create or replace function public.buscar_memorias_exercicios(
  p_ids_exercicios bigint[]
)
returns table (
  id_exercicio bigint,
  carga_utilizada numeric,
  repeticoes_feitas integer,
  criado_em timestamp without time zone,
  id_historico_exercicio bigint,
  id_historico bigint,
  id_sessao uuid
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select distinct on (he.id_exercicio)
    he.id_exercicio,
    he.carga_utilizada,
    he.repeticoes_feitas::integer,
    he.criado_em,
    he.id_historico_exercicio,
    he.id_historico,
    ht.id_sessao
  from public.historico_exercicios as he
  join public.historico_treinos as ht
    on ht.id_historico = he.id_historico
  join public.treino_sessoes as ts
    on ts.id_sessao = ht.id_sessao
   and ts.id_usuario = ht.id_usuario
  where (select auth.uid()) is not null
    and ht.id_usuario = (select auth.uid())
    and ts.status = 'finalizada'
    and he.concluido is true
    and he.id_exercicio = any(
      coalesce(p_ids_exercicios, array[]::bigint[])
    )
  order by
    he.id_exercicio,
    he.criado_em desc,
    he.id_historico_exercicio desc;
$function$;

alter function public.buscar_memorias_exercicios(bigint[])
  owner to postgres;

revoke all on function public.buscar_memorias_exercicios(bigint[])
  from public, anon, authenticated, service_role;
grant execute on function public.buscar_memorias_exercicios(bigint[])
  to authenticated;

do $assertions$
declare
  v_function oid := to_regprocedure(
    'public.buscar_memorias_exercicios(bigint[])'
  );
begin
  if v_function is null then
    raise exception 'Exercise Memory read function is missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as p
    where p.oid = v_function
      and (
        p.prosecdef
        or p.provolatile <> 's'
        or pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres'
        or not (
          coalesce(p.proconfig, array[]::text[])
            @> array['search_path=""']::text[]
        )
      )
  ) then
    raise exception 'Exercise Memory read function security contract is invalid';
  end if;

  if has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('service_role', v_function, 'EXECUTE')
     or not has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'Exercise Memory read function grants are invalid';
  end if;
end
$assertions$;