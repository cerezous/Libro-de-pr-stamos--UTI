import { type FormEvent, useEffect, useId, useState } from 'react'
import { etiquetaRegistradorRecepcion } from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { supabase } from '../../lib/supabase'
import { TIPOS_SOPORTE } from '../insumos/tiposSoporte'

type InsumoOption = {
  id: string
  codigo_inventario: string
  modelo: string
  tipo_soporte: string
  estado: string
}

type NuevoUsoFormProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NuevoUsoForm({ open, onClose, onSuccess }: NuevoUsoFormProps) {
  const titleId = useId()
  const [insumos, setInsumos] = useState<InsumoOption[]>([])
  const [loadingInsumos, setLoadingInsumos] = useState(false)
  const [idInsumo, setIdInsumo] = useState('')
  const [cama, setCama] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [registradorEtiqueta, setRegistradorEtiqueta] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setFormError(null)
    setIdInsumo('')
    setCama('')
    setObservaciones('')
    setRegistradorEtiqueta(null)
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setRegistradorEtiqueta(await etiquetaRegistradorRecepcion(supabase, user))
    })
    setLoadingInsumos(true)
    void supabase
      .from('insumos')
      .select('id, codigo_inventario, modelo, tipo_soporte, estado')
      .eq('estado', 'disponible')
      .in('tipo_soporte', [...TIPOS_SOPORTE])
      .then(({ data, error }) => {
        if (cancelled) return
        setLoadingInsumos(false)
        if (error) {
          setFormError(error.message)
          setInsumos([])
          return
        }
        const rows = (data ?? []) as InsumoOption[]
        rows.sort((a, b) => a.codigo_inventario.localeCompare(b.codigo_inventario))
        setInsumos(rows)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!idInsumo.trim()) {
      setFormError('Selecciona un soporte del inventario.')
      return
    }

    setSaving(true)
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      setSaving(false)
      setFormError('Debes iniciar sesión para registrar un uso.')
      return
    }

    const iid = idInsumo.trim()
    const { error: insErr } = await supabase.from('usos').insert({
      id_insumo: iid,
      id_klgo: user.id,
      cama: cama.trim() ? cama.trim() : null,
      observaciones: observaciones.trim() ? observaciones.trim() : null,
    })

    if (insErr) {
      setSaving(false)
      setFormError(insErr.message)
      return
    }

    const { error: estErr } = await supabase.from('insumos').update({ estado: 'en_uso' }).eq('id', iid)
    setSaving(false)
    if (estErr) {
      setFormError(
        `El uso quedó registrado, pero no se actualizó el estado del equipo en el catálogo: ${estErr.message}`,
      )
      onSuccess()
      return
    }
    onSuccess()
  }

  if (!open) return null

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30'
  const labelClass = 'mb-1.5 block text-xs font-medium text-zinc-400'
  const selectClass = `${inputClass} appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 grid max-h-[calc(100svh-1.5rem)] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="border-b border-white/5 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <h2 id={titleId} className="text-lg font-semibold text-white">
            Nuevo uso
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Registra el soporte que se utiliza en cama. El kinesiólogo queda asociado por tu sesión (id Klgo).
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden"
        >
          <div className="overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
              <h3 className="text-sm font-semibold text-emerald-100/95">Soporte (inventario)</h3>
              <p className="mt-1 text-xs text-zinc-400">Solo soportes disponibles de los tipos habituales (VMI, VMNI, etc.).</p>
              <label htmlFor="nuevo-uso-insumo" className={`${labelClass} mt-4`}>
                Soporte *
              </label>
              {loadingInsumos ? (
                <p className="text-sm text-zinc-500">Cargando insumos…</p>
              ) : (
                <select
                  id="nuevo-uso-insumo"
                  required
                  className={selectClass}
                  value={idInsumo}
                  onChange={(e) => setIdInsumo(e.target.value)}
                >
                  <option value="">Selecciona un soporte</option>
                  {insumos.map((row) => (
                    <option key={row.id} value={row.id}>
                      {`${row.modelo} (${codigoInventarioSeisDigitos(row.codigo_inventario)})`}
                    </option>
                  ))}
                </select>
              )}
              {insumos.length === 0 && !loadingInsumos ? (
                <p className="mt-2 text-xs text-amber-200/90">No hay soportes disponibles. Revisa inventario o devoluciones.</p>
              ) : null}
            </div>

            <label htmlFor="nuevo-uso-cama" className={`${labelClass} mt-6`}>
              Cama / sector
            </label>
            <input
              id="nuevo-uso-cama"
              className={inputClass}
              value={cama}
              onChange={(e) => setCama(e.target.value)}
              placeholder="Opcional"
              autoComplete="off"
            />

            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500">Kinesiólogo que instala euqipo
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">
                {registradorEtiqueta ?? 'Cargando…'}
              </p>
            </div>

            <label htmlFor="nuevo-uso-obs" className={`${labelClass} mt-4`}>
              Observaciones
            </label>
            <textarea
              id="nuevo-uso-obs"
              rows={3}
              className={`${inputClass} resize-y`}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
            />

            {formError ? (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 px-5 py-4 sm:px-6">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || loadingInsumos}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Registrar uso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Mismo estilo que «Agregar insumo» en el catálogo. */
export function BotonNuevoUso({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-600/90 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-base leading-none">
        +
      </span>
      Nuevo uso
    </button>
  )
}
