import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useDescansoTimer } from './useDescansoTimer'
import { useServerNow } from './useServerNow'
import { useWorkoutTimer } from './useWorkoutTimer'
import {
  classificarReconciliacaoMutacao,
  criarChaveDescansoExpirado,
  criarChaveRecuperacaoSessao,
  deveAceitarSessaoRecebida,
  ehErroDeTransporte,
  estaCarregandoRecuperacao,
  reservarEncerramentoDescanso,
} from './treinoSessaoControllerUtils'
import {
  calcularSumarioTreino,
  flattenTreino,
  obterExercicioAtual,
  obterProximaSecao,
} from '../utils/treinoUtils'
import {
  carregarMemoriasComFallback,
  normalizarIdsExercicios,
  resolverValoresIniciaisExercicio,
} from '../utils/memoriaExercicioUtils'
import { getUserFriendlyErrorMessage, logError } from '../utils/errorMessages'
import { marcarAgendamentoConcluido } from '../services/agendamentos/agendamentosService'
import { buscarMemoriasExercicios } from '../services/memoria_exercicios/memoriaExerciciosService'
import {
  ajustarDescansoTreinoSessao,
  avancarExercicioTreinoSessao,
  buscarEstadoSessao,
  buscarEstadoSessaoAtiva,
  cancelarTreinoSessao,
  concluirTreinoSerie,
  definirPausaTreinoSessao,
  encerrarDescansoTreinoSessao,
  finalizarTreinoSessao,
  iniciarTreinoSessao,
  listarSeriesConcluidas,
} from '../services/treino_ativo/treinoSessaoService'

const ERRO_CONCORRENCIA = '40001'
const ERRO_ESTADO_INVALIDO = '55000'

function codigoDoErro(error) {
  return String(error?.code ?? '')
}

function mensagemDaSessao(error) {
  const code = codigoDoErro(error)

  if (code === ERRO_ESTADO_INVALIDO) {
    return 'A sessão não está em um estado válido para esta ação. Recarregamos os dados atuais.'
  }

  if (code === '23514' || code === '22003' || code === '22023') {
    return 'Os valores informados não são válidos para esta sessão.'
  }

  return getUserFriendlyErrorMessage(
    error,
    'Não foi possível atualizar a sessão. Tente novamente.'
  )
}

