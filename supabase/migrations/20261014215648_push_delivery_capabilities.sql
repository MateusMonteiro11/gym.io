-- V3.2-D. Presentation capability only; historical SQL files remain frozen.
begin;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';
do $timeout_guards$ begin
  if pg_catalog.current_setting('lock_timeout')::interval is distinct from interval '2 seconds'
    or pg_catalog.current_setting('statement_timeout')::interval is distinct from interval '60 seconds' then
    raise exception 'D transaction-local timeout guards not effective';
  end if;
end $timeout_guards$;

-- Compare every pre-existing ACL, owner, policy, role/membership, extension,
-- index/constraint/trigger and function contract at commit. Only the three B
-- gates and legacy A register implementation may change bodies. No extension
-- ACL exceptions added; A public signatures and ACLs remain unchanged.
create temporary view push_d_catalog as
select 'relation'::text kind,c.oid::text key,jsonb_build_object('owner',c.relowner,'acl',c.relacl,
  'rls',c.relrowsecurity,'force',c.relforcerowsecurity) value from pg_catalog.pg_class c
where c.relnamespace not in (select oid from pg_catalog.pg_namespace where nspname ~ '^pg_(toast_)?temp_')
union all select 'column',a.attrelid||':'||a.attnum,to_jsonb(a) from pg_catalog.pg_attribute a
where a.attnum>0 and a.attrelid in(select oid from pg_catalog.pg_class where relnamespace not in(select oid from pg_catalog.pg_namespace where nspname ~ '^pg_(toast_)?temp_'))
union all select 'function',p.oid::text,(to_jsonb(p)-'prosrc')||jsonb_build_object('body',case when p.oid in
  ('gymio_workout_push_private.capture_events()'::regprocedure,'gymio_workout_push_private.claim_batch(integer)'::regprocedure,
   'gymio_workout_push_private.begin_attempt(uuid,uuid)'::regprocedure,
   'gymio_push_private.register_impl(text,text,text)'::regprocedure) then null else p.prosrc end)
  from pg_catalog.pg_proc p where p.pronamespace<>pg_my_temp_schema()
union all select 'schema',n.oid::text,to_jsonb(n) from pg_catalog.pg_namespace n where n.oid not in(select oid from pg_catalog.pg_namespace where nspname ~ '^pg_(toast_)?temp_')
union all select 'policy',p.oid::text,to_jsonb(p) from pg_catalog.pg_policy p
union all select 'membership',m.roleid||':'||m.member||':'||m.grantor,
  jsonb_build_object('roleid',m.roleid,'member',m.member,'grantor',m.grantor,
    'admin_option',m.admin_option,'inherit_option',m.inherit_option,'set_option',m.set_option)
  from pg_catalog.pg_auth_members m
union all select 'role',r.oid::text,to_jsonb(r) from pg_catalog.pg_roles r
union all select 'extension',e.oid::text,to_jsonb(e) from pg_catalog.pg_extension e
union all select 'default_acl',d.oid::text,to_jsonb(d) from pg_catalog.pg_default_acl d
union all select 'constraint',c.oid::text,to_jsonb(c) from pg_catalog.pg_constraint c where c.connamespace<>pg_my_temp_schema()
union all select 'index',i.indexrelid::text,to_jsonb(i) from pg_catalog.pg_index i
  where i.indrelid in(select oid from pg_catalog.pg_class where relnamespace not in(select oid from pg_catalog.pg_namespace where nspname ~ '^pg_(toast_)?temp_'))
union all select 'trigger',t.oid::text,to_jsonb(t) from pg_catalog.pg_trigger t;
create temporary table push_d_before on commit drop as select * from pg_temp.push_d_catalog;
create temporary table push_d_jobs_before on commit drop as select to_jsonb(j) value from cron.job j;

-- Semantic sets: pg_auth_members tuple OIDs are not part of this contract.
-- postgres receiving the executor does not make the executor a member of postgres.
create temporary table push_d_executor_memberships_before on commit drop as
  select roleid,member,grantor,admin_option,inherit_option,set_option
  from pg_catalog.pg_auth_members
  where roleid='gymio_push_executor'::regrole or member='gymio_push_executor'::regrole;
create temporary table push_d_executor_schemas_before on commit drop as
  select schema_name,has_schema_privilege('gymio_push_executor',schema_name,'CREATE') can_create
  from (values('public'),('gymio_push_private')) s(schema_name);
create temporary table push_d_executor_setup on commit drop as select false membership_granted;

