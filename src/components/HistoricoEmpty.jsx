export default function HistoricoEmpty() {
  return (
    <div className="bg-white border rounded-2xl p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <i className="fa-regular fa-clock text-2xl text-gray-400"></i>
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        Nenhum treino realizado ainda
      </h3>

      <p className="text-gray-400 text-sm">
        Comece a treinar para ver o seu histórico aqui!
      </p>
    </div>
  )
}
