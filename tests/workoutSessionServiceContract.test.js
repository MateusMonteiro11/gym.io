import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { getUserFriendlyErrorMessage } from '../src/utils/errorMessages.js'

const servicePath = new URL(
  '../src/services/treino_ativo/treinoSessaoService.js',
  import.meta.url
)
const controllerPath = new URL('../src/hooks/useTreinoAtivo.js', import.meta.url)
const memoryServicePath = new URL(
  '../src/services/memoria_exercicios/memoriaExerciciosService.js',
  import.meta.url
)

test('service de sessão consome exatamente as oito RPCs públicas', async () => {
  const source = await readFile(servicePath, 'utf8')
  const rpcNames = [...source.matchAll(/executarRpc\('([^']+)'/g)]
    .map((match) => match[1])
    .sort()

  assert.deepEqual(rpcNames, [
    'ajustar_descanso_treino_sessao',
    'avancar_exercicio_treino_sessao',
    'cancelar_treino_sessao',
    'concluir_treino_serie',
    'definir_pausa_treino_sessao',
    'encerrar_descanso_treino_sessao',
    'finalizar_treino_sessao',
    'iniciar_treino_sessao',
  ])
})

test('service V2 não faz DML direto nas tabelas de sessão', async () => {
  const source = await readFile(servicePath, 'utf8')

  assert.doesNotMatch(source, /\.from\('treino_sessoes'\)[\s\S]*?\.(insert|update|delete)\(/)
  assert.doesNotMatch(source, /\.from\('treino_sessao_series'\)[\s\S]*?\.(insert|update|delete)\(/)
})

test('controller V2 não importa o writer histórico legado', async () => {
  const source = await readFile(controllerPath, 'utf8')

  assert.doesNotMatch(source, /treinoAtivoService|salvarHistoricoTreino/)
  assert.doesNotMatch(source, /criarHistoricoTreino|adicionarHistoricoLote|atualizarHistoricoTreinoStats/)
})

test('Exercise Memory usa uma única RPC de leitura em lote', async () => {
  const source = await readFile(memoryServicePath, 'utf8')

  assert.match(source, /\.rpc\('buscar_memorias_exercicios'/)
  assert.doesNotMatch(source, /\.from\('historico_(treinos|exercicios)'\)/)
})

test('falha de rede recebe mensagem sanitizada', () => {
  assert.equal(
    getUserFriendlyErrorMessage(new TypeError('Failed to fetch')),
    'Não foi possível conectar. Verifique sua conexão e tente novamente.'
  )
})
