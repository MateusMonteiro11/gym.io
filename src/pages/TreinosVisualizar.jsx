import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

import Card from '../components/ui/Card'
import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'
import { buscarTreinoCompleto } from '../services/treinos/treinosService'
import { getWorkoutCounts } from '../utils/trainingDiscovery'
import { ui } from '../styles/theme'

function SectionCard({ section }) {
  const exercises = section.treinos_exercicios || []

  return (
    <Card hover={false} className="min-w-0 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Seção</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{section.nome}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
          {exercises.length} {exercises.length === 1 ? 'exercício' : 'exercícios'}
        </span>
      </div>
      {exercises.length > 0 ? (
        <ul className="space-y-3">
          {exercises.map((item) => (
            <li key={item.id_treino_exercicio} className="min-w-0 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
              <p className="font-medium text-slate-900 dark:text-white">{item.exercicios?.nome}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {item.series || 4} séries • {item.repeticoes || 12} reps
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum exercício nesta seção.</p>
      )}
    </Card>
  )
}

export default function TreinosVisualizar() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const fromTraining = location.state?.from === '/treinar'
  const [treino, setTreino] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function carregarTreino() {
      setLoading(true)
      setTreino(null)
      try {
        const data = await buscarTreinoCompleto(id)
        if (active) setTreino(data)
      } catch (error) {
        if (active) console.error(error)
      } finally {
        if (active) setLoading(false)
      }
    }

    carregarTreino()
    return () => { active = false }
  }, [id])

  const backLink = (
    <Link
      to={fromTraining ? '/treinar' : '/treinos'}
      state={fromTraining ? { catalogSelection: location.state.catalogSelection } : undefined}
      onClick={(event) => {
        if (fromTraining && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault()
          navigate(-1)
        }
      }}
      className={`${ui.btnSecondary} min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Voltar
    </Link>
  )
  const { exerciseCount, sectionCount } = getWorkoutCounts(treino)

  return (
    <PageLoadingBoundary loading={loading} loadingMessage="Carregando treino...">
      {!treino ? (
        <div className="space-y-5 py-12 text-center">
          <p className="text-slate-600 dark:text-slate-300">Não foi possível encontrar este treino.</p>
          {backLink}
        </div>
      ) : (
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">Visualizar treino</p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{treino.nome}</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Estrutura completa do treino.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              {backLink}
              {treino.tipo?.toLowerCase() !== 'sistema' && (
                <Link to={`/treinos/editar/${id}`} className={`${ui.btnPrimary} min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}>
                  Editar treino
                </Link>
              )}
            </div>
          </header>

          <section aria-label="Resumo do treino" className="mb-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card hover={false} className="min-w-0 p-5 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {treino.tipo === 'sistema' ? 'Treino do sistema' : 'Personalizado'}
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">Sobre este treino</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                {treino.descricao || 'Este treino não possui descrição.'}
              </p>
            </Card>
            <Card hover={false} className="min-w-0 p-5 sm:p-8">
              <h2 className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Resumo</h2>
              <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">
                {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
              </p>
            </Card>
          </section>

          <section aria-labelledby="workout-structure-title" className="grid min-w-0 gap-5">
            <h2 id="workout-structure-title" className="text-xl font-semibold text-slate-900 dark:text-white">Exercícios por seção</h2>
            {treino.secoes_treino?.map((section) => <SectionCard key={section.id_secao} section={section} />)}
            {sectionCount === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Este treino ainda não possui seções.</p>}
          </section>
        </div>
      )}
    </PageLoadingBoundary>
  )
}
