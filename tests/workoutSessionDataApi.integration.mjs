import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import { assertLocalSupabaseTarget } from './helpers/localSupabaseTarget.mjs'

const url = process.env.TEST_SUPABASE_URL
const anonKey = process.env.TEST_SUPABASE_ANON_KEY
const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY

assert.ok(url, 'TEST_SUPABASE_URL ausente')
assertLocalSupabaseTarget(url)
assert.ok(anonKey, 'TEST_SUPABASE_ANON_KEY ausente')
assert.ok(serviceKey, 'TEST_SUPABASE_SERVICE_KEY ausente')

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anonymousClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function expectOk(promise, label) {
  const { data, error } = await promise
  assert.ifError(error, label)
  return data
}

async function expectCode(promise, expectedCode, label) {
  const { error } = await promise
  assert.ok(error, `${label}: operação deveria falhar`)
  assert.equal(error.code, expectedCode, `${label}: SQLSTATE inesperado`)
  return error
}

async function rpc(name, args) {
  return expectOk(client.rpc(name, args), `RPC ${name}`)
}

const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
const email = `v2-${suffix}@gymio.local`
const password = `Gymio-${suffix}!`

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
assert.ifError(createError)
const userId = created.user.id

await expectOk(
  admin.from('usuarios').insert({
    id_usuario: userId,
    nome: 'Teste Data API V2',
    email,
  }),
  'seed usuário'
)

const exercises = await expectOk(
  admin
    .from('exercicios')
    .insert([
      { nome: 'Integração A' },
      { nome: 'Integração B' },
      { nome: 'Integração C' },
    ])
    .select('id_exercicio')
    .order('id_exercicio'),
  'seed exercícios'
)

const workouts = await expectOk(
  admin
    .from('treinos')
    .insert([
      { nome: 'Manual V2', id_usuario: userId, tipo_treino: 'usuario', tipo: 'usuario' },
      { nome: 'Automático V2', id_usuario: userId, tipo_treino: 'usuario', tipo: 'usuario' },
      { nome: 'Cancelamento V2', id_usuario: userId, tipo_treino: 'usuario', tipo: 'usuario' },
    ])
    .select('id_treino,nome'),
  'seed treinos'
)

const workoutByName = Object.fromEntries(
  workouts.map((workout) => [workout.nome, workout.id_treino])
)

const sections = await expectOk(
  admin
    .from('secoes_treino')
    .insert(workouts.map((workout) => ({
      id_treino: workout.id_treino,
      nome: 'Bloco principal',
      ordem: 1,
    })))
    .select('id_secao,id_treino'),
  'seed seções'
)
const sectionByWorkout = Object.fromEntries(
  sections.map((section) => [section.id_treino, section.id_secao])
)

const manualWorkoutId = workoutByName['Manual V2']
const automaticWorkoutId = workoutByName['Automático V2']
const cancelWorkoutId = workoutByName['Cancelamento V2']

await expectOk(
  admin.from('treinos_exercicios').insert([
    {
      id_treino: manualWorkoutId,
      id_secao: sectionByWorkout[manualWorkoutId],
      id_exercicio: exercises[0].id_exercicio,
      series: 2,
      repeticoes: 10,
      carga: 50,
      descanso_segundos: 120,
      ordem: '1',
    },
    {
      id_treino: manualWorkoutId,
      id_secao: sectionByWorkout[manualWorkoutId],
      id_exercicio: exercises[1].id_exercicio,
      series: 2,
      repeticoes: 8,
      carga: 60,
      descanso_segundos: 120,
      ordem: '2',
    },
    {
      id_treino: manualWorkoutId,
      id_secao: sectionByWorkout[manualWorkoutId],
      id_exercicio: exercises[2].id_exercicio,
      series: 1,
      repeticoes: 6,
      carga: 70,
      descanso_segundos: 0,
      ordem: '3',
    },
    {
      id_treino: automaticWorkoutId,
      id_secao: sectionByWorkout[automaticWorkoutId],
      id_exercicio: exercises[0].id_exercicio,
      series: 1,
      repeticoes: 12,
      carga: 40,
      descanso_segundos: 120,
      ordem: '1',
    },
    {
      id_treino: cancelWorkoutId,
      id_secao: sectionByWorkout[cancelWorkoutId],
      id_exercicio: exercises[0].id_exercicio,
      series: 2,
      repeticoes: 5,
      carga: 30,
      descanso_segundos: 120,
      ordem: '1',
    },
  ]),
  'seed itens dos treinos'
)

