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

insert into public.usuarios (id_usuario, nome, email)
values
  ('11111111-1111-4111-8111-111111111111', 'Teste Um', 'teste1@gymio.local'),
  ('22222222-2222-4222-8222-222222222222', 'Teste Dois', 'teste2@gymio.local');

insert into public.exercicios (id_exercicio, nome)
overriding system value
values
  (900001, 'Exercicio A'),
  (900002, 'Exercicio B'),
  (900003, 'Exercicio C');

insert into public.treinos (
  id_treino,
  nome,
  id_usuario,
  tipo_treino,
  tipo
)
overriding system value
values
  (900001, 'Fluxo principal', '11111111-1111-4111-8111-111111111111', 'usuario', 'usuario'),
  (900002, 'Fluxo cancelamento', '11111111-1111-4111-8111-111111111111', 'usuario', 'usuario'),
  (900003, 'Fluxo conflito', '11111111-1111-4111-8111-111111111111', 'usuario', 'usuario'),
  (900004, 'Outro usuario', '22222222-2222-4222-8222-222222222222', 'usuario', 'usuario');

insert into public.secoes_treino (id_secao, id_treino, nome, ordem)
overriding system value
values
  (900001, 900001, 'Principal', 1),
  (900002, 900002, 'Cancelamento', 1),
  (900003, 900003, 'Conflito', 1),
  (900004, 900004, 'Outro usuario', 1);

insert into public.treinos_exercicios (
  id_treino_exercicio,
  series,
  repeticoes,
  carga,
  descanso_segundos,
  ordem,
  id_treino,
  id_exercicio,
  id_secao
)
overriding system value
values
  (900001, 2, 10, 50, 120, '1', 900001, 900001, 900001),
  (900002, 2, 8, 60, 120, '2', 900001, 900002, 900001),
  (900003, 1, 6, 70, 0, '3', 900001, 900003, 900001),
  (900004, 2, 10, 40, 60, '1', 900002, 900001, 900002),
  (900005, 1, 10, 40, 0, '1', 900003, 900001, 900003),
  (900006, 1, 10, 40, 0, '1', 900004, 900001, 900004);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);
set role authenticated;

-- New durable tables and the private schema are not directly writable/callable.
\set ON_ERROR_STOP off
select gymio_private.request_uid();
\set private_sqlstate :SQLSTATE
insert into public.treino_sessoes (
  id_usuario,
  id_treino,
  id_treino_exercicio_atual
)
values (
  '11111111-1111-4111-8111-111111111111',
  900001,
  900001
);
\set direct_dml_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'private_sqlstate' = '42501',
  'authenticated executed a private helper'
);
select pg_temp.assert_true(
  :'direct_dml_sqlstate' = '42501',
  'authenticated inserted directly into treino_sessoes'
);

select
  result ->> 'id_sessao' as session_id,
  (result ->> 'revisao')::bigint as revision,
  result ->> 'status' as status,
  result ->> 'fase' as phase
from (
  select public.iniciar_treino_sessao(900001, 60) as result
) as started
\gset main_

select pg_temp.assert_true(:'main_status' = 'ativa', 'start did not create an active session');
select pg_temp.assert_true(:'main_phase' = 'execucao', 'start did not begin in execution');
select pg_temp.assert_true(:main_revision = 0, 'new session revision is not zero');
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.treino_sessoes
    where id_sessao = :'main_session_id'::uuid
  ),
  'user A could not read their own session'
);

\set ON_ERROR_STOP off
insert into public.treino_sessao_series (
  id_sessao,
  id_treino,
  id_treino_exercicio,
  serie,
  carga_utilizada,
  repeticoes_feitas
)
values (
  :'main_session_id'::uuid,
  900001,
  900001,
  1,
  50,
  10
);
\set direct_series_dml_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'direct_series_dml_sqlstate' = '42501',
  'authenticated inserted directly into treino_sessao_series'
);

select
  result ->> 'id_sessao' as session_id
from (
  select public.iniciar_treino_sessao(900001, 60) as result
) as retried_start
\gset retry_start_

