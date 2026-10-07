-- Gym.io workout session persistence V1 - CONTRACT.
--
-- Apply only after the V2 frontend has been deployed and validated in production.
-- This migration intentionally removes the legacy direct history writer while
-- preserving authenticated read access and the V2 RPC execution boundary.

-- -----------------------------------------------------------------------------
-- 1. Fail closed unless EXPAND and the expected legacy writer are both present
-- -----------------------------------------------------------------------------

do $preflight$
declare
  missing_policy text;
  unexpected_policy text;
  sequence_name text;
begin
  if to_regclass('public.treino_sessoes') is null
     or to_regclass('public.treino_sessao_series') is null
     or to_regnamespace('gymio_private') is null
     or to_regrole('gymio_workout_executor') is null then
    raise exception 'CONTRACT requires the workout session EXPAND migration';
  end if;

  select expected.policy_name
  into missing_policy
  from (values
    ('historico_treinos', 'usuarios podem atualizar o proprio historico', 'UPDATE'),
    ('historico_treinos', 'usuarios podem criar o proprio historico', 'INSERT'),
    ('historico_treinos', 'usuarios podem deletar o proprio historico', 'DELETE'),
    ('historico_exercicios', 'usuarios podem atualizar exercicios do proprio historico', 'UPDATE'),
    ('historico_exercicios', 'usuarios podem deletar exercicios do proprio historico', 'DELETE'),
    ('historico_exercicios', 'usuarios podem inserir exercicios no proprio historico', 'INSERT')
  ) as expected(table_name, policy_name, command_name)
  where not exists (
    select 1
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public'
      and p.tablename = expected.table_name
      and p.policyname = expected.policy_name
      and p.cmd = expected.command_name
      and 'authenticated' = any (p.roles)
  )
  limit 1;

  if missing_policy is not null then
    raise exception 'expected legacy write policy is missing: %', missing_policy;
  end if;

  select p.policyname
  into unexpected_policy
  from pg_catalog.pg_policies as p
  where p.schemaname = 'public'
    and p.tablename in ('historico_treinos', 'historico_exercicios')
    and p.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and p.roles && array['public', 'anon', 'authenticated']::name[]
    and p.policyname not in (
      'usuarios podem atualizar o proprio historico',
      'usuarios podem criar o proprio historico',
      'usuarios podem deletar o proprio historico',
      'usuarios podem atualizar exercicios do proprio historico',
      'usuarios podem deletar exercicios do proprio historico',
      'usuarios podem inserir exercicios no proprio historico'
    )
  limit 1;

  if unexpected_policy is not null then
    raise exception 'unexpected legacy-compatible history writer policy: %',
      unexpected_policy;
  end if;

  if not has_table_privilege(
       'authenticated', 'public.historico_treinos', 'INSERT'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_treinos', 'UPDATE'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_exercicios', 'INSERT'
     ) then
    raise exception 'expected legacy history table grants are missing';
  end if;

  foreach sequence_name in array array[
    pg_get_serial_sequence('public.historico_treinos', 'id_historico'),
    pg_get_serial_sequence(
      'public.historico_exercicios',
      'id_historico_exercicio'
    )
  ]
  loop
    if sequence_name is null
       or not has_sequence_privilege(
         'authenticated', sequence_name, 'USAGE'
       ) then
      raise exception 'expected legacy history sequence privilege is missing';
    end if;
  end loop;
end
$preflight$;

-- -----------------------------------------------------------------------------
-- 2. Remove only the compatibility layer that allowed V1 direct writes
-- -----------------------------------------------------------------------------

drop policy "usuarios podem atualizar o proprio historico"
  on public.historico_treinos;
drop policy "usuarios podem criar o proprio historico"
  on public.historico_treinos;
drop policy "usuarios podem deletar o proprio historico"
  on public.historico_treinos;

drop policy "usuarios podem atualizar exercicios do proprio historico"
  on public.historico_exercicios;
drop policy "usuarios podem deletar exercicios do proprio historico"
  on public.historico_exercicios;
drop policy "usuarios podem inserir exercicios no proprio historico"
  on public.historico_exercicios;

revoke insert, update, delete, truncate, references, trigger
  on table public.historico_treinos, public.historico_exercicios
  from public, anon, authenticated;

do $sequences$
declare
  sequence_name text;
begin
  foreach sequence_name in array array[
    pg_get_serial_sequence('public.historico_treinos', 'id_historico'),
    pg_get_serial_sequence(
      'public.historico_exercicios',
      'id_historico_exercicio'
    )
  ]
  loop
    if sequence_name is null then
      raise exception 'expected history identity sequence is missing';
    end if;

    execute format(
      'revoke all on sequence %s from public, anon, authenticated',
      sequence_name
    );
  end loop;
