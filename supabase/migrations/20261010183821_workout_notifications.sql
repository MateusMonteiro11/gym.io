-- V3.2-B: one physical rest event, frozen recipients, at-most-once attempts.
-- No Session V2 writes, historical ACL changes or extension ACL changes.
begin;

create schema gymio_workout_push_private authorization postgres;
revoke all on schema gymio_workout_push_private from public,anon,authenticated,service_role;

create table gymio_workout_push_private.outbox (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references auth.users(id) on delete cascade,
  id_sessao uuid not null,
  id_treino_exercicio bigint not null,
  proxima_serie smallint not null check(proxima_serie between 1 and 32767),
  tipo_evento text not null default 'rest_finished' check(tipo_evento='rest_finished'),
  revision_snapshot bigint not null check(revision_snapshot>=0),
  rest_started_snapshot timestamptz not null,
  deadline_snapshot timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  terminal_at timestamptz,
  constraint workout_rest_identity unique(id_sessao,id_treino_exercicio,proxima_serie,tipo_evento),
  constraint workout_rest_deadline check(deadline_snapshot>=rest_started_snapshot)
);
create index workout_outbox_pending_idx on gymio_workout_push_private.outbox(id_sessao,id) where terminal_at is null;
create index workout_outbox_retention_idx on gymio_workout_push_private.outbox(terminal_at,id) where terminal_at is not null;

create table gymio_workout_push_private.deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references gymio_workout_push_private.outbox(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  state text not null default 'pending' check(state in ('pending','claimed','attempted','accepted','expired','failed','stale')),
  claim_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  attempted_at timestamptz,
  accepted_at timestamptz,
  constraint workout_delivery_identity unique(event_id,subscription_id),
  constraint workout_delivery_claim check(state<>'claimed' or (claim_token is not null and claimed_at is not null and lease_expires_at>claimed_at)),
  constraint workout_delivery_attempt check((state in ('pending','claimed') and attempted_at is null) or
    (state in ('attempted','accepted','expired','failed') and attempted_at is not null) or state='stale'),
  constraint workout_delivery_accept check((state='accepted')=(accepted_at is not null))
);
create index workout_delivery_subscription_idx on gymio_workout_push_private.deliveries(subscription_id);
create index workout_delivery_claim_idx on gymio_workout_push_private.deliveries(state,lease_expires_at,event_id,id) where attempted_at is null;
-- Eligible sessions only; no timer/countdown column or Session V2 mutation.
create index workout_push_due_sessions_idx on public.treino_sessoes(descanso_termina_em,id_sessao)
  where status='ativa' and fase='descanso' and pausada_em is null;
alter table gymio_workout_push_private.outbox enable row level security;
alter table gymio_workout_push_private.outbox force row level security;
alter table gymio_workout_push_private.deliveries enable row level security;
alter table gymio_workout_push_private.deliveries force row level security;
revoke all on all tables in schema gymio_workout_push_private from public,anon,authenticated,service_role;

