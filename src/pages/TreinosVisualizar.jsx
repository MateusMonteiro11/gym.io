import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'

import {
  buscarTreinoCompleto
} from '../services/treinos/treinosService'

function SectionCard({ section }) {

  return (

    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">

      <div className="flex items-start justify-between gap-4 mb-4">

        <div>

          <p className="text-sm text-slate-600 uppercase tracking-[0.18em]">
            Seção
          </p>

          <h3 className="text-xl font-semibold mt-2">
            {section.nome}
          </h3>

        </div>

        <span className="text-xs text-slate-600 bg-slate-50 rounded-full px-3 py-1">

          {section.treinos_exercicios?.length || 0}
          {' '}
          exercícios

        </span>

      </div>

      <div className="space-y-3">

        {section.treinos_exercicios?.map(
          (item) => (

            <div
              key={item.id_treino_exercicio}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3"
            >

              <div>

                <p className="font-medium">
                  {item.exercicios?.nome}
                </p>

                <p className="text-xs text-slate-600">

                  {item.series || 4} séries •{' '}
                  {item.repeticoes || 12} reps

                </p>

              </div>

            </div>

          )
        )}

      </div>

    </div>

  )
}

export default function TreinosVisualizar() {

  const { id } = useParams()

  const [treino, setTreino] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    let active = true

    async function carregarTreino() {
      setLoading(true)
      setTreino(null)

      try {

        const data =
          await buscarTreinoCompleto(id)

        if (active) setTreino(data)

      } catch (error) {

        if (active) console.error(error)

      } finally {

        if (active) setLoading(false)
      }
    }

    carregarTreino()

    return () => {
      active = false
    }

  }, [id])

  if (loading) {
    return <PageLoadingBoundary loading loadingMessage="Carregando treino..." />
  }

  if (!treino) {

    return (

      <div className="min-h-screen flex items-center justify-center">
        Treino não encontrado.
      </div>

    )
  }
  return (
    <PageLoadingBoundary loading={loading} loadingMessage="Carregando treino...">

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <p className="text-sm text-primary font-semibold">
              Visualizar treino
            </p>

            <h1 className="text-3xl font-bold mt-3">
              {treino.nome}
            </h1>

            <p className="text-slate-600 mt-2">
              Estrutura completa do treino.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              to="/treinos"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voltar
            </Link>

            {treino.tipo?.toLowerCase() !== 'sistema' && (
              <Link
                to={`/treinos/editar/${id}`}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Editar treino
              </Link>
            )}

          </div>

        </div>

        <section className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">

          <div className="min-w-0 rounded-[2rem] bg-white p-8 shadow-sm border border-slate-200">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-sm text-slate-600">
                  Plano ativo
                </p>

                <h2 className="text-2xl font-semibold mt-3">
                  {treino.nome}
                </h2>

                <p className="text-slate-600 mt-2">
                  {treino.descricao ||
                    'Treino personalizado'}
                </p>

              </div>

            </div>

          </div>

          <div className="min-w-0 rounded-[2rem] bg-white p-8 shadow-sm border border-slate-200">

            <p className="text-sm text-slate-600 uppercase tracking-[0.18em]">
              Resumo
            </p>

            <p className="mt-4 text-3xl font-semibold">

              {treino.secoes_treino?.length || 0}
              {' '}
              seções

            </p>

          </div>

        </section>

        <section className="grid gap-6">

          {treino.secoes_treino?.map(
            (section) => (

              <SectionCard
                key={section.id_secao}
                section={section}
              />

            )
          )}

        </section>
    </PageLoadingBoundary>
  )
}
