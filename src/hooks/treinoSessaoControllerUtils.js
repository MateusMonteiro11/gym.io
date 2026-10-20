export function criarChaveRecuperacaoSessao(idUsuario, idTreino) {
  if (!idUsuario || !idTreino) return null
  return `${idUsuario}:${Number(idTreino)}`
}

export function estaCarregandoRecuperacao(chaveAtual, chaveRecuperada) {
  return Boolean(chaveAtual && chaveAtual !== chaveRecuperada)
}

export function deveAceitarSessaoRecebida(sessaoAtual, sessaoRecebida) {
  if (!sessaoAtual || !sessaoRecebida) return true
  if (sessaoAtual.id_sessao !== sessaoRecebida.id_sessao) return true

  return Number(sessaoRecebida.revisao ?? -1) >= Number(sessaoAtual.revisao ?? -1)
}

export function criarChaveDescansoExpirado({
  sessao,
  restante,
  bloqueado = false,
}) {
  if (
    bloqueado ||
    sessao?.status !== 'ativa' ||
    sessao?.fase !== 'descanso' ||
    sessao?.pausada_em ||
    !sessao?.descanso_termina_em ||
    Number(restante) > 0
  ) {
    return null
  }

  return [
    sessao.id_sessao,
    Number(sessao.revisao),
    sessao.descanso_termina_em,
  ].join(':')
}

export function reservarEncerramentoDescanso(chaveAnterior, chaveCandidata) {
  if (!chaveCandidata || chaveAnterior === chaveCandidata) {
    return { deveExecutar: false, chaveReservada: chaveAnterior }
  }

  return { deveExecutar: true, chaveReservada: chaveCandidata }
}

export function ehErroDeTransporte(error) {
  if (!error || String(error.code ?? '') !== '') return false

  const mensagem = `${error.message ?? ''} ${error.details ?? ''}`
  return /failed to fetch|fetch failed|network|connection|timeout|load failed/i.test(mensagem)
}

export function ehConflitoDeRevisao(error) {
  // Keep the legacy code recognizable while environments adopt the HTTP hotfix.
  return ['PT409', '40001'].includes(String(error?.code ?? ''))
}

export function classificarReconciliacaoMutacao(
  sessaoAntes,
  sessaoDepois,
  { aceitarAusente = false } = {}
) {
  if (!sessaoDepois) return aceitarAusente ? 'ausente_confirmada' : 'inconclusiva'
  if (sessaoAntes?.id_sessao !== sessaoDepois.id_sessao) return 'inconclusiva'
  if (sessaoDepois.status === 'finalizada') return 'finalizada'

  return Number(sessaoDepois.revisao) > Number(sessaoAntes?.revisao ?? -1)
    ? 'revisao_avancou'
    : 'inconclusiva'
}

export function ordemSecaoParaApresentacao(exercicio) {
  return Number(exercicio?.ordemSecao ?? 0)
}
