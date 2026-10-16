// D-only baseline fixtures. No imported module starts a runtime or mutates SQL.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const membershipQuery = `select roleid,member,grantor,admin_option,inherit_option,set_option
 from pg_catalog.pg_auth_members
 where roleid='gymio_push_executor'::regrole or member='gymio_push_executor'::regrole`
export function executorSnapshot(c) {
  return c.value(`select jsonb_build_object('memberships',coalesce((select jsonb_agg(to_jsonb(m) order by roleid,member,grantor)
    from (${membershipQuery}) m),'[]'::jsonb),'public_create',has_schema_privilege('gymio_push_executor','public','CREATE'),
    'private_create',has_schema_privilege('gymio_push_executor','gymio_push_private','CREATE'));`)
}

export function assertExecutorBaseline(c, expectedCount) {
  const snapshot = executorSnapshot(c)
  assert.equal(snapshot.memberships.length, expectedCount)
  assert.equal(snapshot.public_create, false); assert.equal(snapshot.private_create, false)
  if (expectedCount) {
    const row = snapshot.memberships[0]
    assert.deepEqual(row, c.value(`select jsonb_build_object('roleid','gymio_push_executor'::regrole::oid,
      'member','postgres'::regrole::oid,'grantor','supabase_admin'::regrole::oid,
      'admin_option',true,'inherit_option',false,'set_option',false);`))
  }
  return snapshot
}

function bootstrapSql(c, input) {
  // actionsContext already verified the exact disposable container/root/image.
  assert.equal(c.context.project, 'gymio-push-delivery-local')
  const container = `supabase_db_${c.context.project}`
  // The image requires SCRAM on the supabase_admin Unix socket. Its loopback
  // rule is trusted; this connection stays inside the verified DB container.
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'supabase_admin', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    encoding: 'utf8', windowsHide: true, input,
  })
  assert.equal(result.status, 0, `zero-membership fixture SQL failed: ${result.stderr}`)
  return result.stdout.trim()
}

export function prepareZeroMembershipFixture(c) {
  // POSITIVE TEST FIXTURE ONLY, in the extra runtime that is destroyed before
  // the normal matrix starts. This intentionally constructs the requested zero
  // baseline; it is not D, not a repair and never runs on the normal baseline.
  const original = assertExecutorBaseline(c, 1)
  assert.equal(c.sql("select count(*) from public.push_subscriptions;"), '0')
  bootstrapSql(c, 'begin; revoke gymio_push_executor from postgres granted by supabase_admin; commit;')
  assertExecutorBaseline(c, 0)
  return original
}

export function applyZeroBaselineMigration(c, migrationSource) {
  assertExecutorBaseline(c, 0)
  // Run the complete unchanged D file with a migration administrator that can
  // SET ROLE without membership. No historical role attributes are changed.
  applyWithTimeoutProbe(c, migrationSource, true)
}

export function negativeExecutorBaselines(c, migrationSource) {
  // Extract the actual migration checks, not a mirror that could drift from D.
  const snapshot = migrationSource.match(/create temporary table push_d_executor_memberships_before[\s\S]*?from \(values\('public'\),\('gymio_push_private'\)\) s\(schema_name\);/)?.[0]
  const preflight = migrationSource.match(/do \$preflight\$[\s\S]*?end \$preflight\$;/)?.[0]
  const postflight = migrationSource.match(/do \$executor_assertions\$[\s\S]*?end \$executor_assertions\$;/)?.[0]
  assert.ok(snapshot && preflight && postflight, 'D baseline assertion extraction must be exact')
  const before = assertExecutorBaseline(c, 1), cases = []
  const fixtures = [
    ['A executor receives another role', 'pre', 'create role gymio_d_negative_other nologin; grant gymio_d_negative_other to gymio_push_executor;'],
    ['B authenticated receives executor', 'pre', 'grant gymio_push_executor to authenticated with inherit false,set false;'],
    ['C service_role receives executor', 'pre', 'grant gymio_push_executor to service_role with inherit false,set false;'],
    ['D residual CREATE public', 'pre', 'grant create on schema public to gymio_push_executor;'],
    ['E residual CREATE private', 'pre', 'grant create on schema gymio_push_private to gymio_push_executor;'],
    ['D residual CREATE public postflight', 'schema', 'grant create on schema public to gymio_push_executor;'],
    ['E residual CREATE private postflight', 'schema', 'grant create on schema gymio_push_private to gymio_push_executor;'],
    ['F legitimate inbound removed', 'post', 'revoke gymio_push_executor from postgres granted by supabase_admin;'],
    ['G inherit changed', 'post', 'grant gymio_push_executor to postgres with inherit true granted by supabase_admin;'],
    ['G set changed', 'post', 'grant gymio_push_executor to postgres with set true granted by supabase_admin;'],
    ['G admin changed', 'post', 'revoke admin option for gymio_push_executor from postgres granted by supabase_admin;'],
    ['G grantor drift: temporary postgres grant left behind', 'post', `set local role postgres;
      grant gymio_push_executor to postgres with inherit false,set false granted by postgres; reset role;`],
    ['postflight new inbound cannot hide behind baseline', 'post', 'grant gymio_push_executor to authenticated with inherit false,set false;'],
  ]
  for (const [name, stage, mutation] of fixtures) {
    const expected = stage === 'pre' ? 'D requires unchanged executor membership/schema baseline'
      : stage === 'schema' ? 'D executor schema snapshot changed' : 'D executor membership snapshot changed'
    // Every mutation is rollback-only in a dedicated psql transaction. An
    // expected exception terminates the connection and rolls it back. The
    // production D file, including BEGIN/COMMIT, is never rewritten for tests.
    const input = `begin; set local role postgres; ${snapshot} reset role;
      ${mutation}
      select jsonb_build_object('mutated',true,'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from (${membershipQuery}) m),'[]'::jsonb));
      set local role postgres; ${stage === 'pre' ? preflight : postflight}
      rollback;`
    const result = spawnSync('docker', ['exec', '-i', `supabase_db_${c.context.project}`, 'psql', '-h', '127.0.0.1', '-U', 'supabase_admin', '-d', 'postgres',
      '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], { input, encoding: 'utf8', windowsHide: true })
    assert.ok(!result.error && result.status !== 0 && result.stderr.includes(`P0001: ${expected}`), `negative baseline must fail at D check: ${name}`)
    assert.ok(result.stdout.includes('"mutated": true'), `fixture must reach D assertion: ${name}`)
    assert.deepEqual(executorSnapshot(c), before, `rollback must preserve original membership and CREATE: ${name}`)
    assert.equal(c.sql("select to_regrole('gymio_d_negative_other') is null;"), 't')
    cases.push({ name, passed: true, assertion: expected, rollbackVerified: true })
    console.log(`PASS D baseline negative: ${name}`)
  }
  fs.writeFileSync(path.join(c.context.root, 'd-baseline-negative-result.json'), JSON.stringify({ passed: true, cases, before, after: executorSnapshot(c) }, null, 2))
}

export function applyWithTimeoutProbe(c, migrationSource, bootstrap = false) {
  const freshSettings = () => c.value(`select jsonb_build_object(
    'lock_seconds',extract(epoch from current_setting('lock_timeout')::interval),
    'statement_seconds',extract(epoch from current_setting('statement_timeout')::interval));`)
  const freshBefore = freshSettings()
  assert.equal(c.sql("select to_regnamespace('gymio_d_timeout_test') is null;"), 't')
  let fixtureCreated = false
  try {
    // Disposable observer installed before D's snapshot; it reads settings
    // at D's first persistent DDL, inside the canonical transaction.
    bootstrapSql(c, `begin;
      create schema gymio_d_timeout_test authorization postgres;
      revoke all on schema gymio_d_timeout_test from public,anon,authenticated,service_role;
      create table gymio_d_timeout_test.observations(
        lock_seconds numeric not null, statement_seconds numeric not null,
        lock_display text not null, statement_display text not null);
      alter table gymio_d_timeout_test.observations owner to postgres;
      create function gymio_d_timeout_test.observe() returns event_trigger
      language plpgsql security definer set search_path='' as $probe$
      begin
        if position('alter table public.push_subscriptions add column workout_notification_mode' in lower(pg_catalog.current_query()))>0 then
          insert into gymio_d_timeout_test.observations
          select extract(epoch from pg_catalog.current_setting('lock_timeout')::interval),
            extract(epoch from pg_catalog.current_setting('statement_timeout')::interval),
            pg_catalog.current_setting('lock_timeout'),pg_catalog.current_setting('statement_timeout');
        end if;
      end $probe$;
      revoke all on function gymio_d_timeout_test.observe() from public,anon,authenticated,service_role;
      create event trigger gymio_d_timeout_probe on ddl_command_start when tag in ('ALTER TABLE')
        execute function gymio_d_timeout_test.observe();
      commit;`)
    fixtureCreated = true
    // SESSION values exist only in this test connection. Canonical D remains
    // complete and byte-for-byte intact between the pre/post-commit probes.
    const input = `set lock_timeout='5s'; set statement_timeout='90s';
${migrationSource}
do $scope_probe$ begin
  if current_setting('lock_timeout')::interval is distinct from interval '5 seconds'
    or current_setting('statement_timeout')::interval is distinct from interval '90 seconds' then
    raise exception 'D timeout settings escaped COMMIT';
  end if;
end $scope_probe$;
select jsonb_build_object('lock_seconds',extract(epoch from current_setting('lock_timeout')::interval),
  'statement_seconds',extract(epoch from current_setting('statement_timeout')::interval));`
    const output = bootstrap ? bootstrapSql(c, input) : c.sql(input)
    const afterCommit = JSON.parse(output.split('\n').filter((line) => line.startsWith('{')).at(-1))
    assert.deepEqual(afterCommit, { lock_seconds: 5, statement_seconds: 90 })
    const observations = c.value('select jsonb_agg(to_jsonb(o)) from gymio_d_timeout_test.observations o;')
    assert.equal(observations?.length, 1, 'must observe D inside its transaction')
    assert.equal(observations[0].lock_seconds, 2)
    assert.equal(observations[0].statement_seconds, 60)
    const freshAfter = freshSettings()
    assert.deepEqual(freshAfter, freshBefore, 'fresh connection must retain its own defaults')
    fs.writeFileSync(path.join(c.context.root, 'd-timeout-guards-result.json'), JSON.stringify({
      passed: true, duringD: observations[0], sameConnectionAfterCommit: afterCommit,
      freshBefore, freshAfter, canonicalFileAppliedIntact: true,
    }, null, 2))
    console.log('PASS D transaction-local timeout guards: inside D 2s/60s; COMMIT restores 5s/90s; fresh connection unchanged')
  } finally {
    if (fixtureCreated) bootstrapSql(c, 'begin; drop event trigger gymio_d_timeout_probe; drop schema gymio_d_timeout_test cascade; commit;')
  }
}