export function useTreinoAtivo({
  treino,
  idUsuario,
  descansoPadrao = 60,
  onFinalizar,
  onCancelar,
}) {
  const exercicios = useMemo(() => flattenTreino(treino), [treino])
  const sumario = useMemo(() => calcularSumarioTreino(exercicios), [exercicios])
  const idsExerciciosMemoria = useMemo(
    () => normalizarIdsExercicios(exercicios.map((item) => item.id_exercicio)),
    [exercicios]
  )

  const [sessao, setSessao] = useState(null)
  const [seriesConcluidas, setSeriesConcluidas] = useState([])
  const [memoriasHistoricas, setMemoriasHistoricas] = useState(() => new Map())
  const [sessaoConflitante, setSessaoConflitante] = useState(null)
  const [serverOffsetMs, setServerOffsetMs] = useState(0)
  const [chaveRecuperada, setChaveRecuperada] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)

  const sessaoRef = useRef(null)
  const mutacaoRef = useRef(false)
  const descansoAutomaticoRef = useRef(null)
  const finalizacoesProcessadasRef = useRef(new Set())
  const onFinalizarRef = useRef(onFinalizar)
  const onCancelarRef = useRef(onCancelar)
  const chaveRecuperacao = criarChaveRecuperacaoSessao(
    idUsuario,
    treino?.id_treino
  )
  const carregandoSessao = estaCarregandoRecuperacao(
    chaveRecuperacao,
    chaveRecuperada
  )

  useEffect(() => {
    onFinalizarRef.current = onFinalizar
    onCancelarRef.current = onCancelar
  }, [onCancelar, onFinalizar])

  useEffect(() => {
    let ativo = true
    setMemoriasHistoricas(new Map())

    if (!idUsuario || !idsExerciciosMemoria.length) {
      return () => {
        ativo = false
      }
    }

    carregarMemoriasComFallback(
      idsExerciciosMemoria,
      buscarMemoriasExercicios,
      (error) => logError(
        error,
        '[useTreinoAtivo] Failed to load exercise memories'
      )
    ).then((memorias) => {
      if (ativo) setMemoriasHistoricas(memorias)
    })

    return () => {
      ativo = false
    }
  }, [idUsuario, idsExerciciosMemoria])

  const registrarSessao = useCallback((proximaSessao, novasSeries) => {
    if (!deveAceitarSessaoRecebida(sessaoRef.current, proximaSessao)) {
      return false
    }

    if (proximaSessao?.agora_servidor) {
      const agoraServidorMs = Date.parse(proximaSessao.agora_servidor)
      if (Number.isFinite(agoraServidorMs)) {
        setServerOffsetMs(agoraServidorMs - Date.now())
      }
    }

    sessaoRef.current = proximaSessao
    setSessao(proximaSessao)
    if (novasSeries !== undefined) setSeriesConcluidas(novasSeries)
    return true
  }, [])

  const limparFeedback = useCallback(() => {
    setErro(null)
    setAviso(null)
  }, [])

  const processarFinalizacao = useCallback(async (sessaoFinalizada) => {
    if (!sessaoFinalizada?.id_sessao) return
    if (finalizacoesProcessadasRef.current.has(sessaoFinalizada.id_sessao)) return

    finalizacoesProcessadasRef.current.add(sessaoFinalizada.id_sessao)

    try {
      await marcarAgendamentoConcluido(
        idUsuario,
        sessaoFinalizada.id_treino
      )
    } catch (error) {
      logError(error, '[useTreinoAtivo] Failed to complete appointment')
    }

    onFinalizarRef.current?.(sessaoFinalizada)
  }, [idUsuario])

  const aplicarRespostaConfirmada = useCallback(async (resposta) => {
    const aceita = registrarSessao(resposta)
    if (!aceita) return false

    try {
      const series = await listarSeriesConcluidas(resposta.id_sessao)
      const atual = sessaoRef.current
      if (
        atual?.id_sessao === resposta.id_sessao &&
        Number(atual.revisao) === Number(resposta.revisao)
      ) {
        setSeriesConcluidas(series)
      }
    } catch (error) {
      logError(error, '[useTreinoAtivo] Failed to refresh completed sets')
      setAviso('A ação foi salva, mas a lista de séries não pôde ser atualizada agora.')
    }

    if (resposta.status === 'finalizada') {
      await processarFinalizacao(resposta)
    }
    return true
  }, [processarFinalizacao, registrarSessao])

  const validarFinalizacaoRecuperada = useCallback(async (sessaoFinalizada) => {
    try {
      const resposta = await finalizarTreinoSessao(
        sessaoFinalizada.id_sessao,
        sessaoFinalizada.revisao
      )
      await aplicarRespostaConfirmada(resposta)
      return true
    } catch (error) {
      logError(error, '[useTreinoAtivo] Failed to validate recovered finalization')
      registrarSessao(sessaoFinalizada)
      setErro(
        codigoDoErro(error) === ERRO_ESTADO_INVALIDO
          ? 'Não foi possível validar a finalização desta sessão.'
          : mensagemDaSessao(error)
      )
      return false
    }
  }, [aplicarRespostaConfirmada, registrarSessao])

  const recarregarSessaoAtual = useCallback(async ({
    validarFinalizada = true,
    silencioso = true,
  } = {}) => {
    const atual = sessaoRef.current
    if (!atual?.id_sessao) return null

    try {
      const estado = await buscarEstadoSessao(atual.id_sessao)

      if (!estado.sessao) {
        registrarSessao(null, [])
        return null
      }

      const aceita = registrarSessao(estado.sessao, estado.series)
      if (!aceita) return sessaoRef.current

      if (validarFinalizada && estado.sessao.status === 'finalizada') {
        await validarFinalizacaoRecuperada(estado.sessao)
      }

      return estado.sessao
    } catch (error) {
      logError(error, '[useTreinoAtivo] Failed to reload session')
      if (!silencioso) setErro(mensagemDaSessao(error))
      return null
    }
  }, [registrarSessao, validarFinalizacaoRecuperada])

  const reconciliarMutacaoAposErroRede = useCallback(async (
    sessaoAntes,
    { aceitarAusente = false } = {}
  ) => {
    try {
      const estado = await buscarEstadoSessao(sessaoAntes.id_sessao)
      const classificacao = classificarReconciliacaoMutacao(
        sessaoAntes,
        estado.sessao,
        { aceitarAusente }
      )

      if (classificacao === 'ausente_confirmada') {
        registrarSessao(null, [])
        return true
      }

      if (classificacao === 'finalizada') {
        return validarFinalizacaoRecuperada(estado.sessao)
      }

      if (estado.sessao) {
        registrarSessao(estado.sessao, estado.series)
      }

      return false
    } catch (error) {
      logError(error, '[useTreinoAtivo] Failed to reconcile network mutation')
      return false
    }
  }, [registrarSessao, validarFinalizacaoRecuperada])

  const tratarErroMutacao = useCallback(async (error) => {
    logError(error, '[useTreinoAtivo] Session mutation failed')
    const code = codigoDoErro(error)

    if (code === ERRO_CONCORRENCIA) {
      setAviso('A sessão foi alterada em outra aba. Os dados atuais foram recarregados.')
      await recarregarSessaoAtual({ validarFinalizada: true })
      return
    }

    if (code === ERRO_ESTADO_INVALIDO) {
      setErro('A sessão não está em um estado válido para esta ação. Os dados foram recarregados.')
      await recarregarSessaoAtual({ validarFinalizada: false })
      return
    }

    if (code === 'P0002') {
      registrarSessao(null, [])
      setErro('Esta sessão não está mais disponível.')
      return
    }

    setErro(mensagemDaSessao(error))
  }, [recarregarSessaoAtual, registrarSessao])

  const executarMutacao = useCallback(async (
    mutacao,
    { aceitarAusenteAposErroRede = false } = {}
  ) => {
    if (mutacaoRef.current) return false

    const atual = sessaoRef.current
    if (!atual?.id_sessao) return false

    mutacaoRef.current = true
    setSalvando(true)
    limparFeedback()

    try {
      const resposta = await mutacao(atual)
      await aplicarRespostaConfirmada(resposta)
      return true
    } catch (error) {
      if (ehErroDeTransporte(error)) {
        const reconciliada = await reconciliarMutacaoAposErroRede(atual, {
          aceitarAusente: aceitarAusenteAposErroRede,
        })

        if (reconciliada) {
          setAviso('A resposta foi interrompida, mas o estado salvo foi confirmado no servidor.')
          return true
        }
      }

      await tratarErroMutacao(error)
      return false
    } finally {
      mutacaoRef.current = false
      setSalvando(false)
    }
  }, [
    aplicarRespostaConfirmada,
    limparFeedback,
    reconciliarMutacaoAposErroRede,
    tratarErroMutacao,
  ])

  useEffect(() => {
    if (!chaveRecuperacao) return undefined

    let ativo = true

    async function recuperar() {
      limparFeedback()

      try {
        const estado = await buscarEstadoSessaoAtiva()
        if (!ativo) return

        if (!estado.sessao) {
          registrarSessao(null, [])
          setSessaoConflitante(null)
          return
        }

        if (Number(estado.sessao.id_treino) === Number(treino.id_treino)) {
          registrarSessao(estado.sessao, estado.series)
          setSessaoConflitante(null)
        } else {
          registrarSessao(null, [])
          setSessaoConflitante(estado.sessao)
        }
      } catch (error) {
        if (!ativo) return
        logError(error, '[useTreinoAtivo] Failed to recover active session')
        setErro(mensagemDaSessao(error))
      } finally {
        if (ativo) setChaveRecuperada(chaveRecuperacao)
      }
    }

    recuperar()
    return () => {
      ativo = false
    }
  }, [chaveRecuperacao, limparFeedback, registrarSessao, treino?.id_treino])

  useEffect(() => {
    if (!idUsuario || carregandoSessao) return undefined

    const sincronizar = async () => {
      if (document.visibilityState === 'hidden') return
      if (mutacaoRef.current) return

      if (sessaoRef.current?.id_sessao) {
        await recarregarSessaoAtual({ validarFinalizada: true })
        return
      }

      try {
        const estado = await buscarEstadoSessaoAtiva()
        if (!estado.sessao) {
          setSessaoConflitante(null)
        } else if (Number(estado.sessao.id_treino) === Number(treino?.id_treino)) {
          registrarSessao(estado.sessao, estado.series)
          setSessaoConflitante(null)
        } else {
          setSessaoConflitante(estado.sessao)
        }
      } catch (error) {
        logError(error, '[useTreinoAtivo] Failed to sync active session')
      }
    }

    const sincronizarOnline = () => {
      descansoAutomaticoRef.current = null
      sincronizar()
    }

    window.addEventListener('focus', sincronizar)
    window.addEventListener('online', sincronizarOnline)
    document.addEventListener('visibilitychange', sincronizar)

    return () => {
      window.removeEventListener('focus', sincronizar)
      window.removeEventListener('online', sincronizarOnline)
      document.removeEventListener('visibilitychange', sincronizar)
    }
  }, [
    carregandoSessao,
    idUsuario,
    recarregarSessaoAtual,
    registrarSessao,
    treino?.id_treino,
  ])

  const { nowMs } = useServerNow(serverOffsetMs, Boolean(sessao))
  const timerTreinoBase = useWorkoutTimer({ sessao, nowMs })
  const timerDescansoBase = useDescansoTimer({ sessao, nowMs })

  const indexAtual = Number(sessao?.indice_exercicio_atual ?? 0)
  const serieAtual = Number(sessao?.serie_atual ?? 1)
  const exercicioAtual = obterExercicioAtual(exercicios, indexAtual)
  const memoriaHistoricaAtual = memoriasHistoricas.get(
    Number(exercicioAtual?.id_exercicio)
  ) ?? null
  const valoresIniciaisExercicio = useMemo(
    () => resolverValoresIniciaisExercicio({
      exercicio: exercicioAtual,
      seriesConcluidas,
      memoriaHistorica: memoriaHistoricaAtual,
      idTreinoExercicioAtual: sessao?.id_treino_exercicio_atual ?? null,
    }),
    [
      exercicioAtual,
      memoriaHistoricaAtual,
      seriesConcluidas,
      sessao?.id_treino_exercicio_atual,
    ]
  )
  const proximaSecao = obterProximaSecao(exercicios, indexAtual)
  const proximoExercicios = useMemo(
    () => exercicios.slice(indexAtual + 1, indexAtual + 4),
    [exercicios, indexAtual]
  )

  const status = !sessao || sessao.status === 'cancelada'
    ? 'idle'
    : sessao.status === 'finalizada'
      ? 'finalizado'
      : sessao.fase === 'descanso'
        ? 'descansando'
        : 'ativo'
  const pausado = Boolean(sessao?.pausada_em)
  const finalizado = sessao?.status === 'finalizada'
  const tempoDescanso = Number(
    sessao?.descanso_padrao_segundos ?? descansoPadrao ?? 60
  )
  const chaveDescansoExpirado = criarChaveDescansoExpirado({
    sessao,
    restante: timerDescansoBase.restante,
    bloqueado: salvando,
  })

  useEffect(() => {
    if (mutacaoRef.current) return

    const reserva = reservarEncerramentoDescanso(
      descansoAutomaticoRef.current,
      chaveDescansoExpirado
    )

    if (!reserva.deveExecutar) return
    descansoAutomaticoRef.current = reserva.chaveReservada

    executarMutacao((atual) => encerrarDescansoTreinoSessao(
      atual.id_sessao,
      atual.revisao,
      false
    ))
  }, [chaveDescansoExpirado, executarMutacao])

  const estado = useMemo(() => {
    const totalExercicios = exercicios.length
    const totalSeries = exercicios.reduce(
      (total, exercicio) => total + Number(exercicio.series || 0),
      0
    )
    const seriesAteExercicioAtual = exercicios
      .slice(0, indexAtual)
      .reduce((total, exercicio) => total + Number(exercicio.series || 0), 0)
    const seriesPercorridas = finalizado
      ? totalSeries
      : Math.min(totalSeries, seriesAteExercicioAtual + Math.max(0, serieAtual - 1))
    const exerciciosFeitos = finalizado ? totalExercicios : indexAtual
    const exerciciosRestantes = finalizado
      ? 0
      : Math.max(0, totalExercicios - indexAtual - 1)
    const seriesRestantes = Math.max(0, totalSeries - seriesPercorridas)
    const percentual = totalSeries > 0
      ? Math.min(100, Math.round((seriesPercorridas / totalSeries) * 100))
      : 0

    return {
      percentual,
      totalExercicios,
      exerciciosFeitos,
      exerciciosRestantes,
      totalSeries,
      seriesRestantes,
      secaoAtual: exercicioAtual?.secao || 'Treino',
      proximaSecao: proximaSecao?.secao || null,
    }
  }, [exercicioAtual, exercicios, finalizado, indexAtual, proximaSecao, serieAtual])

  const iniciarTreino = useCallback(async (tempo = descansoPadrao) => {
    if (mutacaoRef.current || sessaoRef.current || sessaoConflitante) return false

    const descanso = Number(tempo)
    if (!Number.isInteger(descanso) || descanso < 0 || descanso > 3600) {
      setErro('Escolha um descanso entre 0 e 3600 segundos.')
      return false
    }

    mutacaoRef.current = true
    setSalvando(true)
    limparFeedback()

    try {
      const resposta = await iniciarTreinoSessao(treino.id_treino, descanso)
      await aplicarRespostaConfirmada(resposta)
      return true
    } catch (error) {
      if (ehErroDeTransporte(error)) {
        try {
          const estado = await buscarEstadoSessaoAtiva()
          if (Number(estado.sessao?.id_treino) === Number(treino.id_treino)) {
            registrarSessao(estado.sessao, estado.series)
            setAviso('A resposta foi interrompida, mas a sessão iniciada foi confirmada no servidor.')
            return true
          }
        } catch (reloadError) {
          logError(reloadError, '[useTreinoAtivo] Failed to reconcile session start')
        }
      }

      if ([ERRO_CONCORRENCIA, '23505'].includes(codigoDoErro(error))) {
        try {
          const estado = await buscarEstadoSessaoAtiva()
          if (estado.sessao) {
            if (Number(estado.sessao.id_treino) === Number(treino.id_treino)) {
              registrarSessao(estado.sessao, estado.series)
            } else {
              setSessaoConflitante(estado.sessao)
            }
          }
        } catch (reloadError) {
          logError(reloadError, '[useTreinoAtivo] Failed to load conflicting session')
        }
        setErro('Já existe uma sessão ativa. Continue ou cancele essa sessão antes de iniciar outra.')
      } else {
        await tratarErroMutacao(error)
      }
      return false
    } finally {
      mutacaoRef.current = false
      setSalvando(false)
    }
  }, [
    aplicarRespostaConfirmada,
    descansoPadrao,
    limparFeedback,
    registrarSessao,
    sessaoConflitante,
    tratarErroMutacao,
    treino?.id_treino,
  ])

  const concluirSerie = useCallback((ajustes = {}) => {
    if (!exercicioAtual || pausado || sessaoRef.current?.fase !== 'execucao') {
      return Promise.resolve(false)
    }

    return executarMutacao((atual) => concluirTreinoSerie(
      atual.id_sessao,
      atual.revisao,
      ajustes.carga ?? exercicioAtual.carga,
      ajustes.repeticoes ?? exercicioAtual.repeticoes
    ))
  }, [exercicioAtual, executarMutacao, pausado])

  const alternarPausa = useCallback(() => executarMutacao((atual) =>
    definirPausaTreinoSessao(
      atual.id_sessao,
      atual.revisao,
      !atual.pausada_em
    )
  ), [executarMutacao])

  const continuarSerie = useCallback(() => {
    if (pausado) return Promise.resolve(false)
    return executarMutacao((atual) => encerrarDescansoTreinoSessao(
      atual.id_sessao,
      atual.revisao,
      timerDescansoBase.restante > 0
    ))
  }, [executarMutacao, pausado, timerDescansoBase.restante])

  const pularDescanso = useCallback(() => {
    if (pausado) return Promise.resolve(false)
    return executarMutacao((atual) => encerrarDescansoTreinoSessao(
      atual.id_sessao,
      atual.revisao,
      true
    ))
  }, [executarMutacao, pausado])

  const ajustarDescanso = useCallback((delta) => {
    if (pausado) return Promise.resolve(false)
    return executarMutacao((atual) => ajustarDescansoTreinoSessao(
      atual.id_sessao,
      atual.revisao,
      delta
    ))
  }, [executarMutacao, pausado])

  const avancarExercicio = useCallback(() => {
    if (pausado) return Promise.resolve(false)
    return executarMutacao((atual) => avancarExercicioTreinoSessao(
      atual.id_sessao,
      atual.revisao
    ))
  }, [executarMutacao, pausado])

  const finalizarTreino = useCallback(() => executarMutacao((atual) =>
    finalizarTreinoSessao(atual.id_sessao, atual.revisao)
  ), [executarMutacao])

  const cancelarTreino = useCallback(async () => {
    if (!sessaoRef.current) {
      onCancelarRef.current?.()
      return true
    }

    const cancelada = await executarMutacao(
      (atual) => cancelarTreinoSessao(
        atual.id_sessao,
        atual.revisao
      ),
      { aceitarAusenteAposErroRede: true }
    )

    if (cancelada) {
      registrarSessao(null, [])
      onCancelarRef.current?.()
    }

    return cancelada
  }, [executarMutacao, registrarSessao])

  const cancelarSessaoConflitante = useCallback(async () => {
    if (!sessaoConflitante || mutacaoRef.current) return false

    mutacaoRef.current = true
    setSalvando(true)
    limparFeedback()

    try {
      await cancelarTreinoSessao(
        sessaoConflitante.id_sessao,
        sessaoConflitante.revisao
      )
      setSessaoConflitante(null)
      return true
    } catch (error) {
      logError(error, '[useTreinoAtivo] Failed to cancel conflicting session')
      if (ehErroDeTransporte(error)) {
        try {
          const estado = await buscarEstadoSessao(sessaoConflitante.id_sessao)
          if (!estado.sessao) {
            setSessaoConflitante(null)
            setAviso('A resposta foi interrompida, mas o cancelamento foi confirmado no servidor.')
            return true
          }
          setSessaoConflitante(estado.sessao)
        } catch (reloadError) {
          logError(reloadError, '[useTreinoAtivo] Failed to reconcile conflict cancellation')
        }
      }

      if (codigoDoErro(error) === ERRO_CONCORRENCIA) {
        try {
          const estado = await buscarEstadoSessaoAtiva()
          setSessaoConflitante(estado.sessao)
          setAviso('A outra sessão mudou. O estado atual foi recarregado.')
        } catch (reloadError) {
          logError(reloadError, '[useTreinoAtivo] Failed to refresh conflict')
        }
      } else {
        setErro(mensagemDaSessao(error))
      }
      return false
    } finally {
      mutacaoRef.current = false
      setSalvando(false)
    }
  }, [limparFeedback, sessaoConflitante])

  const workoutTimer = {
    ...timerTreinoBase,
    toggle: alternarPausa,
  }

  const descansoTimer = {
    ...timerDescansoBase,
    adicionarTempo: () => ajustarDescanso(15),
    removerTempo: () => ajustarDescanso(-15),
  }

  return {
    status,
    pausado,
    salvando,
    carregandoSessao,
    erro,
    aviso,
    limparFeedback,
    sessao,
    sessaoConflitante,
    seriesConcluidas,
    revisao: sessao?.revisao ?? null,
    exercicios,
    indexAtual,
    serieAtual,
    exercicioAtual,
    valoresIniciaisExercicio,
    proximoExercicios,
    proximaSecao,
    finalizado,
    estado,
    sumario,
    workoutTimer,
    descansoTimer,
    tempoDescanso,
    iniciarTreino,
    concluirSerie,
    pularDescanso,
    avancarExercicio,
    finalizarTreino,
    cancelarTreino,
    cancelarSessaoConflitante,
    continuarSerie,
  }
}
