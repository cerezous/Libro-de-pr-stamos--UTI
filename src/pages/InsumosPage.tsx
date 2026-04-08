import { InsumosTable } from '../components/insumos/InsumosTable'

export function InsumosPage() {
  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-8 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Catálogo</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Catálogo de insumos: tipo de soporte, identificación MINSAL y estado operativo.
        </p>
      </div>
      <InsumosTable />
    </div>
  )
}
