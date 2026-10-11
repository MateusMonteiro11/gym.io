-- V3.2-C. Bearer capabilities authorize only fixed rest controls.
-- This file is prepared for a future isolated matrix, never the manual B runtime.
begin;

-- Compare historical definitions and ACLs inside the same transaction. No repair.
create temporary table gymio_c_historical on commit drop as
select 'function'::text kind,p.oid::text id,
  jsonb_build_array(pg_get_functiondef(p.oid),p.proowner,p.proacl) value
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','auth','gymio_private','gymio_push_private','gymio_workout_push_private','extensions','cron','net','vault') and p.prokind='f'
union all
select 'relation',c.oid::text,jsonb_build_array(c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','auth','gymio_private','gymio_push_private','gymio_workout_push_private','extensions','cron','net','vault')
union all
select 'schema',n.oid::text,jsonb_build_array(n.nspowner,n.nspacl) from pg_namespace n
where n.nspname in ('public','auth','gymio_private','gymio_push_private','gymio_workout_push_private','extensions','cron','net','vault')
union all
select 'policy',oid::text,to_jsonb(p) from pg_policy p
union all
select 'role',oid::text,to_jsonb(r) from pg_roles r
where rolname in ('gymio_workout_executor','gymio_push_executor')
union all
select 'membership',roleid::text||':'||member::text||':'||grantor::text,to_jsonb(m) from pg_auth_members m
union all
select 'column',attrelid::text||':'||attnum::text,to_jsonb(a) from pg_attribute a
where attnum>0 and attacl is not null
union all
select 'constraint',oid::text,to_jsonb(c) from pg_constraint c
union all
select 'index',indexrelid::text,jsonb_build_array(pg_get_indexdef(indexrelid),to_jsonb(i)) from pg_index i
union all
select 'default_acl',oid::text,to_jsonb(a) from pg_default_acl a;

create schema gymio_workout_actions_private authorization postgres;
revoke all on schema gymio_workout_actions_private from public,anon,authenticated,service_role;

create table gymio_workout_actions_private.generations (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  id_sessao uuid not null references public.treino_sessoes(id_sessao) on delete cascade,
  revision bigint not null check(revision>=0),
  eligible_state text not null check(eligible_state in ('rest_active','rest_paused','rest_finished')),
  item_id bigint not null,
  next_set smallint not null check(next_set>0),
  rest_started_at timestamptz not null,
  deadline timestamptz not null check(deadline>=rest_started_at),
  paused_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  constraint workout_controls_ttl check(expires_at>created_at and expires_at<=created_at+interval '15 minutes'),
  constraint workout_controls_paused check((eligible_state='rest_paused')=(paused_at is not null)),
  constraint workout_controls_binding unique(id,id_usuario,subscription_id,id_sessao,revision)
);
create unique index workout_controls_current_idx on gymio_workout_actions_private.generations(id_sessao,subscription_id) where invalidated_at is null;
create index workout_controls_subscription_idx on gymio_workout_actions_private.generations(subscription_id);
create index workout_controls_session_idx on gymio_workout_actions_private.generations(id_sessao);
create index workout_controls_cleanup_idx on gymio_workout_actions_private.generations(expires_at,id);

create table gymio_workout_actions_private.capabilities (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  id_usuario uuid not null,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  id_sessao uuid not null references public.treino_sessoes(id_sessao) on delete cascade,
  revision bigint not null check(revision>=0),
  action text not null check(action in ('rest_add_15','rest_skip','rest_pause','rest_resume','rest_continue')),
  token_hash bytea not null unique check(octet_length(token_hash)=32),
  consumed_at timestamptz,
  invalidated_at timestamptz,
  constraint workout_capability_generation foreign key(generation_id,id_usuario,subscription_id,id_sessao,revision)
    references gymio_workout_actions_private.generations(id,id_usuario,subscription_id,id_sessao,revision) on delete cascade,
  constraint workout_capability_action unique(generation_id,action)
);
create index workout_capability_subscription_idx on gymio_workout_actions_private.capabilities(subscription_id);
create index workout_capability_session_idx on gymio_workout_actions_private.capabilities(id_sessao);
alter table gymio_workout_actions_private.generations enable row level security;
alter table gymio_workout_actions_private.generations force row level security;
alter table gymio_workout_actions_private.capabilities enable row level security;
alter table gymio_workout_actions_private.capabilities force row level security;
revoke all on all tables in schema gymio_workout_actions_private from public,anon,authenticated,service_role;

create function gymio_workout_actions_private.request_uid() returns uuid
language plpgsql security invoker set search_path='' as $fn$
declare v_uid uuid;
begin
  begin
    v_uid:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
      nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
  exception when invalid_text_representation then raise exception 'invalid identity' using errcode='28000'; end;
  if v_uid is null then raise exception 'missing identity' using errcode='28000'; end if;
  return v_uid;
end $fn$;

create function gymio_workout_actions_private.eligible(s public.treino_sessoes) returns text
language sql security invoker set search_path='' as $fn$
  select case when (s).status<>'ativa' or (s).fase<>'descanso' or (s).descanso_termina_em is null or (s).descanso_iniciado_em is null then null
    when (s).pausada_em is not null then 'rest_paused'
    when (s).descanso_termina_em<=clock_timestamp() then 'rest_finished' else 'rest_active' end;
$fn$;

create function gymio_workout_actions_private.projection(s public.treino_sessoes) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare v_name text; v_total bigint; v_rest boolean:=s.fase='descanso';
begin
  if s.status<>'ativa' then return null; end if;
  select left(coalesce(nullif(btrim(regexp_replace(ex.nome,'[[:cntrl:]]',' ','g')),''),'Exercício'),80),te.series into v_name,v_total
    from public.treinos_exercicios te left join public.exercicios ex on ex.id_exercicio=te.id_exercicio
    where te.id_treino_exercicio=s.id_treino_exercicio_atual and te.id_treino=s.id_treino;
  v_name:=coalesce(v_name,'Exercício');
  if v_total is null or v_total<s.serie_atual or v_total>32767 then v_total:=null; end if;
  return jsonb_build_object('version',2,'type','workout_projection',
    'title',case when s.pausada_em is not null then 'Gym.io · Pausado' when v_rest then 'Gym.io · Descanso' else 'Gym.io · Treino' end,
    'body',left(v_name||' · Série '||s.serie_atual::text||case when v_total is not null then '/'||v_total::text else '' end,160),
    'id_sessao',s.id_sessao,'revisao',s.revisao::text,'id_treino',s.id_treino::text,
    'id_treino_exercicio',s.id_treino_exercicio_atual::text,'proxima_serie',s.serie_atual::text,'serie_total',v_total::text,
    'iniciada_em',s.iniciada_em,'agora_servidor',clock_timestamp(),'exercicio',v_name,'fase',s.fase,'pausada',s.pausada_em is not null,
    'descanso_iniciado_em',case when v_rest then s.descanso_iniciado_em else null end,
    'descanso_termina_em',case when v_rest then s.descanso_termina_em else null end,
    'data',jsonb_build_object('url','/treinar/'||s.id_treino::text));
end $fn$;

create function gymio_workout_actions_private.issue(p_session uuid,p_subscription uuid,p_revision bigint,p_user uuid) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare s public.treino_sessoes; ps public.push_subscriptions; g gymio_workout_actions_private.generations;
  v_state text; v_now timestamptz; v_token text; v_action text; v_actions text[]; v_controls jsonb:='[]'; v_projection jsonb;
begin
  -- Same lock order as action consumption. B retains its session/event prefix.
  select * into s from public.treino_sessoes where id_sessao=p_session for update;
  if not found or s.id_usuario is distinct from p_user or p_revision is null or s.revisao<>p_revision then return jsonb_build_object('result','stale'); end if;
  select * into ps from public.push_subscriptions where id=p_subscription for update;
  if not found or ps.id_usuario is distinct from p_user then return jsonb_build_object('result','unavailable'); end if;
  v_now:=clock_timestamp();
  v_state:=gymio_workout_actions_private.eligible(s);
  v_projection:=gymio_workout_actions_private.projection(s);
  -- One backend observation for eligibility and the projection, including a
  -- deadline crossing while the preceding statements were executing.
  v_state:=case when v_state='rest_active' and s.descanso_termina_em<=(v_projection->>'agora_servidor')::timestamptz then 'rest_finished' else v_state end;
  -- Bounded opportunistic retention. Never delete a currently valid generation.
  delete from gymio_workout_actions_private.generations where id in (
    select id from gymio_workout_actions_private.generations
    where expires_at<=v_now and (expires_at<v_now-interval '7 days' or invalidated_at<v_now-interval '7 days')
    order by expires_at,id limit 100 for update skip locked);
  select * into g from gymio_workout_actions_private.generations where id_sessao=s.id_sessao and subscription_id=ps.id and invalidated_at is null for update;
  if v_state is null then
    update gymio_workout_actions_private.generations set invalidated_at=v_now where id=g.id;
    update gymio_workout_actions_private.capabilities set invalidated_at=v_now where generation_id=g.id and consumed_at is null;
    return jsonb_build_object('result','ok','projection',v_projection);
  end if;
  if g.id is not null and g.expires_at>(v_projection->>'agora_servidor')::timestamptz and (g.revision,g.eligible_state,g.item_id,g.next_set,g.rest_started_at,g.deadline,g.paused_at)
    is not distinct from (s.revisao,v_state,s.id_treino_exercicio_atual,s.serie_atual,s.descanso_iniciado_em,s.descanso_termina_em,s.pausada_em) then
    -- Plaintext tokens do not exist in the database and cannot be returned again.
    return jsonb_build_object('result','unchanged','projection',v_projection||jsonb_build_object('version',3,'type','workout_control',
      'generation_id',g.id,'expires_at',g.expires_at,'eligible_state',v_state,'controls_status','unchanged','controls','[]'::jsonb));
  end if;
  update gymio_workout_actions_private.generations set invalidated_at=v_now where id=g.id;
  update gymio_workout_actions_private.capabilities set invalidated_at=v_now where generation_id=g.id and consumed_at is null;
  insert into gymio_workout_actions_private.generations(id_usuario,subscription_id,id_sessao,revision,eligible_state,item_id,next_set,rest_started_at,deadline,paused_at,created_at,expires_at)
    values(p_user,ps.id,s.id_sessao,s.revisao,v_state,s.id_treino_exercicio_atual,s.serie_atual,s.descanso_iniciado_em,s.descanso_termina_em,s.pausada_em,v_now,v_now+interval '15 minutes') returning * into g;
  v_actions:=case v_state when 'rest_paused' then array['rest_resume','rest_skip'] when 'rest_finished' then array['rest_continue'] else array['rest_add_15','rest_skip','rest_pause'] end;
  if v_state='rest_active' and s.descanso_termina_em+interval '15 seconds'>v_now+interval '3600 seconds' then v_actions:=array['rest_skip','rest_pause']; end if;
  foreach v_action in array v_actions loop
    v_token:=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
    insert into gymio_workout_actions_private.capabilities(generation_id,id_usuario,subscription_id,id_sessao,revision,action,token_hash)
      values(g.id,p_user,ps.id,s.id_sessao,s.revisao,v_action,extensions.digest(convert_to(v_token,'UTF8'),'sha256'));
    v_controls:=v_controls||jsonb_build_array(jsonb_build_object('action',v_action,'capability',v_token));
  end loop;
  return jsonb_build_object('result','ok','projection',v_projection||jsonb_build_object('version',3,'type','workout_control',
    'generation_id',g.id,'expires_at',g.expires_at,'eligible_state',v_state,'controls_status','emitted','controls',v_controls));
end $fn$;

create function gymio_workout_actions_private.consume(p_capability text) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare c gymio_workout_actions_private.capabilities; g gymio_workout_actions_private.generations;
  s public.treino_sessoes; ps public.push_subscriptions; v_previous text; v_result jsonb; v_revision bigint;
begin
  -- Exactly 32 random bytes in canonical Base64URL. Hash is never an input capability.
  if p_capability is null or p_capability !~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$' then return jsonb_build_object('result','unavailable'); end if;
  select * into c from gymio_workout_actions_private.capabilities where token_hash=extensions.digest(convert_to(p_capability,'UTF8'),'sha256');
  if not found then return jsonb_build_object('result','unavailable'); end if;
  select * into s from public.treino_sessoes where id_sessao=c.id_sessao for update;
  if not found then return jsonb_build_object('result','stale'); end if;
  select * into ps from public.push_subscriptions where id=c.subscription_id for update;
  if not found then return jsonb_build_object('result','stale'); end if;
  select * into g from gymio_workout_actions_private.generations where id=c.generation_id for update;
  select * into c from gymio_workout_actions_private.capabilities where id=c.id for update;
  if c.id is null or g.id is null then return jsonb_build_object('result','stale'); end if;
  if c.consumed_at is not null then return jsonb_build_object('result','already_used'); end if;
  if g.expires_at<=clock_timestamp() then return jsonb_build_object('result','expired'); end if;
  if c.invalidated_at is not null or g.invalidated_at is not null or s.id_usuario<>c.id_usuario or ps.id_usuario<>c.id_usuario
    or (g.revision,g.eligible_state,g.item_id,g.next_set,g.rest_started_at,g.deadline,g.paused_at) is distinct from
      (s.revisao,gymio_workout_actions_private.eligible(s),s.id_treino_exercicio_atual,s.serie_atual,s.descanso_iniciado_em,s.descanso_termina_em,s.pausada_em)
    then return jsonb_build_object('result','stale'); end if;
  if not ((g.eligible_state='rest_active' and c.action in ('rest_add_15','rest_skip','rest_pause')) or
    (g.eligible_state='rest_paused' and c.action in ('rest_resume','rest_skip')) or (g.eligible_state='rest_finished' and c.action='rest_continue'))
    then return jsonb_build_object('result','stale'); end if;
  v_previous:=current_setting('request.jwt.claim.sub',true);
  -- This exception block is a subtransaction: failures undo V2, consumption and issuance.
  begin
    perform set_config('request.jwt.claim.sub',c.id_usuario::text,true);
    v_revision:=s.revisao;
    case c.action
      when 'rest_add_15' then perform public.ajustar_descanso_treino_sessao(s.id_sessao,v_revision,15);
      when 'rest_pause' then perform public.definir_pausa_treino_sessao(s.id_sessao,v_revision,true);
      when 'rest_resume' then perform public.definir_pausa_treino_sessao(s.id_sessao,v_revision,false);
      when 'rest_continue' then perform public.encerrar_descanso_treino_sessao(s.id_sessao,v_revision,false);
      when 'rest_skip' then
        if s.pausada_em is not null then
          v_result:=public.definir_pausa_treino_sessao(s.id_sessao,v_revision,false);
          v_revision:=(v_result->>'revisao')::bigint;
        end if;
        perform public.encerrar_descanso_treino_sessao(s.id_sessao,v_revision,true);
    end case;
    update gymio_workout_actions_private.capabilities set consumed_at=clock_timestamp() where id=c.id;
    -- Any accepted action makes all old revisions, including other devices, stale.
    update gymio_workout_actions_private.generations set invalidated_at=clock_timestamp() where id_sessao=s.id_sessao and invalidated_at is null;
    update gymio_workout_actions_private.capabilities set invalidated_at=clock_timestamp() where id_sessao=s.id_sessao and consumed_at is null and invalidated_at is null;
    select * into s from public.treino_sessoes where id_sessao=s.id_sessao;
    v_result:=gymio_workout_actions_private.issue(s.id_sessao,ps.id,s.revisao,c.id_usuario);
    perform set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
    return v_result;
  exception when others then
    -- The subtransaction already restored the prior GUC; restore explicitly too.
    perform set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
    return jsonb_build_object('result','unavailable');
  end;
end $fn$;

create function public.emitir_controles_notificacao_treino(p_session_id uuid,p_subscription_id uuid,p_expected_revision bigint) returns jsonb
language sql security definer set search_path='' as $fn$
  select gymio_workout_actions_private.issue(p_session_id,p_subscription_id,p_expected_revision,gymio_workout_actions_private.request_uid());
$fn$;
create function public.workout_notification_action(p_capability text) returns jsonb
language sql security definer set search_path='' as $fn$ select gymio_workout_actions_private.consume(p_capability); $fn$;

create function public.workout_push_begin_controls(p_delivery_id uuid,p_claim_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare v_attempt jsonb; v_controls jsonb; d gymio_workout_push_private.deliveries; g gymio_workout_actions_private.generations;
begin
  -- B locks and revalidates session -> event -> subscription -> delivery, then
  -- records attempted. A failure below rolls that marker back with this RPC.
  v_attempt:=gymio_workout_push_private.begin_attempt(p_delivery_id,p_claim_token);
  if v_attempt is null then return null; end if;
  select * into d from gymio_workout_push_private.deliveries where id=p_delivery_id for update;
  if d.id is null or d.subscription_id::text is distinct from v_attempt->'snapshot'->>'id' then raise exception 'delivery binding mismatch'; end if;
  v_controls:=gymio_workout_actions_private.issue((v_attempt->'payload'->>'id_sessao')::uuid,d.subscription_id,
    (v_attempt->'payload'->>'revisao')::bigint,(v_attempt->'snapshot'->>'id_usuario')::uuid);
  if v_controls->>'result'='ok' and v_controls->'projection'->>'version'='3' then
    select * into g from gymio_workout_actions_private.generations where id=(v_controls->'projection'->>'generation_id')::uuid;
    if g.id is null or g.subscription_id<>d.subscription_id or exists(select 1 from gymio_workout_actions_private.capabilities c
      where c.generation_id=g.id and c.subscription_id<>d.subscription_id) then raise exception 'capability delivery binding mismatch'; end if;
    -- Keep B's fixed due-alert title/body and timestamps; add only bound controls.
    v_attempt:=jsonb_set(v_attempt,'{payload}',v_attempt->'payload'||(v_controls->'projection'-'title'-'body')||
      jsonb_build_object('title',v_attempt->'payload'->>'title','body',v_attempt->'payload'->>'body'));
  elsif v_controls->>'result' not in ('unchanged','unavailable','stale') then raise exception 'unexpected control issuance';
  end if;
  -- unchanged has no plaintext: retain the complete V2 envelope, without actions.
  return v_attempt;
end $fn$;

revoke all on all functions in schema gymio_workout_actions_private from public,anon,authenticated,service_role;
revoke all on function public.emitir_controles_notificacao_treino(uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function public.workout_notification_action(text) from public,anon,authenticated,service_role;
revoke all on function public.workout_push_begin_controls(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.emitir_controles_notificacao_treino(uuid,uuid,bigint) to authenticated;
grant execute on function public.workout_notification_action(text) to service_role;
grant execute on function public.workout_push_begin_controls(uuid,uuid) to service_role;

do $assert$
declare p record; c record; r text; f regprocedure; v_actions text[]; v_expression text;
begin
  if (select nspowner from pg_namespace where nspname='gymio_workout_actions_private')<> 'postgres'::regrole then raise exception 'C schema owner'; end if;
  if not (select rolbypassrls from pg_roles where rolname='postgres') then raise exception 'existing postgres RLS bridge unavailable'; end if;
  foreach r in array array['anon','authenticated','service_role','gymio_push_executor','gymio_workout_executor'] loop
    if has_schema_privilege(r,'gymio_workout_actions_private','USAGE') or has_schema_privilege(r,'gymio_workout_actions_private','CREATE') then raise exception 'C schema exposed'; end if;
    for c in select oid,relowner,relrowsecurity,relforcerowsecurity from pg_class where relnamespace='gymio_workout_actions_private'::regnamespace and relkind='r' loop
      if c.relowner<>'postgres'::regrole or not c.relrowsecurity or not c.relforcerowsecurity or
        has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or
        has_any_column_privilege(r,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'C relation security'; end if;
    end loop;
  end loop;
  for p in select oid,proowner,prosecdef,proconfig,pronamespace from pg_proc where pronamespace='gymio_workout_actions_private'::regnamespace
    or oid in ('public.emitir_controles_notificacao_treino(uuid,uuid,bigint)'::regprocedure,'public.workout_notification_action(text)'::regprocedure,'public.workout_push_begin_controls(uuid,uuid)'::regprocedure) loop
    if p.proowner<>'postgres'::regrole or p.prosecdef<>(p.pronamespace='public'::regnamespace) or p.proconfig is distinct from array['search_path=""']::text[] then raise exception 'C function security'; end if;
    if has_function_privilege('anon',p.oid,'EXECUTE') or exists(select 1 from aclexplode(coalesce((select proacl from pg_proc where oid=p.oid),acldefault('f',p.proowner))) where grantee=0 and privilege_type='EXECUTE') then raise exception 'C public execution'; end if;
    if p.pronamespace='gymio_workout_actions_private'::regnamespace and
      (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')) then raise exception 'C private execution'; end if;
  end loop;
  foreach r in array array['anon','authenticated'] loop
    if has_function_privilege(r,'public.workout_notification_action(text)','EXECUTE') or has_function_privilege(r,'public.workout_push_begin_controls(uuid,uuid)','EXECUTE') then raise exception 'C administrative execution'; end if;
  end loop;
  if not has_function_privilege('authenticated','public.emitir_controles_notificacao_treino(uuid,uuid,bigint)','EXECUTE') or
    not has_function_privilege('service_role','public.workout_notification_action(text)','EXECUTE') then raise exception 'C required execution'; end if;
  foreach f in array array['public.definir_pausa_treino_sessao(uuid,bigint,boolean)'::regprocedure,
    'public.encerrar_descanso_treino_sessao(uuid,bigint,boolean)'::regprocedure,'public.ajustar_descanso_treino_sessao(uuid,bigint,integer)'::regprocedure] loop
    if not has_function_privilege('postgres',f,'EXECUTE') then raise exception 'existing V2 bridge privilege absent'; end if;
  end loop;
  if (select count(*) from pg_constraint where connamespace='gymio_workout_actions_private'::regnamespace and contype='f' and confdeltype='c')<>6 then raise exception 'C cascade FKs'; end if;
  if (select count(*) from pg_indexes where schemaname='gymio_workout_actions_private')<>11 then raise exception 'C indexes'; end if;
  select pg_get_expr(conbin,conrelid) into v_expression from pg_constraint
    where conrelid='gymio_workout_actions_private.capabilities'::regclass and conname='capabilities_action_check' and contype='c' and convalidated;
  select array_agg(value[1] order by value[1]) into v_actions from regexp_matches(v_expression,'''([^'']*)''','g') as matches(value);
  if v_actions is distinct from array['rest_add_15','rest_continue','rest_pause','rest_resume','rest_skip']::text[] or
    v_expression is distinct from '(action = ANY (ARRAY[''rest_add_15''::text, ''rest_skip''::text, ''rest_pause''::text, ''rest_resume''::text, ''rest_continue''::text]))' then raise exception 'C fixed actions constraint'; end if;
  if not exists(select 1 from pg_index where indexrelid='gymio_workout_actions_private.workout_controls_current_idx'::regclass
    and indisunique and indisvalid and pg_get_expr(indpred,indrelid)='(invalidated_at IS NULL)') then raise exception 'C current generation uniqueness'; end if;
  if exists(select 1 from pg_policy where polrelid in ('gymio_workout_actions_private.generations'::regclass,'gymio_workout_actions_private.capabilities'::regclass)) then raise exception 'C unexpected policy'; end if;
  if not exists(select 1 from pg_constraint where conrelid='gymio_workout_actions_private.capabilities'::regclass
    and conname='workout_capability_generation' and confrelid='gymio_workout_actions_private.generations'::regclass and cardinality(conkey)=5 and confdeltype='c') then raise exception 'C composite binding'; end if;
  -- Check the unchanged rows captured before C, including executor attributes.
  for p in select * from gymio_c_historical loop
    if p.value is distinct from case p.kind
      when 'function' then (select jsonb_build_array(pg_get_functiondef(oid),proowner,proacl) from pg_proc where oid=p.id::oid)
      when 'relation' then (select jsonb_build_array(relowner,relacl,relrowsecurity,relforcerowsecurity) from pg_class where oid=p.id::oid)
      when 'schema' then (select jsonb_build_array(nspowner,nspacl) from pg_namespace where oid=p.id::oid)
      when 'policy' then (select to_jsonb(x) from pg_policy x where oid=p.id::oid)
      when 'role' then (select to_jsonb(x) from pg_roles x where oid=p.id::oid)
      when 'membership' then (select to_jsonb(x) from pg_auth_members x where roleid::text||':'||member::text||':'||grantor::text=p.id)
      when 'column' then (select to_jsonb(x) from pg_attribute x where attrelid::text||':'||attnum::text=p.id)
      when 'constraint' then (select to_jsonb(x) from pg_constraint x where oid=p.id::oid)
      when 'index' then (select jsonb_build_array(pg_get_indexdef(indexrelid),to_jsonb(x)) from pg_index x where indexrelid=p.id::oid)
      when 'default_acl' then (select to_jsonb(x) from pg_default_acl x where oid=p.id::oid) end then raise exception 'historical definition/ACL drift: %',p.kind; end if;
  end loop;
  if (select count(*) from pg_auth_members)<>(select count(*)from gymio_c_historical where kind='membership') then raise exception 'historical membership count drift'; end if;
end $assert$;
commit;