select pg_temp.assert_true(
  :'retry_start_session_id' = :'main_session_id',
  'same-workout start retry was not idempotent'
);

select
  (result ->> 'revisao')::bigint as revision,
  result ->> 'fase' as phase,
  (result ->> 'serie_atual')::integer as current_set,
  result ->> 'descanso_iniciado_em' as rest_started_at,
  result ->> 'descanso_termina_em' as rest_ends_at
from (
  select public.concluir_treino_serie(
    :'main_session_id'::uuid,
    :main_revision,
    10000.50,
    10
  ) as result
) as completed_first_set
\gset set1_

select pg_temp.assert_true(:set1_revision = 1, 'first completion did not increment revision');
select pg_temp.assert_true(:'set1_phase' = 'descanso', 'first completion did not start rest');
select pg_temp.assert_true(:set1_current_set = 2, 'first completion did not advance the set index');
select pg_temp.assert_true(
  (
    select descanso_segundos = 120
    from public.treinos_exercicios
    where id_treino_exercicio = 900001
  ),
  'rest precedence fixture does not differ from the selected session rest'
);
select pg_temp.assert_true(
  extract(epoch from (
    :'set1_rest_ends_at'::timestamptz - :'set1_rest_started_at'::timestamptz
  )) = 60,
  'session-selected rest did not override the prescribed exercise rest'
);

-- Authenticated users can read only completed series from their own sessions.
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.treino_sessao_series
    where id_sessao = :'main_session_id'::uuid
  ),
  'user A could not read their own completed series'
);

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  false
);
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.treino_sessao_series
    where id_sessao = :'main_session_id'::uuid
  ),
  'user B read completed series from user A'
);

reset role;
set role anon;
\set ON_ERROR_STOP off
select *
from public.treino_sessoes
where id_sessao = :'main_session_id'::uuid;
\set anon_session_sqlstate :SQLSTATE
select *
from public.treino_sessao_series
where id_sessao = :'main_session_id'::uuid;
\set anon_series_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'anon_session_sqlstate' = '42501',
  'anon read treino_sessoes'
);
select pg_temp.assert_true(
  :'anon_series_sqlstate' = '42501',
  'anon read treino_sessao_series'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);
set role authenticated;

\set ON_ERROR_STOP off
select public.concluir_treino_serie(
  :'main_session_id'::uuid,
  :main_revision,
  10000.50,
  10
);
\set stale_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(:'stale_sqlstate' = '40001', 'stale revision was accepted');

select
  (result ->> 'revisao')::bigint as revision,
  (result ->> 'pausada_em') is not null as has_pause
from (
  select public.definir_pausa_treino_sessao(
    :'main_session_id'::uuid,
    :set1_revision,
    true
  ) as result
) as paused
\gset pause_

select pg_temp.assert_true(:pause_revision = 2, 'pause did not increment revision');
select pg_temp.assert_true(:'pause_has_pause'::boolean, 'pause timestamp was not persisted');

-- Advance the simulated wall clock without waiting in real time. The general
-- timer accumulates the pause, but the independent rest deadline must not move.
reset role;
update public.treino_sessoes
set pausada_em = pausada_em - interval '30 seconds'
where id_sessao = :'main_session_id'::uuid;
set role authenticated;

select
  (result ->> 'revisao')::bigint as revision,
  (result ->> 'pausada_em') is null as pause_cleared,
  result ->> 'descanso_termina_em' as rest_ends_at
from (
  select public.definir_pausa_treino_sessao(
    :'main_session_id'::uuid,
    :pause_revision,
    false
  ) as result
) as resumed
\gset resume_

select pg_temp.assert_true(:resume_revision = 3, 'resume did not increment revision');
select pg_temp.assert_true(:'resume_pause_cleared'::boolean, 'resume did not clear pause timestamp');
select pg_temp.assert_true(
  :'resume_rest_ends_at'::timestamptz = :'set1_rest_ends_at'::timestamptz,
  'resume shifted the independent rest deadline'
);
select pg_temp.assert_true(
  (
    select segundos_pausados >= 30
    from public.treino_sessoes
    where id_sessao = :'main_session_id'::uuid
  ),
  'resume did not accumulate the simulated general-timer pause'
);

