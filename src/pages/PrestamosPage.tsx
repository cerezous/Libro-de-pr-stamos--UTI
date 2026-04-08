import { useState } from 'react'
import { PrestamosDevolverForm } from '../components/prestamos/PrestamosDevolverForm'
import { BotonNuevoPrestamo, PrestamosForm } from '../components/prestamos/PrestamosForm'
import { PrestamosTable, type PrestamoRow } from '../components/prestamos/PrestamosTable'

export function PrestamosPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [devolverOpen, setDevolverOpen] = useState(false)
  const [devolverPrestamo, setDevolverPrestamo] = useState<PrestamoRow | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-8 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Préstamos</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Registro de préstamos y devoluciones de insumos por servicio y cama.
        </p>
      </div>

      <div className="mb-4 flex justify-end">
        <BotonNuevoPrestamo onClick={() => setFormOpen(true)} />
      </div>

      <PrestamosTable
        refreshSignal={refreshSignal}
        onDevolver={(row) => {
          setDevolverPrestamo(row)
          setDevolverOpen(true)
        }}
      />

      <PrestamosForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          setFormOpen(false)
          setRefreshSignal((n) => n + 1)
        }}
      />

      <PrestamosDevolverForm
        open={devolverOpen}
        prestamo={devolverPrestamo}
        onClose={() => {
          setDevolverOpen(false)
          setDevolverPrestamo(null)
        }}
        onSuccess={() => {
          setDevolverOpen(false)
          setDevolverPrestamo(null)
          setRefreshSignal((n) => n + 1)
        }}
      />
    </div>
  )
}
