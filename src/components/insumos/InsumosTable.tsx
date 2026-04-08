import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  nombreCompletoDesdeUsuariosRow,
  nombreCompletoKinesiologoSesion,
  type UsuarioNombreRow,
} from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { abrirImpresionEtiquetaInsumo } from '../../lib/insumoEtiquetaImpresion'
import {
  estadoOperativoDesdeContexto,
  fetchPrestamoActivoPorInsumoIds,
  fetchUsoActivoPorInsumoIds,
  type PrestamoResumenPorInsumo,
  type UsoResumenPorInsumo,
} from '../../lib/insumoOperativo'
import { insumosDbSinColumnasEstadoManual, supabase } from '../../lib/supabase'
import { AgregarInsumoModal, BotonAgregarInsumo } from './AgregarInsumoModal'
import { TIPOS_SOPORTE } from './tiposSoporte'

export type { PrestamoResumenPorInsumo, UsoResumenPorInsumo } from '../../lib/insumoOperativo'

function fmtKlgo(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return String(n)
}

function fmtFechaPrestamo(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} h`
}

function textoCodigoPrestamo(p: { id: string; numero_publico: number | string | null }) {
  const n =
    p.numero_publico === null || p.numero_publico === undefined
      ? NaN
      : typeof p.numero_publico === 'string'
        ? Number(p.numero_publico)
        : p.numero_publico
  if (Number.isFinite(n) && n >= 1 && n <= 999_999) {
    return String(Math.floor(n))
  }
  return p.id
}

export type InsumoRow = {
  id: string
  codigo_inventario: string
  tipo_soporte: string
  modelo: string
  numero: string
  codigo_minsal: string
  detalle: string | null
  estado: string
  /** Última vez que se actualizó a Mantenimiento / Fuera de servicio. */
  fecha_actualizacion_estado: string | null
  /** uuid en usuarios.id — último usuario que actualizó ese estado. */
  id_actualizacion_estado: string | null
  usuario_actualizacion_estado: UsuarioNombreRow | null
  no_ubicable: boolean
  fecha_no_ubicable: string | null
  id_usuario_no_ubicable: string | null
  usuario_no_ubicable: UsuarioNombreRow | null
}

function esEstadoMantenimientoOFueraCatalogo(estado: string) {
  const e = estado.trim().toLowerCase()
  return e === 'mantenimiento' || e === 'fuera_de_servicio' || e === 'baja'
}

function mapInsumoDesdeSupabase(raw: Record<string, unknown>): InsumoRow {
  const idAct =
    (raw.id_actualizacion_estado as string | null | undefined) ??
    (raw.estado_manual_por as string | null | undefined) ??
    null
  const fechaAct =
    (raw.fecha_actualizacion_estado as string | null | undefined) ??
    (raw.estado_manual_at as string | null | undefined) ??
    null
  const nu = raw.no_ubicable
  const noUbicable = typeof nu === 'boolean' ? nu : String(nu).toLowerCase() === 'true'
  return {
    id: raw.id as string,
    codigo_inventario: raw.codigo_inventario as string,
    tipo_soporte: raw.tipo_soporte as string,
    modelo: raw.modelo as string,
    numero: raw.numero as string,
    codigo_minsal: raw.codigo_minsal as string,
    detalle: (raw.detalle as string | null) ?? null,
    estado: raw.estado as string,
    fecha_actualizacion_estado: fechaAct,
    id_actualizacion_estado: idAct,
    usuario_actualizacion_estado: null,
    no_ubicable: noUbicable,
    fecha_no_ubicable: (raw.fecha_no_ubicable as string | null) ?? null,
    id_usuario_no_ubicable: (raw.id_usuario_no_ubicable as string | null) ?? null,
    usuario_no_ubicable: null,
  }
}

function usuarioDesdeMapOsesion(
  id: string | null,
  map: Record<string, UsuarioNombreRow>,
  sessionUser: User | null,
): UsuarioNombreRow | null {
  if (!id) return null
  if (map[id]) return map[id]
  if (sessionUser && id === sessionUser.id) {
    const etiqueta = nombreCompletoKinesiologoSesion(sessionUser)
    return { nombre1: etiqueta, nombre2: null, apellido1: '', apellido2: null }
  }
  return null
}

/** Resuelve nombres para `id_actualizacion_estado` e `id_usuario_no_ubicable`. */
async function enriquecerUsuariosInsumosRows(rows: InsumoRow[]): Promise<InsumoRow[]> {
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.id_actualizacion_estado) ids.add(r.id_actualizacion_estado)
    if (r.id_usuario_no_ubicable) ids.add(r.id_usuario_no_ubicable)
  }
  const porIds = [...ids]
  if (porIds.length === 0) return rows

  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nombre1, nombre2, apellido1, apellido2')
    .in('id', porIds)

  const map: Record<string, UsuarioNombreRow> = {}
  if (!error && usuarios?.length) {
    for (const u of usuarios) {
      const ur = u as { id: string } & UsuarioNombreRow
      map[ur.id] = {
        nombre1: ur.nombre1,
        nombre2: ur.nombre2,
        apellido1: ur.apellido1,
        apellido2: ur.apellido2,
      }
    }
  }

  const { data: authData } = await supabase.auth.getUser()
  const sessionUser = authData?.user ?? null

  return rows.map((r) => ({
    ...r,
    usuario_actualizacion_estado: usuarioDesdeMapOsesion(
      r.id_actualizacion_estado,
      map,
      sessionUser,
    ),
    usuario_no_ubicable: usuarioDesdeMapOsesion(r.id_usuario_no_ubicable, map, sessionUser),
  }))
}

const COL_COUNT = 8

function IconoEditar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  )
}

function IconoImprimir({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"
      />
    </svg>
  )
}

function IconoEliminar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function tipoSoporteRank(tipo: string): number {
  const t = tipo.trim()
  const i = TIPOS_SOPORTE.indexOf(t as (typeof TIPOS_SOPORTE)[number])
  if (i !== -1) return i
  return TIPOS_SOPORTE.length
}

function tipoSoporteStyles(tipo: string) {
  const t = tipo.trim()
  if (t === 'VMI') return 'bg-violet-500/15 text-violet-200 ring-violet-400/30'
  if (t === 'VMNI') return 'bg-blue-500/15 text-blue-200 ring-blue-400/30'
  if (t === 'CNAF') return 'bg-teal-500/15 text-teal-200 ring-teal-400/30'
  if (t === 'VM Transporte') return 'bg-orange-500/15 text-orange-200 ring-orange-400/30'
  return 'bg-zinc-500/15 text-zinc-300 ring-white/10'
}

function sortInsumoRows(rows: InsumoRow[]): InsumoRow[] {
  return [...rows].sort((a, b) => {
    const ra = tipoSoporteRank(a.tipo_soporte)
    const rb = tipoSoporteRank(b.tipo_soporte)
    if (ra !== rb) return ra - rb
    if (ra === TIPOS_SOPORTE.length) {
      const tipoCmp = a.tipo_soporte.localeCompare(b.tipo_soporte, 'es')
      if (tipoCmp !== 0) return tipoCmp
    }
    const modeloCmp = a.modelo.localeCompare(b.modelo, 'es', { sensitivity: 'base' })
    if (modeloCmp !== 0) return modeloCmp
    return a.numero.localeCompare(b.numero, 'es', { numeric: true, sensitivity: 'base' })
  })
}

function estadoStyles(estado: string) {
  const e = estado.toLowerCase()
  if (e === 'disponible') return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
  if (e === 'prestado') return 'bg-amber-500/15 text-amber-200 ring-amber-500/25'
  if (e === 'en_uso') return 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/25'
  if (e === 'mantenimiento') return 'bg-sky-500/15 text-sky-200 ring-sky-500/25'
  if (e === 'fuera_de_servicio' || e === 'baja') return 'bg-red-500/15 text-red-300 ring-red-500/25'
  return 'bg-zinc-500/15 text-zinc-300 ring-white/10'
}

const accionIconBtnClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50'

function InsumoDetalleCelda({
  row,
  prestamo,
  uso,
  contextoLoading,
}: {
  row: InsumoRow
  prestamo: PrestamoResumenPorInsumo | undefined
  uso: UsoResumenPorInsumo | undefined
  contextoLoading: boolean
}) {
  const nombreEntrega = prestamo?.prestador
    ? nombreCompletoDesdeUsuariosRow(prestamo.prestador).trim()
    : ''
  const nombreInstala = uso?.klgo_instalador
    ? nombreCompletoDesdeUsuariosRow(uso.klgo_instalador).trim()
    : ''
  const textoLibre = row.detalle?.trim() ?? ''
  const vista = estadoOperativoDesdeContexto(row.estado, prestamo, uso)
  const muestraAuditoriaManual = esEstadoMantenimientoOFueraCatalogo(row.estado)
  const nombreRegistroManual = row.usuario_actualizacion_estado
    ? nombreCompletoDesdeUsuariosRow(row.usuario_actualizacion_estado).trim()
    : ''
  const auditoriaEsMantenimiento = row.estado.trim().toLowerCase() === 'mantenimiento'
  const muestraNoUbicable = row.no_ubicable
  const nombreNoUbicable = row.usuario_no_ubicable
    ? nombreCompletoDesdeUsuariosRow(row.usuario_no_ubicable).trim()
    : ''

  const hayBloques =
    Boolean(textoLibre) ||
    contextoLoading ||
    Boolean(prestamo) ||
    Boolean(uso) ||
    Boolean(vista.aviso) ||
    muestraAuditoriaManual ||
    muestraNoUbicable

  if (!hayBloques) {
    return <span className="text-zinc-600">—</span>
  }

  return (
    <div className="space-y-2">
      {textoLibre ? (
        <div>
          <p className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">Notas del equipo</p>
          <p className="line-clamp-3 wrap-break-word text-[11px] leading-snug text-zinc-300" title={textoLibre}>
            {textoLibre}
          </p>
        </div>
      ) : null}

      {muestraAuditoriaManual ? (
        <div
          className={`rounded-lg border px-2 py-1.5 text-[10px] leading-snug sm:text-[11px] ${
            auditoriaEsMantenimiento
              ? 'border-sky-500/25 bg-sky-500/[0.07]'
              : 'border-red-500/25 bg-red-500/[0.07]'
          }`}
        >
          <p
            className={`font-semibold ${auditoriaEsMantenimiento ? 'text-sky-100/95' : 'text-red-100/95'}`}
          >
            {auditoriaEsMantenimiento ? 'Mantenimiento' : 'Fuera de servicio'}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Desde</span>{' '}
            {row.fecha_actualizacion_estado ? fmtFechaPrestamo(row.fecha_actualizacion_estado) : '—'}
          </p>
          <p className="mt-1 text-zinc-200">
            <span className="text-zinc-500">Registró</span>{' '}
            {nombreRegistroManual ? (
              <span className="font-medium text-zinc-100">{nombreRegistroManual}</span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </p>
        </div>
      ) : null}

      {muestraNoUbicable ? (
        <div className="rounded-lg border border-red-500/35 bg-red-500/[0.08] px-2 py-1.5 text-[10px] leading-snug sm:text-[11px]">
          <p className="font-semibold text-red-100/95">No ubicable</p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Desde</span>{' '}
            {row.fecha_no_ubicable ? fmtFechaPrestamo(row.fecha_no_ubicable) : '—'}
          </p>
          <p className="mt-1 text-zinc-200">
            <span className="text-zinc-500">Registró</span>{' '}
            {nombreNoUbicable ? (
              <span className="font-medium text-zinc-100">{nombreNoUbicable}</span>
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </p>
        </div>
      ) : null}

      {contextoLoading ? (
        <p className="text-[10px] text-zinc-500">Sincronizando préstamos y usos…</p>
      ) : null}

      {prestamo ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5 text-[10px] leading-snug sm:text-[11px]">
          <p className="font-semibold text-amber-100/95">Préstamo activo</p>
          <p className="mt-1 text-zinc-200">
            <span className="text-zinc-500">Código</span>{' '}
            <span className="font-mono tabular-nums text-emerald-300/90">{textoCodigoPrestamo(prestamo)}</span>
            {' · '}
            <span>{prestamo.servicio_prestamo}</span>
            {prestamo.cama_prestamo?.trim() ? (
              <>
                {' · '}
                <span className="text-zinc-400">Cama</span> {prestamo.cama_prestamo}
              </>
            ) : null}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Fecha préstamo</span> {fmtFechaPrestamo(prestamo.fecha_prestamo)}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Solicita</span>{' '}
            <span className="font-medium tabular-nums text-zinc-100">Klgo. {fmtKlgo(prestamo.klgo_solicitante)}</span>
          </p>
          {nombreEntrega ? (
            <p className="mt-1 text-zinc-200">
              <span className="text-zinc-500">Entrega</span>{' '}
              <span className="font-medium text-zinc-100">{nombreEntrega}</span>
            </p>
          ) : (
            <p className="mt-1 text-[9px] text-amber-200/85">Sin nombre de quien entrega en el catálogo.</p>
          )}
          {prestamo.estado.trim().toLowerCase() !== 'a préstamo' &&
          prestamo.estado.trim().toLowerCase() !== 'activo' ? (
            <p className="mt-1 text-zinc-400">Estado préstamo: {prestamo.estado}</p>
          ) : null}
        </div>
      ) : null}

      {uso ? (
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.07] px-2 py-1.5 text-[10px] leading-snug sm:text-[11px]">
          <p className="font-semibold text-cyan-100/95">Uso activo</p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Fecha uso</span> {fmtFechaPrestamo(uso.fecha_uso)}
          </p>
          {nombreInstala ? (
            <p className="mt-1 text-zinc-200">
              <span className="text-zinc-500">Instala</span>{' '}
              <span className="font-medium text-zinc-100">{nombreInstala}</span>
            </p>
          ) : null}
          {uso.cama?.trim() ? (
            <p className="mt-1 text-zinc-300">
              <span className="text-zinc-500">Cama</span> {uso.cama}
            </p>
          ) : null}
          {uso.observaciones?.trim() ? (
            <p className="mt-1 text-zinc-400">{uso.observaciones}</p>
          ) : null}
        </div>
      ) : null}

      {!prestamo && !uso && vista.aviso && !contextoLoading ? (
        <p className="text-[10px] leading-snug text-amber-200/90">{vista.aviso}</p>
      ) : null}
    </div>
  )
}

export function InsumosTable() {
  const [rows, setRows] = useState<InsumoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prestamoPorInsumoId, setPrestamoPorInsumoId] = useState<Record<string, PrestamoResumenPorInsumo>>({})
  const [usoPorInsumoId, setUsoPorInsumoId] = useState<Record<string, UsoResumenPorInsumo>>({})
  const [contextoOperativoLoading, setContextoOperativoLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const [insumoEditar, setInsumoEditar] = useState<InsumoRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [insumoEliminar, setInsumoEliminar] = useState<InsumoRow | null>(null)

  const loadInsumos = useCallback(async () => {
    const selAuditoria =
      'id, codigo_inventario, tipo_soporte, modelo, numero, codigo_minsal, detalle, estado, fecha_actualizacion_estado, id_actualizacion_estado, no_ubicable, fecha_no_ubicable, id_usuario_no_ubicable'
    const selAuditoriaLegacyId =
      'id, codigo_inventario, tipo_soporte, modelo, numero, codigo_minsal, detalle, estado, estado_manual_at, id_actualizacion_estado'
    const selAuditoriaLegacyPor =
      'id, codigo_inventario, tipo_soporte, modelo, numero, codigo_minsal, detalle, estado, estado_manual_at, estado_manual_por'
    const selBase =
      'id, codigo_inventario, tipo_soporte, modelo, numero, codigo_minsal, detalle, estado'

    let { data, error: qError } = await supabase.from('insumos').select(selAuditoria)
    if (qError && insumosDbSinColumnasEstadoManual(qError.message)) {
      ;({ data, error: qError } = await supabase.from('insumos').select(selAuditoriaLegacyId))
    }
    if (qError && insumosDbSinColumnasEstadoManual(qError.message)) {
      ;({ data, error: qError } = await supabase.from('insumos').select(selAuditoriaLegacyPor))
    }
    if (qError && insumosDbSinColumnasEstadoManual(qError.message)) {
      ;({ data, error: qError } = await supabase.from('insumos').select(selBase))
    }
    if (qError) {
      setError(qError.message)
      setRows([])
      return
    }
    const raw = (data ?? []) as Record<string, unknown>[]
    let mapped = raw.map((r) => mapInsumoDesdeSupabase(r))
    mapped = await enriquecerUsuariosInsumosRows(mapped)
    setError(null)
    setRows(sortInsumoRows(mapped))
  }, [])

  useEffect(() => {
    let active = true
    void loadInsumos().finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [loadInsumos])

  useEffect(() => {
    if (loading || error) return
    const ids = rows.map((r) => r.id)
    setPrestamoPorInsumoId({})
    setUsoPorInsumoId({})
    if (ids.length === 0) {
      setContextoOperativoLoading(false)
      return
    }
    let cancelled = false
    setContextoOperativoLoading(true)
    void Promise.all([fetchPrestamoActivoPorInsumoIds(ids), fetchUsoActivoPorInsumoIds(ids)])
      .then(([prestamos, usos]) => {
        if (!cancelled) {
          setPrestamoPorInsumoId(prestamos)
          setUsoPorInsumoId(usos)
          setContextoOperativoLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrestamoPorInsumoId({})
          setUsoPorInsumoId({})
          setContextoOperativoLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [rows, loading, error])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    void loadInsumos().finally(() => setLoading(false))
  }, [loadInsumos])

  const handleModalClose = useCallback(() => {
    setModalOpen(false)
    setInsumoEditar(null)
  }, [])

  const handleAdded = useCallback(() => {
    setModalOpen(false)
    setInsumoEditar(null)
    void loadInsumos()
  }, [loadInsumos])

  const refetch = useCallback(() => {
    void loadInsumos()
  }, [loadInsumos])

  useEffect(() => {
    if (!insumoEliminar) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && deletingId === null) setInsumoEliminar(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [insumoEliminar, deletingId])

  const ejecutarEliminar = useCallback(async () => {
    const row = insumoEliminar
    if (!row) return
    setDeletingId(row.id)
    const { error: delError } = await supabase.from('insumos').delete().eq('id', row.id)
    setDeletingId(null)
    setInsumoEliminar(null)
    if (delError) {
      alert(delError.message)
      return
    }
    refetch()
  }, [insumoEliminar, refetch])

  const toolbar = (
    <div className="mb-4 flex justify-end">
      <BotonAgregarInsumo
        onClick={() => {
          setInsumoEditar(null)
          setModalKey((k) => k + 1)
          setModalOpen(true)
        }}
        disabled={loading}
      />
    </div>
  )

  const modal = (
    <AgregarInsumoModal
      key={`${modalKey}-${insumoEditar?.id ?? 'nuevo'}`}
      open={modalOpen}
      insumoEditar={insumoEditar}
      onClose={handleModalClose}
      onSuccess={handleAdded}
    />
  )

  const modalConfirmarEliminar =
    insumoEliminar !== null ? (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          aria-label="Cerrar"
          disabled={deletingId !== null}
          onClick={() => deletingId === null && setInsumoEliminar(null)}
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="eliminar-insumo-titulo"
          aria-describedby="eliminar-insumo-desc"
          className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
        >
          <h2 id="eliminar-insumo-titulo" className="text-lg font-semibold text-white">
            ¿Eliminar insumo?
          </h2>
          <p id="eliminar-insumo-desc" className="mt-3 text-sm leading-relaxed text-zinc-400">
            Se eliminará permanentemente{' '}
            <span className="font-medium text-zinc-200">«{insumoEliminar.modelo}»</span> (MINSAL{' '}
            <span className="font-mono text-zinc-300">{insumoEliminar.codigo_minsal}</span>). Esta
            acción no se puede deshacer.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={deletingId !== null}
              className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              onClick={() => setInsumoEliminar(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deletingId !== null}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              onClick={() => void ejecutarEliminar()}
            >
              {deletingId !== null ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </div>
    ) : null

  let tbodyContent: ReactNode
  if (loading) {
    tbodyContent = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-400">
          Cargando insumos…
        </td>
      </tr>
    )
  } else if (error) {
    tbodyContent = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-6">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 text-xs font-medium text-red-100 underline-offset-2 hover:underline"
          >
            Reintentar
          </button>
        </td>
      </tr>
    )
  } else if (rows.length === 0) {
    tbodyContent = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-500">
          No hay insumos registrados. Usa «Agregar insumo» para crear el primero.
        </td>
      </tr>
    )
  } else {
    tbodyContent = rows.map((row) => (
      <tr
        key={row.id}
        className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.04]"
      >
        <td className="min-w-0 px-3 py-3">
          <span
            className={`inline-block max-w-full whitespace-normal break-words rounded-2xl px-2 py-0.5 text-center text-[10px] font-medium leading-snug ring-1 ring-inset sm:px-2.5 sm:text-xs ${tipoSoporteStyles(row.tipo_soporte)}`}
            title={row.tipo_soporte}
          >
            {row.tipo_soporte}
          </span>
        </td>
        <td className="min-w-0 px-3 py-3 font-medium text-white">
          <span className="block truncate" title={row.modelo}>
            {row.modelo}
          </span>
        </td>
        <td className="min-w-0 px-3 py-3 text-zinc-300">
          <span className="block truncate" title={row.numero}>
            {row.numero}
          </span>
        </td>
        <td className="min-w-0 px-3 py-3 font-mono text-xs text-emerald-200/90">
          <span className="block truncate font-mono tabular-nums" title={row.codigo_inventario}>
            {codigoInventarioSeisDigitos(row.codigo_inventario)}
          </span>
        </td>
        <td className="min-w-0 px-3 py-3 font-mono text-xs text-zinc-400">
          <span className="block truncate" title={row.codigo_minsal}>
            {row.codigo_minsal}
          </span>
        </td>
        <td className="min-w-0 px-3 py-3 align-top text-xs text-zinc-400">
          <InsumoDetalleCelda
            row={row}
            prestamo={prestamoPorInsumoId[row.id]}
            uso={usoPorInsumoId[row.id]}
            contextoLoading={contextoOperativoLoading}
          />
        </td>
        <td className="min-w-0 align-middle px-3 py-3">
          {(() => {
            const vista = estadoOperativoDesdeContexto(
              row.estado,
              prestamoPorInsumoId[row.id],
              usoPorInsumoId[row.id],
            )
            return (
              <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                <span
                  className={`inline-block max-w-full whitespace-normal break-words rounded-2xl px-2 py-0.5 text-center text-[10px] font-medium leading-snug ring-1 ring-inset sm:px-2.5 sm:text-xs ${estadoStyles(vista.claveEstilo)}`}
                  title={vista.etiqueta}
                >
                  {vista.etiqueta}
                </span>
                {row.no_ubicable ? (
                  <span
                    className="chip-no-ubicable-alerta inline-block max-w-full whitespace-nowrap rounded-2xl bg-red-600/90 px-2 py-0.5 text-center text-[10px] font-semibold leading-snug text-white ring-2 ring-red-400/60 sm:text-xs"
                    title="Equipo marcado como no localizable"
                  >
                    No ubicable
                  </span>
                ) : null}
              </div>
            )
          })()}
        </td>
        <td className="min-w-0 px-1 py-2 align-middle sm:px-2 sm:py-3">
          <div className="flex flex-nowrap items-center justify-center gap-1">
            <button
              type="button"
              className={`${accionIconBtnClass} border-sky-500/40 text-sky-200 hover:bg-sky-500/15`}
              disabled={deletingId !== null || insumoEliminar !== null}
              aria-label="Editar insumo"
              title="Editar"
              onClick={() => {
                setInsumoEditar(row)
                setModalKey((k) => k + 1)
                setModalOpen(true)
              }}
            >
              <IconoEditar className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`${accionIconBtnClass} border-white/15 text-zinc-200 hover:bg-white/10`}
              disabled={deletingId !== null || insumoEliminar !== null}
              aria-label="Imprimir ficha del insumo"
              title="Imprimir"
              onClick={() => abrirImpresionEtiquetaInsumo(row)}
            >
              <IconoImprimir className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`${accionIconBtnClass} border-red-500/35 text-red-300 hover:bg-red-500/15`}
              disabled={deletingId !== null || insumoEliminar !== null}
              aria-label="Eliminar insumo"
              aria-busy={deletingId === row.id}
              title="Eliminar"
              onClick={() => setInsumoEliminar(row)}
            >
              {deletingId === row.id ? (
                <span className="h-4 w-4 animate-pulse rounded-full bg-red-400/50" aria-hidden />
              ) : (
                <IconoEliminar className="h-4 w-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
    ))
  }

  return (
    <>
      {toolbar}
      {modal}
      {modalConfirmarEliminar}
      <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/20">
        <table className="w-full min-w-[56rem] table-fixed border-collapse text-left text-sm md:min-w-0">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-800/60">
              <th className="w-[11%] px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Tipo soporte
              </th>
              <th className="w-[17%] px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Modelo
              </th>
              <th className="w-[7%] px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Número
              </th>
              <th className="w-[11%] px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Cód. inventario
              </th>
              <th className="w-[11%] px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Código MINSAL
              </th>
              <th className="w-[20%] px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Detalle
              </th>
              <th className="w-[13%] align-middle px-2 py-3 text-left text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Estado
              </th>
              <th className="w-[11%] px-2 py-3 text-center text-xs font-medium text-zinc-300 sm:px-3 sm:text-sm">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>{tbodyContent}</tbody>
        </table>
      </div>
    </>
  )
}