select
  (result ->> 'revisao')::bigint as revision,
  result ->> 'fase' as phase
from (
  select public.ajustar_descanso_treino_sessao(
    :'main_session_id'::uuid,
    :resume_revision,
    -300
  ) as result
) as adjusted_rest
\gset adjusted_

select pg_temp.assert_true(:adjusted_revision = 4, 'rest adjustment did not increment revision');
select pg_temp.assert_true(:'adjusted_phase' = 'execucao', 'negative adjustment did not end rest');

select
  (result ->> 'revisao')::bigint as revision,
  (result ->> 'id_treino_exercicio_atual')::bigint as workout_exercise_id,
  (result ->> 'indice_exercicio_atual')::integer as exercise_index
from (
  select public.concluir_treino_serie(
    :'main_session_id'::uuid,
    :adjusted_revision,
    55.00,
    9
  ) as result
) as completed_second_set
\gset set2_

select pg_temp.assert_true(:set2_revision = 5, 'second completion did not increment revision');
select pg_temp.assert_true(:set2_workout_exercise_id = 900002, 'last set did not advance exercise');
select pg_temp.assert_true(:set2_exercise_index = 1, 'exercise index is inconsistent');

select
  (result ->> 'revisao')::bigint as revision,
  result ->> 'fase' as phase
from (
  select public.concluir_treino_serie(
    :'main_session_id'::uuid,
    :set2_revision,
    60.00,
    8
  ) as result
) as completed_third_set
\gset set3_

select pg_temp.assert_true(:set3_revision = 6, 'third completion did not increment revision');
select pg_temp.assert_true(:'set3_phase' = 'descanso', 'third completion did not start rest');

-- Rest -> next exercise is one atomic transition and skips remaining sets.
select
  (result ->> 'revisao')::bigint as revision,
  result ->> 'fase' as phase,
  (result ->> 'id_treino_exercicio_atual')::bigint as workout_exercise_id,
  (result ->> 'indice_exercicio_atual')::integer as exercise_index
from (
  select public.avancar_exercicio_treino_sessao(
    :'main_session_id'::uuid,
    :set3_revision
  ) as result
) as advanced_during_rest
\gset advanced_

select pg_temp.assert_true(:advanced_revision = 7, 'advance did not increment revision');
select pg_temp.assert_true(:'advanced_phase' = 'execucao', 'advance did not clear rest');
select pg_temp.assert_true(:advanced_workout_exercise_id = 900003, 'advance chose the wrong exercise');
select pg_temp.assert_true(:advanced_exercise_index = 2, 'advance produced the wrong index');

\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid);
\set missing_revision_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'missing_revision_sqlstate' = '42883',
  'public finalization accepted an omitted revision'
);

select
  (result ->> 'revisao')::bigint as revision,
  result ->> 'status' as status
from (
  select public.finalizar_treino_sessao(
    :'main_session_id'::uuid,
    :advanced_revision
  ) as result
) as finalized
\gset final_

select pg_temp.assert_true(:'final_status' = 'finalizada', 'manual finalization did not finish');
select pg_temp.assert_true(:final_revision = 8, 'finalization did not increment revision');

select id_historico as history_id
from public.historico_treinos
where id_sessao = :'main_session_id'::uuid
\gset finalized_

select
  (result ->> 'revisao')::bigint as revision,
  result ->> 'status' as status
from (
  select public.finalizar_treino_sessao(
    :'main_session_id'::uuid,
    :advanced_revision
  ) as result
) as finalized_retry
\gset final_retry_

select pg_temp.assert_true(:'final_retry_status' = 'finalizada', 'finalization retry failed');
select pg_temp.assert_true(:final_retry_revision = 8, 'finalization retry mutated revision');
select pg_temp.assert_true(
  (
    select id_historico = :finalized_history_id
    from public.historico_treinos
    where id_sessao = :'main_session_id'::uuid
  ),
  'finalization retry did not preserve the same history row'
);

