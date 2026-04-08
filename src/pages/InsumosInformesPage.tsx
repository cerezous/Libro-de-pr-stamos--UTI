import { useState } from 'react'
import { BotonNuevoInforme, InformesInsumosTable } from '../components/insumos/InformesInsumosTable'
import { NuevoInformeModal } from '../components/insumos/NuevoInformeModal'

export function InsumosInformesPage() {
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [modalInformeOpen, setModalInformeOpen] = useState(false)

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-8 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Informes</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Informes semanal del inventario ventilatorio de UTI 2° Piso. Presiona nuevo informe para generar tu reporte.
        </p>
      </div>

      <div className="mb-4 flex justify-end">
        <BotonNuevoInforme onClick={() => setModalInformeOpen(true)} />
      </div>

      <InformesInsumosTable refreshSignal={refreshSignal} />

      <NuevoInformeModal
        open={modalInformeOpen}
        onClose={() => setModalInformeOpen(false)}
        onGuardado={() => setRefreshSignal((n) => n + 1)}
      />
    </div>
  )
}
