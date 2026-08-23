\set ON_ERROR_STOP on

do $block$
begin
  create role anon nologin;
exception when duplicate_object then null;
end;
$block$;

do $block$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end;
$block$;

do $block$
begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end;
$block$;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