reset role;
select pg_temp.assert_true(
  (select count(*) = 1 from public.historico_treinos where id_sessao = :'main_session_id'::uuid),
  'finalization produced duplicate or missing history rows'
);
select pg_temp.assert_true(
  (
    select count(*) = 3
    from public.historico_exercicios as he
    join public.historico_treinos as ht using (id_historico)
    where ht.id_sessao = :'main_session_id'::uuid
  ),
  'finalization materialized the wrong completed-set count'
);
select pg_temp.assert_true(
  (
    select max(he.carga_utilizada) = 10000.50
    from public.historico_exercicios as he
    join public.historico_treinos as ht using (id_historico)
    where ht.id_sessao = :'main_session_id'::uuid
  ),
  'numeric(10,2) execution load did not reach the historical destination'
);

-- The legacy writer can still mutate the current user's V2 history during the
-- EXPAND window. Every operation below is intentionally allowed, but a retry
-- must fail closed while the materialization is inconsistent.
set role authenticated;

begin;
update public.historico_treinos
set total_series = total_series + 1
where id_historico = :finalized_history_id
returning id_historico as updated_history_id
\gset history_update_
\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid, :advanced_revision);
\set history_update_retry_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback;
select pg_temp.assert_true(
  :history_update_updated_history_id = :finalized_history_id,
  'authenticated could not update its own V2 history during EXPAND'
);
select pg_temp.assert_true(
  :'history_update_retry_sqlstate' = '55000',
  'retry accepted an updated V2 history'
);

begin;
delete from public.historico_treinos
where id_historico = :finalized_history_id
returning id_historico as deleted_history_id
\gset history_delete_
\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid, :advanced_revision);
\set history_delete_retry_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback;
select pg_temp.assert_true(
  :history_delete_deleted_history_id = :finalized_history_id,
  'authenticated could not delete its own V2 history during EXPAND'
);
select pg_temp.assert_true(
  :'history_delete_retry_sqlstate' = '55000',
  'retry accepted a missing V2 history'
);

begin;
insert into public.historico_exercicios (
  id_historico,
  id_exercicio,
  id_treino_exercicio,
  serie,
  carga_utilizada,
  repeticoes_feitas,
  concluido
)
values (
  :finalized_history_id,
  900001,
  900001,
  32767,
  1,
  1,
  true
)
returning id_historico_exercicio as inserted_history_set_id
\gset history_set_insert_
\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid, :advanced_revision);
\set history_set_insert_retry_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback;
select pg_temp.assert_true(
  :history_set_insert_inserted_history_set_id is not null,
  'authenticated could not insert a set into its own V2 history during EXPAND'
);
select pg_temp.assert_true(
  :'history_set_insert_retry_sqlstate' = '55000',
  'retry accepted an extra V2 historical set'
);

begin;
update public.historico_exercicios
set repeticoes_feitas = repeticoes_feitas + 1
where id_historico_exercicio = (
  select min(he.id_historico_exercicio)
  from public.historico_exercicios as he
  where he.id_historico = :finalized_history_id
)
returning id_historico_exercicio as updated_history_set_id
\gset history_set_update_
\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid, :advanced_revision);
\set history_set_update_retry_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback;
select pg_temp.assert_true(
  :history_set_update_updated_history_set_id is not null,
  'authenticated could not update its own V2 historical set during EXPAND'
);
select pg_temp.assert_true(
  :'history_set_update_retry_sqlstate' = '55000',
  'retry accepted an updated V2 historical set'
);

begin;
delete from public.historico_exercicios
where id_historico_exercicio = (
  select min(he.id_historico_exercicio)
  from public.historico_exercicios as he
  where he.id_historico = :finalized_history_id
)
returning id_historico_exercicio as deleted_history_set_id
\gset history_set_delete_
\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid, :advanced_revision);
\set history_set_delete_retry_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback;
select pg_temp.assert_true(
  :history_set_delete_deleted_history_set_id is not null,
  'authenticated could not delete its own V2 historical set during EXPAND'
);
select pg_temp.assert_true(
  :'history_set_delete_retry_sqlstate' = '55000',
  'retry accepted a missing V2 historical set'
);

