function normalizarNumero(valor) {
  if (valor == null || valor === '') return 0
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

export function criarChaveFormularioSerie(idTreinoExercicio, serieAtual) {
  const id = idTreinoExercicio == null ? 'sem-exercicio' : Number(idTreinoExercicio)
  return `${id}:${Number(serieAtual ?? 1)}`
}

export function criarEstadoFormularioSerie(chaveSerie, valoresIniciais = {}) {
  return {
    chaveSerie,
    carga: normalizarNumero(valoresIniciais.carga),
    repeticoes: normalizarNumero(valoresIniciais.repeticoes),
    sujo: false,
  }
}

export function reduzirEstadoFormularioSerie(estado, acao) {
  switch (acao.type) {
    case 'sincronizar': {
      if (acao.chaveSerie !== estado.chaveSerie) {
        return criarEstadoFormularioSerie(acao.chaveSerie, acao.valoresIniciais)
      }

      if (estado.sujo) return estado

      const carga = normalizarNumero(acao.valoresIniciais?.carga)
      const repeticoes = normalizarNumero(acao.valoresIniciais?.repeticoes)
      if (carga === estado.carga && repeticoes === estado.repeticoes) return estado

      return { ...estado, carga, repeticoes }
    }

    case 'editar_carga':
      return { ...estado, carga: normalizarNumero(acao.valor), sujo: true }

    case 'editar_repeticoes':
      return { ...estado, repeticoes: normalizarNumero(acao.valor), sujo: true }

    default:
      return estado
  }
}
