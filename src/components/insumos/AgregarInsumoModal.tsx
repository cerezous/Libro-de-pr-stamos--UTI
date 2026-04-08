import { useEffect, useId, useState } from 'react'
import {
  ESTADOS_INSUMO_EDITABLES,
  type EstadoInsumoValor,
  estadoInsumoGestionadoPorPrestamosUsos,
  etiquetaEstadoInsumo,
  normalizarEstadoInsumoDesdeDb,
} from '../../constants/estadoInsumo'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { supabase } from '../../lib/supabase'
import { TIPOS_SOPORTE, type TipoSoporte } from './tiposSoporte'

/** Datos mínimos para editar (misma forma que la fila de la tabla). */
export type InsumoEditable = {
  id: string
  codigo_inventario: string
  tipo_soporte: string
  modelo: string
  numero: string
  codigo_minsal: string
  detalle: string | null
  estado: string
  fecha_actualizacion_estado?: string | null
  /** Último usuario que actualizó el estado a mantenimiento / fuera de servicio (uuid = usuarios.id). */
  id_actualizacion_estado?: string | null
  no_ubicable?: boolean
  fecha_no_ubicable?: string | null
  id_usuario_no_ubicable?: string | null
}

type AgregarInsumoModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Si viene definido, el modal actualiza ese insumo en lugar de insertar uno nuevo. */
  insumoEditar?: InsumoEditable | null
}

