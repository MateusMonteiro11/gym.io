function normalizarNumero(valor) {
  if (valor == null || valor === '') return 0
  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 0 ? numero : 0
}

function editarCampo(estado, campo, valor) {
  const texto = String(valor ?? '')
  const numero = Number(texto)
  const valido = texto.trim() !== '' && Number.isFinite(numero) && numero >= 0
  const confirmado = `${campo}Confirmado`

  return {
    ...estado,
    [`${campo}Texto`]: texto,
    [campo]: valido ? numero : estado[confirmado],
    // Os botões enviam números e confirmam imediatamente; digitação envia texto.
    [confirmado]: valido && typeof valor === 'number' ? numero : estado[confirmado],
    sujo: true,
  }
}

function confirmarCampo(estado, campo) {
  return {
    ...estado,
    [`${campo}Texto`]: String(estado[campo]),
    [`${campo}Confirmado`]: estado[campo],
  }
}

export function criarChaveFormularioSerie(idTreinoExercicio, serieAtual) {
  const id = idTreinoExercicio == null ? 'sem-exercicio' : Number(idTreinoExercicio)
  return `${id}:${Number(serieAtual ?? 1)}`
}

export function criarEstadoFormularioSerie(chaveSerie, valoresIniciais = {}) {
  const carga = normalizarNumero(valoresIniciais.carga)
  const repeticoes = normalizarNumero(valoresIniciais.repeticoes)
  return {
    chaveSerie,
    carga,
    repeticoes,
    cargaConfirmado: carga,
    repeticoesConfirmado: repeticoes,
    cargaTexto: String(carga),
    repeticoesTexto: String(repeticoes),
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

      return criarEstadoFormularioSerie(acao.chaveSerie, { carga, repeticoes })
    }

    case 'editar_carga':
      return editarCampo(estado, 'carga', acao.valor)

    case 'editar_repeticoes':
      return editarCampo(estado, 'repeticoes', acao.valor)

    case 'confirmar_carga':
      return confirmarCampo(estado, 'carga')

    case 'confirmar_repeticoes':
      return confirmarCampo(estado, 'repeticoes')

    case 'confirmar':
      return confirmarCampo(confirmarCampo(estado, 'carga'), 'repeticoes')

    default:
      return estado
  }
}
