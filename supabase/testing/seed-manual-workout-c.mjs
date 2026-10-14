// C-only local manual fixture. No session RPC, notification, cron activation or cleanup.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { actionsContext } from './actions-context.mjs'
import { fixtureSql } from './seed-manual-workout.mjs'

export async function run(input) {
  assert.ok(input && !/^[a-z]+:\/\//i.test(input), 'Local runtime path required')
  const supplied = fs.realpathSync(path.resolve(input))
  const file = fs.statSync(supplied).isDirectory() ? path.join(supplied, 'context.json') : supplied
  assert.equal(path.basename(file), 'context.json')
  const c = actionsContext(file)
  assert.equal(path.relative(c.context.root, fs.realpathSync(path.dirname(file))), '')
  const options = { encoding: 'utf8', windowsHide: true, stdio: 'pipe' }
  const current = execFileSync('docker', ['context', 'show'], options).trim()
  const host = process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT ? process.env.DOCKER_HOST
    : execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', current], options).trim()
  assert.ok(/^npipe:\/+\.\/pipe\//.test(host) || /^unix:\/\/\/[^\r\n]+$/.test(host), 'Remote Docker refused')
  const user = c.users[0]
  const response = await fetch(c.api + '/auth/v1/token?grant_type=password', {
    method: 'POST', redirect: 'error', headers: { apikey: c.status.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }), signal: AbortSignal.timeout(20000),
  })
  assert.equal(response.status, 200, 'Local user A authentication failed')
  const auth = await response.json(); assert.equal(auth.user.id, user.id); assert.ok(auth.access_token)
  // The old helper is imported only as a pure SQL generator; its B loader/runner
  // never runs. Fixed C identity and name replace the B constants in that SQL.
  const sql = fixtureSql(user, false).replaceAll('gymio-workout-push-local', 'gymio-workout-actions-local')
    .replaceAll('V3.2-B', 'V3.2-C')
  const output = c.sql(sql)
  const fixture = JSON.parse(output.split(/\r?\n/).findLast(line => line.startsWith('{')))
  assert.equal(fixture.workout, 'V3.2-C Test Workout')
  assert.equal(fixture.exercises.length, 2)
  assert.ok(fixture.exercises.every(item => item.series === 2 && item.rest === 15))
  const resource = `/rest/v1/treinos?id_treino=eq.${fixture.id_treino}&select=id_treino,id_usuario,nome,publico,tipo,tipo_treino,secoes_treino(id_secao,nome,treinos_exercicios(id_treino_exercicio,series,repeticoes,carga,descanso_segundos,exercicios(id_exercicio,nome)))`
  const visible = await c.request(resource, auth.access_token, undefined, { method: 'GET' })
  assert.equal(visible.status, 200); assert.equal(visible.data.length, 1)
  const workout = visible.data[0]
  assert.equal(workout.id_usuario, user.id); assert.equal(workout.nome, fixture.workout)
  assert.equal(workout.publico, false); assert.equal(workout.tipo, 'usuario'); assert.equal(workout.tipo_treino, 'usuario')
  assert.equal(workout.secoes_treino.length, 1)
  assert.equal(workout.secoes_treino[0].treinos_exercicios.length, 2)
  assert.ok(workout.secoes_treino[0].treinos_exercicios.every(item => item.descanso_segundos === 15 && item.series === 2))
  const other = await c.request(resource, c.users[1].jwt, undefined, { method: 'GET' })
  assert.equal(other.status, 200); assert.deepEqual(other.data, [])
  assert.equal(c.sql('begin read only; select count(*) from public.treino_sessoes; commit;'), '0')
  fs.writeFileSync(path.join(c.context.root, 'manual-workout-c.json'), JSON.stringify(fixture, null, 2) + '\n')
  console.log('MANUAL_C_WORKOUT_FIXTURE_READY')
  return fixture
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { assert.equal(process.argv.length, 3); await run(process.argv[2]) }
  catch { console.error('MANUAL_C_WORKOUT_FIXTURE_FAILED: runtime preserved'); process.exitCode = 1 }
}
