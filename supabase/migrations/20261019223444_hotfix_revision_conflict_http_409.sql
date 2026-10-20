-- Record the production SQL Editor hotfix without rewriting EXPAND/history.
-- Run as a migrator that already inherits the function owner's privileges and
-- has CREATE on gymio_private. No ownership, ACL or membership is changed here.
-- Missing authority is intentional STOP; see the accompanying rollout notes.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '60s';
set local search_path = '';

do $hotfix$
declare
  v_oid oid := pg_catalog.to_regprocedure('gymio_private.validar_revisao(bigint,bigint)');
  v_before jsonb;
  v_after jsonb;
begin
  if pg_catalog.current_setting('lock_timeout')::interval <> interval '2 seconds'
     or pg_catalog.current_setting('statement_timeout')::interval <> interval '60 seconds' then
    raise exception 'hotfix transaction timeout guards are not effective';
  end if;

  if v_oid is null then
    raise exception 'validar_revisao baseline is missing';
  end if;

  select pg_catalog.to_jsonb(p) - 'prosrc' into v_before
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
    raise exception 'validar_revisao owner/security/configuration differs from baseline';
  end if;

  if not pg_catalog.pg_has_role('gymio_workout_executor', 'USAGE')
     or not pg_catalog.has_schema_privilege('gymio_private', 'CREATE') then
    raise exception using errcode = '42501',
      message = 'Migrator lacks existing owner/schema authority; stop without changing grants';
  end if;

  execute $definition$
    create or replace function gymio_private.validar_revisao(
      p_revisao_atual bigint,
      p_revisao_esperada bigint
    )
    returns void
    language plpgsql
    security invoker
    set search_path to ''
    as $function$
BEGIN
  IF p_revisao_esperada IS NULL
     OR p_revisao_esperada < 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Revisao esperada invalida';
  END IF;

  IF p_revisao_atual <> p_revisao_esperada THEN
    RAISE SQLSTATE 'PT409'
      USING MESSAGE =
        'A sessao foi alterada; recarregue o estado duravel';
  END IF;
END;
$function$;
  $definition$;

  select pg_catalog.to_jsonb(p) - 'prosrc' into v_after
  from pg_catalog.pg_proc p where p.oid = v_oid;
  if v_after is distinct from v_before then
    raise exception 'hotfix unexpectedly changed function metadata/ownership/ACL';
  end if;

  perform gymio_private.validar_revisao(7, 7);
  begin
    perform gymio_private.validar_revisao(7, 6);
    raise exception 'stale revision was accepted';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform gymio_private.validar_revisao(7, null);
    raise exception 'null revision was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform gymio_private.validar_revisao(7, -1);
    raise exception 'negative revision was accepted';
  exception when sqlstate '22023' then null;
  end;
end;
$hotfix$;
commit;