const today = new Date().toLocaleDateString('sv-SE')
await expectOk(
  admin.from('agendamentos').insert({
    id_usuario: userId,
    id_treino: manualWorkoutId,
    data_agendada: today,
    concluido: false,
  }),
  'seed agendamento'
)

const { error: signInError } = await client.auth.signInWithPassword({ email, password })
assert.ifError(signInError)

const initialActive = await expectOk(
  client.from('treino_sessoes').select('*').eq('status', 'ativa'),
  'leitura inicial RLS'
)
assert.equal(initialActive.length, 0)

const started = await rpc('iniciar_treino_sessao', {
  p_id_treino: manualWorkoutId,
  p_descanso_padrao_segundos: 45,
})
assert.equal(started.revisao, 0)
assert.equal(started.status, 'ativa')
assert.equal(started.fase, 'execucao')
assert.equal(started.descanso_padrao_segundos, 45)
assert.ok(started.agora_servidor)

const restored = await expectOk(
  client
    .from('treino_sessoes')
    .select('*')
    .eq('id_sessao', started.id_sessao)
    .single(),
  'recuperação por leitura RLS'
)
assert.equal(restored.revisao, 0)

await expectCode(
  client.rpc('iniciar_treino_sessao', {
    p_id_treino: automaticWorkoutId,
    p_descanso_padrao_segundos: 60,
  }),
  '23505',
  'sessão única'
)

const firstSet = await rpc('concluir_treino_serie', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: started.revisao,
  p_carga_utilizada: 52.5,
  p_repeticoes_feitas: 11,
})
assert.equal(firstSet.revisao, 1)
assert.equal(firstSet.fase, 'descanso')
assert.equal(firstSet.serie_atual, 2)
const originalRestDeadline = Date.parse(firstSet.descanso_termina_em)
const originalRestStart = Date.parse(firstSet.descanso_iniciado_em)
assert.ok(Math.abs(originalRestDeadline - originalRestStart - 45_000) < 100)

const persistedSets = await expectOk(
  client
    .from('treino_sessao_series')
    .select('carga_utilizada,repeticoes_feitas,serie')
    .eq('id_sessao', started.id_sessao),
  'série persistida'
)
assert.equal(persistedSets.length, 1)
assert.equal(Number(persistedSets[0].carga_utilizada), 52.5)
assert.equal(persistedSets[0].repeticoes_feitas, 11)

await expectCode(
  client
    .from('treino_sessoes')
    .update({ serie_atual: 99 })
    .eq('id_sessao', started.id_sessao),
  '42501',
  'DML direto bloqueado'
)

const extendedRest = await rpc('ajustar_descanso_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: firstSet.revisao,
  p_delta_segundos: 15,
})
assert.equal(extendedRest.revisao, 2)
assert.ok(Math.abs(Date.parse(extendedRest.descanso_termina_em) - originalRestDeadline - 15_000) < 100)

const paused = await rpc('definir_pausa_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: extendedRest.revisao,
  p_pausar: true,
})
assert.equal(paused.revisao, 3)
assert.ok(paused.pausada_em)
const pausedDeadline = paused.descanso_termina_em

await new Promise((resolve) => setTimeout(resolve, 1100))

const resumed = await rpc('definir_pausa_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: paused.revisao,
  p_pausar: false,
})
assert.equal(resumed.revisao, 4)
assert.equal(resumed.pausada_em, null)
assert.ok(
  Date.parse(resumed.descanso_termina_em) - Date.parse(pausedDeadline) >= 1000,
  'retomar deve deslocar o deadline pelo intervalo pausado e preservar o descanso'
)
assert.ok(resumed.segundos_pausados >= 1)

const advancedDuringRest = await rpc('avancar_exercicio_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: resumed.revisao,
})
assert.equal(advancedDuringRest.revisao, 5)
assert.equal(advancedDuringRest.indice_exercicio_atual, 1)
assert.equal(advancedDuringRest.fase, 'execucao')

const secondExerciseSet = await rpc('concluir_treino_serie', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: advancedDuringRest.revisao,
  p_carga_utilizada: 61,
  p_repeticoes_feitas: 9,
})
assert.equal(secondExerciseSet.revisao, 6)
assert.equal(secondExerciseSet.fase, 'descanso')

const shortenedRest = await rpc('ajustar_descanso_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: secondExerciseSet.revisao,
  p_delta_segundos: -15,
})
assert.equal(shortenedRest.revisao, 7)

const endedRest = await rpc('encerrar_descanso_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: shortenedRest.revisao,
  p_forcar: true,
})
assert.equal(endedRest.revisao, 8)
assert.equal(endedRest.fase, 'execucao')