-- Every path acquires session -> event -> subscription -> delivery. Reads used
-- to locate these locks are not authorization snapshots. No HTTP inside locks.
create function gymio_workout_push_private.prepare_event(p_event uuid,p_wait boolean default false) returns text
language plpgsql security invoker set search_path='' as $fn$
declare e gymio_workout_push_private.outbox; s public.treino_sessoes; found_session boolean;
begin
  select * into e from gymio_workout_push_private.outbox where id=p_event;
  if not found then return 'missing'; end if;
  if p_wait then
    select * into s from public.treino_sessoes where id_sessao=e.id_sessao for update;
  else
    select * into s from public.treino_sessoes where id_sessao=e.id_sessao for update skip locked;
  end if;
  found_session:=found;
  if not found_session and exists(select 1 from public.treino_sessoes where id_sessao=e.id_sessao) then return 'locked'; end if;
  select * into e from gymio_workout_push_private.outbox where id=p_event for update skip locked;
  if not found then return 'locked'; end if;
  if not found_session or s.id_usuario<>e.id_usuario or s.status<>'ativa' or s.fase<>'descanso'
    or s.id_treino_exercicio_atual is distinct from e.id_treino_exercicio or s.serie_atual<>e.proxima_serie
    or s.descanso_termina_em is null or s.descanso_iniciado_em is null or s.revisao<e.revision_snapshot then
    -- Delivery rows are locked only after their subscriptions (cascade order).
    perform 1 from public.push_subscriptions ps join gymio_workout_push_private.deliveries d on d.subscription_id=ps.id
      where d.event_id=e.id and d.state in ('pending','claimed') order by ps.id for update of ps;
    update gymio_workout_push_private.deliveries set state='stale',claim_token=null,lease_expires_at=null
      where event_id=e.id and state in ('pending','claimed') and attempted_at is null;
    return 'stale';
  end if;
  if (e.revision_snapshot,e.deadline_snapshot,e.rest_started_snapshot) is distinct from
    (s.revisao,s.descanso_termina_em,s.descanso_iniciado_em) then
    update gymio_workout_push_private.outbox set revision_snapshot=s.revisao,
      deadline_snapshot=s.descanso_termina_em,rest_started_snapshot=s.descanso_iniciado_em where id=e.id;
    perform 1 from public.push_subscriptions ps join gymio_workout_push_private.deliveries d on d.subscription_id=ps.id
      where d.event_id=e.id and d.state='claimed' order by ps.id for update of ps;
    update gymio_workout_push_private.deliveries set state='pending',claim_token=null,lease_expires_at=null
      where event_id=e.id and state='claimed' and attempted_at is null;
  end if;
  if s.pausada_em is not null or s.descanso_termina_em>clock_timestamp() then return 'deferred'; end if;
  return 'ready';
end $fn$;

create function gymio_workout_push_private.capture_events() returns jsonb
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
        select v_event,ps.id from public.push_subscriptions ps where ps.id_usuario=s.id_usuario order by ps.id for key share of ps;
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

create function gymio_workout_push_private.claim_batch(p_limit integer) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare c record; d gymio_workout_push_private.deliveries; v_token uuid; result jsonb:='[]'::jsonb; v_count integer:=0;
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
    perform 1 from public.push_subscriptions ps join gymio_workout_push_private.outbox e on e.id=c.event_id
      where ps.id=c.subscription_id and ps.id_usuario=e.id_usuario for update of ps;
    if not found then continue; end if;
    select * into d from gymio_workout_push_private.deliveries where id=c.id for update skip locked;
    if not found or d.attempted_at is not null or not (d.state='pending' or (d.state='claimed' and d.lease_expires_at<=clock_timestamp())) then continue; end if;
    v_token:=gen_random_uuid();
    update gymio_workout_push_private.deliveries set state='claimed',claim_token=v_token,
      claimed_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '60 seconds' where id=d.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'claim_token',v_token)); v_count:=v_count+1;
  end loop;
  return result;
end $fn$;

create function gymio_workout_push_private.begin_attempt(p_delivery uuid,p_claim uuid) returns jsonb
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

create function gymio_workout_push_private.complete_attempt(p_delivery uuid,p_claim uuid,p_outcome text,p_snapshot jsonb) returns text
language plpgsql security invoker set search_path='' as $fn$
declare e gymio_workout_push_private.outbox; d gymio_workout_push_private.deliveries; ps public.push_subscriptions;
begin
  if p_outcome is null or p_outcome not in ('accepted','expired','failed') then raise exception 'invalid outcome' using errcode='22023'; end if;
  select e0.* into e from gymio_workout_push_private.outbox e0 join gymio_workout_push_private.deliveries d0 on d0.event_id=e0.id where d0.id=p_delivery;
  if not found then return case when p_outcome='expired' then 'expired' else 'stale' end; end if;
  perform 1 from public.treino_sessoes where id_sessao=e.id_sessao for update;
  perform 1 from gymio_workout_push_private.outbox where id=e.id for update;
  select ps0.* into ps from public.push_subscriptions ps0 join gymio_workout_push_private.deliveries d0 on d0.subscription_id=ps0.id
    where d0.id=p_delivery for update of ps0;
  select * into d from gymio_workout_push_private.deliveries where id=p_delivery for update;
  if not found or d.state<>'attempted' or d.claim_token is distinct from p_claim or d.attempted_at is null then
    return case when p_outcome='expired' then 'expired' else 'stale' end;
  end if;
  if p_outcome='expired' and ps.id_usuario=e.id_usuario and ps.id::text=p_snapshot->>'id'
    and ps.id_usuario::text=p_snapshot->>'id_usuario' and ps.updated_at=(p_snapshot->>'updated_at')::timestamptz
    and ps.endpoint=p_snapshot->>'endpoint' and ps.p256dh=p_snapshot->>'p256dh' and ps.auth=p_snapshot->>'auth' then
    delete from public.push_subscriptions where id=ps.id and id_usuario=e.id_usuario;
    return 'expired'; -- Cascade may remove this delivery; the outcome survives.
  end if;
  update gymio_workout_push_private.deliveries set state=p_outcome,
    accepted_at=case when p_outcome='accepted' then clock_timestamp() else null end where id=d.id;
  return p_outcome;
