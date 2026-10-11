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
commit;
