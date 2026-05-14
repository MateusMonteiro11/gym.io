import { useState } from 'react'

import Sidebar from '../components/Sidebar'
import HistoricoHeader from '../components/HistoricoHeader'
import HistoricoCard from '../components/HistoricoCard'
import HistoricoMonth from '../components/HistoricoMonth'
import HistoricoEmpty from '../components/HistoricoEmpty'

import { useAuth } from '../hooks/useAuth'
import { useHistorico } from '../hooks/useHistorico'

export default function Historico() {
  const { usuario, loading: loadingAuth } = useAuth()
  const { historico, loading, erro, estatisticas, agruparPorMes } = useHistorico(usuario?.id)
  const [modo, setModo] = useState('geral') // 'geral' ou 'mes'

  if (loadingAuth || loading) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-6 md:p-8">
          <div className="text-center">
            <i className="fa-solid fa-spinner animate-spin text-blue-600 text-3xl mb-3"></i>
            <p className="text-gray-600">Carregando histórico...</p>
          </div>
        </main>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8">
          <div className="bg-white border border-red-200 rounded-2xl p-6 text-center">
            <i className="fa-solid fa-exclamation-circle text-red-600 text-3xl mb-3"></i>
            <h2 className="text-lg font-semibold text-red-700 mb-2">Erro ao carregar histórico</h2>
            <p className="text-red-600">{erro}</p>
          </div>
        </main>
      </div>
    )
  }

  const stats = estatisticas
  const agrupado = agruparPorMes()
  const temHistorico = historico.length > 0

  console.log(estatisticas)

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <HistoricoHeader stats={stats} />

        {temHistorico && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setModo('geral')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                modo === 'geral'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              Histórico Geral
            </button>
            <button
              onClick={() => setModo('mes')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                modo === 'mes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              Por Mês
            </button>
          </div>
        )}

        {!temHistorico ? (
          <HistoricoEmpty />
        ) : modo === 'geral' ? (
          <div className="space-y-3">
            {historico.map((treino) => (
              <HistoricoCard
                key={treino.id_historico}
                historico={treino}
              />
            ))}
          </div>
        ) : (
          <div>
            {Object.entries(agrupado).map(([chave, { mes, treinos }]) => (
              <HistoricoMonth
                key={chave}
                mes={mes}
                treinos={treinos}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
