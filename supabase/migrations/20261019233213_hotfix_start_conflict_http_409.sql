-- Prevent PostgREST serialization retries for the disappearing active-session race.
-- Requires existing inherited owner authority and CREATE on gymio_private.
-- No ownership, ACL, membership or historical migration is changed.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '60s';
set local search_path = '';

do $hotfix$
declare
  v_oid oid := pg_catalog.to_regprocedure('gymio_private.iniciar_treino_sessao(bigint,integer)');
  v_before jsonb;
  v_after jsonb;
  v_source_before text;
  v_source_after text;
begin
  if pg_catalog.current_setting('lock_timeout')::interval <> interval '2 seconds'
     or pg_catalog.current_setting('statement_timeout')::interval <> interval '60 seconds' then
    raise exception 'hotfix transaction timeout guards are not effective';
  end if;

  if v_oid is null then
    raise exception 'iniciar_treino_sessao baseline is missing';
  end if;

  select pg_catalog.to_jsonb(p) - 'prosrc',
    pg_catalog.replace(p.prosrc, E'\r\n', E'\n')
  into v_before, v_source_before
  from pg_catalog.pg_proc p where p.oid = v_oid;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_roles r on r.oid = p.proowner
    join pg_catalog.pg_language l on l.oid = p.prolang
    where p.oid = v_oid
      and r.rolname = 'gymio_workout_executor'
      and l.lanname = 'plpgsql'
      and not p.prosecdef
      and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception 'iniciar_treino_sessao owner/security/configuration differs from baseline';
  end if;

  if not pg_catalog.pg_has_role('gymio_workout_executor', 'USAGE')
     or not pg_catalog.has_schema_privilege('gymio_private', 'CREATE') then
    raise exception using errcode = '42501',
      message = 'Migrator lacks existing owner/schema authority; stop without changing grants';
  end if;

  execute $definition$
create or replace function gymio_private.iniciar_treino_sessao(
  p_id_treino bigint,
  p_descanso_padrao_segundos integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select gymio_private.request_uid());
  v_primeiro record;
  v_id_sessao uuid;
  v_existente public.treino_sessoes%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = 'Autenticacao obrigatoria';
  end if;

  if p_descanso_padrao_segundos is null
     or p_descanso_padrao_segundos not between 0 and 3600 then
    raise exception using errcode = '22023', message = 'Descanso padrao invalido';
  end if;

  if not exists (
    select 1
    from public.treinos as t
    where t.id_treino = p_id_treino
      and (
        t.id_usuario = v_uid
        or t.tipo_treino = 'sistema'
      )
  ) then
    raise exception using errcode = '42501', message = 'Treino indisponivel';
  end if;

  select *
  into v_primeiro
  from gymio_private.itens_ordenados_do_treino(p_id_treino)
  order by indice
  limit 1;

  if not found then
    raise exception using errcode = '22023', message = 'Treino sem exercicios validos';
  end if;

  insert into public.treino_sessoes (
    id_usuario,
    id_treino,
    id_treino_exercicio_atual,
    indice_exercicio_atual,
    serie_atual,
    descanso_padrao_segundos
  )
  values (
    v_uid,
    p_id_treino,
    v_primeiro.id_treino_exercicio,
    v_primeiro.indice,
    1,
    p_descanso_padrao_segundos
  )
  on conflict (id_usuario) where status = 'ativa'
  do nothing
  returning id_sessao into v_id_sessao;

  if v_id_sessao is null then
    select *
    into v_existente
    from public.treino_sessoes as s
    where s.id_usuario = v_uid
      and s.status = 'ativa'
    for update;

    if v_existente.id_sessao is null then
      raise sqlstate 'PT409'
        using message = 'Conflito ao iniciar sessao';
    end if;

    if v_existente.id_treino <> p_id_treino then
      raise exception using
        errcode = '23505',
        message = 'O usuario ja possui outra sessao ativa';
    end if;

    v_id_sessao := v_existente.id_sessao;
  end if;

  return gymio_private.sessao_com_relogio(v_id_sessao);
end;
$function$;
  $definition$;

  select pg_catalog.to_jsonb(p) - 'prosrc', p.prosrc
  into v_after, v_source_after
  from pg_catalog.pg_proc p where p.oid = v_oid;
  if v_after is distinct from v_before then
    raise exception 'hotfix unexpectedly changed function metadata/ownership/ACL';
  end if;

  -- Fail closed on any source drift beyond the single approved RAISE replacement.
  if v_source_after is distinct from pg_catalog.replace(v_source_before,
    $old$raise exception using errcode = '40001', message = 'Conflito ao iniciar sessao';$old$,
    $new$raise sqlstate 'PT409'
        using message = 'Conflito ao iniciar sessao';$new$)
    or pg_catalog.strpos(v_source_after, '40001') > 0
    or pg_catalog.strpos(v_source_after, $code$raise sqlstate 'PT409'$code$) = 0 then
    raise exception 'hotfix source differs beyond the approved start-conflict RAISE';
  end if;
end;
$hotfix$;
commit;
