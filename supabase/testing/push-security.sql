-- Local synthetic users only. Everything rolls back, including test helpers.
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
create function pg_temp.expect_error(command text) returns void language plpgsql as $$
declare failed boolean := false;
begin begin execute command; exception when others then failed := true; end;
if not failed then raise exception 'expected rejection: %', command; end if; end $$;

insert into auth.users(id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sql-a@local.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','sql-b@local.invalid');
select pg_temp.check_true(not has_schema_privilege('gymio_push_executor','auth','USAGE'), 'no Auth usage');
select pg_temp.check_true(not has_schema_privilege('gymio_push_executor','auth','CREATE'), 'no Auth create');
select pg_temp.check_true(not (select rolbypassrls from pg_roles where rolname='gymio_push_executor'), 'no bypassrls');
select pg_temp.check_true((select count(*)=3 from pg_constraint where conrelid='public.push_subscriptions'::regclass and contype='c'), 'checks');
select pg_temp.check_true((select count(*)=3 from pg_index where indrelid='public.push_subscriptions'::regclass), 'indexes');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.registrar_push_subscription('https://fcm.googleapis.com/fcm/send/sql-a', 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA') as a_id \gset
select pg_temp.check_true(public.registrar_push_subscription('https://fcm.googleapis.com/fcm/send/sql-a', 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'AQEBAQEBAQEBAQEBAQEBAQ') = :'a_id'::uuid, 'idempotent update');
select public.registrar_push_subscription('https://fcm.googleapis.com/fcm/send/sql-a2', 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA') as a2_id \gset
select pg_temp.check_true(:'a_id'::uuid <> :'a2_id'::uuid, 'multiple devices');
select pg_temp.expect_error('select * from public.push_subscriptions');
select pg_temp.expect_error('delete from public.push_subscriptions');
select pg_temp.expect_error('update public.push_subscriptions set auth=''AAAAAAAAAAAAAAAAAAAAAA''');
select pg_temp.expect_error('insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth) values(null,null,null,null)');
select pg_temp.expect_error('select gymio_push_private.request_uid()');
select pg_temp.expect_error('select public.registrar_push_subscription(''https://127.0.0.1/private'',''BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'',''AAAAAAAAAAAAAAAAAAAAAA'')');
select pg_temp.expect_error('select public.registrar_push_subscription(''https://fcm.googleapis.com/fcm/send/bad'',''bad'',''bad'')');
do $invalid_endpoints$
declare v_endpoint text;
begin
  foreach v_endpoint in array array[
    'http://fcm.googleapis.com/fcm/send/plaintext',
    'https://fcm.googleapis.com.evil.invalid/fcm/send/fake',
    'https://fcm.googleapis.com:8443/fcm/send/port',
    'https://user@fcm.googleapis.com/fcm/send/credentials',
    'https://fcm.googleapis.com/fcm/send/fragment#secret',
    'https://fcm.googleapis.com/fcm/send/space here',
    'https://fcm.googleapis.com/fcm/send/' || repeat('a', 2048)
  ] loop
    perform pg_temp.expect_error(format('select public.registrar_push_subscription(%L,%L,%L)',
      v_endpoint, 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA'));
  end loop;
end;
$invalid_endpoints$;

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select pg_temp.check_true(public.consultar_push_subscription('https://fcm.googleapis.com/fcm/send/sql-a') is null, 'B cannot lookup A');
select public.remover_push_subscription(:'a_id'::uuid);
select pg_temp.expect_error('select public.registrar_push_subscription(''https://fcm.googleapis.com/fcm/send/sql-a'',''BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'',''AAAAAAAAAAAAAAAAAAAAAA'')');
set local request.jwt.claims = '';
select pg_temp.expect_error('select public.consultar_push_subscription(''https://fcm.googleapis.com/fcm/send/sql-a'')');
set local request.jwt.claims = '{bad';
select pg_temp.expect_error('select public.consultar_push_subscription(''https://fcm.googleapis.com/fcm/send/sql-a'')');
set local request.jwt.claims = '{"sub":"invalid-uuid"}';
select pg_temp.expect_error('select public.consultar_push_subscription(''https://fcm.googleapis.com/fcm/send/sql-a'')');
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';
select pg_temp.check_true(public.consultar_push_subscription('https://fcm.googleapis.com/fcm/send/sql-a') = :'a_id'::uuid, 'legacy GUC precedence and A preserved');
select public.remover_push_subscription(:'a_id'::uuid);
select public.remover_push_subscription(:'a_id'::uuid);
select pg_temp.check_true(public.consultar_push_subscription('https://fcm.googleapis.com/fcm/send/sql-a') is null, 'idempotent removal');

set local role anon;
select pg_temp.expect_error('select public.consultar_push_subscription(''https://fcm.googleapis.com/fcm/send/sql-a2'')');
select pg_temp.expect_error('select * from public.push_subscriptions');
reset role;
select pg_temp.check_true((select count(*)=1 from public.push_subscriptions where id_usuario='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'no accidental deletes');
select pg_temp.expect_error('insert into public.push_subscriptions(id_usuario,endpoint,p256dh,auth) select id_usuario,endpoint,p256dh,auth from public.push_subscriptions where id=''' || :'a2_id' || '''');
delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select pg_temp.check_true(not exists(select 1 from public.push_subscriptions where id_usuario='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'user delete cascades');
rollback;