-- A has table-wide UPDATE already. Temporary ownership setup is undone below;
-- no new lasting grant/membership on any historical object is introduced.
do $preflight$ begin
  if exists(select 1 from pg_catalog.pg_auth_members where member='gymio_push_executor'::regrole)
    or exists(select 1 from pg_catalog.pg_auth_members where roleid='gymio_push_executor'::regrole
      and (member<>'postgres'::regrole or inherit_option or set_option
        or grantor<>'supabase_admin'::regrole or not admin_option))
    or (select count(*) from pg_catalog.pg_auth_members where roleid='gymio_push_executor'::regrole)>1
    or has_schema_privilege('gymio_push_executor','public','CREATE')
    or has_schema_privilege('gymio_push_executor','gymio_push_private','CREATE') then
    raise exception 'D requires unchanged executor membership/schema baseline';
  end if;
end $preflight$;

alter table public.push_subscriptions add column workout_notification_mode text not null default 'minimal'
  constraint push_workout_notification_mode_valid check(workout_notification_mode in ('minimal','enhanced'));

-- The allowed inbound row is granted by supabase_admin. D's separate grant
-- is granted/revoked by postgres only, so it cannot overwrite that baseline.
-- A bootstrap superuser can SET ROLE without membership: do not create a
-- grant in that zero-membership baseline merely to revoke it later.
do $ownership_grant$ begin
  if not pg_has_role(current_user,'gymio_push_executor','SET') then
    grant gymio_push_executor to postgres with inherit false,set true granted by postgres;
    update pg_temp.push_d_executor_setup set membership_granted=true;
  end if;
end $ownership_grant$;
grant create on schema public,gymio_push_private to gymio_push_executor;

