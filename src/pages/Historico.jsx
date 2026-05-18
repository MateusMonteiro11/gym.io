import { useState } from 'react'
import HistoricoHeader from '../components/HistoricoHeader'
import HistoricoCard from '../components/HistoricoCard'
import HistoricoMonth from '../components/HistoricoMonth'
import HistoricoEmpty from '../components/HistoricoEmpty'
import DashboardLayout from '../layouts/DashboardLayout'
import Card from '../components/ui/Card'
import { useAuth } from '../hooks/useAuth'
import { useHistorico } from '../hooks/useHistorico'
import { ui } from '../styles/theme'

export default function Historico() {
  const { usuario, loading: loadingAuth } = useAuth()
  const { historico, loading, erro, estatisticas, agruparPorMes } = useHistorico(usuario?.id)
  const [modo, setModo] = useState('geral')

  if (erro) {
    return (
      <DashboardLayout>
        <Card className={`${ui.cardPadding} border-danger/30 bg-danger-muted text-center`}>
          <i className="fa-solid fa-circle-exclamation mb-3 text-3xl text-danger" />
          <h2 className="mb-2 text-lg font-semibold text-danger">Erro ao carregar histórico</h2>
          <p className="text-slate-600">{erro}</p>
        </Card>
      </DashboardLayout>
    )
  }

  const agrupado = agruparPorMes()
  const temHistorico = historico.length > 0

  return (
    <DashboardLayout loading={loadingAuth || loading} loadingMessage="Carregando histórico...">
      <HistoricoHeader stats={estatisticas} />

      {temHistorico && (
        <div className="mb-6 flex flex-wrap gap-2">
          {['geral', 'mes'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                modo === m
                  ? 'bg-primary text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {m === 'geral' ? 'Histórico geral' : 'Por mês'}
            </button>
          ))}
        </div>
      )}

      {!temHistorico ? (
        <HistoricoEmpty />
      ) : modo === 'geral' ? (
        <div className="space-y-3">
          {historico.map((treino) => (
            <HistoricoCard key={treino.id_historico} historico={treino} />
          ))}
        </div>
      ) : (
        <div>
          {Object.entries(agrupado).map(([chave, { mes, treinos }]) => (
            <HistoricoMonth key={chave} mes={mes} treinos={treinos} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
