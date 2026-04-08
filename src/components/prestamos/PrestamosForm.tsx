import { type FormEvent, useEffect, useId, useState } from 'react'
import { ESTADO_PRESTAMO_EN_CURSO } from '../../constants/estadoPrestamo'
import { SERVICIOS_PRESTAMO } from '../../constants/serviciosPrestamo'
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

type PrestamosFormProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PrestamosForm({ open, onClose, onSuccess }: PrestamosFormProps) {
  const titleId = useId()
  const [insumos, setInsumos] = useState<InsumoOption[]>([])
  const [loadingInsumos, setLoadingInsumos] = useState(false)
  /** Uno o varios soportes inventariados en el mismo acto de préstamo. */
  const [insumoIds, setInsumoIds] = useState<string[]>([])
  const [servicio, setServicio] = useState('')
  const [cama, setCama] = useState('')
  const [klgoSolicitante, setKlgoSolicitante] = useState('')
  const [otrosInsumos, setOtrosInsumos] = useState<string[]>(() => ['', '', ''])
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
    setInsumoIds([])
    setServicio('')
    setCama('')
    setKlgoSolicitante('')
    setOtrosInsumos(['', '', ''])
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
    const lineasOtros = otrosInsumos.map((t) => t.trim()).filter(Boolean)
    if (insumoIds.length === 0 && lineasOtros.length === 0) {
      setFormError('Elige uno o más soportes del listado o escribe al menos un otro insumo.')
      return
    }
    if (!servicio.trim()) {
      setFormError('Selecciona un servicio de la lista.')
      return
    }

    setSaving(true)
    const fecha = new Date().toISOString()

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      setSaving(false)
      setFormError('Debes iniciar sesión para registrar un préstamo.')
      return
    }

    const primerInsumo = insumoIds[0] ?? null
    const { data: prest, error: insErr } = await supabase
      .from('prestamos')
      .insert({
        id_insumo: primerInsumo,
        id_prestador: user.id,
        fecha_prestamo: fecha,
        servicio_prestamo: servicio.trim(),
        cama_prestamo: cama.trim() ? cama.trim() : null,
        klgo_solicitante: klgoSolicitante.trim() || null,
        observaciones: observaciones.trim() ? observaciones.trim() : null,
        estado: ESTADO_PRESTAMO_EN_CURSO,
        fecha_devolucion: null,
        klgo_devuelve: null,
      })
      .select('id')
      .single()

    if (insErr) {
      setSaving(false)
      setFormError(insErr.message)
      return
    }

    const pid = prest?.id as string | undefined
    if (pid && insumoIds.length > 0) {
      const { error: piErr } = await supabase.from('prestamos_insumos').insert(
        insumoIds.map((id_insumo, orden) => ({
          prestamo_id: pid,
          id_insumo,
          orden,
        })),
      )
      if (piErr) {
        setSaving(false)
        setFormError(
          `El préstamo quedó registrado, pero no se pudieron vincular todos los soportes: ${piErr.message}`,
        )
        onSuccess()
        return
      }
    }

    let upErr: { message: string } | null = null
    for (const iid of insumoIds) {
      const { error } = await supabase.from('insumos').update({ estado: 'prestado' }).eq('id', iid)
      if (error) upErr = error
    }

    if (!upErr && lineasOtros.length > 0 && prest?.id) {
      const { error: otErr } = await supabase.from('prestamos_otros_insumos').insert(
        lineasOtros.map((descripcion, orden) => ({
          prestamo_id: prest.id,
          descripcion,
          orden,
        })),
      )
      if (otErr) {
        setSaving(false)
        setFormError(`El préstamo quedó registrado, pero no se pudieron guardar otros insumos: ${otErr.message}`)
        onSuccess()
        return
      }
    }

    setSaving(false)

    if (upErr && insumoIds.length > 0) {
      setFormError(
        'El préstamo se guardó, pero no se pudo actualizar el estado del insumo. Revisa la lista de insumos.',
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
            Nuevo préstamo
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Puedes prestar uno o varios soportes del listado, solo otros insumos (sin etiqueta) o ambos.
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden"
        >
          <div className="overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
              <h3 className="text-sm font-semibold text-emerald-100/95">
                Soporte ventilatorio, respiratorio o Aerogen
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                Puedes sumar varios equipos al mismo préstamo. Opcional si el préstamo es solo de otros insumos
                (sin etiqueta).
              </p>
              <label htmlFor="insumo-select-add" className={`${labelClass} mt-4`}>
                Agregar soporte (inventario)
              </label>
              {loadingInsumos ? (
                <p className="text-sm text-zinc-500">Cargando insumos…</p>
              ) : (
                <select
                  id="insumo-select-add"
                  className={selectClass}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    setInsumoIds((prev) => (prev.includes(v) ? prev : [...prev, v]))
                    e.target.value = ''
                  }}
                >
                  <option value="">Elegir para agregar a la lista…</option>
                  {insumos
                    .filter((row) => !insumoIds.includes(row.id))
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {`${row.modelo} (${codigoInventarioSeisDigitos(row.codigo_inventario)})`}
                      </option>
                    ))}
                </select>
              )}
              {insumoIds.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {insumoIds.map((iid) => {
                    const row = insumos.find((x) => x.id === iid)
                    const label = row
                      ? `${row.modelo} (${codigoInventarioSeisDigitos(row.codigo_inventario)})`
                      : iid
                    return (
                      <li
                        key={iid}
                        className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100"
                      >
                        <span className="min-w-0 flex-1 whitespace-normal break-words">{label}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10"
                          onClick={() => setInsumoIds((prev) => prev.filter((x) => x !== iid))}
                        >
                          Quitar
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Ningún soporte con etiqueta aún — o usa solo «otros insumos».</p>
              )}
              {insumos.length === 0 && !loadingInsumos ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  No hay insumos disponibles de estos tipos. Agrega o devuelve insumos primero.
                </p>
              ) : null}
            </div>

            <h3 className="mt-6 text-sm font-semibold text-zinc-200">Datos del préstamo</h3>

            <label htmlFor="pf-servicio" className={`${labelClass} mt-3`}>
              Servicio *
            </label>
            <select
              id="pf-servicio"
              required
              className={selectClass}
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
            >
              <option value="">Selecciona un servicio</option>
              {SERVICIOS_PRESTAMO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <label htmlFor="pf-cama" className={`${labelClass} mt-4`}>
              Cama/Sector
            </label>
            <input
              id="pf-cama"
              className={inputClass}
              value={cama}
              onChange={(e) => setCama(e.target.value)}
              placeholder="Opcional"
              autoComplete="off"
            />

            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500">Entrega del préstamo</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">
                {registradorEtiqueta ?? 'Cargando…'}
              </p>
            </div>

            <label htmlFor="pf-klgo-solic" className={`${labelClass} mt-4`}>
              Personal que solicita
            </label>
            <input
              id="pf-klgo-solic"
              className={inputClass}
              value={klgoSolicitante}
              onChange={(e) => setKlgoSolicitante(e.target.value)}
              placeholder="Nombre de quien solicita"
              inputMode="decimal"
              autoComplete="off"
            />

            <div className="relative mt-6 rounded-xl border border-white/10 bg-zinc-950/50 p-4 pb-14">
              <h3 className="text-sm font-semibold text-zinc-200">Agregar otros insumos</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Insumos sin etiqueta (tapas, arnés, mascarillas, etc.). Si no elegiste soporte arriba, completa al
                menos una línea aquí.
              </p>
              <div className="mt-3 space-y-2">
                {otrosInsumos.map((valor, i) => (
                  <input
                    key={i}
                    type="text"
                    className={inputClass}
                    value={valor}
                    onChange={(e) => {
                      const v = e.target.value
                      setOtrosInsumos((prev) => {
                        const n = [...prev]
                        n[i] = v
                        return n
                      })
                    }}
                    placeholder={`Insumo ${i + 1}`}
                    autoComplete="off"
                  />
                ))}
              </div>
              <button
                type="button"
                className="absolute bottom-3 right-3 rounded-full border border-emerald-500/40 bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                onClick={() => setOtrosInsumos((prev) => [...prev, ''])}
              >
                + Agregar
              </button>
            </div>

            <label htmlFor="pf-obs" className={`${labelClass} mt-6`}>
              Observaciones
            </label>
            <textarea
              id="pf-obs"
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
              {saving ? 'Guardando…' : 'Registrar préstamo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Mismo estilo que «Agregar insumo» / «Nuevo uso». */
export function BotonNuevoPrestamo({
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
      Nuevo préstamo
    </button>
  )
}
