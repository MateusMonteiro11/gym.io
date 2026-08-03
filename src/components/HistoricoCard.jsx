import { useState } from 'react'
import { buscarHistoricoCompleto } from '../services/historico/historicoTreinosService'
import { formatDatePtBr, formatTimePtBr } from '../utils/dateUtils'

export default function HistoricoCard({ historico, onExpanded }) {
  const [expandido, setExpandido] = useState(false)
  const [detalhes, setDetalhes] = useState(null)
  const [carregando, setCarregando] = useState(false)

  const formatarData = (data) => formatDatePtBr(data)
  const formatarHora = (data) => formatTimePtBr(data)

  const formatarDuracao = (segundos) => {
    if (!segundos) return '0 min'
    const minutos = Math.floor(segundos / 60)
    return `${minutos} min`
  }

  const handleExpandir = async () => {
    if (expandido) {
      setExpandido(false)
      return
    }

    if (!detalhes) {
      setCarregando(true)
      try {
        const dados = await buscarHistoricoCompleto(historico.id_historico)
        setDetalhes(dados)
      } catch (err) {
        console.error('Erro ao carregar detalhes:', err)
      } finally {
        setCarregando(false)
      }
    }

    setExpandido(!expandido)
    onExpanded?.()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/85 dark:shadow-black/20">
      <button
        onClick={handleExpandir}
        className="w-full p-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/70"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {historico.treinos?.nome || 'Treino'}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {formatarData(historico.data_execucao)} às {formatarHora(historico.data_execucao)}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <i className="fa-solid fa-stopwatch mr-2 dark:text-white"></i>
              {formatarDuracao(historico.duracao_segundos)} •
              <i className="fa-solid fa-fire mx-2 dark:text-white"></i>
              {historico.total_series || 0} séries
            </p>
          </div>
          <div className="flex-shrink-0 ml-4">
            <i
              className={`fa-solid fa-chevron-down text-slate-600 transition-transform dark:text-slate-300 ${
                expandido ? 'rotate-180' : ''
              }`}
            ></i>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-700/70 dark:bg-slate-950/70">
          {carregando ? (
            <div className="text-center py-4">
              <i className="fa-solid fa-spinner mr-2 animate-spin text-primary dark:text-white"></i>
              <p className="text-slate-600 dark:text-slate-300">Carregando detalhes...</p>
            </div>
          ) : detalhes?.historico_exercicios ? (
            <div className="space-y-3">
              <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-100">Exercícios realizados</h4>
              {detalhes.historico_exercicios.map((exercicio, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700/70 dark:bg-slate-900/85"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-slate-900 dark:text-slate-50">
                      {exercicio.exercicios?.nome || 'Exercício'}
                    </h5>
                    <span className="rounded bg-primary-muted px-2 py-1 text-xs text-blue-700 dark:bg-slate-800 dark:text-white">
                      Série {exercicio.serie}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Carga utilizada</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{exercicio.carga_utilizada || 0} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Status</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {exercicio.concluido ? '✓ Concluído' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-300">Sem exercícios registrados</p>
          )}
        </div>
      )}
    </div>
  )
}