end $fn$;

create function gymio_workout_push_private.tick() returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare v_result jsonb; v_token text; v_url text;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(18347622) then return jsonb_build_object('skipped',true); end if;
  v_result:=gymio_workout_push_private.capture_events();
  if exists(select 1 from gymio_workout_push_private.deliveries d join gymio_workout_push_private.outbox e on e.id=d.event_id
    join public.treino_sessoes s on s.id_sessao=e.id_sessao where d.attempted_at is null
      and (d.state='pending' or (d.state='claimed' and d.lease_expires_at<=clock_timestamp()))
      and s.status='ativa' and s.fase='descanso' and s.pausada_em is null and s.descanso_termina_em<=clock_timestamp()) then
    select decrypted_secret into v_token from vault.decrypted_secrets where name='gymio_workout_push_worker_token';
    select decrypted_secret into v_url from vault.decrypted_secrets where name='gymio_workout_push_url';
    if v_token ~ '^[A-Za-z0-9_-]{43}$' and v_url ~ '^(https://[A-Za-z0-9.-]+|http://kong:8000)/functions/v1/workout-push$' then
      perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json',
        'X-Gymio-Workout-Worker-Token',v_token),body:='{}'::jsonb,timeout_milliseconds:=10000);
      return v_result||jsonb_build_object('dispatched',true);
    end if;
  end if;
  return v_result||jsonb_build_object('dispatched',false);
end $fn$;

