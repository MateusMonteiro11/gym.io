-- Additive Push Foundation. No workout state or historical objects are changed.
begin;

do $role$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'gymio_push_executor') then
    create role gymio_push_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'gymio_push_executor'
    and (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
    raise exception 'unsafe push executor';
  end if;
  if exists (select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.member
    where m.roleid = 'gymio_push_executor'::regrole and r.rolname <> 'postgres')
    or exists (select 1 from pg_catalog.pg_auth_members where member = 'gymio_push_executor'::regrole) then
    raise exception 'unsafe push executor memberships';
  end if;
end
$role$;

create schema gymio_push_private authorization postgres;
revoke all on schema gymio_push_private from public, anon, authenticated, service_role;
grant usage on schema public, gymio_push_private to gymio_push_executor;
grant gymio_push_executor to postgres with inherit false, set true granted by postgres;
grant create on schema public, gymio_push_private to gymio_push_executor;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  last_test_requested_at timestamptz,
  constraint push_endpoint_valid check (octet_length(endpoint) <= 2048 and
    endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'),
  constraint push_p256dh_valid check (p256dh ~ '^[A-Za-z0-9_-]{87}$' and
    octet_length(decode(translate(p256dh, '-_', '+/') || '=', 'base64')) = 65 and
    get_byte(decode(translate(p256dh, '-_', '+/') || '=', 'base64'), 0) = 4),
  constraint push_auth_valid check (auth ~ '^[A-Za-z0-9_-]{22}$' and
    octet_length(decode(translate(auth, '-_', '+/') || '==', 'base64')) = 16)
);
create index push_subscriptions_usuario_idx on public.push_subscriptions(id_usuario);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
revoke all on public.push_subscriptions from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.push_subscriptions to gymio_push_executor;
grant select, delete on public.push_subscriptions to service_role;
grant update(last_test_requested_at) on public.push_subscriptions to service_role;

create function gymio_push_private.request_uid() returns uuid
language sql stable security invoker set search_path = ''
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$function$;
alter function gymio_push_private.request_uid() owner to gymio_push_executor;

create policy push_executor_own on public.push_subscriptions to gymio_push_executor
using (id_usuario = (select gymio_push_private.request_uid()))
with check (id_usuario = (select gymio_push_private.request_uid()));

create function gymio_push_private.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $function$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
for each row execute function gymio_push_private.touch_updated_at();
revoke all on function gymio_push_private.touch_updated_at() from public, anon, authenticated, service_role;
grant execute on function gymio_push_private.touch_updated_at() to gymio_push_executor, service_role;

create function gymio_push_private.register_impl(p_endpoint text, p_p256dh text, p_auth text) returns uuid
language plpgsql security invoker set search_path = '' as $function$
declare v_uid uuid := gymio_push_private.request_uid(); v_id uuid;
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  begin
    insert into public.push_subscriptions(id_usuario, endpoint, p256dh, auth)
    values(v_uid, p_endpoint, p_p256dh, p_auth)
    on conflict(endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
      where push_subscriptions.id_usuario = v_uid
    returning id into v_id;
  exception when insufficient_privilege or unique_violation then
    raise exception using errcode = '42501', message = 'subscription_unavailable';
  end;
  if v_id is null then raise exception using errcode = '42501', message = 'subscription_unavailable'; end if;
  return v_id;
end;
$function$;

create function gymio_push_private.lookup_impl(p_endpoint text) returns uuid
language plpgsql stable security invoker set search_path = '' as $function$
declare v_uid uuid := gymio_push_private.request_uid(); v_id uuid;
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  select id into v_id from public.push_subscriptions where endpoint = p_endpoint and id_usuario = v_uid;
  return v_id;
end;
$function$;

create function gymio_push_private.remove_impl(p_subscription_id uuid) returns void
language plpgsql security invoker set search_path = '' as $function$
declare v_uid uuid := gymio_push_private.request_uid();
begin
  if v_uid is null then raise exception using errcode = '28000', message = 'authentication_required'; end if;
  delete from public.push_subscriptions where id = p_subscription_id and id_usuario = v_uid;
end;
$function$;

alter function gymio_push_private.register_impl(text,text,text) owner to gymio_push_executor;
alter function gymio_push_private.lookup_impl(text) owner to gymio_push_executor;
alter function gymio_push_private.remove_impl(uuid) owner to gymio_push_executor;

create function public.registrar_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns uuid
language sql security definer set search_path = '' as $function$
  select gymio_push_private.register_impl(p_endpoint, p_p256dh, p_auth);
$function$;
create function public.consultar_push_subscription(p_endpoint text) returns uuid
language sql stable security definer set search_path = '' as $function$
  select gymio_push_private.lookup_impl(p_endpoint);
$function$;
create function public.remover_push_subscription(p_subscription_id uuid) returns void
language sql security definer set search_path = '' as $function$
  select gymio_push_private.remove_impl(p_subscription_id);
$function$;
alter function public.registrar_push_subscription(text,text,text) owner to gymio_push_executor;
alter function public.consultar_push_subscription(text) owner to gymio_push_executor;
alter function public.remover_push_subscription(uuid) owner to gymio_push_executor;

set role gymio_push_executor;
revoke all on function gymio_push_private.request_uid(), gymio_push_private.register_impl(text,text,text),
  gymio_push_private.lookup_impl(text), gymio_push_private.remove_impl(uuid) from public, anon, authenticated, service_role;
revoke all on function public.registrar_push_subscription(text,text,text), public.consultar_push_subscription(text),
  public.remover_push_subscription(uuid) from public, anon, authenticated, service_role;
grant execute on function public.registrar_push_subscription(text,text,text), public.consultar_push_subscription(text),
  public.remover_push_subscription(uuid) to authenticated;
reset role;
revoke create on schema public, gymio_push_private from gymio_push_executor;
revoke gymio_push_executor from postgres granted by postgres;

do $assertions$
declare v_role oid := 'gymio_push_executor'::regrole; v_problem text;
begin
  if has_schema_privilege(v_role, 'auth', 'USAGE') or has_schema_privilege(v_role, 'auth', 'CREATE')
    or has_schema_privilege(v_role, 'public', 'CREATE') or has_schema_privilege(v_role, 'gymio_push_private', 'CREATE') then
    raise exception 'push executor schema privileges invalid';
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members where member = v_role or
    (roleid = v_role and member <> 'postgres'::regrole)) then raise exception 'push membership violation'; end if;
  select c.relname into v_problem from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
  where n.nspname = 'auth' and c.relkind in ('r','p','v','m','f') and has_table_privilege(v_role,c.oid,p.priv) limit 1;
  if v_problem is not null then raise exception 'push executor accesses auth table: %', v_problem; end if;
  if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relkind='S' and (has_sequence_privilege(v_role,c.oid,'USAGE')
      or has_sequence_privilege(v_role,c.oid,'SELECT') or has_sequence_privilege(v_role,c.oid,'UPDATE'))) then
    raise exception 'push executor accesses auth sequence';
  end if;
  if exists(select 1 from pg_catalog.pg_roles where oid=v_role and
    (rolsuper or rolcanlogin or rolinherit or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)) then
    raise exception 'unsafe executor attributes';
  end if;
  if exists(select 1 from pg_catalog.pg_class where relowner=v_role) then raise exception 'executor owns relation'; end if;
  -- Effective privileges include PUBLIC, inherited ACLs and column-only grants.
  -- Only these official views retain baseline SELECT inherited from PUBLIC.
  -- Name alone is insufficient: require view type, extension membership/owner,
  -- PUBLIC's table SELECT and no explicit executor relation/column ACL.
  with official_stats as (
    select c.oid from pg_catalog.pg_class c
    join pg_catalog.pg_depend d on d.classid='pg_catalog.pg_class'::regclass and d.objid=c.oid
      and d.refclassid='pg_catalog.pg_extension'::regclass and d.deptype='e'
    join pg_catalog.pg_extension e on e.oid=d.refobjid
    where c.oid in (to_regclass('extensions.pg_stat_statements'),to_regclass('extensions.pg_stat_statements_info'))
      and c.relkind='v' and c.relnamespace='extensions'::regnamespace
      and e.extname='pg_stat_statements' and e.extnamespace=c.relnamespace and e.extowner=c.relowner
      and exists(select 1 from pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
        where a.grantee=0 and a.privilege_type='SELECT' and not a.is_grantable)
      and not exists(select 1 from pg_catalog.aclexplode(c.relacl) a where a.grantee=v_role)
      and not exists(select 1 from pg_catalog.pg_attribute col cross join lateral pg_catalog.aclexplode(col.attacl) a
        where col.attrelid=c.oid and a.grantee=v_role)
  )
  select format('%I.%I (%s)', n.nspname, c.relname, p.priv) into v_problem
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(priv)
  where c.relkind in ('r','p','v','m','f')
    and n.nspname not in ('pg_catalog','information_schema')
    and n.nspname !~ '^pg_(toast|temp)(_|$)'
    and ((c.oid <> 'public.push_subscriptions'::regclass
      and not (p.priv='SELECT' and c.oid in (select oid from official_stats)) and
      (has_table_privilege(v_role,c.oid,p.priv) or case when p.priv in ('SELECT','INSERT','UPDATE','REFERENCES')
        then has_any_column_privilege(v_role,c.oid,p.priv) else false end))
      or (c.oid = 'public.push_subscriptions'::regclass and p.priv in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
        and (has_table_privilege(v_role,c.oid,p.priv) or case when p.priv = 'REFERENCES'
          then has_any_column_privilege(v_role,c.oid,p.priv) else false end)))
  order by n.nspname,c.relname,p.priv limit 1;
  if v_problem is not null then raise exception 'push executor relation allowlist violation: %', v_problem; end if;
  if exists(select 1 from (values('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(priv)
    where not has_table_privilege(v_role,'public.push_subscriptions',p.priv)) then
    raise exception 'push executor required CRUD missing';
  end if;
  if not exists(select 1 from pg_catalog.pg_class where oid='public.push_subscriptions'::regclass
    and relowner='postgres'::regrole and relrowsecurity and relforcerowsecurity) then raise exception 'push RLS/owner invalid'; end if;
  if (select count(*) from pg_catalog.pg_constraint where conrelid='public.push_subscriptions'::regclass
    and contype in ('p','u','f','c')) <> 6 then raise exception 'push constraints missing'; end if;
  if not exists(select 1 from pg_catalog.pg_index where indexrelid='public.push_subscriptions_usuario_idx'::regclass
    and indisvalid and indkey::text=(select attnum::text from pg_catalog.pg_attribute
    where attrelid='public.push_subscriptions'::regclass and attname='id_usuario')) then raise exception 'push user index missing'; end if;
  if (select count(*) from pg_catalog.pg_proc where proowner=v_role and pronamespace='public'::regnamespace)<>3
    or exists(select 1 from pg_catalog.pg_proc where proowner=v_role and
      (not coalesce(proconfig @> array['search_path=""'],false) or pg_catalog.pg_get_functiondef(oid) ~ '\mauth[.]'
        or prosecdef <> (pronamespace='public'::regnamespace))) then raise exception 'push functions security invalid'; end if;
  if exists(select 1 from pg_catalog.pg_proc p where p.proowner=v_role and p.pronamespace='public'::regnamespace
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')
      or not has_function_privilege('authenticated',p.oid,'EXECUTE'))) then raise exception 'push RPC grants invalid'; end if;
  if exists(select 1 from pg_catalog.pg_roles r cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
    where r.rolname in ('anon','authenticated') and has_table_privilege(r.oid,'public.push_subscriptions',p.priv))
    or exists(select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
      and has_schema_privilege(r.oid,'gymio_push_private','USAGE')) then raise exception 'push Data API boundary invalid'; end if;
  if exists(select 1 from pg_catalog.pg_proc p where p.proowner=v_role and p.pronamespace='gymio_push_private'::regnamespace
    and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE'))) then raise exception 'private push functions exposed'; end if;
end
$assertions$;
commit;
