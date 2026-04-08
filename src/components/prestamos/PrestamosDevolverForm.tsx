import { type FormEvent, useCallback, useEffect, useId, useState } from 'react'
import { ESTADO_PRESTAMO_PARCIAL } from '../../constants/estadoPrestamo'
import {
  etiquetaRegistradorRecepcion,
  klgoDesdeMetadataUsuario,
  mensajeErrorDesconocido,
} from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { lineasInventariadoPrestamo } from '../../lib/prestamosLineasInventario'
import { supabase } from '../../lib/supabase'
import { AppleSwitch } from './AppleSwitch'
import type { PrestamoRow } from './PrestamosTable'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  prestamo: PrestamoRow | null
}

type ReturnedState = {
  insumosIds: Set<string>
  otrosIds: Set<string>
}

export function PrestamosDevolverForm({ open, onClose, onSuccess, prestamo }: Props) {
  const titleId = useId()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [returned, setReturned] = useState<ReturnedState>({ insumosIds: new Set(), otrosIds: new Set() })
  const [selInsumos, setSelInsumos] = useState<Record<string, boolean>>({})
  const [selOtros, setSelOtros] = useState<Record<string, boolean>>({})
  const [kinesiologoDevuelve, setKinesiologoDevuelve] = useState('')
  const [registradorEtiqueta, setRegistradorEtiqueta] = useState<string | null>(null)

  const loadReturned = useCallback(async (pid: string, idsInventariados: string[]) => {
    const { data, error: qe } = await supabase
      .from('prestamos_devoluciones_items')
      .select('id_insumo, prestamos_otros_insumos_id')
      .eq('prestamo_id', pid)
    if (qe) throw new Error(qe.message ?? 'Error al cargar devoluciones previas.')
    const insumosIds = new Set<string>()
    const otrosIds = new Set<string>()
    const invSet = new Set(idsInventariados)
    for (const r of data ?? []) {
      const idi = r.id_insumo as string | null
      if (idi && invSet.has(idi)) insumosIds.add(idi)
      if (r.prestamos_otros_insumos_id) otrosIds.add(r.prestamos_otros_insumos_id as string)
    }
    setReturned({ insumosIds, otrosIds })
  }, [])

  useEffect(() => {
    if (!open || !prestamo) return
    let a = true
    setError(null)
    setSelInsumos({})
    setSelOtros({})
    setKinesiologoDevuelve('')
    setRegistradorEtiqueta(null)
    setLoading(true)
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setRegistradorEtiqueta(await etiquetaRegistradorRecepcion(supabase, user))
    })
    const idsInv = lineasInventariadoPrestamo(prestamo).map((l) => l.id_insumo)
    void loadReturned(prestamo.id, idsInv)
      .catch((e: unknown) => {
        if (!a) return
        setError(mensajeErrorDesconocido(e))
      })
      .finally(() => {
        if (a) setLoading(false)
      })
    return () => {
      a = false
    }
  }, [open, prestamo, loadReturned])

  if (!open || !prestamo) return null

  const lineasInv = lineasInventariadoPrestamo(prestamo)
  const otrosRows = [...(prestamo.prestamos_otros_insumos ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .filter((o) => o.id && o.descripcion.trim())

  const pendientesInv = lineasInv.filter((l) => !returned.insumosIds.has(l.id_insumo))
  const otrosPendientes = otrosRows.filter((o) => !returned.otrosIds.has(o.id))

  const hayPendientes = pendientesInv.length > 0 || otrosPendientes.length > 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const p = prestamo
    if (!p) return
    setError(null)
    const kine = kinesiologoDevuelve.trim()
    if (!kine) {
      setError('Indica el kinesiólogo que devuelve.')
      return
    }

    const invSeleccionados = pendientesInv.filter((l) => selInsumos[l.id_insumo])
    const otrosSeleccionados = otrosPendientes.filter((o) => selOtros[o.id])
    if (invSeleccionados.length === 0 && otrosSeleccionados.length === 0) {
      setError('Selecciona al menos un insumo que se devuelve en este acto.')
      return
    }

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      setError('Debes iniciar sesión para registrar la devolución.')
      return
    }

    setSaving(true)

    const klgoRecepcionMeta = klgoDesdeMetadataUsuario(user)

    const { data: devRow, error: devErr } = await supabase
      .from('prestamos_devoluciones')
      .insert({
        prestamo_id: p.id,
        id_recibidor: user.id,
        klgo_recibe: klgoRecepcionMeta,
        kinesiologo_devuelve: kine,
        id_registrador: user.id,
      })
      .select('id')
      .single()

    if (devErr || !devRow) {
      setSaving(false)
      setError(devErr ? mensajeErrorDesconocido(devErr) : 'No se pudo guardar la devolución.')
      return
    }

    const devolucionId = devRow.id as string
    const items: {
      prestamo_id: string
      devolucion_id: string
      id_insumo: string | null
      prestamos_otros_insumos_id: string | null
    }[] = []

    for (const l of invSeleccionados) {
      items.push({
        prestamo_id: p.id,
        devolucion_id: devolucionId,
        id_insumo: l.id_insumo,
        prestamos_otros_insumos_id: null,
      })
    }
    for (const o of otrosSeleccionados) {
      items.push({
        prestamo_id: p.id,
        devolucion_id: devolucionId,
        id_insumo: null,
        prestamos_otros_insumos_id: o.id,
      })
    }

    const { error: itErr } = await supabase.from('prestamos_devoluciones_items').insert(items)
    if (itErr) {
      await supabase.from('prestamos_devoluciones').delete().eq('id', devolucionId)
      setSaving(false)
      setError(mensajeErrorDesconocido(itErr))
      return
    }

    for (const l of invSeleccionados) {
      await supabase.from('insumos').update({ estado: 'disponible' }).eq('id', l.id_insumo)
    }

    const ahoraInsumos = new Set(returned.insumosIds)
    for (const l of invSeleccionados) ahoraInsumos.add(l.id_insumo)
    const ahoraOtros = new Set(returned.otrosIds)
    for (const o of otrosSeleccionados) ahoraOtros.add(o.id)
    const todosOtrosOk = otrosRows.length === 0 || otrosRows.every((o) => ahoraOtros.has(o.id))
    const todosInvOk = lineasInv.length === 0 || lineasInv.every((l) => ahoraInsumos.has(l.id_insumo))
    const completo = todosInvOk && todosOtrosOk

    const fechaIso = new Date().toISOString()
    if (completo) {
      await supabase
        .from('prestamos')
        .update({
          estado: 'devuelto',
          fecha_devolucion: fechaIso,
          id_recibidor: user.id,
          klgo_devuelve: null,
        })
        .eq('id', p.id)
    } else {
      await supabase
        .from('prestamos')
        .update({
          estado: ESTADO_PRESTAMO_PARCIAL,
          fecha_devolucion: null,
        })
        .eq('id', p.id)
    }

    setSaving(false)
    onSuccess()
  }

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30'
  const labelClass = 'mb-1.5 block text-xs font-medium text-zinc-400'

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 grid max-h-[calc(100svh-1.5rem)] w-full max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="border-b border-white/5 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <h2 id={titleId} className="text-lg font-semibold text-white">
            Registrar devolución
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Préstamo {prestamo.numero_publico != null ? `#${String(prestamo.numero_publico)}` : ''} · Puedes
            devolver solo parte de los ítems; cada registro queda guardado con quien recepciona y quien entrega.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="grid min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden">
          <div className="overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            {loading ? (
              <p className="text-sm text-zinc-500">Cargando…</p>
            ) : !hayPendientes ? (
              <p className="text-sm text-amber-200/90">
                No quedan insumos pendientes de devolver en este préstamo.
              </p>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Insumos a devolver ahora</p>
                <ul className="mt-3 space-y-3">
                  {pendientesInv.map((l) => (
                    <li
                      key={l.id_insumo}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500">Soporte (inventario)</p>
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {l.insumos.modelo?.trim() || l.insumos.tipo_soporte?.trim() || '—'}
                        </p>
                        <p className="font-mono text-xs tabular-nums text-emerald-400/90">
                          ({codigoInventarioSeisDigitos(l.insumos.codigo_inventario)})
                        </p>
                      </div>
                      <AppleSwitch
                        label={`Devolver ${l.insumos.modelo?.slice(0, 24) ?? 'soporte'}`}
                        checked={Boolean(selInsumos[l.id_insumo])}
                        onCheckedChange={(v) => setSelInsumos((prev) => ({ ...prev, [l.id_insumo]: v }))}
                      />
                    </li>
                  ))}
                  {otrosPendientes.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-500">Otro insumo</p>
                        <p className="text-sm text-zinc-200">{o.descripcion.trim()}</p>
                      </div>
                      <AppleSwitch
                        label={`Devolver ${o.descripcion.slice(0, 40)}`}
                        checked={Boolean(selOtros[o.id])}
                        onCheckedChange={(v) => setSelOtros((prev) => ({ ...prev, [o.id]: v }))}
                      />
                    </li>
                  ))}
                </ul>

                <h3 className="mt-6 text-sm font-semibold text-zinc-200">Quién interviene en este acto</h3>

                <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Recepción de la devolución
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">
                    {registradorEtiqueta ?? 'Cargando…'}
                  </p>
                </div>

                <label htmlFor="pd-kine" className={`${labelClass} mt-4`}>
                  Personal que devuelve *
                </label>
                <input
                  id="pd-kine"
                  className={inputClass}
                  value={kinesiologoDevuelve}
                  onChange={(e) => setKinesiologoDevuelve(e.target.value)}
                  placeholder="Nombre de quien devuelve el o los insumos"
                  autoComplete="off"
                  required
                />
              </>
            )}

            {error ? (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
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
              disabled={saving || loading || !hayPendientes}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Confirmar devolución'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
