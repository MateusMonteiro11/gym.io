// Explicit local D matrix. Importing starts nothing. No remote target accepted.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { actionsContext, assertActionsHistory } from './delivery-context.mjs'
import { actionsFixture } from './actions-fixture.mjs'
import { assertExecutorBaseline, prepareZeroMembershipFixture, applyZeroBaselineMigration, applyWithTimeoutProbe, negativeExecutorBaselines } from './delivery-baseline-tests.mjs'

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const base = path.join(workspace, 'supabase/testing')
const migration = '20261014215648_push_delivery_capabilities.sql'
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const scrub = (text) => String(text).replace(/\beyJ[A-Za-z0-9_.-]+\b|sb_(?:secret|publishable)_[A-Za-z0-9_-]+|\b[A-Za-z0-9_-]{43,}\b/g, '[REDACTED]')
const check = (result, label) => { if (result.error || result.status !== 0) throw Error(label); return result.stdout }
const run = (script, file) => {
  const result = spawnSync(process.execPath, [script, file], { cwd: workspace, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
  fs.writeFileSync(path.join(path.dirname(file), path.basename(script) + '.log'), scrub(result.stdout + '\n' + result.stderr))
  check(result, `D matrix failed: ${path.basename(script)}`)
}
function exactly(source, before, after) {
  assert.equal(source.split(before).length, 2, `adapter anchor: ${before}`)
  return source.replace(before, after)
}

export function prepareSetup(folder) {
  assertActionsHistory()
  let source = fs.readFileSync(path.join(base, 'actions-reexecution-setup.mjs'), 'utf8')
  source = exactly(source, "from './actions-context.mjs'", `from ${JSON.stringify(pathToFileURL(path.join(base, 'delivery-context.mjs')).href)}`)
  source = exactly(source, "const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')", `const workspace=${JSON.stringify(workspace)}`)
  source = source.replaceAll('gymio-workout-actions', 'gymio-push-delivery').replaceAll('55450', '55460').replaceAll('55451', '55461').replaceAll('55452', '55462')
  source = source.replaceAll("supabase/testing/actions-context.mjs", "supabase/testing/delivery-context.mjs")
  source = exactly(source, "const env={...process.env,...paths,SUPABASE_HOME:home", "const env={...process.env,...paths,USERPROFILE:home,SUPABASE_HOME:home")
  const target = path.join(folder, 'delivery-setup.generated.mjs')
  fs.writeFileSync(target, source, { flag: 'wx' })
  fs.writeFileSync(path.join(folder, 'setup-adapter.json'), JSON.stringify({
    original: digest(fs.readFileSync(path.join(base, 'actions-reexecution-setup.mjs'))), generated: digest(source),
    changes: ['D project and ports', 'guarded D context', 'absolute workspace', 'isolated CLI USERPROFILE'],
  }, null, 2))
  return target
}

function regressionAdapters(c) {
  const folder = path.join(c.context.root, 'tests'), records = []
  for (const name of ['actions-local-tests.mjs', 'actions-fixture.mjs', 'actions-third-matrix-db-lint.mjs']) {
    let source = fs.readFileSync(path.join(base, name), 'utf8')
    if (name === 'actions-third-matrix-db-lint.mjs') source = exactly(source, 'const env={...process.env,APPDATA:', 'const env={...process.env,USERPROFILE:home,APPDATA:')
    fs.writeFileSync(path.join(folder, name), source, { flag: 'wx' })
  }
  fs.writeFileSync(path.join(folder, 'actions-context.mjs'), `export * from ${JSON.stringify(pathToFileURL(path.join(base, 'delivery-context.mjs')).href)};\n`, { flag: 'wx' })
  // B historical positives require explicitly enhanced synthetic subscriptions.
  // Only fixture setup is adapted; every historical assertion remains intact.
  const target = path.join(folder, 'workout-local-tests.mjs')
  let source = fs.readFileSync(target, 'utf8'), before = source
  source = exactly(source, 'id_usuario,endpoint,p256dh,auth)values(', 'id_usuario,workout_notification_mode,endpoint,p256dh,auth)values(')
  source = exactly(source, 'values(${q(user.id)},${q(', "values(${q(user.id)},'enhanced',${q(")
  fs.writeFileSync(target, source)
  records.push({ name: 'workout-local-tests.mjs', original: digest(before), adapted: digest(source), setupOnly: true })
  // C's sender case uses B capture; direct C capabilities remain mode-independent.
  const fixture = path.join(folder, 'actions-fixture.mjs'), original = fs.readFileSync(fixture, 'utf8')
  source = exactly(original, 'id_usuario,endpoint,p256dh,auth)values(', 'id_usuario,workout_notification_mode,endpoint,p256dh,auth)values(')
  source = exactly(source, 'values(${q(user.id)},${q(', "values(${q(user.id)},'enhanced',${q(")
  fs.writeFileSync(fixture, source)
  records.push({ name: 'actions-fixture.mjs', original: digest(original), adapted: digest(source), setupOnly: true })
  fs.writeFileSync(path.join(c.context.root, 'd-regression-adapters.json'), JSON.stringify(records, null, 2), { flag: 'wx' })
}

function closeRuntime(file, evidence) {
  const context = JSON.parse(fs.readFileSync(file, 'utf8')), root = fs.realpathSync(context.root)
  const relative = path.relative(fs.realpathSync(os.tmpdir()), root), project = 'gymio-push-delivery-local'
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative))
  assert.match(path.basename(root), /^gymio-push-delivery-[a-f0-9]{32}$/)
  assert.equal(context.project, project); assert.equal(context.port, '55461')
  assert.equal(fs.readFileSync(path.join(root, '.owner'), 'utf8').trim(), project)
  const docker = (args) => check(spawnSync('docker', args, { encoding: 'utf8', windowsHide: true }), 'D cleanup Docker failed').trim()
  const ids = docker(['ps', '-a', '--filter', 'label=com.supabase.cli.project=' + project, '--format', '{{.ID}}']).split('\n').filter(Boolean)
  for (const id of ids) {
    const object = JSON.parse(docker(['inspect', id]))[0]
    assert.equal(object.Config.Labels['com.supabase.cli.project'], project)
    assert.equal(fs.realpathSync(object.Config.Labels['com.supabase.cli.workdir']), root)
  }
  // Preserve only sanitized test/catalog evidence. Credentials and env files
  // never leave the disposable runtime and are removed with that exact root.
  for (const name of fs.readdirSync(root)) {
    if (/^(?:d-.*\.json|context\.json|created-resources\.json|adapter-manifest\.json|extension-result\.json|workout-sql-result\.json|actions-performance-result\.json|actions-third-db-lint-.*\.json)$/.test(name)) {
      fs.copyFileSync(path.join(root, name), path.join(evidence, name))
    }
    if (name.endsWith('.log')) fs.writeFileSync(path.join(evidence, name), scrub(fs.readFileSync(path.join(root, name), 'utf8')))
  }
  const executable = path.join(process.env.APPDATA, 'npm/node_modules/supabase/dist/supabase.js')
  assert.ok(fs.existsSync(executable), 'installed CLI only')
  const home = path.join(root, 'cli-home'), env = { ...process.env, USERPROFILE: home, APPDATA: path.join(home, 'roaming'),
    LOCALAPPDATA: path.join(home, 'local'), XDG_CONFIG_HOME: path.join(home, 'config'), XDG_CACHE_HOME: path.join(home, 'cache'),
    SUPABASE_HOME: home, DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1' }
  delete env.SUPABASE_ACCESS_TOKEN
  const cli = (args) => spawnSync(process.execPath, [executable, ...args, '--workdir', root], {
    cwd: root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024,
  })
  assert.ok(check(cli(['stop', '--help']), 'local stop help failed').includes('--no-backup'))
  const stopped = cli(['stop', '--no-backup'])
  fs.writeFileSync(path.join(evidence, 'd-cleanup.log'), scrub(stopped.stdout + '\n' + stopped.stderr))
  check(stopped, 'D cleanup stop failed')
  assert.equal(docker(['ps', '-a', '--filter', 'label=com.supabase.cli.project=' + project, '--format', '{{.ID}}']), '')
  assert.equal(docker(['volume', 'ls', '--filter', 'label=com.supabase.cli.project=' + project, '--format', '{{.Name}}']), '')
  assert.equal(docker(['network', 'ls', '--filter', 'label=com.supabase.cli.project=' + project, '--format', '{{.Name}}']), '')
  // Absolute root, TEMP boundary, exact prefix, owner and project were checked
  // above; no parent path or preserved manual project can reach this deletion.
  assert.equal(fs.realpathSync(root), root)
  fs.rmSync(root, { recursive: true, force: false })
  fs.writeFileSync(path.join(evidence, 'd-cleanup-result.json'), JSON.stringify({ passed: true, project,
    runtimeRemoved: true, containers: 0, volumes: 0, networks: 0, originalRuntime: root }, null, 2))
}

export async function main(args) {
  assert.equal(process.cwd(), workspace)
  assertActionsHistory()
  if (args[0] === '--prepare-only') {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gymio-delivery-prepared-'))
    prepareSetup(folder)
    console.log(`D_MATRIX_PREPARED ${folder}; no services or SQL started`)
    return
  }
  assert.deepEqual(args, ['--run-isolated'], 'explicit isolated matrix flag required')
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'gymio-delivery-result-'))
  let file = null, passed = false, cleanupPassed = false, zeroCleanupPassed = false, failure = null
  console.log('D_EVIDENCE ' + evidence)
  try {
  assert.ok(!process.env.DOCKER_HOST || process.env.DOCKER_HOST.startsWith('npipe:////./pipe/'), 'remote Docker host refused')
  const context = JSON.parse(check(spawnSync('docker', ['context', 'inspect'], { encoding: 'utf8', windowsHide: true }), 'Docker context unavailable'))[0]
  assert.ok(context.Endpoints.docker.Host.startsWith('npipe:////./pipe/'), 'only the local Windows Docker engine is accepted')
  const server = check(spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', windowsHide: true }), 'Docker unavailable: D matrix not executed').trim()
  assert.match(server, /^\d+\.\d+\.\d+/, 'Docker engine unavailable: no server version; no D resources created')
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'gymio-delivery-prepared-'))
  const setupURL = pathToFileURL(prepareSetup(staging)).href
  const setup = await import(setupURL)
  const credentials = (contextFile) => {
    // Separate HTTP pools for sequential fresh stacks on the same local port.
    // No retry of signup: each historical credentials setup runs exactly once.
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      'const {credentials}=await import(process.argv[1]);await credentials(process.argv[2]);', setupURL, contextFile],
    { cwd: workspace, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
    fs.writeFileSync(path.join(path.dirname(contextFile), 'd-credentials.log'), scrub(result.stdout + '\n' + result.stderr))
    check(result, 'isolated D credentials setup failed')
    console.log(scrub(result.stdout.trim()))
  }
  // Independent positive zero baseline. Its explicit fixture is never run on
  // the normal baseline; both applications use the complete original D file.
  let zeroFile = null
  const zeroEvidence = path.join(evidence, 'zero-baseline')
  fs.mkdirSync(zeroEvidence)
  try {
    zeroFile = await setup.createRuntime()
    setup.startRuntime(zeroFile)
    credentials(zeroFile); setup.bootstrap(zeroFile)
    setup.adapters(zeroFile); setup.gate(zeroFile)
    const zero = actionsContext(zeroFile)
    zero.sql(fs.readFileSync(path.join(workspace, 'supabase/migrations/20261011021351_workout_notification_actions.sql'), 'utf8'))
    const original = prepareZeroMembershipFixture(zero)
    const before = assertExecutorBaseline(zero, 0)
    applyZeroBaselineMigration(zero, fs.readFileSync(path.join(workspace, 'supabase/migrations', migration), 'utf8'))
    const after = assertExecutorBaseline(zero, 0)
    assert.deepEqual(after, before)
    fs.writeFileSync(path.join(zero.context.root, 'd-zero-baseline-result.json'), JSON.stringify({ passed: true,
      syntheticFixture: 'extra runtime only; original historical bootstrap; zero baseline constructed explicitly before D',
      migrationAdministrator: 'supabase_admin; postgres role attributes unchanged', original, before, after }, null, 2))
    console.log('PASS D complete migration: independent zero-membership baseline preserved')
  } finally {
    if (zeroFile) closeRuntime(zeroFile, zeroEvidence)
    zeroCleanupPassed = true
  }
  file = await setup.createRuntime()
  console.log(`D_RUNTIME ${file}`)
  setup.startRuntime(file); credentials(file); setup.bootstrap(file)
  setup.adapters(file); setup.gate(file)
  const c = actionsContext(file)
  c.sql(fs.readFileSync(path.join(workspace, 'supabase/migrations/20261011021351_workout_notification_actions.sql'), 'utf8'))
  const executorBefore = assertExecutorBaseline(c, 1)
  negativeExecutorBaselines(c, fs.readFileSync(path.join(workspace, 'supabase/migrations', migration), 'utf8'))
  // Pre-D rows prove fail-closed defaults and retirement, including a claim and
  // an already-attempted row that D must preserve exactly.
  const legacy = actionsFixture(c)
  const old = [legacy.subscribe(), legacy.subscribe(), legacy.subscribe()]
  legacy.start(1); await new Promise((resolve) => setTimeout(resolve, 1100))
  c.value('select gymio_workout_push_private.capture_events();')
  const claimed = c.value('select public.workout_push_claim(2);')
  assert.equal(claimed.length, 2)
  assert.ok(c.value(`select public.workout_push_begin(${c.literal(claimed[0].id)},${c.literal(claimed[0].claim_token)});`))
  const attempted = c.sql(`select to_jsonb(d) from gymio_workout_push_private.deliveries d where id=${c.literal(claimed[0].id)};`)
  assertActionsHistory()
  applyWithTimeoutProbe(c, fs.readFileSync(path.join(workspace, 'supabase/migrations', migration), 'utf8'))
  const executorAfter = assertExecutorBaseline(c, 1)
  assert.deepEqual(executorAfter, executorBefore)
  fs.writeFileSync(path.join(c.context.root, 'd-local-baseline-result.json'), JSON.stringify({ passed: true,
    before: executorBefore, after: executorAfter }, null, 2))
  console.log('PASS D complete migration: original postgres inbound membership preserved exactly')
  assert.equal(c.sql(`select count(*) from public.push_subscriptions where id in(${old.map(c.literal).join(',')}) and workout_notification_mode='minimal';`), '3')
  assert.equal(c.sql("select count(*)from gymio_workout_push_private.deliveries where state='stale' and attempted_at is null;"), '2')
  assert.equal(c.sql(`select to_jsonb(d) from gymio_workout_push_private.deliveries d where id=${c.literal(claimed[0].id)};`), attempted)
  legacy.clean()
  c.sql("notify pgrst,'reload schema';")
  regressionAdapters(c)
  run(path.join(base, 'delivery-local-tests.mjs'), file)
  run(path.join(base, 'delivery-data-api.mjs'), file)
  for (const name of ['workout-local-tests.mjs', 'actions-local-tests.mjs']) run(path.join(c.context.root, 'tests', name), file)
  const lint = spawnSync(process.execPath, [path.join(c.context.root, 'tests/actions-third-matrix-db-lint.mjs'), file, 'after'], { cwd: workspace, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
  fs.writeFileSync(path.join(c.context.root, 'd-lint.log'), scrub(lint.stdout + '\n' + lint.stderr))
  check(lint, 'local db lint failed')
  assertActionsHistory()
  passed = true
  } catch (error) {
    failure = scrub(error.message); throw error
  } finally {
    try { if (file) closeRuntime(file, evidence); cleanupPassed = zeroCleanupPassed }
    finally {
      fs.writeFileSync(path.join(evidence, 'd-matrix-result.json'), JSON.stringify({ passed: passed && cleanupPassed,
        matrixPassed: passed, cleanupPassed, zeroCleanupPassed, contextCreated: Boolean(file), contextFile: file, failure,
        migrationSha256: digest(fs.readFileSync(path.join(workspace, 'supabase/migrations', migration))),
        remoteOperations: 0, providerRequests: 0 }, null, 2))
    }
  }
  console.log('D_MATRIX_PASSED; D runtime cleaned; no remote rollout authorized')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)) } catch (error) { console.error(scrub(error.message)); process.exitCode = 1 }
}
