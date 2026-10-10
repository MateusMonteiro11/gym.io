// Local-only extension boundary audit. Never accepts a remote URL or SQL target.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const context = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''))
assert.ok(['gymio-extension-security-local','gymio-workout-push-local'].includes(context.project))
assert.equal(context.port, '55441')
assert.ok(path.isAbsolute(context.root) && /^(gymio-extension-gate-|gymio-workout-push-)/.test(path.basename(context.root)))
assert.equal(fs.readFileSync(path.join(context.root, '.owner'), 'utf8').trim(), context.project)
const status = JSON.parse(fs.readFileSync(path.join(context.root, 'status.json'), 'utf8').replace(/^\uFEFF/, ''))
const api = new URL(status.API_URL)
assert.ok(api.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(api.hostname) && api.port === context.port)
const users = JSON.parse(fs.readFileSync(path.join(context.root, 'users.json'), 'utf8'))
const sql = (text) => execFileSync('docker', ['exec', '-i', `supabase_db_${context.project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 })
const query = (text) => JSON.parse(sql(text))
const hash = (text) => createHash('sha256').update(text).digest('hex')
const migration = fs.readFileSync('supabase/migrations/20261007215944_push_foundation.sql', 'utf8')
const assertions = migration.match(/do \$assertions\$[\s\S]*?\$assertions\$;/)[0]

// Snapshot every official ACL/owner/policy/default ACL without reading queue
// data, response bodies, decrypted secrets or credentials.
const snapshot = () => query(`select jsonb_build_object(
  'extensions',(select jsonb_agg(to_jsonb(t) order by extname) from
    (select extname,extversion,extowner::regrole::text as owner,extnamespace::regnamespace::text as schema from pg_extension where extname in ('pg_cron','pg_net','supabase_vault')) t),
  'schemas',(select jsonb_agg(to_jsonb(t) order by nspname) from
    (select nspname,nspowner::regrole::text as owner,nspacl from pg_namespace where nspname in ('cron','net','vault')) t),
  'relations',(select jsonb_agg(to_jsonb(t) order by name) from
    (select n.nspname||'.'||c.relname as name,c.relkind,c.relowner::regrole::text as owner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
      e.extname as extension,(select jsonb_agg(jsonb_build_object('column',attname,'acl',attacl) order by attnum) from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped) as columns
     from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e'
     left join pg_extension e on e.oid=d.refobjid where n.nspname in ('cron','net','vault')) t),
  'functions',(select jsonb_agg(to_jsonb(t) order by signature) from
    (select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,p.proowner::regrole::text as owner,p.proacl,p.prosecdef,p.proconfig,p.prosrc,p.probin,e.extname as extension
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'
     left join pg_extension e on e.oid=d.refobjid where n.nspname in ('cron','net','vault')) t),
  'policies',(select jsonb_agg(to_jsonb(t) order by name) from
    (select n.nspname||'.'||c.relname||'.'||p.polname as name,p.polcmd,p.polroles,p.polpermissive,pg_get_expr(p.polqual,p.polrelid) as qual,pg_get_expr(p.polwithcheck,p.polrelid) as check
     from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('cron','net','vault')) t),
  'defaults',(select jsonb_agg(to_jsonb(t) order by schema,owner,type) from
    (select n.nspname as schema,d.defaclrole::regrole::text as owner,d.defaclobjtype as type,d.defaclacl from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ('cron','net','vault')) t));`)

// Review immutable migration bodies, not function names alone. All app functions
// (including private callees) must match those sources, owner/security/config and
// expected caller ACLs. Unknown functions or dynamic SQL fail closed.
const reviewed = new Map()
const sourceFiles = ['20260821190134_workout_session_persistence_expand.sql', '20260823003337_exercise_memory_read.sql', '20261007215944_push_foundation.sql']
const workoutSource = context.project === 'gymio-workout-push-local' && sql("select to_regnamespace('gymio_workout_push_private') is not null;").trim()==='t'
  ? fs.readdirSync('supabase/migrations').find((file) => file.endsWith('_workout_notifications.sql')) : null
if (workoutSource) sourceFiles.push(workoutSource)
const administrative = new Set()
for (const file of sourceFiles) {
  const source = fs.readFileSync(`supabase/migrations/${file}`, 'utf8').replace(/\r\n/g, '\n')
  const pattern = /create(?: or replace)? function ((?:public|gymio_private|gymio_push_private|gymio_workout_push_private)\.[a-z_]+)\s*\([\s\S]*?\)\s*returns[\s\S]*?\bas\s+(\$[a-z_]*\$)([\s\S]*?)\2\s*;/gi
  for (const match of source.matchAll(pattern)) {
    assert.ok(!reviewed.has(match[1]), `ambiguous source ${match[1]}`)
    if (file === workoutSource) administrative.add(match[1])
    else assert.ok(!/\b(?:cron|net|vault)\s*\.|\bexecute\b/i.test(match[3]), `administrative/dynamic source ${match[1]}`)
    reviewed.set(match[1], match[3])
  }
}
assert.ok(reviewed.size >= 30, 'complete app source inventory')
const functionQuery = `select coalesce(jsonb_agg(to_jsonb(t) order by name), '[]'::jsonb) from (
 select n.nspname||'.'||p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,
 p.proowner::regrole::text as owner,p.prosecdef as definer,p.proconfig as config,p.prosrc as source,l.lanname as language,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service,
 p.proacl as acl, pg_get_functiondef(p.oid) as definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname in ('public','graphql_public','gymio_private','gymio_push_private'${workoutSource ? ", 'gymio_workout_push_private'" : ''}) and p.prokind='f') t;`
const auditWrappers = (functions) => {
  const names = new Set()
  for (const fn of functions) {
    assert.ok(!names.has(fn.name), `unreviewed overload ${fn.name}`); names.add(fn.name)
    if (fn.name === 'graphql_public.graphql') {
      // The local official baseline is the non-enabled GraphQL stub. It returns
      // a fixed error and never evaluates a query. An enabled resolver requires
      // a separate review; do not silently trust a changed/native body.
      assert.equal(hash(fn.source), 'd2330ee1a8a4e6fbe400b0e12c15a6cff5d26a37c8c499cea45bab56a43d3bcb')
      assert.equal(fn.owner, 'supabase_admin'); assert.equal(fn.definer, false)
      assert.equal(fn.language, 'plpgsql'); assert.equal(fn.config, null)
      continue
    }
    assert.ok(reviewed.has(fn.name), `unreviewed callable/helper ${fn.name}`)
    assert.equal(fn.source.replace(/\r\n/g, '\n'), reviewed.get(fn.name), `body drift ${fn.name}`)
    const push = fn.name.startsWith('gymio_push_private.') || /public\.(registrar|consultar|remover)_push_subscription/.test(fn.name)
    const memory = fn.name === 'public.buscar_memorias_exercicios'
    const trigger = fn.name === 'gymio_push_private.touch_updated_at'
    const admin = administrative.has(fn.name)
    assert.equal(fn.owner, memory || trigger || admin ? 'postgres' : push ? 'gymio_push_executor' : 'gymio_workout_executor', `owner ${fn.name}`)
    assert.equal(fn.definer, fn.name.startsWith('public.') && !memory, `security ${fn.name}`)
    assert.deepEqual(fn.config, ['search_path=""'], `search path ${fn.name}`)
    assert.equal(fn.anon, false, `anon ACL ${fn.name}`)
    assert.equal(fn.authenticated, fn.name.startsWith('public.') && !admin, `authenticated ACL ${fn.name}`)
    if (admin) assert.equal(fn.service, fn.name.startsWith('public.'), `service-only ACL ${fn.name}`)
  }
  assert.equal(names.size, reviewed.size + 1, 'full function inventory including downstream implementations')
  return functions.map(({ name, arguments: args, owner, definer, language, anon, authenticated, source }) => ({ name, arguments: args, owner, definer, language, anon, authenticated, bodyHash: hash(source) }))
}
const request = async (role, schema, resource, body, method = 'GET') => {
  const response = await fetch(`${api.origin}/rest/v1/${resource}`, { method, headers: {
    apikey: status.ANON_KEY, Authorization: `Bearer ${role === 'anon' ? status.ANON_KEY : users[0].jwt}`,
    [method === 'GET' ? 'Accept-Profile' : 'Content-Profile']: schema, 'Content-Type': 'application/json',
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) })
  return { status: response.status, data: await response.json() }
}
const effectiveProfiles = (result) => {
  assert.equal(result.data.code, 'PGRST106')
  // PostgREST 16 reports the allowed list in hint; earlier releases used message.
  const text = result.data.hint ?? result.data.message
  assert.match(text, /^(Only the following schemas are exposed: |The schema must be one of the following: )/)
  return text.split(': ').slice(1).join(': ').split(',').map((name) => name.trim())
}
const assertProfiles = async () => {
  // A valid public request proves that rejection is not an unavailable API or
  // invalid JWT. PGRST106 reports the actual allowed profiles for this request.
  const rows = []
  const probes = [
    ['cron', 'job?select=jobid&limit=0'], ['cron', 'job_run_details?select=jobid&limit=0'],
    ['net', 'http_request_queue?select=id&limit=0'], ['net', '_http_response?select=id&limit=0'],
    ['cron', 'rpc/schedule', { schedule: '0 0 1 1 *', command: 'select 1' }],
    ['cron', 'rpc/unschedule', { job_id: -1 }],
    ['net', 'rpc/http_post', { url: 'http://127.0.0.1:1/', body: {}, params: {}, headers: {}, timeout_milliseconds: 1 }],
    ['vault', 'decrypted_secrets?select=id&limit=0'], ['gymio_private', 'rpc/request_uid', {}],
    ['gymio_push_private', 'rpc/request_uid', {}], ['gymio_workout_push_private', 'rpc/tick', {}],
  ]
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await request(role, 'public', 'exercicios?select=id_exercicio&limit=0')).status, 200)
    for (const [schema, resource, body] of probes) {
      const result = await request(role, schema, resource, body, body === undefined ? 'GET' : 'POST')
      assert.equal(result.status, 406, `unexposed schema ${role} ${schema} ${resource}`)
      assert.equal(result.data.code, 'PGRST106')
      assert.deepEqual(effectiveProfiles(result), ['public', 'graphql_public'], 'effective schemas')
      rows.push({ role, schema, resource, status: result.status, code: result.data.code })
    }
    const graphql = await request(role, 'graphql_public', 'rpc/graphql', { query: '{ __typename }' }, 'POST')
    assert.equal(graphql.status, 200)
    assert.deepEqual(graphql.data, { errors: [{ message: 'pg_graphql extension is not enabled.' }] })
  }
  return rows
}

const before = snapshot()
sql(assertions)
const wrapperAudit = auditWrappers(query(functionQuery))
const http = await assertProfiles()
const acl = query(`select jsonb_agg(to_jsonb(t) order by role,schema) from (
  select r.rolname as role,n.nspname as schema,has_schema_privilege(r.oid,n.oid,'USAGE') as usage,has_schema_privilege(r.oid,n.oid,'CREATE') as create
  from pg_roles r cross join pg_namespace n where r.rolname in ('anon','authenticated','gymio_push_executor') and n.nspname in ('cron','net','vault')) t;`)
assert.ok(acl.filter((row) => row.schema === 'vault').every((row) => !row.usage && !row.create), 'strict Vault schema boundary')
sql(`do $$ begin
 if exists(select 1 from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
   where r.rolname in ('anon','authenticated') and n.nspname='vault' and c.relkind in ('r','v') and
   (has_table_privilege(r.oid,c.oid,'SELECT') or has_any_column_privilege(r.oid,c.oid,'SELECT')))
 or exists(select 1 from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where r.rolname in ('anon','authenticated') and n.nspname='vault' and has_function_privilege(r.oid,p.oid,'EXECUTE'))
 then raise exception 'Vault capability exposed'; end if; end $$;`)

const negatives = []
for (const [grant, message] of [
  ['select on public.usuarios', 'push executor relation allowlist violation'],
  ['select on cron.job', 'push platform direct executor grant violation'],
]) {
  assert.throws(() => sql(`begin; grant ${grant} to gymio_push_executor; ${assertions} rollback;`),
    (error) => String(error.stderr).includes(message), `reject explicit ${grant}`)
  sql(assertions); negatives.push(`explicit ${grant}`)
}
// Unknown exposed wrappers are rejected by the same body/owner/ACL audit.
// This rollback query returns the real catalog entry; it never invokes the
// function, enqueues HTTP or schedules a job.
for (const body of ["select cron.schedule('0 0 1 1 *','select 1');", "select net.http_post('http://127.0.0.1:1/');"]) {
  const output = sql(`begin;
    create function public.extension_gate_unsafe() returns bigint language sql security definer set search_path='' as $bad$ ${body} $bad$;
    grant execute on function public.extension_gate_unsafe() to authenticated;
    ${functionQuery} rollback;`)
  const functions = JSON.parse(output.split('\n').find((line) => line.startsWith('[')))
  assert.throws(() => auditWrappers(functions), /unreviewed callable\/helper/)
  negatives.push(body.includes('cron.') ? 'cron wrapper' : 'net wrapper')
}
// Change only our disposable authenticator configuration, not extension ACLs.
// The HTTP gate must reject the resulting effective API exposure. Restore the
// absent setting in finally and verify the original boundary again.
const setting = sql("select coalesce(jsonb_agg(s),'[]'::jsonb) from pg_db_role_setting d cross join lateral unnest(d.setconfig) s where d.setrole='authenticator'::regrole and s like 'pgrst.db_schemas=%';").trim()
assert.equal(setting, '[]', 'preserve an existing role override')
for (const schema of ['net', 'cron']) {
  try {
    sql(`alter role authenticator set pgrst.db_schemas='public,graphql_public,${schema}'; notify pgrst, 'reload config'; notify pgrst, 'reload schema';`)
    let changed = false
    for (let i = 0; i < 30; i++) {
      const result = await request('anon', 'vault', 'decrypted_secrets?select=id&limit=0')
      if (effectiveProfiles(result).includes(schema)) { changed = true; break }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    assert.ok(changed, 'actual PostgREST config reload')
    await assert.rejects(assertProfiles(), /effective schemas|unexposed schema/)
    negatives.push(`effective ${schema} exposure`)
  } finally {
    sql("alter role authenticator reset pgrst.db_schemas; notify pgrst, 'reload config'; notify pgrst, 'reload schema';")
    let restored = false
    for (let i = 0; i < 30; i++) {
      const result = await request('anon', 'vault', 'decrypted_secrets?select=id&limit=0')
      if (effectiveProfiles(result).join(',') === 'public,graphql_public') { restored = true; break }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    assert.ok(restored, 'restore original effective exposure')
  }
}
await assertProfiles()
sql(assertions)
assert.deepEqual(snapshot(), before, 'official extension ACLs, owners, policies and defaults unchanged')
const empty = query("select jsonb_build_object('jobs',(select count(*) from cron.job),'requests',(select count(*) from net.http_request_queue),'responses',(select count(*) from net._http_response),'secrets',(select count(*) from vault.secrets));")
assert.deepEqual(empty, { jobs: workoutSource ? 1 : 0, requests: 0, responses: 0, secrets: workoutSource ? (context.expectedSecrets ?? 0) : 0 })
if (workoutSource) assert.equal(sql("select count(*) from cron.job where jobname='gymio-workout-push' and command='select gymio_workout_push_private.tick();' and username='postgres';").trim(), '1')
const result = { passed: true, extensions: before, effectiveSchemas: ['public', 'graphql_public'], http, acl, wrapperAudit, negatives, empty, externalRequests: 0, graphql: 'official disabled stub audited; enabled resolver is outside this tested baseline' }
fs.writeFileSync(path.join(context.root, 'extension-result.json'), JSON.stringify(result, null, 2))
console.log(`PASS extension boundary: ${http.length} HTTP rejections, ${wrapperAudit.length} bodies/owners/ACLs, ${negatives.length} new negative fixtures; official ACL snapshot unchanged`)
