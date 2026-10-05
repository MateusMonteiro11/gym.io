import { useState } from 'react'
import { buscarHistoricoCompleto } from '../services/historico/historicoTreinosService'
import { formatDatePtBr, formatTimePtBr } from '../utils/dateUtils'
import { SkeletonList } from './ui/Skeleton'

export default function HistoricoCard({ historico }) {
  const [expandido, setExpandido] = useState(false)
  const [detalhes, setDetalhes] = useState(null)
  const [carregando, setCarregando] = useState(false)

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
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-app-line bg-app-surface transition-all hover:shadow-md dark:shadow-black/20">
      <button
        onClick={handleExpandir}
        className="w-full p-5 text-left transition-colors hover:bg-app-muted"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-app-ink">
              {historico.treinos?.nome || 'Treino'}
            </h3>
            <p className="mt-1 text-sm text-app-secondary">
              {formatDatePtBr(historico.data_execucao)} às {formatTimePtBr(historico.data_execucao)}
            </p>
            <p className="mt-2 text-sm text-app-secondary">
              <i className="fa-solid fa-stopwatch mr-2"></i>
              {formatarDuracao(historico.duracao_segundos)} •
              <i className="fa-solid fa-fire mx-2"></i>
              {historico.total_series || 0} séries
            </p>
          </div>
          <div className="flex-shrink-0 ml-4">
            <i
              className={`fa-solid fa-chevron-down text-app-secondary transition-transform  ${
                expandido ? 'rotate-180' : ''
              }`}
            ></i>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-app-line bg-app-muted p-5">
          {carregando ? (
            <div className="py-1" role="status" aria-label="Carregando detalhes...">
              <SkeletonList items={2} compact />
            </div>
          ) : detalhes?.historico_exercicios ? (
            <div className="space-y-3">
              <h4 className="mb-3 font-semibold text-app-ink">Exercícios realizados</h4>
              {detalhes.historico_exercicios.map((exercicio, idx) => (
                <div
                  key={exercicio.id_historico_exercicio ?? `${exercicio.id_exercicio ?? 'exercicio'}:${exercicio.serie ?? idx}`}
                  className="rounded-lg border border-app-line bg-app-surface p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-app-ink">
                      {exercicio.exercicios?.nome || 'Exercício'}
                    </h5>
                    <span className="rounded bg-app-selection px-2 py-1 text-xs text-app-accent">
                      Série {exercicio.serie}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-app-secondary">
                    <div>
                      <p className="text-xs text-app-secondary">Carga utilizada</p>
                      <p className="font-semibold text-app-ink">{exercicio.carga_utilizada || 0} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-app-secondary">Status</p>
                      <p className="font-semibold text-app-success">
                        {exercicio.concluido ? '✓ Concluído' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-app-secondary">Sem exercícios registrados</p>
          )}
        </div>
      )}
    </div>
  )
}
