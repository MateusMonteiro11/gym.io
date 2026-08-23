import test from 'node:test'
import assert from 'node:assert/strict'

import {
  carregarMemoriasComFallback,
  criarMapaMemoriasHistoricas,
  normalizarIdsExercicios,
  obterUltimaSerieConfirmada,
  resolverValoresIniciaisExercicio,
} from '../src/utils/memoriaExercicioUtils.js'
import {
  criarChaveFormularioSerie,
  criarEstadoFormularioSerie,
  reduzirEstadoFormularioSerie,
} from '../src/utils/currentExerciseFormState.js'

function criarExercicio(overrides = {}) {
  return {
    id_treino_exercicio: 101,
    id_exercicio: 10,
    carga: 20,
    repeticoes: 12,
    ...overrides,
  }
}

function resolver(overrides = {}) {
  const exercicio = overrides.exercicio ?? criarExercicio()
  return resolverValoresIniciaisExercicio({
    exercicio,
    idTreinoExercicioAtual: exercicio.id_treino_exercicio,
    seriesConcluidas: [],
    memoriaHistorica: null,
    ...overrides,
  })
}

test('memória confirmada da colocação atual vence histórico e prescrição', () => {
  assert.deepEqual(
    resolver({
      seriesConcluidas: [{
        id_sessao_serie: 1,
        id_treino_exercicio: 101,
        carga_utilizada: 34,
        repeticoes_feitas: 8,
        concluida_em: '2026-08-22T12:00:00.000Z',
      }],
      memoriaHistorica: { carga: 32, repeticoes: 10 },
    }),
    { carga: 34, repeticoes: 8, origem: 'sessao' }
  )
})

test('memória histórica vence prescrição quando a sessão não possui série confirmada', () => {
  assert.deepEqual(
    resolver({ memoriaHistorica: { carga: 32, repeticoes: 8 } }),
    { carga: 32, repeticoes: 8, origem: 'historico' }
  )
})

test('prescrição é usada quando nenhuma memória elegível existe', () => {
  assert.deepEqual(
    resolver(),
    { carga: 20, repeticoes: 12, origem: 'prescricao' }
  )
})

test('carga zero é preservada como memória válida', () => {
  assert.deepEqual(
    resolver({ memoriaHistorica: { carga: 0, repeticoes: 15 } }),
    { carga: 0, repeticoes: 15, origem: 'historico' }
  )
})

test('memória da sessão é isolada por id_treino_exercicio', () => {
  const seriesConcluidas = [{
    id_sessao_serie: 1,
    id_treino_exercicio: 101,
    carga_utilizada: 50,
    repeticoes_feitas: 5,
    concluida_em: '2026-08-22T12:00:00.000Z',
  }]
  const outraColocacao = criarExercicio({ id_treino_exercicio: 202 })

  assert.deepEqual(
    resolver({
      exercicio: outraColocacao,
      idTreinoExercicioAtual: 202,
      seriesConcluidas,
      memoriaHistorica: { carga: 30, repeticoes: 10 },
    }),
    { carga: 30, repeticoes: 10, origem: 'historico' }
  )
})

test('memória histórica usa id_exercicio em diferentes treinos', () => {
  const memorias = criarMapaMemoriasHistoricas([{
    id_exercicio: 10,
    carga_utilizada: 42,
    repeticoes_feitas: 7,
    criado_em: '2026-08-22 12:00:00',
  }])
  const memoria = memorias.get(10)
  const treinoA = criarExercicio({ id_treino_exercicio: 101 })
  const treinoB = criarExercicio({ id_treino_exercicio: 999 })

  assert.equal(resolver({ exercicio: treinoA, memoriaHistorica: memoria }).carga, 42)
  assert.equal(resolver({ exercicio: treinoB, memoriaHistorica: memoria }).carga, 42)
})