select
  result ->> 'status' as status
from (
  select public.finalizar_treino_sessao(
    :'main_session_id'::uuid,
    :advanced_revision
  ) as result
) as valid_retry_after_rollbacks
\gset valid_after_rollback_
select pg_temp.assert_true(
  :'valid_after_rollback_status' = 'finalizada',
  'diagnostic rollbacks damaged the valid V2 materialization'
);

-- A different authenticated user cannot read or mutate this session.
reset role;
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  false
);
set role authenticated;
select pg_temp.assert_true(
  (select count(*) = 0 from public.treino_sessoes where id_sessao = :'main_session_id'::uuid),
  'RLS exposed another user session'
);
update public.historico_treinos
set total_series = total_series + 1
where id_historico = :finalized_history_id;
\set cross_user_history_update_count :ROW_COUNT
select pg_temp.assert_true(
  :cross_user_history_update_count = 0,
  'user B updated user A history'
);
delete from public.historico_exercicios
where id_historico = :finalized_history_id;
\set cross_user_history_delete_count :ROW_COUNT
select pg_temp.assert_true(
  :cross_user_history_delete_count = 0,
  'user B deleted user A historical sets'
);
\set ON_ERROR_STOP off
insert into public.historico_exercicios (
  id_historico,
  id_exercicio,
  id_treino_exercicio,
  serie,
  carga_utilizada,
  repeticoes_feitas,
  concluido
)
values (:finalized_history_id, 900001, 900001, 32767, 1, 1, true);
\set cross_user_history_insert_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'cross_user_history_insert_sqlstate' = '42501',
  'user B inserted into user A history'
);
\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(:'main_session_id'::uuid, 8);
\set ownership_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(:'ownership_sqlstate' = 'P0002', 'cross-user mutation was not rejected');

-- Anon cannot execute the public SECURITY DEFINER facade.
reset role;
set role anon;
\set ON_ERROR_STOP off
select public.iniciar_treino_sessao(900004, 60);
\set anon_execute_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(:'anon_execute_sqlstate' = '42501', 'anon executed a V2 RPC');

-- Session uniqueness, cancellation discard and cascade.
reset role;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);
set role authenticated;
select
  result ->> 'id_sessao' as session_id,
  (result ->> 'revisao')::bigint as revision
from (
  select public.iniciar_treino_sessao(900002, 60) as result
) as cancel_started
\gset cancel_

\set ON_ERROR_STOP off
select public.iniciar_treino_sessao(900003, 60);
\set unique_active_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(:'unique_active_sqlstate' = '23505', 'second active session was accepted');

select
  (result ->> 'revisao')::bigint as revision
from (
  select public.concluir_treino_serie(
    :'cancel_session_id'::uuid,
    :cancel_revision,
    40,
    10
  ) as result
) as cancel_completed
\gset cancel_set_

select
  result ->> 'status' as status,
  (result ->> 'descartada')::boolean as discarded
from (
  select public.cancelar_treino_sessao(
    :'cancel_session_id'::uuid,
    :cancel_set_revision
  ) as result
) as canceled
\gset canceled_

select pg_temp.assert_true(:'canceled_status' = 'cancelada', 'cancel returned the wrong status');
select pg_temp.assert_true(:'canceled_discarded'::boolean, 'cancel did not report transient discard');

select
  (result ->> 'descartada')::boolean as discarded
from (
  select public.cancelar_treino_sessao(
    :'cancel_session_id'::uuid,
    :cancel_set_revision
  ) as result
) as canceled_retry
\gset canceled_retry_

select pg_temp.assert_true(:'canceled_retry_discarded'::boolean, 'cancel retry was not idempotent');

reset role;
select pg_temp.assert_true(
  (select count(*) = 0 from public.treino_sessoes where id_sessao = :'cancel_session_id'::uuid),
  'cancel retained the transient session'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.treino_sessao_series where id_sessao = :'cancel_session_id'::uuid),
  'cancel did not cascade transient sets'
);

