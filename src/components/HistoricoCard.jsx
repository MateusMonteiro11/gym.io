import { useState } from 'react'
import { buscarHistoricoCompleto } from '../services/historico/historicoTreinosService'

export default function HistoricoCard({ historico, onExpanded }) {
  const [expandido, setExpandido] = useState(false)
  const [detalhes, setDetalhes] = useState(null)
  const [carregando, setCarregando] = useState(false)

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatarHora = (data) => {
    return new Date(data).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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
    <div className="bg-white border rounded-2xl overflow-hidden hover:shadow-md transition-all">
      <button
        onClick={handleExpandir}
        className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800">
              {historico.treinos?.nome || 'Treino'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {formatarData(historico.data_execucao)} às {formatarHora(historico.data_execucao)}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              <i className="fa-solid fa-stopwatch mr-2"></i>
              {formatarDuracao(historico.duracao_segundos)} •
              <i className="fa-solid fa-fire mx-2"></i>
              {historico.total_series || 0} séries
            </p>
          </div>
          <div className="flex-shrink-0 ml-4">
            <i
              className={`fa-solid fa-chevron-down text-gray-400 transition-transform ${
                expandido ? 'rotate-180' : ''
              }`}
            ></i>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="border-t bg-gray-50 p-5">
          {carregando ? (
            <div className="text-center py-4">
              <i className="fa-solid fa-spinner animate-spin text-blue-600 mr-2"></i>
              <p className="text-gray-600">Carregando detalhes...</p>
            </div>
          ) : detalhes?.historico_exercicios ? (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700 mb-3">Exercícios realizados</h4>
              {detalhes.historico_exercicios.map((exercicio, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-gray-800">
                      {exercicio.exercicios?.nome || 'Exercício'}
                    </h5>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Série {exercicio.serie}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                    <div>
                      <p className="text-xs text-gray-400">Carga utilizada</p>
                      <p className="font-semibold">{exercicio.carga_utilizada || 0} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <p className="font-semibold text-emerald-600">
                        {exercicio.concluido ? '✓ Concluído' : 'Pendente'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">Sem exercícios registrados</p>
          )}
        </div>
      )}
    </div>
  )
}
