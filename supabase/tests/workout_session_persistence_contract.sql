\set ON_ERROR_STOP on
\pset pager off

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$function$;

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);
set role authenticated;

select pg_temp.assert_true(
  (select count(*) >= 2 from public.historico_treinos),
  'CONTRACT removed authenticated history SELECT'
);

\set ON_ERROR_STOP off
insert into public.historico_treinos (
  id_usuario,
  id_treino,
  duracao_segundos
)
values (
  '11111111-1111-4111-8111-111111111111',
  900003,
  1
);
\set insert_sqlstate :SQLSTATE

update public.historico_treinos
set total_series = total_series + 1
where id_usuario = '11111111-1111-4111-8111-111111111111';
\set update_sqlstate :SQLSTATE

select nextval('public.historico_treinos_id_historico_seq');
\set sequence_sqlstate :SQLSTATE
\set ON_ERROR_STOP on

select pg_temp.assert_true(:'insert_sqlstate' = '42501', 'CONTRACT left direct history INSERT');
select pg_temp.assert_true(:'update_sqlstate' = '42501', 'CONTRACT left direct history UPDATE');
select pg_temp.assert_true(:'sequence_sqlstate' = '42501', 'CONTRACT left history sequence access');

-- V2 RPCs remain operational after the legacy writer is removed.
select
  result ->> 'id_sessao' as session_id,
  (result ->> 'revisao')::bigint as revision
from (
  select public.iniciar_treino_sessao(900003, 60) as result
) as started
\gset v2_

select
  (result ->> 'descartada')::boolean as discarded
from (
  select public.cancelar_treino_sessao(
    :'v2_session_id'::uuid,
    :v2_revision
  ) as result
) as canceled
\gset v2_cancel_

select pg_temp.assert_true(
  :'v2_cancel_discarded'::boolean,
  'V2 RPC boundary stopped working after CONTRACT'
);

reset role;

select pg_temp.assert_true(
  (
    select count(*) = 2
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public'
      and p.tablename in ('historico_treinos', 'historico_exercicios')
      and p.cmd = 'SELECT'
      and 'authenticated' = any (p.roles)
  ),
  'CONTRACT did not preserve exactly the two history read policies'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public'
      and p.tablename in ('historico_treinos', 'historico_exercicios')
      and p.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and p.roles && array['public', 'anon', 'authenticated']::name[]
  ),
  'CONTRACT left a Data API history write policy'
);

select 'CONTRACT_BEHAVIOR_TESTS_OK' as result;
