-- TEST HARNESS ONLY. Install only after actionsContext has rejected manual B.
-- No extension ACL changes or production test hooks. Remove with that stack.
begin;
create function public.actions_matrix_capture() returns jsonb
language sql security definer set search_path='' as $fn$
  select gymio_workout_push_private.capture_events();
$fn$;
revoke all on function public.actions_matrix_capture()from public,anon,authenticated,service_role;
grant execute on function public.actions_matrix_capture()to service_role;
create function public.actions_matrix_binding(p_generation uuid,p_subscription uuid,p_user uuid) returns boolean
language sql security definer set search_path='' as $fn$
  select exists(select 1 from gymio_workout_actions_private.generations g where g.id=p_generation and g.subscription_id=p_subscription and g.id_usuario=p_user)
    and exists(select 1 from gymio_workout_actions_private.capabilities c where c.generation_id=p_generation)
    and not exists(select 1 from gymio_workout_actions_private.capabilities c where c.generation_id=p_generation and (c.subscription_id<>p_subscription or c.id_usuario<>p_user));
$fn$;
revoke all on function public.actions_matrix_binding(uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.actions_matrix_binding(uuid,uuid,uuid)to service_role;

-- Authentic B baseline for the fixed sender test port. Its attempt marker is
-- rolled back in this subtransaction; only the public payload is returned.
-- No endpoint/key snapshot, capability, arbitrary SQL or destination escapes.
create function public.actions_matrix_b_payload(p_delivery_id uuid,p_claim_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare v_attempt jsonb;
begin
 begin
  v_attempt:=public.workout_push_begin(p_delivery_id,p_claim_token);
  raise exception using errcode='ZC002',message='rollback-only B sender baseline';
 exception when sqlstate 'ZC002' then null;
 end;
 return v_attempt->'payload';
end $fn$;
revoke all on function public.actions_matrix_b_payload(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.actions_matrix_b_payload(uuid,uuid) to service_role;

-- Origin is defense-in-depth; the capability is authorization. Kong may answer
-- universal preflight. This observer measures actual RPC calls and unchanged
-- state at the real gateway without replacing the production handler.
create function public.actions_matrix_boundary_snapshot() returns jsonb
language sql security definer set search_path='' as $fn$
 select jsonb_build_object(
  'rpc_calls',coalesce((select sum(calls) from extensions.pg_stat_statements
    where query ~ 'workout_notification_action["[:space:]]*\('),0),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.id_sessao) from public.treino_sessoes s),'[]'::jsonb),
  'generations',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from gymio_workout_actions_private.generations g),'[]'::jsonb),
  'capabilities',coalesce((select jsonb_agg(to_jsonb(c)-'token_hash' order by c.id) from gymio_workout_actions_private.capabilities c),'[]'::jsonb));
$fn$;
revoke all on function public.actions_matrix_boundary_snapshot() from public,anon,authenticated,service_role;
grant execute on function public.actions_matrix_boundary_snapshot() to service_role;

-- Never returns tokens, their hashes, claim tokens, endpoints or keys.
create function public.actions_matrix_sender_audit(p_session uuid,p_subscriptions uuid[]) returns jsonb
language sql security definer set search_path='' as $fn$
 select jsonb_build_object(
  'deliveries',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'subscription_id',d.subscription_id,
    'state',d.state,'attempted_at',d.attempted_at,'accepted_at',d.accepted_at) order by d.subscription_id)
    from gymio_workout_push_private.deliveries d join gymio_workout_push_private.outbox e on e.id=d.event_id
    where e.id_sessao=p_session and d.subscription_id=any(p_subscriptions)),'[]'::jsonb),
  'generations',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'subscription_id',g.subscription_id,
    'id_usuario',g.id_usuario,'capability_subscriptions',(select jsonb_agg(c.subscription_id order by c.id)
      from gymio_workout_actions_private.capabilities c where c.generation_id=g.id)) order by g.subscription_id)
    from gymio_workout_actions_private.generations g where g.id_sessao=p_session and g.subscription_id=any(p_subscriptions)),'[]'::jsonb),
  'subscriptions',coalesce((select jsonb_agg(ps.id order by ps.id) from public.push_subscriptions ps
    where ps.id=any(p_subscriptions)),'[]'::jsonb));
$fn$;
revoke all on function public.actions_matrix_sender_audit(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.actions_matrix_sender_audit(uuid,uuid[]) to service_role;

-- TRANSIENT ROLLBACK-ONLY TEST FIXTURE: delete the already-local owner inside a
-- subtransaction, prove cascades and begin-after-delete, then roll back it all.
-- No third Auth user is created or committed, and A/B remain exactly present.
create function public.actions_matrix_user_cascade(p_user uuid,p_session uuid,p_subscriptions uuid[]) returns boolean
language plpgsql security definer set search_path='' as $fn$
declare v_before integer; v_profiles integer; v_claims jsonb; v_claim jsonb; v_checked boolean:=false;
begin
 if not exists(select 1 from auth.users where id=p_user and email like '%@local.invalid')
   or not exists(select 1 from public.treino_sessoes where id_sessao=p_session and id_usuario=p_user)
   or cardinality(p_subscriptions)<>2
   or (select count(*) from public.push_subscriptions where id=any(p_subscriptions) and id_usuario=p_user)<>2
 then raise exception 'local cascade fixture scope rejected'; end if;
 select count(*) into v_before from auth.users;
 select count(*) into v_profiles from public.usuarios;
 begin
  v_claims:=public.workout_push_claim(10);
  if jsonb_array_length(v_claims)<>2 then raise exception 'cascade claim fixture mismatch'; end if;
  delete from auth.users where id=p_user;
  if exists(select 1 from public.push_subscriptions where id=any(p_subscriptions))
   or exists(select 1 from gymio_workout_push_private.deliveries where subscription_id=any(p_subscriptions))
   or exists(select 1 from gymio_workout_actions_private.capabilities where subscription_id=any(p_subscriptions))
  then raise exception 'cascade did not remove fixture'; end if;
  for v_claim in select value from jsonb_array_elements(v_claims) loop
   if public.workout_push_begin_controls((v_claim->>'id')::uuid,(v_claim->>'claim_token')::uuid) is not null
    then raise exception 'removed user authorized attempt'; end if;
  end loop;
  v_checked:=true;
  raise exception using errcode='ZC001',message='rollback-only cascade fixture';
 exception when sqlstate 'ZC001' then null;
 end;
 return v_checked and (select count(*) from auth.users)=v_before
   and (select count(*) from public.usuarios)=v_profiles
   and (select count(*) from public.push_subscriptions where id=any(p_subscriptions) and id_usuario=p_user)=2;
end $fn$;
revoke all on function public.actions_matrix_user_cascade(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.actions_matrix_user_cascade(uuid,uuid,uuid[]) to service_role;
commit;