test('última série usa concluida_em e desempata por id_sessao_serie', () => {
  const series = [
    {
      id_sessao_serie: 10,
      id_treino_exercicio: 101,
      concluida_em: '2026-08-22T12:01:00.000Z',
    },
    {
      id_sessao_serie: 11,
      id_treino_exercicio: 101,
      concluida_em: '2026-08-22T12:01:00.000Z',
    },
    {
      id_sessao_serie: 99,
      id_treino_exercicio: 202,
      concluida_em: '2026-08-22T12:02:00.000Z',
    },
  ]

  assert.equal(obterUltimaSerieConfirmada(series, 101), series[1])
})

test('IDs históricos são normalizados e deduplicados para uma única leitura em lote', () => {
  assert.deepEqual(normalizarIdsExercicios([10, '10', 20, null, -1, 'x']), [10, 20])
})

test('falha histórica degrada para mapa vazio sem rejeitar o fluxo', async () => {
  const erro = new Error('indisponível')
  let erroRegistrado = null
  const memorias = await carregarMemoriasComFallback(
    [10],
    async () => { throw erro },
    (recebido) => { erroRegistrado = recebido }
  )

  assert.ok(memorias instanceof Map)
  assert.equal(memorias.size, 0)
  assert.equal(erroRegistrado, erro)
})

test('valores locais não confirmados não entram no resolvedor', () => {
  assert.deepEqual(
    resolver({ seriesConcluidas: [], memoriaHistorica: null }),
    { carga: 20, repeticoes: 12, origem: 'prescricao' }
  )
})

test('Set 1 inicializa com os defaults resolvidos', () => {
  const chave = criarChaveFormularioSerie(101, 1)
  assert.deepEqual(
    criarEstadoFormularioSerie(chave, { carga: 32, repeticoes: 8 }),
    { chaveSerie: '101:1', carga: 32, repeticoes: 8, sujo: false }
  )
})

test('default histórico assíncrono atualiza formulário ainda limpo', () => {
  const estado = criarEstadoFormularioSerie('101:1', { carga: 20, repeticoes: 12 })
  const atualizado = reduzirEstadoFormularioSerie(estado, {
    type: 'sincronizar',
    chaveSerie: '101:1',
    valoresIniciais: { carga: 32, repeticoes: 8 },
  })

  assert.deepEqual(atualizado, {
    chaveSerie: '101:1', carga: 32, repeticoes: 8, sujo: false,
  })
})

test('default assíncrono e rerender não sobrescrevem edição ativa', () => {
  const inicial = criarEstadoFormularioSerie('101:1', { carga: 20, repeticoes: 12 })
  const editado = reduzirEstadoFormularioSerie(inicial, {
    type: 'editar_carga',
    valor: 25,
  })
  const aposMemoria = reduzirEstadoFormularioSerie(editado, {
    type: 'sincronizar',
    chaveSerie: '101:1',
    valoresIniciais: { carga: 32, repeticoes: 8 },
  })
  const aposRerender = reduzirEstadoFormularioSerie(aposMemoria, {
    type: 'sincronizar',
    chaveSerie: '101:1',
    valoresIniciais: { carga: 32, repeticoes: 8 },
  })

  assert.equal(aposMemoria, editado)
  assert.equal(aposRerender, editado)
  assert.equal(aposRerender.carga, 25)
})

test('Set 2 reinicializa com a série recém-confirmada', () => {
  const set1Editado = {
    ...criarEstadoFormularioSerie('101:1', { carga: 32, repeticoes: 8 }),
    carga: 34,
    sujo: true,
  }
  const set2 = reduzirEstadoFormularioSerie(set1Editado, {
    type: 'sincronizar',
    chaveSerie: '101:2',
    valoresIniciais: { carga: 34, repeticoes: 8 },
  })

  assert.deepEqual(set2, {
    chaveSerie: '101:2', carga: 34, repeticoes: 8, sujo: false,
  })
})

test('mudança de exercício cria nova identidade de formulário', () => {
  const anterior = criarEstadoFormularioSerie('101:1', { carga: 32, repeticoes: 8 })
  const proximo = reduzirEstadoFormularioSerie(anterior, {
    type: 'sincronizar',
    chaveSerie: '202:1',
    valoresIniciais: { carga: 70, repeticoes: 6 },
  })

  assert.deepEqual(proximo, {
    chaveSerie: '202:1', carga: 70, repeticoes: 6, sujo: false,
  })
})
