import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useHistorico } from '../hooks/useHistorico'
import { useAgendamentos } from '../hooks/useAgendamentos'
import { parseDateTime } from '../utils/dateUtils'
import DashboardLayout from '../layouts/DashboardLayout'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { ui } from '../styles/theme'

function StatCard({ label, value, sub, icon }) {
  return (
    <Card className={`${ui.cardPadding} flex items-start justify-between`}>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-600">{label}</p>
        <p className="text-4xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-3 text-xs text-slate-500">{sub}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-muted text-xl text-primary">
        {icon}
      </div>
    </Card>
  )
}

function TreinoDeHojeCard({ agendamentos, onVerExercicios }) {
  if (!agendamentos?.length) {
    return (
      <Card className={`${ui.cardPadding} flex min-h-80 flex-col justify-between`}>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Treino de Hoje</h3>
          <p className="mt-1 text-sm text-slate-600">Nenhum treino agendado</p>
        </div>
        <p className="py-12 text-center text-sm text-slate-500">Agende um treino na aba Treinos</p>
      </Card>
    )
  }

  const hoje = new Date().toLocaleDateString('sv-SE')
  const primeiroAgendamento = agendamentos[0]
  const isHoje = primeiroAgendamento.data_agendada === hoje
  const treinoNome = primeiroAgendamento?.treino?.nome || 'Treino'
  const exerciciosCount =
    primeiroAgendamento?.treino?.secoes_treino?.reduce(
      (acc, secao) => acc + (secao?.treinos_exercicios?.length || 0),
      0
    ) || 0
  const dataTreino = parseDateTime(primeiroAgendamento.data_agendada)
  const dataFormatada =
    dataTreino?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) || ''

  return (
    <Card className={`${ui.cardPadding} flex min-h-80 flex-col justify-between`}>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {isHoje ? 'Treino de Hoje' : 'Próximo Treino'}
          </h3>
          {!isHoje && <span className={ui.badge}>{dataFormatada}</span>}
        </div>
        <p className="mb-4 text-sm text-slate-600">
          {isHoje ? 'Seu treino agendado para hoje' : 'Próximo treino agendado'}
        </p>
        <p className="text-lg font-semibold text-slate-900">{treinoNome}</p>
        <p className="mt-2 text-sm text-slate-600">{exerciciosCount} exercício(s)</p>
      </div>
      <Button variant="secondary" className="mt-6 w-fit" onClick={() => onVerExercicios(primeiroAgendamento.id_treino)}>
        Ver exercícios
      </Button>
    </Card>
  )
}

function AtividadeRecenteCard({ historico, onVerTodoHistorico }) {
  return (
    <Card className={`${ui.cardPadding} flex h-80 flex-col`}>
      <h3 className="text-lg font-semibold text-slate-900">Atividade recente</h3>
      <p className="mb-6 mt-1 text-sm text-slate-600">Seus últimos treinos concluídos</p>
      <div className="flex-1 space-y-4 overflow-y-auto">
        {historico.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Nenhum treino concluído ainda</p>
        ) : (
          historico.slice(0, 3).map((treino, idx) => {
            const dataExecucao = parseDateTime(treino.data_execucao)
            const hoje = new Date()
            const diferenca = Math.floor((hoje - dataExecucao) / (1000 * 60 * 60 * 24))
            let dataFormatada
            if (diferenca === 0) dataFormatada = 'Hoje'
            else if (diferenca === 1) dataFormatada = 'Ontem'
            else dataFormatada = dataExecucao.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
            const minutos = Math.round(treino.duracao_segundos / 60)
            const series = treino.total_series || 0
            return (
              <div key={idx} className="border-b border-slate-100 pb-4 last:border-b-0">
                <p className="text-sm font-semibold text-slate-900">{treino.treinos?.nome || 'Treino'}</p>
                <p className="text-xs text-slate-500">{dataFormatada}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {series} séries • {minutos} min
                </p>
              </div>
            )
          })
        )}
      </div>
      {historico.length > 3 && (
        <button
          type="button"
          onClick={onVerTodoHistorico}
          className="mt-4 w-full cursor-pointer rounded-xl py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
        >
          Ver todo histórico
        </button>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const { historico, loading: historicoLoading, estatisticas } = useHistorico(usuario?.id)
  const { agendamentos, loading: agendamentosLoading } = useAgendamentos()
  const [dataAtual, setDataAtual] = useState('')
  const isLoading = authLoading || historicoLoading || agendamentosLoading

  useEffect(() => {
    const hoje = new Date()
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    setDataAtual(`${diasSemana[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`)
  }, [])

  return (
    <DashboardLayout loading={isLoading} loadingMessage="Carregando painel...">
      <PageHeader title="Painel" subtitle={dataAtual} />
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de treinos" value={estatisticas.totalTreinos} sub="Desde o início" icon={<i className="fa-solid fa-dumbbell" />} />
        <StatCard
          label="Esta semana"
          value={historico.filter((t) => {
            const umaSemana = 7 * 24 * 60 * 60 * 1000
            const dataExecucao = parseDateTime(t.data_execucao)?.getTime() ?? 0
            return Date.now() - dataExecucao <= umaSemana
          }).length}
          sub="Últimos 7 dias"
          icon={<i className="fa-solid fa-calendar" />}
        />
        <StatCard label="Total de exercícios" value={estatisticas.totalExercicios} sub="Concluídos" icon={<i className="fa-solid fa-chart-line" />} />
        <StatCard label="Duração média" value={estatisticas.duracaoMedia} sub="Por treino" icon={<i className="fa-solid fa-hourglass" />} />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TreinoDeHojeCard agendamentos={agendamentos} onVerExercicios={(id) => id && navigate(`/treinos/visualizar/${id}`)} />
        <AtividadeRecenteCard historico={historico} onVerTodoHistorico={() => navigate('/historico')} />
      </div>
    </DashboardLayout>
  )
}