const movedToLastExercise = await rpc('concluir_treino_serie', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: endedRest.revisao,
  p_carga_utilizada: 62,
  p_repeticoes_feitas: 8,
})
assert.equal(movedToLastExercise.revisao, 9)
assert.equal(movedToLastExercise.indice_exercicio_atual, 2)

await expectCode(
  client.rpc('definir_pausa_treino_sessao', {
    p_id_sessao: started.id_sessao,
    p_revisao_esperada: endedRest.revisao,
    p_pausar: true,
  }),
  '40001',
  'revision guard'
)

const reconciled = await expectOk(
  client
    .from('treino_sessoes')
    .select('*')
    .eq('id_sessao', started.id_sessao)
    .single(),
  'reconciliação após 40001'
)
assert.equal(reconciled.revisao, 9)

const manualFinal = await rpc('finalizar_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: reconciled.revisao,
})
assert.equal(manualFinal.status, 'finalizada')

// Simula resposta perdida: ignora o payload original e recupera o estado durável.
const recoveredAfterLostResponse = await expectOk(
  client
    .from('treino_sessoes')
    .select('*')
    .eq('id_sessao', started.id_sessao)
    .single(),
  'reconciliação após resposta perdida de finalização'
)
assert.equal(recoveredAfterLostResponse.status, 'finalizada')

const manualHistory = await expectOk(
  client
    .from('historico_treinos')
    .select('id_historico,id_sessao,total_series')
    .eq('id_sessao', started.id_sessao)
    .single(),
  'histórico manual'
)
const manualHistorySets = await expectOk(
  client
    .from('historico_exercicios')
    .select('id_historico_exercicio')
    .eq('id_historico', manualHistory.id_historico),
  'séries históricas manuais'
)
assert.equal(manualHistorySets.length, 3)

const manualRetry = await rpc('finalizar_treino_sessao', {
  p_id_sessao: started.id_sessao,
  p_revisao_esperada: recoveredAfterLostResponse.revisao,
})
assert.equal(manualRetry.id_sessao, manualFinal.id_sessao)
const historiesAfterRetry = await expectOk(
  client
    .from('historico_treinos')
    .select('id_historico')
    .eq('id_sessao', started.id_sessao),
  'retry idempotente'
)
assert.equal(historiesAfterRetry.length, 1)
const manualSetsAfterRetry = await expectOk(
  client
    .from('historico_exercicios')
    .select('id_historico_exercicio')
    .eq('id_historico', manualHistory.id_historico),
  'séries após retry'
)
assert.equal(manualSetsAfterRetry.length, 3)

const appointment = await expectOk(
  client
    .from('agendamentos')
    .select('id_agendamento')
    .eq('id_treino', manualWorkoutId)
    .eq('data_agendada', today)
    .eq('concluido', false)
    .single(),
  'busca de agendamento'
)
await expectOk(
  client
    .from('agendamentos')
    .update({ concluido: true })
    .eq('id_agendamento', appointment.id_agendamento),
  'agendamento concluído'
)

const autoStarted = await rpc('iniciar_treino_sessao', {
  p_id_treino: automaticWorkoutId,
  p_descanso_padrao_segundos: 90,
})
const autoFinal = await rpc('concluir_treino_serie', {
  p_id_sessao: autoStarted.id_sessao,
  p_revisao_esperada: autoStarted.revisao,
  p_carga_utilizada: 41,
  p_repeticoes_feitas: 12,
})
assert.equal(autoFinal.status, 'finalizada')
const autoHistory = await expectOk(
  client
    .from('historico_treinos')
    .select('id_historico')
    .eq('id_sessao', autoStarted.id_sessao)
    .single(),
  'histórico automático'
)
const autoHistorySets = await expectOk(
  client
    .from('historico_exercicios')
    .select('id_historico_exercicio')
    .eq('id_historico', autoHistory.id_historico),
  'série histórica automática'
)
assert.equal(autoHistorySets.length, 1)

const expiredRestStarted = await rpc('iniciar_treino_sessao', {
  p_id_treino: cancelWorkoutId,
  p_descanso_padrao_segundos: 1,
})
const expiredRest = await rpc('concluir_treino_serie', {
  p_id_sessao: expiredRestStarted.id_sessao,
  p_revisao_esperada: expiredRestStarted.revisao,
  p_carga_utilizada: 30,
  p_repeticoes_feitas: 5,
})
assert.equal(expiredRest.fase, 'descanso')
await new Promise((resolve) => setTimeout(resolve, 1100))
const automaticRestEnd = await rpc('encerrar_descanso_treino_sessao', {
  p_id_sessao: expiredRestStarted.id_sessao,
  p_revisao_esperada: expiredRest.revisao,
  p_forcar: false,
})
assert.equal(automaticRestEnd.fase, 'execucao')
assert.equal(automaticRestEnd.revisao, expiredRest.revisao + 1)
await rpc('cancelar_treino_sessao', {
  p_id_sessao: expiredRestStarted.id_sessao,
  p_revisao_esperada: automaticRestEnd.revisao,
})