create function gymio_push_private.register_with_mode_impl(p_endpoint text, p_p256dh text, p_auth text, p_workout_notification_mode text) returns uuid
language plpgsql security invoker set search_path = '' as $function$
declare v_uid uuid := gymio_push_private.request_uid(); v_id uuid;
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  if p_workout_notification_mode is null or p_workout_notification_mode not in ('minimal','enhanced') then
    raise exception using errcode='22023',message='invalid_notification_mode';
  end if;
  begin
    insert into public.push_subscriptions(id_usuario, endpoint, p256dh, auth, workout_notification_mode)
    values(v_uid, p_endpoint, p_p256dh, p_auth, p_workout_notification_mode)
    on conflict(endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
      workout_notification_mode = excluded.workout_notification_mode
      where push_subscriptions.id_usuario = v_uid
    returning id into v_id;
  exception when insufficient_privilege or unique_violation then
    raise exception using errcode = '42501', message = 'subscription_unavailable';
  end;
  if v_id is null then raise exception using errcode = '42501', message = 'subscription_unavailable'; end if;
  return v_id;
end;
$function$;
-- Shared validation, A constraints and ownership predicates remain unchanged.
-- Legacy callers always opt into minimal; D is one upsert including its mode.
-- The historical implementation is executor-owned. SET (not INHERIT) was
-- granted above; replace it as its actual owner, then return to the migrator.
set role gymio_push_executor;
create or replace function gymio_push_private.register_impl(p_endpoint text,p_p256dh text,p_auth text) returns uuid
language plpgsql security invoker set search_path='' as $fn$
begin
  return gymio_push_private.register_with_mode_impl(p_endpoint,p_p256dh,p_auth,'minimal');
end $fn$;
reset role;

create function public.registrar_push_subscription_com_modo(p_endpoint text,p_p256dh text,p_auth text,p_workout_notification_mode text) returns uuid
language sql security definer set search_path='' as $fn$
  select gymio_push_private.register_with_mode_impl(p_endpoint,p_p256dh,p_auth,p_workout_notification_mode);
$fn$;
alter function gymio_push_private.register_with_mode_impl(text,text,text,text) owner to gymio_push_executor;
alter function public.registrar_push_subscription_com_modo(text,text,text,text) owner to gymio_push_executor;
set role gymio_push_executor;
revoke all on function gymio_push_private.register_with_mode_impl(text,text,text,text),
  public.registrar_push_subscription_com_modo(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_push_subscription_com_modo(text,text,text,text) to authenticated;
reset role;
revoke create on schema public,gymio_push_private from gymio_push_executor;
do $ownership_revoke$ begin
  if (select membership_granted from pg_temp.push_d_executor_setup) then
    revoke gymio_push_executor from postgres granted by postgres;
  end if;
end $ownership_revoke$;

-- Narrow trigger bridge: executor receives NO access to B's private schema or
-- tables. Subscription is already locked, followed by its delivery rows only.
-- Never lock session/event here (that would invert B's ordering).
create function gymio_workout_push_private.invalidate_minimal_deliveries() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
  if tg_relid<>'public.push_subscriptions'::regclass or tg_op<>'UPDATE' then
    raise exception 'invalid mode trigger context';
  end if;
  update gymio_workout_push_private.deliveries set state='stale',claim_token=null,lease_expires_at=null
    where subscription_id=new.id and state in ('pending','claimed') and attempted_at is null;
  return new;
end $fn$;
alter function gymio_workout_push_private.invalidate_minimal_deliveries() owner to postgres;
revoke all on function gymio_workout_push_private.invalidate_minimal_deliveries() from public,anon,authenticated,service_role,gymio_push_executor;
-- General UPDATE is intentional: BEFORE reset can change mode even when mode
-- wasn't mentioned in the SET list of the historical register RPC.
create trigger push_subscriptions_invalidate_minimal after update on public.push_subscriptions
  for each row when(old.workout_notification_mode='enhanced' and new.workout_notification_mode='minimal')
  execute function gymio_workout_push_private.invalidate_minimal_deliveries();

-- Existing subscriptions default minimal. Retire unattempted work atomically;
-- attempted/accepted outcomes retain their original at-most-once semantics.
update gymio_workout_push_private.deliveries d set state='stale',claim_token=null,lease_expires_at=null
  from public.push_subscriptions ps where ps.id=d.subscription_id and ps.workout_notification_mode='minimal'
  and d.state in ('pending','claimed') and d.attempted_at is null;


-- Effective B definitions: only capture, claim and begin gain capability gates.
create or replace function gymio_workout_push_private.capture_events() returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare s public.treino_sessoes; v_event uuid; v_events integer:=0; v_deliveries integer:=0; v_count integer; e record; v_state text;
begin
  for s in select * from public.treino_sessoes
    where status='ativa' and fase='descanso' and pausada_em is null
      and descanso_termina_em is not null and descanso_termina_em<=clock_timestamp()
      and not exists(select 1 from gymio_workout_push_private.outbox known_event
        where known_event.id_sessao=treino_sessoes.id_sessao and known_event.id_treino_exercicio=treino_sessoes.id_treino_exercicio_atual
          and known_event.proxima_serie=treino_sessoes.serie_atual and known_event.tipo_evento='rest_finished')
    order by id_sessao limit 100 for update skip locked loop
    insert into gymio_workout_push_private.outbox(id_usuario,id_sessao,id_treino_exercicio,proxima_serie,
      revision_snapshot,rest_started_snapshot,deadline_snapshot)
    values(s.id_usuario,s.id_sessao,s.id_treino_exercicio_atual,s.serie_atual,s.revisao,s.descanso_iniciado_em,s.descanso_termina_em)
    on conflict on constraint workout_rest_identity do nothing returning id into v_event;
    if v_event is not null then
      v_events:=v_events+1;
      -- Freeze this statement's recipients once. A later tick never backfills.
      insert into gymio_workout_push_private.deliveries(event_id,subscription_id)
        select v_event,ps.id from public.push_subscriptions ps where ps.id_usuario=s.id_usuario and ps.workout_notification_mode='enhanced' order by ps.id for share of ps;
      get diagnostics v_count=row_count; v_deliveries:=v_deliveries+v_count;
    end if;
  end loop;
  for e in select pending_event.id from gymio_workout_push_private.outbox pending_event
    left join public.treino_sessoes live_session on live_session.id_sessao=pending_event.id_sessao
    where pending_event.terminal_at is null
    order by case when live_session.id_sessao is null or live_session.status<>'ativa' or live_session.fase<>'descanso'
      or live_session.id_usuario<>pending_event.id_usuario or live_session.id_treino_exercicio_atual is distinct from pending_event.id_treino_exercicio
      or live_session.serie_atual<>pending_event.proxima_serie or live_session.revisao<pending_event.revision_snapshot then 0
      when live_session.pausada_em is null and live_session.descanso_termina_em<=clock_timestamp()then 1 else 2 end,
      pending_event.id limit 100 loop
    v_state:=gymio_workout_push_private.prepare_event(e.id);
    if v_state not in ('locked','missing') then
      update gymio_workout_push_private.outbox o set terminal_at=clock_timestamp()
        where o.id=e.id and o.terminal_at is null and not exists(select 1 from gymio_workout_push_private.deliveries d
          where d.event_id=o.id and d.state in ('pending','claimed'));
    end if;
  end loop;
  for e in
    select old_event.id from gymio_workout_push_private.outbox old_event where old_event.terminal_at<clock_timestamp()-interval '7 days'
      and not exists(select 1 from public.treino_sessoes active_session where active_session.id_sessao=old_event.id_sessao and active_session.status='ativa')
    order by old_event.terminal_at,old_event.id limit 100 loop
    v_state:=gymio_workout_push_private.prepare_event(e.id);
    if v_state not in ('locked','missing') then
      perform 1 from public.push_subscriptions ps join gymio_workout_push_private.deliveries d on d.subscription_id=ps.id
        where d.event_id=e.id order by ps.id for update of ps;
      delete from gymio_workout_push_private.outbox o where o.id=e.id
        and not exists(select 1 from public.treino_sessoes active_session where active_session.id_sessao=o.id_sessao and active_session.status='ativa');
    end if;
  end loop;
  return jsonb_build_object('events',v_events,'deliveries',v_deliveries);
end $fn$;


create or replace function gymio_workout_push_private.claim_batch(p_limit integer) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare c record; d gymio_workout_push_private.deliveries; v_token uuid; v_mode text; result jsonb:='[]'::jsonb; v_count integer:=0;
begin
  if p_limit is null or p_limit<1 or p_limit>10 then raise exception 'invalid batch size' using errcode='22023'; end if;
  for c in select candidate.id,candidate.event_id,candidate.subscription_id from gymio_workout_push_private.deliveries candidate
    join gymio_workout_push_private.outbox e on e.id=candidate.event_id
    join public.treino_sessoes s on s.id_sessao=e.id_sessao
    where candidate.attempted_at is null and (candidate.state='pending' or (candidate.state='claimed' and candidate.lease_expires_at<=clock_timestamp()))
      and s.status='ativa' and s.fase='descanso' and s.pausada_em is null and s.descanso_termina_em<=clock_timestamp()
    order by s.id_sessao,e.id,candidate.subscription_id,candidate.id limit 100 for update of s skip locked loop
    exit when v_count>=p_limit;
    if gymio_workout_push_private.prepare_event(c.event_id)<>'ready' then continue; end if;
    select ps.workout_notification_mode into v_mode from public.push_subscriptions ps join gymio_workout_push_private.outbox e on e.id=c.event_id
      where ps.id=c.subscription_id and ps.id_usuario=e.id_usuario for update of ps;
    if not found then continue; end if;
    select * into d from gymio_workout_push_private.deliveries where id=c.id for update skip locked;
    if not found or d.attempted_at is not null or not (d.state='pending' or (d.state='claimed' and d.lease_expires_at<=clock_timestamp())) then continue; end if;
    if v_mode<>'enhanced' then
      update gymio_workout_push_private.deliveries set state='stale',claim_token=null,lease_expires_at=null where id=d.id;
      continue;
    end if;
    v_token:=gen_random_uuid();
    update gymio_workout_push_private.deliveries set state='claimed',claim_token=v_token,
      claimed_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '60 seconds' where id=d.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'claim_token',v_token)); v_count:=v_count+1;
  end loop;
  return result;
end $fn$;


create or replace function gymio_workout_push_private.begin_attempt(p_delivery uuid,p_claim uuid) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare e gymio_workout_push_private.outbox; s public.treino_sessoes; ps public.push_subscriptions;
  d gymio_workout_push_private.deliveries; v_name text; v_total bigint; v_body text;
begin
  select e0.* into e from gymio_workout_push_private.outbox e0 join gymio_workout_push_private.deliveries d0 on d0.event_id=e0.id where d0.id=p_delivery;
  if not found or gymio_workout_push_private.prepare_event(e.id,true)<>'ready' then return null; end if;
  select * into s from public.treino_sessoes where id_sessao=e.id_sessao;
  select * into e from gymio_workout_push_private.outbox where id=e.id;
  select ps0.* into ps from public.push_subscriptions ps0 join gymio_workout_push_private.deliveries d0 on d0.subscription_id=ps0.id
    where d0.id=p_delivery and ps0.id_usuario=e.id_usuario for update of ps0;
  if not found then return null; end if;
  select * into d from gymio_workout_push_private.deliveries where id=p_delivery for update;
  if not found or d.state<>'claimed' or d.claim_token is distinct from p_claim or d.attempted_at is not null
    or d.lease_expires_at<=clock_timestamp() or (e.revision_snapshot,e.deadline_snapshot) is distinct from (s.revisao,s.descanso_termina_em) then return null; end if;
  if ps.workout_notification_mode<>'enhanced' then
    update gymio_workout_push_private.deliveries set state='stale',claim_token=null,lease_expires_at=null where id=d.id;
    return null;
  end if;
  select left(coalesce(nullif(btrim(regexp_replace(ex.nome,'[[:cntrl:]]',' ','g')),''),'Exercício'),80),te.series into v_name,v_total
    from public.treinos_exercicios te left join public.exercicios ex on ex.id_exercicio=te.id_exercicio
    where te.id_treino_exercicio=e.id_treino_exercicio and te.id_treino=s.id_treino;
  v_name:=coalesce(v_name,'Exercício');
  if v_total is null or v_total<e.proxima_serie or v_total>32767 then v_total:=null; end if;
  v_body:=left(v_name||' · Série '||e.proxima_serie::text||case when v_total is not null then '/'||v_total::text else '' end,160);
  -- Commit this marker before returning credentials to the sender. HTTP starts
  -- only after the RPC transaction commits. A crash from now on may lose Push.
  update gymio_workout_push_private.deliveries set state='attempted',attempted_at=clock_timestamp() where id=d.id;
  return jsonb_build_object('snapshot',jsonb_build_object('id',ps.id,'id_usuario',ps.id_usuario,'endpoint',ps.endpoint,
      'p256dh',ps.p256dh,'auth',ps.auth,'updated_at',ps.updated_at),
    'payload',jsonb_build_object('version',2,'type','workout_rest_finished','title','Gym.io · Descanso concluído','body',v_body,
      'id_sessao',s.id_sessao,'revisao',s.revisao::text,'id_treino',s.id_treino::text,
      'id_treino_exercicio',e.id_treino_exercicio::text,'proxima_serie',e.proxima_serie::text,'serie_total',v_total::text,
      'iniciada_em',s.iniciada_em,'descanso_iniciado_em',s.descanso_iniciado_em,'descanso_termina_em',s.descanso_termina_em,
      'agora_servidor',clock_timestamp(),'exercicio',v_name,'fase','descanso','pausada',false,
      'data',jsonb_build_object('url','/treinar/'||s.id_treino::text)));
end $fn$;


do $executor_assertions$
begin
  if exists(
    (select roleid,member,grantor,admin_option,inherit_option,set_option
      from pg_catalog.pg_auth_members
      where roleid='gymio_push_executor'::regrole or member='gymio_push_executor'::regrole
     except select * from pg_temp.push_d_executor_memberships_before)
    union all
    (select * from pg_temp.push_d_executor_memberships_before
     except select roleid,member,grantor,admin_option,inherit_option,set_option
      from pg_catalog.pg_auth_members
      where roleid='gymio_push_executor'::regrole or member='gymio_push_executor'::regrole)) then
    raise exception 'D executor membership snapshot changed';
  end if;
  if exists(select 1 from pg_temp.push_d_executor_schemas_before b
    where b.can_create or has_schema_privilege('gymio_push_executor',b.schema_name,'CREATE')
      is distinct from b.can_create) then
    raise exception 'D executor schema snapshot changed';
  end if;
end $executor_assertions$;

do $assertions$
declare r oid:='gymio_push_executor'::regrole; f record; role_name text; privilege text;
begin
  if exists(select 1 from pg_temp.push_d_before b left join pg_temp.push_d_catalog a using(kind,key)
    where a.value is distinct from b.value) then raise exception 'D changed historical catalog/ACL contract'; end if;
  if exists((select value from pg_temp.push_d_jobs_before except select to_jsonb(j) from cron.job j)
    union all (select to_jsonb(j) from cron.job j except select value from pg_temp.push_d_jobs_before)) then
    raise exception 'D changed cron jobs';
  end if;
  if not exists(select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid='public.push_subscriptions'::regclass and a.attname='workout_notification_mode'
      and a.atttypid='text'::regtype and a.attnotnull and pg_get_expr(d.adbin,d.adrelid)=$expr$'minimal'::text$expr$)
    or not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.push_subscriptions'::regclass
      and conname='push_workout_notification_mode_valid' and contype='c' and convalidated
      and pg_get_constraintdef(oid) like '%minimal%enhanced%') then raise exception 'D invalid capability column'; end if;
  if not exists(select 1 from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass and relrowsecurity and relforcerowsecurity)
    or exists(select 1 from pg_catalog.pg_roles where oid=r and
      (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
    or exists(select 1 from pg_catalog.pg_auth_members where member=r
      or (roleid=r and (member<>'postgres'::regrole or inherit_option or set_option)))
    or has_schema_privilege(r,'auth','USAGE') or has_schema_privilege(r,'auth','CREATE')
    or has_schema_privilege(r,'public','CREATE') or has_schema_privilege(r,'gymio_push_private','CREATE')
    or has_schema_privilege(r,'gymio_workout_push_private','USAGE') then raise exception 'D executor boundary invalid'; end if;
  if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
    where n.nspname='auth' and c.relkind in('r','p','v','m','f') and has_table_privilege(r,c.oid,p.priv))
    or exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='auth' and c.relkind='S' and
      (has_sequence_privilege(r,c.oid,'USAGE') or has_sequence_privilege(r,c.oid,'SELECT') or has_sequence_privilege(r,c.oid,'UPDATE')))
    then raise exception 'D executor auth access'; end if;
  foreach role_name in array array['anon','authenticated'] loop
    if has_schema_privilege(role_name,'gymio_push_private','USAGE') or has_schema_privilege(role_name,'gymio_workout_push_private','USAGE') then
      raise exception 'D private schema exposed'; end if;
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege(role_name,'public.push_subscriptions',privilege) then raise exception 'D client table access'; end if;
    end loop;
    if has_any_column_privilege(role_name,'public.push_subscriptions','SELECT')
      or has_any_column_privilege(role_name,'public.push_subscriptions','INSERT')
      or has_any_column_privilege(role_name,'public.push_subscriptions','UPDATE')
      or has_any_column_privilege(role_name,'public.push_subscriptions','REFERENCES') then raise exception 'D client column access'; end if;
  end loop;
  for f in select p.*,n.nspname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where p.oid in ('public.registrar_push_subscription_com_modo(text,text,text,text)'::regprocedure,
      'gymio_push_private.register_with_mode_impl(text,text,text,text)'::regprocedure,
      'gymio_workout_push_private.invalidate_minimal_deliveries()'::regprocedure) loop
    if f.proconfig is distinct from array['search_path=""'] or f.proretset
      or f.prosecdef is distinct from (f.proname in('registrar_push_subscription_com_modo','invalidate_minimal_deliveries'))
      or f.proowner is distinct from (case when f.proname='invalidate_minimal_deliveries' then 'postgres'::regrole::oid else r end)
      or (f.proowner=r and f.prosrc ~ 'auth[.]')
      or exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.grantee=0)
      or has_function_privilege('anon',f.oid,'EXECUTE') or has_function_privilege('service_role',f.oid,'EXECUTE')
      or has_function_privilege('authenticated',f.oid,'EXECUTE') is distinct from (f.proname='registrar_push_subscription_com_modo')
      then raise exception 'D invalid function security contract'; end if;
  end loop;
  if position($filter$ps.workout_notification_mode='enhanced'$filter$ in pg_get_functiondef('gymio_workout_push_private.capture_events()'::regprocedure))=0
    or position('for share of ps' in pg_get_functiondef('gymio_workout_push_private.capture_events()'::regprocedure))=0
    or position($filter$v_mode<>'enhanced'$filter$ in pg_get_functiondef('gymio_workout_push_private.claim_batch(integer)'::regprocedure))=0
    or position($filter$ps.workout_notification_mode<>'enhanced'$filter$ in pg_get_functiondef('gymio_workout_push_private.begin_attempt(uuid,uuid)'::regprocedure))=0
    then raise exception 'D missing effective B gate'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.push_subscriptions'::regclass
      and tgname='push_subscriptions_invalidate_minimal' and tgenabled='O')
    then raise exception 'D lifecycle triggers missing'; end if;
  if to_regprocedure('public.definir_modo_notificacao_push(uuid,text)') is not null
    or to_regprocedure('gymio_push_private.set_workout_mode_impl(uuid,text)') is not null
    or position($legacy$register_with_mode_impl(p_endpoint,p_p256dh,p_auth,'minimal')$legacy$
      in pg_get_functiondef('gymio_push_private.register_impl(text,text,text)'::regprocedure))=0 then
    raise exception 'D legacy minimal/atomic-only boundary invalid';
  end if;
end $assertions$;
drop view pg_temp.push_d_catalog;
commit;
