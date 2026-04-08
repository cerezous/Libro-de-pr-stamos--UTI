import { useState } from 'react'
import { BotonNuevoUso, NuevoUsoForm } from '../components/usos/NuevoUsoForm'
import { UsosTable } from '../components/usos/UsosTable'

export function UsosPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-8 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Usos</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Registro de usos por cama e insumo (tabla usos en Supabase).
        </p>
      </div>

      <div className="mb-4 flex justify-end">
        <BotonNuevoUso onClick={() => setFormOpen(true)} />
      </div>

      <UsosTable refreshSignal={refreshSignal} />

      <NuevoUsoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          setFormOpen(false)
          setRefreshSignal((n) => n + 1)
        }}
      />
    </div>
  )
}
