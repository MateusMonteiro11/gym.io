// TreinosVisualizar.jsx

import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

import Sidebar from '../components/Sidebar'

import {
  buscarTreinoCompleto
} from '../services/treinos/treinosService'

function SectionCard({ section }) {

  return (

    <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">

      <div className="flex items-start justify-between gap-4 mb-4">

        <div>

          <p className="text-sm text-gray-400 uppercase tracking-[0.18em]">
            Seção
          </p>

          <h3 className="text-xl font-semibold mt-2">
            {section.nome}
          </h3>

        </div>

        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">

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
              className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 p-3"
            >

              <div>

                <p className="font-medium">
                  {item.exercicios?.nome}
                </p>

                <p className="text-xs text-gray-400">

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

    async function carregarTreino() {

      try {

        const data =
          await buscarTreinoCompleto(id)

        setTreino(data)

      } catch (error) {

        console.error(error)

      } finally {

        setLoading(false)
      }
    }

    carregarTreino()

  }, [id])

  if (loading) {

    return (

      <div className="min-h-screen flex items-center justify-center">
        Carregando treino...
      </div>

    )
  }

  if (!treino) {

    return (

      <div className="min-h-screen flex items-center justify-center">
        Treino não encontrado.
      </div>

    )
  }

  return (

    <div className="flex min-h-screen bg-gray-100">

      <Sidebar />

      <main className="flex-1 p-8">

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm text-blue-600 font-semibold">
              Visualizar treino
            </p>

            <h1 className="text-3xl font-bold mt-3">
              {treino.nome}
            </h1>

            <p className="text-gray-400 mt-2">
              Estrutura completa do treino.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              to="/treinos"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
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

        <section className="mb-10 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">

          <div className="rounded-[2rem] bg-white p-8 shadow-sm border border-gray-200">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-sm text-gray-400">
                  Plano ativo
                </p>

                <h2 className="text-2xl font-semibold mt-3">
                  {treino.nome}
                </h2>

                <p className="text-gray-500 mt-2">
                  {treino.descricao ||
                    'Treino personalizado'}
                </p>

              </div>

            </div>

          </div>

          <div className="rounded-[2rem] bg-white p-8 shadow-sm border border-gray-200">

            <p className="text-sm text-gray-500 uppercase tracking-[0.18em]">
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

      </main>

    </div>

  )
}