create function public.workout_push_claim(p_limit integer default 10) returns jsonb
language sql security definer set search_path='' as $fn$ select gymio_workout_push_private.claim_batch(p_limit); $fn$;
create function public.workout_push_begin(p_delivery_id uuid,p_claim_token uuid) returns jsonb
language sql security definer set search_path='' as $fn$ select gymio_workout_push_private.begin_attempt(p_delivery_id,p_claim_token); $fn$;
create function public.workout_push_complete(p_delivery_id uuid,p_claim_token uuid,p_outcome text,p_snapshot jsonb) returns text
language sql security definer set search_path='' as $fn$ select gymio_workout_push_private.complete_attempt(p_delivery_id,p_claim_token,p_outcome,p_snapshot); $fn$;
revoke all on all functions in schema gymio_workout_push_private from public,anon,authenticated,service_role;
revoke all on function public.workout_push_claim(integer),public.workout_push_begin(uuid,uuid),public.workout_push_complete(uuid,uuid,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.workout_push_claim(integer),public.workout_push_begin(uuid,uuid),public.workout_push_complete(uuid,uuid,text,jsonb) to service_role;

-- Inactive until server-only Vault/runtime configuration is provisioned.
select cron.schedule('gymio-workout-push','10 seconds','select gymio_workout_push_private.tick();');
select cron.alter_job(job_id:=(select jobid from cron.job where jobname='gymio-workout-push'),active:=false);

do $assertions$
declare p record; v_executor oid;
begin
  if not exists(select 1 from pg_namespace where nspname='gymio_workout_push_private' and nspowner='postgres'::regrole) then raise exception 'workout schema owner'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gymio_workout_push_private' and c.relkind='r' and c.relowner='postgres'::regrole and c.relrowsecurity and c.relforcerowsecurity)<>2 then raise exception 'workout tables/RLS'; end if;
  if (select count(*) from pg_constraint where conrelid='gymio_workout_push_private.deliveries'::regclass and contype='f' and confdeltype='c')<>2 then raise exception 'workout FK cascade'; end if;
  if not exists(select 1 from pg_constraint where conrelid='gymio_workout_push_private.deliveries'::regclass
    and confrelid='public.push_subscriptions'::regclass and contype='f' and confdeltype='c'
    and pg_get_constraintdef(oid)='FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE')
    or not exists(select 1 from pg_constraint where conrelid='gymio_workout_push_private.deliveries'::regclass
      and confrelid='gymio_workout_push_private.outbox'::regclass and contype='f' and confdeltype='c') then raise exception 'workout FK targets'; end if;
  if not exists(select 1 from pg_constraint where conname='workout_delivery_identity' and conrelid='gymio_workout_push_private.deliveries'::regclass and contype='u')
    or not exists(select 1 from pg_constraint where conname='workout_rest_identity' and conrelid='gymio_workout_push_private.outbox'::regclass and contype='u') then raise exception 'workout unique identity'; end if;
  if not exists(select 1 from pg_constraint where conname='workout_delivery_identity' and conrelid='gymio_workout_push_private.deliveries'::regclass
      and pg_get_constraintdef(oid)='UNIQUE (event_id, subscription_id)')
    or not exists(select 1 from pg_constraint where conname='workout_rest_identity' and conrelid='gymio_workout_push_private.outbox'::regclass
      and pg_get_constraintdef(oid)='UNIQUE (id_sessao, id_treino_exercicio, proxima_serie, tipo_evento)')
    or exists(select 1 from pg_attribute where attrelid='gymio_workout_push_private.deliveries'::regclass and attnum>0 and not attisdropped and attname in ('endpoint','p256dh','auth','delivered_at')) then raise exception 'workout physical identity/data boundary'; end if;
  if (select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='gymio_workout_push_private' and i.indisvalid)<>8 then raise exception 'workout indexes'; end if;
  if not exists(select 1 from pg_index where indexrelid='public.workout_push_due_sessions_idx'::regclass and indisvalid and indrelid='public.treino_sessoes'::regclass and indpred is not null)
    or (select count(*) from pg_constraint where conrelid in ('gymio_workout_push_private.outbox'::regclass,'gymio_workout_push_private.deliveries'::regclass) and contype='c')<>8
    or exists(select 1 from pg_policy where polrelid in ('gymio_workout_push_private.outbox'::regclass,'gymio_workout_push_private.deliveries'::regclass)) then raise exception 'workout constraints/index/policies'; end if;
  for p in select oid from pg_roles where rolname in ('anon','authenticated','service_role','gymio_push_executor','gymio_workout_executor') loop
    if has_schema_privilege(p.oid,'gymio_workout_push_private','USAGE') or has_schema_privilege(p.oid,'gymio_workout_push_private','CREATE')
      or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gymio_workout_push_private' and c.relkind='r' and
        (has_table_privilege(p.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or has_any_column_privilege(p.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
      or exists(select 1 from pg_proc f where f.pronamespace='gymio_workout_push_private'::regnamespace and has_function_privilege(p.oid,f.oid,'EXECUTE')) then raise exception 'workout private boundary'; end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace='gymio_workout_push_private'::regnamespace)<>6 then raise exception 'workout private functions'; end if;
  for p in select * from pg_proc where pronamespace='gymio_workout_push_private'::regnamespace or (pronamespace='public'::regnamespace and proname in ('workout_push_claim','workout_push_begin','workout_push_complete')) loop
    if p.proowner<>'postgres'::regrole or not coalesce(p.proconfig @> array['search_path=""'],false)
      or p.prosecdef<>(p.pronamespace='public'::regnamespace) then raise exception 'workout function security'; end if;
    if has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') then raise exception 'workout client RPC exposed'; end if;
    if has_function_privilege('gymio_push_executor',p.oid,'EXECUTE') or has_function_privilege('gymio_workout_executor',p.oid,'EXECUTE') then raise exception 'workout old executor privilege'; end if;
    if p.pronamespace='public'::regnamespace and not has_function_privilege('service_role',p.oid,'EXECUTE') then raise exception 'workout service RPC missing'; end if;
  end loop;
  if (select count(*) from cron.job where jobname='gymio-workout-push' and schedule='10 seconds' and command='select gymio_workout_push_private.tick();' and username='postgres' and not active)<>1 then raise exception 'workout cron definition'; end if;
  if exists(select 1 from cron.job where jobname like 'gymio-workout-%' and jobname<>'gymio-workout-push') then raise exception 'unexpected workout cron'; end if;
end $assertions$;
commit;