const invalidStarted = await rpc('iniciar_treino_sessao', {
  p_id_treino: cancelWorkoutId,
  p_descanso_padrao_segundos: 60,
})
const invalidHistory = await expectOk(
  admin
    .from('historico_treinos')
    .insert({
      id_usuario: userId,
      id_treino: cancelWorkoutId,
      id_sessao: invalidStarted.id_sessao,
      total_exercicios: 999,
      total_series: 999,
      duracao_segundos: 0,
    })
    .select('id_historico')
    .single(),
  'histórico adversarial'
)
await expectCode(
  client.rpc('finalizar_treino_sessao', {
    p_id_sessao: invalidStarted.id_sessao,
    p_revisao_esperada: invalidStarted.revisao,
  }),
  '55000',
  'materialização inconsistente'
)
const stillActive = await expectOk(
  client
    .from('treino_sessoes')
    .select('status,revisao')
    .eq('id_sessao', invalidStarted.id_sessao)
    .single(),
  'estado após 55000'
)
assert.equal(stillActive.status, 'ativa')

await expectOk(
  admin.from('historico_treinos').delete().eq('id_historico', invalidHistory.id_historico),
  'limpeza adversarial'
)
await rpc('cancelar_treino_sessao', {
  p_id_sessao: invalidStarted.id_sessao,
  p_revisao_esperada: stillActive.revisao,
})

await expectCode(
  client.rpc('definir_pausa_treino_sessao', {
    p_id_sessao: randomUUID(),
    p_revisao_esperada: 0,
    p_pausar: true,
  }),
  'P0002',
  'sessão inexistente'
)

const restartAfterCancel = await rpc('iniciar_treino_sessao', {
  p_id_treino: cancelWorkoutId,
  p_descanso_padrao_segundos: 30,
})
await rpc('cancelar_treino_sessao', {
  p_id_sessao: restartAfterCancel.id_sessao,
  p_revisao_esperada: restartAfterCancel.revisao,
})
const activeAfterCancel = await expectOk(
  client.from('treino_sessoes').select('*').eq('status', 'ativa'),
  'estado após cancelamento'
)
assert.equal(activeAfterCancel.length, 0)

const cancelledHistories = await expectOk(
  client
    .from('historico_treinos')
    .select('id_historico')
    .eq('id_treino', cancelWorkoutId),
  'cancelamento não materializa histórico'
)
assert.equal(cancelledHistories.length, 0)

const legacyHistory = await expectOk(
  admin
    .from('historico_treinos')
    .insert({
      id_usuario: userId,
      id_treino: manualWorkoutId,
      id_sessao: null,
      data_execucao: '2099-01-01T00:00:00.000Z',
      duracao_segundos: 1,
      total_exercicios: 1,
      total_series: 1,
    })
    .select('id_historico')
    .single(),
  'histórico V1 legado'
)
await expectOk(
  admin.from('historico_exercicios').insert({
    id_historico: legacyHistory.id_historico,
    id_exercicio: exercises[2].id_exercicio,
    id_treino_exercicio: null,
    serie: 1,
    carga_utilizada: 999,
    repeticoes_feitas: 99,
    concluido: true,
    criado_em: '2099-01-01T00:00:00.000Z',
  }),
  'série V1 legada'
)

const manualExerciseBSets = await expectOk(
  admin
    .from('historico_exercicios')
    .select('id_historico_exercicio')
    .eq('id_historico', manualHistory.id_historico)
    .eq('id_exercicio', exercises[1].id_exercicio)
    .order('id_historico_exercicio'),
  'séries para desempate determinístico'
)
assert.equal(manualExerciseBSets.length, 2)
await expectOk(
  admin
    .from('historico_exercicios')
    .update({ criado_em: '2026-08-22T12:30:00.000Z' })
    .in(
      'id_historico_exercicio',
      manualExerciseBSets.map((item) => item.id_historico_exercicio)
    ),
  'timestamp empatado para desempate'
)

