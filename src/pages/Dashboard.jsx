import Sidebar from '../components/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { useHistorico } from '../hooks/useHistorico'
import { useAgendamentos } from '../hooks/useAgendamentos'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { parseDateTime } from '../utils/dateUtils'


function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex justify-between items-start hover:shadow-md transition">
      <div>
        <p className="text-gray-500 text-sm mb-2 font-medium">{label}</p>
        <p className="text-4xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 mt-3">{sub}</p>
      </div>
      <div className="text-gray-200 text-3xl">
        {icon}
      </div>
    </div>
  )
}

function TreinoDeHojeCard({ agendamentos, onVerExercicios }) {
  if (!agendamentos || agendamentos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col justify-between min-h-80">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1 text-lg">Treino de Hoje</h3>
          <p className="text-gray-400 text-sm mb-6">Nenhum treino agendado</p>
        </div>
        <p className="text-gray-300 text-center py-12 text-sm">Nenhum treino agendado</p>
      </div>
    )
  }

  const hoje = new Date().toLocaleDateString('sv-SE')
  const primeiroAgendamento = agendamentos[0]

  const isHoje = primeiroAgendamento.data_agendada === hoje
  const treinoParaMostrar = primeiroAgendamento

  const treinoNome = treinoParaMostrar?.treino?.nome || 'Treino'
  const exerciciosCount = treinoParaMostrar?.treino?.secoes_treino?.reduce(
    (acc, secao) => acc + (secao?.treinos_exercicios?.length || 0),
    0
  ) || 0

  const dataTreino = parseDateTime(treinoParaMostrar.data_agendada)
  const dataFormatada = dataTreino?.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  }) || ''

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col justify-between min-h-80">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-lg">
            {isHoje ? 'Treino de Hoje' : 'Próximo Treino'}
          </h3>
          {!isHoje && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {dataFormatada}
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm mb-6">
          {isHoje ? '' : 'Próximo treino agendado'}
        </p>
        <div>
          <p className="text-gray-600 font-semibold text-lg">{treinoNome}</p>
          <p className="text-gray-400 text-sm mt-2">{exerciciosCount} exercício(s)</p>
        </div>
      </div>
      <button
        onClick={() => onVerExercicios(treinoParaMostrar.id_treino)}
        className="mt-6 px-6 py-2 border border-gray-300 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 transition w-fit"
      >
        Ver exercícios
      </button>
    </div>
  )
}

function AtividadeRecenteCard({ historico, onVerTodoHistorico }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col h-80">
      <h3 className="font-semibold text-gray-900 mb-1 text-lg">Atividade recente</h3>
      <p className="text-gray-400 text-sm mb-6">Seus últimos treinos concluídos</p>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {historico.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Nenhum treino concluído ainda</p>
        ) : (
          historico.slice(0, 3).map((treino, idx) => {
            const dataExecucao = parseDateTime(treino.data_execucao)
            const hoje = new Date()
            const diferenca = Math.floor(
              (hoje - dataExecucao) / (1000 * 60 * 60 * 24)
            )

            let dataFormatada
            if (diferenca === 0) {
              dataFormatada = 'Hoje'
            } else if (diferenca === 1) {
              dataFormatada = 'Ontem'
            } else {
              dataFormatada = dataExecucao.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
              })
            }

            const minutos = Math.round(treino.duracao_segundos / 60)
            const series = treino.total_series || 0

            return (
              <div key={idx} className="border-b border-gray-100 pb-4 last:border-b-0">
                <p className="font-semibold text-gray-900 text-sm">
                  {treino.treinos?.nome || 'Treino'}
                </p>
                <p className="text-xs text-gray-400">{dataFormatada}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {series} séries • {minutos} min
                </p>
              </div>
            )
          })
        )}
      </div>

      {historico.length > 3 && (
        <button
          onClick={onVerTodoHistorico}
          className="mt-4 w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition"
        >
          Ver todo histórico
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const { historico, loading: historicoLoading, estatisticas } = useHistorico(usuario?.id)
  const { agendamentos, loading: agendamentosLoading } = useAgendamentos()
  const [dataAtual, setDataAtual] = useState('')

  useEffect(() => {
    const hoje = new Date()
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ]

    const diaSemana = diasSemana[hoje.getDay()]
    const dia = hoje.getDate()
    const mes = meses[hoje.getMonth()]
    const ano = hoje.getFullYear()

    setDataAtual(`${diaSemana}, ${dia} de ${mes} de ${ano}`)
  }, [])

  const treinoDeHoje = agendamentos && agendamentos.length > 0 ? agendamentos[0] : null
  const isLoading = authLoading || historicoLoading || agendamentosLoading

  const handleVerExercicios = (idTreino) => {
    if (idTreino) {
      navigate(`/treinos/visualizar/${idTreino}`)
    }
  }

  const handleVerTodoHistorico = () => {
    navigate('/historico')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">Carregando...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Painel</h1>
          <p className="text-gray-400 text-sm">{dataAtual}</p>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total de treinos"
            value={estatisticas.totalTreinos}
            sub="Desde o início"
            icon={<i className="fa-solid fa-arrow-up"></i>}
          />
          <StatCard
            label="Esta semana"
            value={(() => {
              const umaSemana = 7 * 24 * 60 * 60 * 1000
              const agora = Date.now()
              return historico.filter(t => {
                const dataExecucao = parseDateTime(t.data_execucao)?.getTime() ?? 0
                return (agora - dataExecucao) <= umaSemana
              }).length
            })()}
            sub="Últimos 7 dias"
            icon={<i className="fa-solid fa-calendar"></i>}
          />
          <StatCard
            label="Total de exercícios"
            value={estatisticas.totalExercicios}
            sub="Concluídos"
            icon={<i className="fa-solid fa-chart-line"></i>}
          />
          <StatCard
            label="Duração média"
            value={estatisticas.duracaoMedia}
            sub="Por treino"
            icon={<i className="fa-solid fa-hourglass"></i>}
          />
        </div>

        {/* Main Cards Grid */}
        <div className="grid grid-cols-2 gap-8">
          {/* Treino de Hoje */}
          <TreinoDeHojeCard
            agendamentos={agendamentos}
            onVerExercicios={handleVerExercicios}
          />

          {/* Atividade Recente */}
          <AtividadeRecenteCard
            historico={historico}
            onVerTodoHistorico={handleVerTodoHistorico}
          />
        </div>
      </main>
    </div>
  )
}