end
$sequences$;

-- -----------------------------------------------------------------------------
-- 3. Final least-privilege assertions
-- -----------------------------------------------------------------------------

do $assertions$
declare
  direct_dml text;
  write_policy text;
  invalid_wrapper text;
  sequence_name text;
begin
  select format('%I on %I for %I', privilege_name, table_name, role_name)
  into direct_dml
  from (values ('anon'), ('authenticated')) as roles(role_name)
  cross join (values
    ('treino_sessoes'),
    ('treino_sessao_series'),
    ('historico_treinos'),
    ('historico_exercicios')
  ) as tables(table_name)
  cross join (values
    ('INSERT'), ('UPDATE'), ('DELETE'),
    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
  ) as privileges(privilege_name)
  where has_table_privilege(
    role_name,
    format('public.%I', table_name),
    privilege_name
  )
  limit 1;

  if direct_dml is not null then
    raise exception 'direct Data API DML remains after CONTRACT: %', direct_dml;
  end if;

  if not has_table_privilege(
       'authenticated', 'public.historico_treinos', 'SELECT'
     )
     or not has_table_privilege(
       'authenticated', 'public.historico_exercicios', 'SELECT'
     ) then
    raise exception 'CONTRACT must preserve authenticated history SELECT';
  end if;

  select p.policyname
  into write_policy
  from pg_catalog.pg_policies as p
  where p.schemaname = 'public'
    and p.tablename in ('historico_treinos', 'historico_exercicios')
    and p.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    and p.roles && array['public', 'anon', 'authenticated']::name[]
  limit 1;

  if write_policy is not null then
    raise exception 'Data API history write policy remains: %', write_policy;
  end if;

  foreach sequence_name in array array[
    pg_get_serial_sequence('public.historico_treinos', 'id_historico'),
    pg_get_serial_sequence(
      'public.historico_exercicios',
      'id_historico_exercicio'
    )
  ]
  loop
    if has_sequence_privilege('anon', sequence_name, 'USAGE')
       or has_sequence_privilege('authenticated', sequence_name, 'USAGE')
       or has_sequence_privilege('anon', sequence_name, 'SELECT')
       or has_sequence_privilege('authenticated', sequence_name, 'SELECT')
       or has_sequence_privilege('anon', sequence_name, 'UPDATE')
       or has_sequence_privilege('authenticated', sequence_name, 'UPDATE') then
      raise exception 'Data API access remains on a history sequence';
    end if;

    if not has_sequence_privilege(
      'gymio_workout_executor', sequence_name, 'USAGE'
    ) then
      raise exception 'executor lost required history sequence USAGE';
    end if;
  end loop;

  if not has_table_privilege(
       'gymio_workout_executor', 'public.historico_treinos', 'INSERT'
     )
     or not has_table_privilege(
       'gymio_workout_executor', 'public.historico_exercicios', 'INSERT'
     ) then
    raise exception 'executor lost transactional history writer privileges';
  end if;

  if has_schema_privilege('anon', 'gymio_private', 'USAGE')
     or has_schema_privilege('authenticated', 'gymio_private', 'USAGE') then
    raise exception 'private schema became accessible to a Data API role';
  end if;

  select expected.identity
  into invalid_wrapper
  from (values
    ('public.iniciar_treino_sessao(bigint,integer)'),
    ('public.concluir_treino_serie(uuid,bigint,numeric,integer)'),
    ('public.definir_pausa_treino_sessao(uuid,bigint,boolean)'),
    ('public.encerrar_descanso_treino_sessao(uuid,bigint,boolean)'),
    ('public.ajustar_descanso_treino_sessao(uuid,bigint,integer)'),
    ('public.avancar_exercicio_treino_sessao(uuid,bigint)'),
    ('public.finalizar_treino_sessao(uuid,bigint)'),
    ('public.cancelar_treino_sessao(uuid,bigint)')
  ) as expected(identity)
  left join pg_catalog.pg_proc as p
    on p.oid = to_regprocedure(expected.identity)
  where p.oid is null
     or not p.prosecdef
     or pg_catalog.pg_get_userbyid(p.proowner) <> 'gymio_workout_executor'
     or has_function_privilege('anon', p.oid, 'EXECUTE')
     or has_function_privilege('service_role', p.oid, 'EXECUTE')
     or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
  limit 1;

  if invalid_wrapper is not null then
    raise exception 'V2 RPC boundary is invalid after CONTRACT: %',
      invalid_wrapper;
  end if;
end
$assertions$;