const memoriesA = await expectOk(
  client.rpc('buscar_memorias_exercicios', {
    p_ids_exercicios: [
      exercises[0].id_exercicio,
      exercises[0].id_exercicio,
      exercises[1].id_exercicio,
      exercises[2].id_exercicio,
      999999999,
    ],
  }),
  'memórias em lote do usuário A'
)
assert.equal(memoriesA.length, 2)
assert.equal(new Set(memoriesA.map((item) => item.id_exercicio)).size, 2)
const memoryAByExercise = Object.fromEntries(
  memoriesA.map((item) => [item.id_exercicio, item])
)
assert.equal(Number(memoryAByExercise[exercises[0].id_exercicio].carga_utilizada), 41)
assert.equal(memoryAByExercise[exercises[0].id_exercicio].repeticoes_feitas, 12)
assert.equal(Number(memoryAByExercise[exercises[1].id_exercicio].carga_utilizada), 62)
assert.equal(memoryAByExercise[exercises[1].id_exercicio].repeticoes_feitas, 8)
assert.equal(memoryAByExercise[exercises[2].id_exercicio], undefined)

const emptyMemories = await expectOk(
  client.rpc('buscar_memorias_exercicios', { p_ids_exercicios: [] }),
  'entrada vazia de memórias'
)
assert.deepEqual(emptyMemories, [])

const nullMemories = await expectOk(
  client.rpc('buscar_memorias_exercicios', { p_ids_exercicios: null }),
  'entrada nula de memórias'
)
assert.deepEqual(nullMemories, [])

const { error: anonymousMemoryError } = await anonymousClient.rpc(
  'buscar_memorias_exercicios',
  { p_ids_exercicios: [exercises[0].id_exercicio] }
)
assert.ok(anonymousMemoryError, 'anon não deve executar a RPC de memória')

const emailB = `v3-memory-${suffix}@gymio.local`
const { data: createdB, error: createErrorB } = await admin.auth.admin.createUser({
  email: emailB,
  password,
  email_confirm: true,
})
assert.ifError(createErrorB)
const userIdB = createdB.user.id
await expectOk(
  admin.from('usuarios').insert({
    id_usuario: userIdB,
    nome: 'Teste Exercise Memory B',
    email: emailB,
  }),
  'seed usuário B'
)
const workoutB = await expectOk(
  admin
    .from('treinos')
    .insert({
      nome: 'Memória B',
      id_usuario: userIdB,
      tipo_treino: 'usuario',
      tipo: 'usuario',
    })
    .select('id_treino')
    .single(),
  'seed treino B'
)
const sectionB = await expectOk(
  admin
    .from('secoes_treino')
    .insert({ id_treino: workoutB.id_treino, nome: 'Bloco B', ordem: 1 })
    .select('id_secao')
    .single(),
  'seed seção B'
)
await expectOk(
  admin.from('treinos_exercicios').insert({
    id_treino: workoutB.id_treino,
    id_secao: sectionB.id_secao,
    id_exercicio: exercises[0].id_exercicio,
    series: 1,
    repeticoes: 3,
    carga: 70,
    descanso_segundos: 0,
    ordem: '1',
  }),
  'seed item B'
)
const clientB = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { error: signInErrorB } = await clientB.auth.signInWithPassword({
  email: emailB,
  password,
})
assert.ifError(signInErrorB)
const startedB = await expectOk(
  clientB.rpc('iniciar_treino_sessao', {
    p_id_treino: workoutB.id_treino,
    p_descanso_padrao_segundos: 0,
  }),
  'início da sessão B'
)
const activeMemoriesB = await expectOk(
  clientB.rpc('buscar_memorias_exercicios', {
    p_ids_exercicios: [exercises[0].id_exercicio],
  }),
  'sessão ativa não gera memória histórica'
)
assert.deepEqual(activeMemoriesB, [])
await expectOk(
  clientB.rpc('concluir_treino_serie', {
    p_id_sessao: startedB.id_sessao,
    p_revisao_esperada: startedB.revisao,
    p_carga_utilizada: 77,
    p_repeticoes_feitas: 3,
  }),
  'finalização automática B'
)
const memoriesB = await expectOk(
  clientB.rpc('buscar_memorias_exercicios', {
    p_ids_exercicios: [exercises[0].id_exercicio],
  }),
  'usuário B lê a própria memória'
)
assert.equal(memoriesB.length, 1)
assert.equal(Number(memoriesB[0].carga_utilizada), 77)

const memoriesAAfterB = await expectOk(
  client.rpc('buscar_memorias_exercicios', {
    p_ids_exercicios: [exercises[0].id_exercicio],
  }),
  'usuário A não lê a memória do usuário B'
)
assert.equal(memoriesAAfterB.length, 1)
assert.equal(Number(memoriesAAfterB[0].carga_utilizada), 41)

console.log('WORKOUT_SESSION_DATA_API_OK')