export function AgregarInsumoModal({ open, onClose, onSuccess, insumoEditar = null }: AgregarInsumoModalProps) {
  const esEdicion = insumoEditar != null
  const titleId = useId()
  const noUbicableSwitchId = useId()
  const [tipoSoporte, setTipoSoporte] = useState<string>('VMI')
  const [modelo, setModelo] = useState('')
  const [numero, setNumero] = useState('')
  const [codigoMinsal, setCodigoMinsal] = useState('')
  const [detalle, setDetalle] = useState('')
  const [estado, setEstado] = useState<EstadoInsumoValor>('disponible')
  const [noUbicable, setNoUbicable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (insumoEditar) {
      setTipoSoporte(insumoEditar.tipo_soporte)
      setModelo(insumoEditar.modelo)
      setNumero(insumoEditar.numero)
      setCodigoMinsal(insumoEditar.codigo_minsal)
      setDetalle(insumoEditar.detalle ?? '')
      const estNorm = normalizarEstadoInsumoDesdeDb(insumoEditar.estado)
      setNoUbicable(Boolean(insumoEditar.no_ubicable))
      if (insumoEditar.no_ubicable && estNorm === 'disponible') {
        setEstado('mantenimiento')
      } else {
        setEstado(estNorm)
      }
    } else {
      setTipoSoporte('VMI')
      setModelo('')
      setNumero('')
      setCodigoMinsal('')
      setDetalle('')
      setEstado('disponible')
      setNoUbicable(false)
    }
    setFormError(null)
  }, [open, insumoEditar])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    const base = {
      tipo_soporte: tipoSoporte.trim(),
      modelo: modelo.trim(),
      numero: numero.trim(),
      codigo_minsal: codigoMinsal.trim(),
      detalle: detalle.trim() ? detalle.trim() : null,
    }
    if (esEdicion) {
      if (estado === 'disponible' && noUbicable) {
        setSaving(false)
        setFormError('Desactiva «No ubicable» antes de dejar el equipo en Disponible.')
        return
      }
      const payload: Record<string, unknown> = { ...base, estado }
      const auditManual = estado === 'mantenimiento' || estado === 'fuera_de_servicio'
      const needUser = auditManual || noUbicable
      let userId: string | null = null
      if (needUser) {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser()
        if (userErr || !user) {
          setSaving(false)
          setFormError(userErr?.message ?? 'No hay sesión. Inicia sesión de nuevo.')
          return
        }
        userId = user.id
      }
      if (auditManual) {
        payload.fecha_actualizacion_estado = new Date().toISOString()
        payload.id_actualizacion_estado = userId
      } else {
        payload.fecha_actualizacion_estado = null
        payload.id_actualizacion_estado = null
      }
      payload.no_ubicable = noUbicable
      if (noUbicable) {
        payload.fecha_no_ubicable = new Date().toISOString()
        payload.id_usuario_no_ubicable = userId
      } else {
        payload.fecha_no_ubicable = null
        payload.id_usuario_no_ubicable = null
      }
      const { error } = await supabase.from('insumos').update(payload).eq('id', insumoEditar!.id)
      setSaving(false)
      if (error) {
        setFormError(error.message)
        return
      }
      onSuccess()
      return
    }
    const { error } = await supabase
      .from('insumos')
      .insert({ ...base, estado: 'disponible' as EstadoInsumoValor })
    setSaving(false)
    if (error) {
      setFormError(error.message)
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
        className="relative z-10 grid max-h-[calc(100svh-1.5rem)] w-full max-w-md grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="border-b border-white/5 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <h2 id={titleId} className="text-lg font-semibold text-white">
            {esEdicion ? 'Editar insumo' : 'Agregar insumo'}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {esEdicion
              ? 'Modifica los datos y guarda los cambios. El código de inventario no se puede editar.'
              : 'Completa los datos del nuevo registro.'}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="contents">
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <div>
            <label htmlFor="insumo-tipo" className={labelClass}>
              Tipo de soporte
            </label>
            <select
              id="insumo-tipo"
              value={tipoSoporte}
              onChange={(e) => setTipoSoporte(e.target.value)}
              className={selectClass}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1aa'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
              }}
            >
              {insumoEditar &&
              !TIPOS_SOPORTE.includes(insumoEditar.tipo_soporte as TipoSoporte) ? (
                <option value={insumoEditar.tipo_soporte}>{insumoEditar.tipo_soporte}</option>
              ) : null}
              {TIPOS_SOPORTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {esEdicion && insumoEditar ? (
            <div>
              <span className={labelClass}>Código inventario</span>
              <p className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 font-mono text-sm tabular-nums text-zinc-300">
                {codigoInventarioSeisDigitos(insumoEditar.codigo_inventario)}
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="insumo-modelo" className={labelClass}>
              Modelo
            </label>
            <input
              id="insumo-modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              required
              className={inputClass}
              placeholder="Ej. Puritan Bennett 840"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="insumo-numero" className={labelClass}>
              Número
            </label>
            <input
              id="insumo-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              required
              className={inputClass}
              placeholder="Ej. 12 o S/N"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="insumo-minsal" className={labelClass}>
              Código MINSAL
            </label>
            <input
              id="insumo-minsal"
              value={codigoMinsal}
              onChange={(e) => setCodigoMinsal(e.target.value)}
              required
              className={`${inputClass} font-mono text-xs`}
              placeholder="Ej. 0-70181-20"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="insumo-detalle" className={labelClass}>
              Detalle <span className="font-normal text-zinc-500">(opcional)</span>
            </label>
            <textarea
              id="insumo-detalle"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows={2}
              className={`${inputClass} max-h-32 min-h-[4rem] resize-y`}
              placeholder="Notas u observaciones"
            />
          </div>

          {esEdicion ? (
            <>
              <div>
                <span className={labelClass}>Estado</span>
                {insumoEditar && estadoInsumoGestionadoPorPrestamosUsos(insumoEditar.estado) ? (
                  <>
                    <p className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200">
                      {etiquetaEstadoInsumo(estado)}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                      <span className="text-zinc-400">En uso</span> y{' '}
                      <span className="text-zinc-400">Prestado</span> los actualiza el sistema; no se cambian
                      desde aquí.
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      id="insumo-estado"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value as EstadoInsumoValor)}
                      className={selectClass}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a1a1aa'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                      }}
                    >
                      {ESTADOS_INSUMO_EDITABLES.map(({ value, label }) => (
                        <option key={value} value={value} disabled={noUbicable && value === 'disponible'}>
                          {label}
                          {noUbicable && value === 'disponible' ? ' (desactiva No ubicable)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                      Con el equipo <span className="text-zinc-400">disponible</span> puedes marcarlo en{' '}
                      <span className="text-zinc-400">Mantenimiento</span> o{' '}
                      <span className="text-zinc-400">Fuera de servicio</span>; en caso contrario vuelve a{' '}
                      <span className="text-zinc-400">Disponible</span>.
                      {noUbicable ? (
                        <>
                          {' '}
                          Mientras <span className="text-red-300/90">No ubicable</span> esté activo no puedes elegir
                          Disponible.
                        </>
                      ) : null}
                    </p>
                  </>
                )}
              </div>

              <label
                htmlFor={noUbicableSwitchId}
                className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-3 select-none"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-sm font-medium text-zinc-100">No ubicable</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                    Marca si el equipo no puede localizarse físicamente. Para volver a Disponible, desactiva primero
                    esta opción.
                  </p>
                </div>
                <span className="relative mt-0.5 shrink-0">
                  <input
                    id={noUbicableSwitchId}
                    type="checkbox"
                    role="switch"
                    checked={noUbicable}
                    onChange={(e) => {
                      const next = e.target.checked
                      setNoUbicable(next)
                      if (next && estado === 'disponible') {
                        setEstado('mantenimiento')
                      }
                    }}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="relative block h-8 w-14 rounded-full bg-zinc-600 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-red-500/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950 peer-checked:bg-red-600 after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-md after:transition-transform after:duration-200 after:ease-out after:content-[''] peer-checked:after:translate-x-6"
                  />
                </span>
              </label>
            </>
          ) : (
            <div>
              <span className={labelClass}>Estado</span>
              <p className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200">
                Disponible
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                Los nuevos equipos quedan disponibles para préstamo o uso. En uso y Prestado los marca el sistema
                automáticamente.
              </p>
            </div>
          )}

          {formError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {formError}
            </p>
          ) : null}
          </div>

          <div className="border-t border-white/10 bg-zinc-900/95 px-5 py-4 sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar insumo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BotonAgregarInsumo({
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
      Agregar insumo
    </button>
  )
}
