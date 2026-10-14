// Explicit local manual setup phases only. No matrix, deployment, session start,
// cleanup, container removal, or changes to the preserved A/B projects.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes, createECDH, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { actionsContext, assertActionsHistory, historicalHashes } from './actions-context.mjs'
import { startRuntime, bootstrap, gate, secrets, serve, ready } from './actions-reexecution-setup.mjs'

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const project = 'gymio-workout-actions-local'
const image = 'public.ecr.aws/supabase/postgres:17.6.1.113'
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
const exec = (command, args) => execFileSync(command, args, {
  cwd: workspace, encoding: 'utf8', windowsHide: true, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024,
}).trim()
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function sources() {
  assertActionsHistory()
  const approved = read(path.join(workspace, 'supabase/testing/actions-third-inventory-after.json'))
  const production = file => file.startsWith('src/') || file.startsWith('public/') || file.startsWith('supabase/functions/')
    || file.startsWith('supabase/migrations/') || ['.env', '.env.push.local', '.gitignore', 'supabase/config.toml',
      'vite.config.js', 'package.json', 'package-lock.json', 'supabase/testing/legacy-baseline.sql',
      'supabase/testing/seed-manual-workout.mjs'].includes(file)
  const files = Object.entries(approved.files).filter(([file]) => production(file))
  assert.equal(files.length, 257)
  for (const [file, entry] of files) assert.equal(hash(path.join(workspace, file)), entry.sha256, `Approved source drift: ${file}`)
  console.log('PASS 257 approved production/support files byte-identical')
}
function localDocker() {
  const current = exec('docker', ['context', 'show'])
  const host = process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT ? process.env.DOCKER_HOST
    : exec('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', current])
  assert.ok(/^npipe:\/+\.\/pipe\//.test(host) || /^unix:\/\/\/[^\r\n]+$/.test(host), 'Remote Docker refused')
}
async function create() {
  assertActionsHistory(); localDocker()
  assert.equal(exec('docker', ['ps', '-a', '--filter', `label=com.supabase.cli.project=${project}`, '--format', '{{.ID}}']), '', 'Existing C stack must be preserved')
  exec('docker', ['image', 'inspect', image])
  for (const port of [55450, 55451, 55452]) await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', () => reject(Error(`Dedicated port ${port} occupied`)))
    server.listen({ host: '::', port, ipv6Only: false }, () => server.close(resolve))
  })
  const root = path.join(os.tmpdir(), 'gymio-workout-actions-' + randomUUID().replaceAll('-', ''))
  fs.mkdirSync(path.join(root, 'supabase/.temp'), { recursive: true })
  fs.mkdirSync(path.join(root, 'cli-home'))
  fs.writeFileSync(path.join(root, '.owner'), project + '\n', { flag: 'wx' })
  write(path.join(root, 'context.json'), { root, project, port: '55451', manualOnly: true, cleanupPolicy: 'preserve; no automatic cleanup' })
  const config = fs.readFileSync(path.join(workspace, 'supabase/config.toml'), 'utf8')
    .replaceAll('gymio-push-foundation-local', project).replaceAll('55431', '55451')
    .replaceAll('55432', '55452').replaceAll('55430', '55450')
  assert.ok(config.includes(`project_id = "${project}"`) && config.includes('port = 55451')
    && config.includes('port = 55452') && config.includes('shadow_port = 55450'))
  fs.writeFileSync(path.join(root, 'supabase/config.toml'), config, { flag: 'wx' })
  fs.writeFileSync(path.join(root, 'supabase/.temp/postgres-version'), '17.6.1.113', { flag: 'wx' })
  const functions = path.join(root, 'supabase/functions')
  fs.mkdirSync(functions)
  for (const name of ['push-test', 'workout-push', 'workout-action', '_shared']) {
    fs.cpSync(path.join(workspace, 'supabase/functions', name), path.join(functions, name), { recursive: true, errorOnExist: true })
  }
  for (const name of ['deno.json', 'deno.lock']) {
    fs.copyFileSync(path.join(workspace, 'supabase/functions', name), path.join(functions, name), fs.constants.COPYFILE_EXCL)
  }
  const preserved = ['gymio-push-foundation-local', 'gymio-workout-push-local'].map(id => ({ project: id,
    containers: JSON.parse(exec('docker', ['ps', '-a', '--filter', `label=com.supabase.cli.project=${id}`, '--format', 'json'])
      .split(/\r?\n/).filter(Boolean).map(line => JSON.stringify(JSON.parse(line))).join(',').replace(/^(.+)$/, '[$1]') || '[]'),
  }))
  write(path.join(root, 'manual-setup.json'), { root, project, image, historicalHashes, preserved,
    bootstrapOrder: ['legacy fixture', 'EXPAND', 'Exercise Memory', 'Push Foundation A', 'Workout Notifications B', 'Extension Security Gate', 'Workout Notification Actions C'],
    legacyFixtureSha256: hash(path.join(workspace, 'supabase/testing/legacy-baseline.sql')),
    createdAt: new Date().toISOString(), cleanup: false, matrix: false, contract: false, remote: false,
  })
  console.log(path.join(root, 'context.json'))
}
async function credentials(file) {
  localDocker(); assertActionsHistory()
  const context = read(file), root = fs.realpathSync(context.root)
  assert.equal(context.project, project); assert.equal(context.port, '55451')
  assert.equal(fs.readFileSync(path.join(root, '.owner'), 'utf8').trim(), project)
  assert.equal(path.relative(root, fs.realpathSync(path.dirname(file))), '')
  const db = JSON.parse(exec('docker', ['inspect', `supabase_db_${project}`]))[0]
  assert.equal(db.Config.Image, image)
  assert.equal(fs.realpathSync(db.Config.Labels['com.supabase.cli.workdir']), root)
  assert.ok(db.NetworkSettings.Ports['5432/tcp'].every(port => port.HostPort === '55452'))
  const status = read(path.join(root, 'status.json')), api = new URL(status.API_URL ?? status.api_url)
  assert.ok(api.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(api.hostname)
    && api.port === '55451' && api.pathname === '/' && !api.username && !api.password && !api.search && !api.hash)
  const anon = status.ANON_KEY ?? status.anon_key, users = []
  assert.equal(exec('docker', ['exec', `supabase_db_${project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-c', 'select count(*) from auth.users;']), '0')
  for (const letter of ['a', 'b']) {
    const email = `manual-c-${letter}-${Date.now()}@local.invalid`, password = randomBytes(24).toString('base64url') + 'A1!'
    const response = await fetch(api.origin + '/auth/v1/signup', { method: 'POST', redirect: 'error',
      headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(20000) })
    assert.equal(response.status, 200, 'Synthetic local signup failed')
    const data = await response.json(); assert.ok(data.access_token && data.user?.id && data.user.email === email)
    users.push({ id: data.user.id, email, password, jwt: data.access_token })
  }
  write(path.join(root, 'users.json'), users)
  const vapid = createECDH('prime256v1'); vapid.generateKeys()
  const edge = { PUSH_ALLOWED_ORIGINS: 'http://localhost:5173', GYMIO_WORKOUT_ACTION_ORIGINS: 'http://localhost:5173',
    VAPID_PUBLIC_KEY: vapid.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString('base64url'),
    VAPID_SUBJECT: 'mailto:local-test@gym.io' }
  fs.writeFileSync(path.join(root, 'edge.env'), Object.entries(edge).map(([name, value]) => `${name}=${value}`).join('\n') + '\n', { flag: 'wx' })
  fs.writeFileSync(path.join(root, 'frontend.env'), `VITE_SUPABASE_URL=${api.origin}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anon}\nVITE_VAPID_PUBLIC_KEY=${edge.VAPID_PUBLIC_KEY}\n`, { flag: 'wx' })
  console.log('PASS synthetic A/B users and minimal local environment prepared')
}
function extensionGate(file) {
  const c = actionsContext(file); localDocker()
  fs.mkdirSync(path.join(c.context.root, 'tests'))
  let source = fs.readFileSync(path.join(workspace, 'supabase/testing/extension-gate.mjs'), 'utf8')
  for (const [before, after] of [
    ["['gymio-extension-security-local','gymio-workout-push-local']", "['gymio-workout-actions-local']"],
    ["assert.equal(context.port, '55441')", "assert.equal(context.port, '55451')"],
    ['/^(gymio-extension-gate-|gymio-workout-push-)/', '/^gymio-workout-actions-[a-f0-9]{32}$/'],
    ["context.project === 'gymio-workout-push-local'", "context.project === 'gymio-workout-actions-local'"],
  ]) { assert.equal(source.split(before).length, 2); source = source.replace(before, after) }
  source = `import {actionsContext as strictCContext} from ${JSON.stringify(pathToFileURL(path.join(workspace, 'supabase/testing/actions-context.mjs')).href)};strictCContext(process.argv[2]);\n` + source
  fs.writeFileSync(path.join(c.context.root, 'tests/extension-gate.mjs'), source, { flag: 'wx' })
  gate(file)
}
function apply(file) {
  const c = actionsContext(file); localDocker(); sources()
  assert.equal(read(path.join(c.context.root, 'extension-result.json')).passed, true)
  assert.equal(c.sql("select to_regnamespace('gymio_workout_actions_private') is null;"), 't')
  c.sql(fs.readFileSync(path.join(workspace, 'supabase/migrations/20261011021351_workout_notification_actions.sql'), 'utf8'))
  c.sql("notify pgrst,'reload schema';")
  console.log('PASS canonical unmodified Actions C applied after Extension Security Gate')
}
function verify(file) {
  const c = actionsContext(file); localDocker(); sources()
  for (const name of ['.owner', 'context.json', 'status.json', 'users.json', 'frontend.env', 'edge.env']) assert.ok(fs.existsSync(path.join(c.context.root, name)))
  assert.equal(read(path.join(c.context.root, 'extension-result.json')).passed, true)
  const result = c.value(`begin read only; select jsonb_build_object(
    'users',(select count(*) from auth.users),'profiles',(select count(*) from public.usuarios),
    'sessions',(select count(*) from public.treino_sessoes),'series',(select count(*) from public.treino_sessao_series),
    'outbox',(select count(*) from gymio_workout_push_private.outbox),
    'capabilities',(select count(*) from gymio_workout_actions_private.capabilities),
    'job',(select case when active then 'active' else 'inactive' end from cron.job where jobname='gymio-workout-push'),
    'secrets',(select count(*) from vault.secrets),
    'extensions',(select jsonb_object_agg(extname,extversion) from pg_extension where extname in('pg_cron','pg_net','supabase_vault'))); commit;`)
  assert.equal(result.users, 2); assert.equal(result.profiles, 2)
  for (const name of ['sessions', 'series', 'outbox', 'capabilities']) assert.equal(result[name], 0)
  assert.equal(result.job, 'inactive'); assert.equal(result.secrets, 2)
  assert.deepEqual(result.extensions, { pg_cron: '1.6.4', pg_net: '0.20.0', supabase_vault: '0.3.1' })
  const setup = read(path.join(c.context.root, 'manual-setup.json'))
  for (const entry of setup.preserved) {
    const ids = exec('docker', ['ps', '-a', '--filter', `label=com.supabase.cli.project=${entry.project}`, '--format', '{{.ID}}']).split(/\r?\n/).filter(Boolean).sort()
    assert.deepEqual(ids, entry.containers.map(item => item.ID).sort(), 'Preserved A/B container inventory changed')
  }
  for (const name of ['push-test', 'workout-push', 'workout-action']) assert.equal(
    hash(path.join(c.context.root, 'supabase/functions', name, 'index.ts')),
    hash(path.join(workspace, 'supabase/functions', name, 'index.ts')), 'Production entrypoint must remain intact')
  write(path.join(c.context.root, 'manual-ready.json'), { ...result, readyAt: new Date().toISOString(), historicalHashes,
    fullMatrixRepeated: false, startedWorkout: false, cleanup: false, preserved: true })
  console.log('PASS manual C identity, baseline, fixture safety and retained runtime')
}
async function final(file) {
  const c = actionsContext(file); localDocker()
  for (const [name, method, expected] of [['push-test', 'OPTIONS', 204], ['workout-push', 'GET', 401], ['workout-action', 'GET', 405]]) {
    const response = await fetch(c.api + '/functions/v1/' + name, { method, headers: { Origin: 'http://localhost:5173' },
      signal: AbortSignal.timeout(15000), redirect: 'error' })
    await response.body?.cancel(); assert.equal(response.status, expected)
  }
  const frontend = await fetch('http://localhost:5173/push-config.json', { signal: AbortSignal.timeout(10000), redirect: 'error' })
  assert.equal(frontend.status, 200); assert.equal((await frontend.json()).supabaseUrl, c.api)
  const moduleResponse = await fetch('http://localhost:5173/src/lib/supabase.js', { signal: AbortSignal.timeout(10000), redirect: 'error' })
  assert.equal(moduleResponse.status, 200)
  const moduleText = await moduleResponse.text()
  assert.ok(moduleText.includes(c.api)); assert.ok(moduleText.includes(c.status.ANON_KEY))
  for (const name of ['serve.pid', 'frontend.pid']) process.kill(Number(fs.readFileSync(path.join(c.context.root, name), 'utf8').trim()), 0)
  const job = c.sql("begin read only; select case when active then 'active' else 'inactive' end from cron.job where jobname='gymio-workout-push'; commit;")
  assert.equal(job, 'inactive')
  assert.equal(c.sql('begin read only; select count(*) from public.treino_sessoes; commit;'), '0')
  const fixture = read(path.join(c.context.root, 'manual-workout-c.json'))
  assert.equal(fixture.workout, 'V3.2-C Test Workout'); assert.ok(fixture.exercises.every(item => item.rest === 15))
  const proofFile = path.join(c.context.root, 'manual-ready.json'), proof = read(proofFile)
  fs.writeFileSync(proofFile, JSON.stringify({ ...proof, frontendReady: true, frontendUrl: 'http://localhost:5173',
    edgeFunctionsReady: ['push-test', 'workout-push', 'workout-action'], workout: fixture.workout,
    userA: c.users[0].email, runtimeAlive: true, finalVerifiedAt: new Date().toISOString() }, null, 2) + '\n')
  console.log(`MANUAL_C_RUNTIME_READY\n\nruntime:\n${c.context.root}\n\nAPI:\n${c.api}\n\nfrontend:\nhttp://localhost:5173\n\nuser A:\n${c.users[0].email}\n\nworkout:\n${fixture.workout}\n\njob gymio-workout-push:\n${job}`)
}
const phases = { create, sources, start: startRuntime, credentials, bootstrap, gate: extensionGate, apply, secrets, serve, ready, verify, final }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [phase, file] = process.argv.slice(2)
  try {
    assert.equal(process.cwd(), workspace); assert.ok(Object.hasOwn(phases, phase))
    await phases[phase](file)
  } catch { console.error('MANUAL_C_SETUP_FAILED: phase stopped; all runtime resources preserved'); process.exitCode = 1 }
}
