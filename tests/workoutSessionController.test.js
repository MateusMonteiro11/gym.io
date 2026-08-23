import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import SessionFeedback from '../src/components/SessionFeedback.js'
import { calcularDescanso } from '../src/hooks/useDescansoTimer.js'
import {
  classificarReconciliacaoMutacao,
  criarChaveDescansoExpirado,
  criarChaveRecuperacaoSessao,
  deveAceitarSessaoRecebida,
  estaCarregandoRecuperacao,
  ordemSecaoParaApresentacao,
  reservarEncerramentoDescanso,
} from '../src/hooks/treinoSessaoControllerUtils.js'
import { flattenTreino } from '../src/utils/treinoUtils.js'
import { assertLocalSupabaseTarget } from './helpers/localSupabaseTarget.mjs'

function criarSessaoDescanso(overrides = {}) {
  return {
    id_sessao: '11111111-1111-4111-8111-111111111111',
    revisao: 4,
    status: 'ativa',
    fase: 'descanso',
    pausada_em: null,
    descanso_iniciado_em: '2026-08-21T12:00:00.000Z',
    descanso_termina_em: '2026-08-21T12:01:00.000Z',
    ...overrides,
  }
}

test('treino inexistente não mantém recuperação em loading', () => {
  const semTreino = criarChaveRecuperacaoSessao('usuario-1', null)

  assert.equal(semTreino, null)
  assert.equal(estaCarregandoRecuperacao(semTreino, null), false)

  const comTreino = criarChaveRecuperacaoSessao('usuario-1', 42)
  assert.equal(estaCarregandoRecuperacao(comTreino, null), true)
  assert.equal(estaCarregandoRecuperacao(comTreino, comTreino), false)
})

test('descanso expirado reserva exatamente uma transição normal', () => {
  const sessao = criarSessaoDescanso()
  const chave = criarChaveDescansoExpirado({ sessao, restante: 0 })
  const primeira = reservarEncerramentoDescanso(null, chave)
  const repetida = reservarEncerramentoDescanso(primeira.chaveReservada, chave)
  let chamadasRpc = 0

  if (primeira.deveExecutar) chamadasRpc += 1
  if (repetida.deveExecutar) chamadasRpc += 1

  assert.equal(primeira.deveExecutar, true)
  assert.equal(repetida.deveExecutar, false)
  assert.equal(chamadasRpc, 1)
})

test('retorno após background detecta deadline expirado imediatamente', () => {
  const sessao = criarSessaoDescanso()
  const descanso = calcularDescanso(
    sessao,
    Date.parse('2026-08-21T12:02:00.000Z')
  )
  const chave = criarChaveDescansoExpirado({ sessao, restante: descanso.restante })

  assert.equal(descanso.restante, 0)
  assert.ok(chave)
  assert.equal(reservarEncerramentoDescanso(null, chave).deveExecutar, true)
})

test('resposta revision N não sobrescreve N+1 da mesma sessão', () => {
  const atual = { id_sessao: 'sessao-1', revisao: 6 }

  assert.equal(
    deveAceitarSessaoRecebida(atual, { id_sessao: 'sessao-1', revisao: 5 }),
    false
  )
  assert.equal(
    deveAceitarSessaoRecebida(atual, { id_sessao: 'sessao-1', revisao: 7 }),
    true
  )
  assert.equal(
    deveAceitarSessaoRecebida(atual, { id_sessao: 'sessao-2', revisao: 0 }),
    true
  )
})

test('feedback de sessão fica acima dos overlays de modal', () => {
  const html = renderToStaticMarkup(
    createElement(SessionFeedback, { erro: 'Falha durante o descanso' })
  )

  assert.match(html, /role="alert"/)
  assert.match(html, /z-\[70\]/)
  assert.match(html, /Falha durante o descanso/)
})

test('reconciliação reconhece finalização confirmada após resposta perdida', () => {
  assert.equal(
    classificarReconciliacaoMutacao(
      { id_sessao: 'sessao-1', revisao: 9, status: 'ativa' },
      { id_sessao: 'sessao-1', revisao: 10, status: 'finalizada' }
    ),
    'finalizada'
  )
})

test('revisão avançada isoladamente não comprova qual mutação foi confirmada', () => {
  assert.equal(
    classificarReconciliacaoMutacao(
      { id_sessao: 'sessao-1', revisao: 9, status: 'ativa' },
      { id_sessao: 'sessao-1', revisao: 10, status: 'ativa' }
    ),
    'revisao_avancou'
  )
})

test('teste Data API falha fechado para destinos remotos', () => {
  assert.throws(
    () => assertLocalSupabaseTarget('https://projeto.supabase.co'),
    /Teste Data API bloqueado/
  )
  assert.doesNotThrow(() => assertLocalSupabaseTarget('http://127.0.0.1:55321'))
})

test('ordem de seção 1-based permanece 1-based na apresentação', () => {
  const [exercicio] = flattenTreino({
    secoes_treino: [{
      id_secao: 10,
      nome: 'Bloco 1',
      ordem: 1,
      treinos_exercicios: [{
        id_treino_exercicio: 20,
        id_exercicio: 30,
        series: 1,
        ordem: 1,
        exercicios: { nome: 'Exercício' },
      }],
    }],
  })

  assert.equal(exercicio.ordemSecao, 1)
  assert.equal(ordemSecaoParaApresentacao(exercicio), 1)
})