-- The deployed V1 writer remains operational after EXPAND.
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);
set role authenticated;
insert into public.historico_treinos (
  id_usuario,
  id_treino,
  duracao_segundos,
  total_exercicios,
  total_series
)
values (
  '11111111-1111-4111-8111-111111111111',
  900003,
  60,
  0,
  0
)
returning id_historico as history_id
\gset legacy_

insert into public.historico_exercicios (
  id_historico,
  id_exercicio,
  id_treino_exercicio,
  serie,
  carga_utilizada,
  repeticoes_feitas,
  concluido
)
values (
  :legacy_history_id,
  900001,
  900005,
  1,
  40,
  10,
  true
);

update public.historico_treinos
set total_exercicios = 1,
    total_series = 1
where id_historico = :legacy_history_id;

select pg_temp.assert_true(
  (
    select id_sessao is null
      and total_exercicios = 1
      and total_series = 1
    from public.historico_treinos
    where id_historico = :legacy_history_id
  ),
  'legacy history writer failed after EXPAND'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.historico_exercicios
    where id_historico = :legacy_history_id
  ),
  'legacy history writer did not create its historical exercise'
);

-- Both legacy policies can associate a current user's history with an active
-- V2 session. The V2 materializer must reject either preexisting shape.
select
  result ->> 'id_sessao' as session_id,
  (result ->> 'revisao')::bigint as revision
from (
  select public.iniciar_treino_sessao(900002, 60) as result
) as invariant_started
\gset invariant_

insert into public.historico_treinos (
  id_usuario,
  id_treino,
  id_sessao,
  duracao_segundos,
  total_exercicios,
  total_series
)
values (
  '11111111-1111-4111-8111-111111111111',
  900002,
  :'invariant_session_id'::uuid,
  999,
  99,
  99
)
returning id_historico as invalid_history_id
\gset invalid_insert_

\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(
  :'invariant_session_id'::uuid,
  :invariant_revision
);
\set invalid_insert_finalize_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'invalid_insert_finalize_sqlstate' = '55000',
  'materializer accepted a preexisting inserted history'
);
select pg_temp.assert_true(
  (
    select status = 'ativa' and revisao = :invariant_revision
    from public.treino_sessoes
    where id_sessao = :'invariant_session_id'::uuid
  ),
  'invalid inserted history finalized or mutated the active session'
);
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.historico_exercicios
    where id_historico = :invalid_insert_invalid_history_id
  ),
  'rejected inserted history gained historical sets'
);

delete from public.historico_treinos
where id_historico = :invalid_insert_invalid_history_id;

update public.historico_treinos
set id_sessao = :'invariant_session_id'::uuid
where id_historico = :legacy_history_id;

select pg_temp.assert_true(
  (
    select id_sessao = :'invariant_session_id'::uuid
    from public.historico_treinos
    where id_historico = :legacy_history_id
  ),
  'legacy UPDATE policy did not permit associating the V2 session'
);

\set ON_ERROR_STOP off
select public.finalizar_treino_sessao(
  :'invariant_session_id'::uuid,
  :invariant_revision
);
\set invalid_update_finalize_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
select pg_temp.assert_true(
  :'invalid_update_finalize_sqlstate' = '55000',
  'materializer accepted an updated legacy history'
);
select pg_temp.assert_true(
  (
    select status = 'ativa' and revisao = :invariant_revision
    from public.treino_sessoes
    where id_sessao = :'invariant_session_id'::uuid
  ),
  'updated legacy history finalized or mutated the active session'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.historico_exercicios
    where id_historico = :legacy_history_id
  ),
  'rejected updated history duplicated or removed historical sets'
);

update public.historico_treinos
set id_sessao = null
where id_historico = :legacy_history_id;

select public.cancelar_treino_sessao(
  :'invariant_session_id'::uuid,
  :invariant_revision
);

reset role;
select 'EXPAND_BEHAVIOR_TESTS_OK' as result;
