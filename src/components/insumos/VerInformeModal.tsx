import { useCallback, useEffect, useState } from 'react'
import { estadoPrestamoBadgeClass } from '../../constants/estadoPrestamo'
import { etiquetaEstadoInsumo } from '../../constants/estadoInsumo'
import { nombreCompletoDesdeUsuariosRow, type UsuarioNombreRow } from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import {
  fetchTodosPrestamosActivos,
  fetchTodosUsosActivos,
  fmtKlgoInforme,
  nombreInstaladorUso,
  nombrePrestadorPrestamo,
  nombreRecepcionUso,
  resumenSoportesPrestamo,
  type PrestamoActivoInformeRow,
  type UsoActivoInformeRow,
} from '../../lib/informeListasActivas'
import {
  etiquetasMesesAnio,
  fetchPrestamosUltimos30Dias,
  fetchSeriesMensualesAnio,
  fetchUsosUltimos30Dias,
  type PrestamoModalRow,
  type UsoModalRow,
} from '../../lib/informesInsumosModalData'
import {
  fetchPrestamoActivoPorInsumoIds,
  fetchUsoActivoPorInsumoIds,
  type PrestamoResumenPorInsumo,
  type UsoResumenPorInsumo,
} from '../../lib/insumoOperativo'
import { supabase } from '../../lib/supabase'
import { CeldaContextoPrestamoUso, fmtFechaInformeModal as fmtFecha } from './InformeModalCeldaContexto'
import { InformeMensualAreaChart, type MesUsoPrestamo } from './InformeMensualAreaChart'

function estadoBadgeClass(estado: string) {
  const e = estado.toLowerCase()
  if (e === 'disponible') return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
  if (e === 'prestado') return 'bg-amber-500/15 text-amber-200 ring-amber-500/25'
  if (e === 'en_uso') return 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/25'
  if (e === 'mantenimiento') return 'bg-sky-500/15 text-sky-200 ring-sky-500/25'
  if (e === 'fuera_de_servicio' || e === 'baja') return 'bg-red-500/15 text-red-300 ring-red-500/25'
  return 'bg-zinc-500/15 text-zinc-300 ring-white/10'
}

function insumoEmbedUno<T extends { codigo_inventario: string; modelo: string; numero: string; tipo_soporte: string }>(
  ins: T | T[] | null,
): T | null {
  if (!ins) return null
  return Array.isArray(ins) ? (ins[0] ?? null) : ins
}

function InsumoLineModal({
  ins,
}: {
  ins: { codigo_inventario: string; modelo: string; numero: string; tipo_soporte: string } | null
}) {
  if (!ins) return <span className="text-zinc-500">—</span>
  const modelo = ins.modelo?.trim() || ins.tipo_soporte?.trim() || '—'
  const cod = codigoInventarioSeisDigitos(ins.codigo_inventario)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1">
      <span className="font-medium text-zinc-100">{modelo}</span>
      <span className="tabular-nums text-emerald-400/95">({cod})</span>
    </span>
  )
}

function InformeCeldaFechaInstalaUso({
  fechaIso,
  instaladorNombre,
}: {
  fechaIso: string
  instaladorNombre: string
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
        {fmtFecha(fechaIso)}
      </span>
      {instaladorNombre ? (
        <p className="mt-1 text-[10px] leading-snug text-zinc-100 sm:text-[11px]">
          <span className="font-medium text-zinc-500">Instala</span>{' '}
          <span className="font-medium">{instaladorNombre}</span>
        </p>
      ) : (
        <p className="mt-1 text-[9px] leading-tight text-amber-200/80 sm:text-[10px]">
          Sin kinesiólogo en catálogo.
        </p>
      )}
    </div>
  )
}

function InformeCeldaDevolucionUso({
  fechaDev,
  recepcionNombre,
}: {
  fechaDev: string | null | undefined
  recepcionNombre: string
}) {
  if (!fechaDev) {
    return <span className="text-zinc-500">—</span>
  }
  return (
    <div className="min-w-0">
      <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
        {fmtFecha(fechaDev)}
      </span>
      {recepcionNombre ? (
        <p className="mt-1 text-[10px] leading-snug text-zinc-100 sm:text-[11px]">
          <span className="font-medium text-zinc-500">Retirado por</span>{' '}
          <span className="font-medium">{recepcionNombre}</span>
        </p>
      ) : (
        <p className="mt-1 text-[9px] leading-tight text-amber-200/80 sm:text-[10px]">Sin datos de retiro.</p>
      )}
    </div>
  )
}

type ActoDevolucionPrestamo = {
  id: string
  fecha: string
  klgo_recibe: number | string | null
  kinesiologo_devuelve: string
  recibidor?: UsuarioNombreRow | UsuarioNombreRow[] | null
}

function InformeListaDevolucionesPrestamo({ actos }: { actos: ActoDevolucionPrestamo[] }) {
  const sorted = [...actos].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  )
  if (sorted.length === 0) return <span className="text-zinc-500">—</span>
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((a) => {
        const recU = Array.isArray(a.recibidor) ? a.recibidor[0] : a.recibidor
        const nombreRec = recU ? nombreCompletoDesdeUsuariosRow(recU as UsuarioNombreRow).trim() : ''
        const kRec = fmtKlgoInforme(a.klgo_recibe)
        const recepEt = nombreRec || (kRec !== '—' ? `Klgo. ${kRec}` : '')
        const kine = (a.kinesiologo_devuelve ?? '').trim()
        return (
          <div key={a.id} className="border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0">
            <span className="block text-[11px] tabular-nums text-zinc-300">{fmtFecha(a.fecha)}</span>
            <p className="mt-1 text-[10px] text-zinc-100">
              <span className="text-zinc-500">Recepciona</span>{' '}
              {recepEt ? <span className="font-medium">{recepEt}</span> : <span className="text-zinc-500">—</span>}
            </p>
            {kine ? (
              <p className="mt-0.5 text-[10px] text-zinc-300">
                <span className="text-zinc-500">Devuelve</span> {kine}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function InformeCeldaPrestamoOrigen({
  fechaIso,
  nombreEntrega,
  klgoSolicita,
}: {
  fechaIso: string
  nombreEntrega: string
  klgoSolicita: string
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
        {fmtFecha(fechaIso)}
      </span>
      {nombreEntrega ? (
        <>
          <p className="mt-1 text-[10px] font-medium leading-snug text-zinc-100 sm:text-[11px]">{nombreEntrega}</p>
          <p className="mt-0.5 text-[9px] text-zinc-500 sm:text-[10px]">(entrega)</p>
        </>
      ) : (
        <p className="mt-1 text-[9px] text-amber-200/80 sm:text-[10px]">Sin prestador en catálogo.</p>
      )}
      <p className="mt-1.5 text-[10px] text-zinc-300">
        <span className="text-zinc-400">Klgo.</span>{' '}
        <span className="font-medium tabular-nums text-zinc-100">{klgoSolicita}</span>
        <span className="ml-1 text-[9px] text-zinc-500">(solicita)</span>
      </p>
    </div>
  )
}

function normalizarInsumoEmb(
  obs: unknown,
): {
  codigo_inventario: string
  modelo: string
  tipo_soporte: string
  estado: string
  detalle: string
  no_ubicable: boolean
} | null {
  if (!obs) return null
  if (Array.isArray(obs)) return normalizarInsumoEmb(obs[0])
  if (typeof obs === 'object') {
    const o = obs as Record<string, unknown>
    const nu = o.no_ubicable
    const noUbicable = typeof nu === 'boolean' ? nu : String(nu).toLowerCase() === 'true'
    return {
      codigo_inventario: String(o.codigo_inventario ?? ''),
      modelo: String(o.modelo ?? ''),
      tipo_soporte: String(o.tipo_soporte ?? ''),
      estado: String(o.estado ?? ''),
      detalle: String(o.detalle ?? ''),
      no_ubicable: noUbicable,
    }
  }
  return null
}

function parseNoUbicableSnapshot(raw: unknown): boolean | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') return raw.toLowerCase() === 'true'
  return null
}

type LineaCatalogoVer = {
  id_insumo: string
  observacion: string
  detalle: string
  no_ubicable: boolean
  insumos: {
    codigo_inventario: string
    modelo: string
    tipo_soporte: string
    estado: string
    detalle: string
    no_ubicable: boolean
  } | null
}

/** Misma forma que `InformeInsumoRow` en la tabla de informes (evita import circular). */
export type InformeInsumoVista = {
  id: string
  fecha_informe: string
  id_responsable: string
  insumos_disponibles: number
  insumos_en_uso: number
  insumos_mantencion: number
  insumos_fuera_servicio: number
  insumos_prestados: number
  insumos_no_ubicables: number
  responsable?: UsuarioNombreRow | null
}

function nombreResponsableInforme(row: InformeInsumoVista): string {
  const u = row.responsable
  if (u && typeof u === 'object') {
    const s = nombreCompletoDesdeUsuariosRow(u).trim()
    if (s) return s
  }
  return row.id_responsable ? `${row.id_responsable.slice(0, 8)}…` : '—'
}

function fmtFechaCabecera(iso: string | null) {
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

const OBS_SELECT = `
  observacion, detalle, no_ubicable, id_insumo,
  insumos ( codigo_inventario, modelo, tipo_soporte, estado, detalle, no_ubicable )
`

type VerInformeModalProps = {
  open: boolean
  onClose: () => void
  informe: InformeInsumoVista | null
  onImprimir: (row: InformeInsumoVista) => void
  imprimiendo: boolean
}

export function VerInformeModal({
  open,
  onClose,
  informe,
  onImprimir,
  imprimiendo,
}: VerInformeModalProps) {
  const [loading, setLoading] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [lineasCatalogo, setLineasCatalogo] = useState<LineaCatalogoVer[]>([])
  const [chartData, setChartData] = useState<MesUsoPrestamo[]>([])
  const [usos30, setUsos30] = useState<UsoModalRow[]>([])
  const [prestamos30, setPrestamos30] = useState<PrestamoModalRow[]>([])
  const [usosActivosTodos, setUsosActivosTodos] = useState<UsoActivoInformeRow[]>([])
  const [prestamosActivosTodos, setPrestamosActivosTodos] = useState<PrestamoActivoInformeRow[]>([])
  const [prestamoPorId, setPrestamoPorId] = useState<Record<string, PrestamoResumenPorInsumo>>({})
  const [usoPorId, setUsoPorId] = useState<Record<string, UsoResumenPorInsumo>>({})
  const [contextoOperativoLoading, setContextoOperativoLoading] = useState(false)

  const yearInforme = informe ? new Date(informe.fecha_informe).getFullYear() : new Date().getFullYear()

  const cargar = useCallback(async () => {
    if (!informe) return
    setLoading(true)
    setErrorCarga(null)
    const y = new Date(informe.fecha_informe).getFullYear()

    const obsRes = await supabase.from('informes_insumos_observaciones').select(OBS_SELECT).eq('informe_id', informe.id)
    if (obsRes.error) {
      setErrorCarga(obsRes.error.message)
      setLineasCatalogo([])
      setChartData([])
      setUsos30([])
      setPrestamos30([])
      setUsosActivosTodos([])
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    const raw = (obsRes.data ?? []) as Record<string, unknown>[]
    const lineas: LineaCatalogoVer[] = raw.map((r) => {
      const ins = normalizarInsumoEmb(r.insumos)
      const snapNu = parseNoUbicableSnapshot(r.no_ubicable)
      const noUbicable = snapNu !== null ? snapNu : (ins?.no_ubicable ?? false)
      return {
        observacion: String(r.observacion ?? ''),
        detalle: String(r.detalle ?? ''),
        no_ubicable: noUbicable,
        id_insumo: String(r.id_insumo ?? ''),
        insumos: ins,
      }
    })
    setLineasCatalogo(lineas)

    const [series, u30, p30, uAct, pAct] = await Promise.all([
      fetchSeriesMensualesAnio(y),
      fetchUsosUltimos30Dias(),
      fetchPrestamosUltimos30Dias(),
      fetchTodosUsosActivos(),
      fetchTodosPrestamosActivos(),
    ])

    if (!series.ok) {
      setChartData([])
    } else {
      const meses = etiquetasMesesAnio(y)
      setChartData(
        meses.map((mes, i) => ({
          mes,
          usos: series.usosPorMes[i] ?? 0,
          prestamos: series.prestamosPorMes[i] ?? 0,
        })),
      )
    }

    setUsos30(u30.ok ? u30.rows : [])
    setPrestamos30(p30.ok ? p30.rows : [])
    setUsosActivosTodos(uAct.ok ? uAct.rows : [])
    setPrestamosActivosTodos(pAct.ok ? pAct.rows : [])

    setLoading(false)
  }, [informe])

  useEffect(() => {
    if (!open || !informe) return
    void cargar()
  }, [open, informe, cargar])

  useEffect(() => {
    if (!open || lineasCatalogo.length === 0) {
      setPrestamoPorId({})
      setUsoPorId({})
      setContextoOperativoLoading(false)
      return
    }
    let cancelled = false
    const ids = lineasCatalogo.map((c) => c.id_insumo).filter(Boolean)
    setContextoOperativoLoading(true)
    void Promise.all([fetchPrestamoActivoPorInsumoIds(ids), fetchUsoActivoPorInsumoIds(ids)])
      .then(([pm, um]) => {
        if (cancelled) return
        setPrestamoPorId(pm)
        setUsoPorId(um)
        setContextoOperativoLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setPrestamoPorId({})
        setUsoPorId({})
        setContextoOperativoLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, lineasCatalogo])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !informe) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/65 p-4 pt-10 pb-12 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ver-informe-titulo"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-7xl rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <h2 id="ver-informe-titulo" className="text-lg font-semibold text-white md:text-xl">
              Ver informe
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Snapshot guardado el {fmtFechaCabecera(informe.fecha_informe)} · Responsable{' '}
              <span className="text-zinc-200">{nombreResponsableInforme(informe)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-5 md:px-6">
          {loading ? (
            <p className="py-16 text-center text-sm text-zinc-400">Cargando informe…</p>
          ) : (
            <>
              {errorCarga ? (
                <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {errorCarga}
                </p>
              ) : null}

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Métricas del catálogo (informe guardado)</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Disponibles', informe.insumos_disponibles, 'text-emerald-300'],
                    ['En uso', informe.insumos_en_uso, 'text-cyan-300'],
                    ['Mantención', informe.insumos_mantencion, 'text-sky-300'],
                    ['Fuera de servicio', informe.insumos_fuera_servicio, 'text-red-300'],
                    ['Prestados', informe.insumos_prestados, 'text-amber-300'],
                    ['No ubicables', informe.insumos_no_ubicables, 'text-orange-300'],
                  ].map(([label, n, color]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-white/10 bg-zinc-800/40 px-3 py-3 text-center"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
                      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{n}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Catálogo — observación por equipo</h3>
                <p className="mb-3 text-xs text-zinc-500">
                  «Préstamo / uso» refleja movimientos vigentes al abrir esta vista. Las observaciones son las guardadas en
                  el informe.
                </p>
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/50">
                  <div className="max-h-[min(28rem,55vh)] overflow-y-auto">
                    <table className="w-full min-w-[78rem] border-collapse text-left text-xs sm:text-sm">
                      <thead className="sticky top-0 z-[1] border-b border-white/10 bg-zinc-800/90">
                        <tr>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Código</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Tipo</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Modelo</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Estado</th>
                          <th className="w-[15rem] min-w-[13rem] max-w-[16rem] px-3 py-2.5 font-medium text-zinc-400">
                            Préstamo y uso vigentes
                          </th>
                          <th className="min-w-[12rem] px-3 py-2.5 font-medium text-zinc-400">
                            Observación (informe)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasCatalogo.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                              No hay líneas guardadas para este informe.
                            </td>
                          </tr>
                        ) : (
                          lineasCatalogo.map((row) => {
                            const ins = row.insumos
                            const noUbCat = ins?.no_ubicable === true
                            return (
                              <tr key={row.id_insumo} className="border-b border-white/5 last:border-0">
                                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-300">
                                  {ins ? codigoInventarioSeisDigitos(ins.codigo_inventario) : '—'}
                                </td>
                                <td className="px-3 py-2 text-zinc-300">{ins?.tipo_soporte ?? '—'}</td>
                                <td className="max-w-[8rem] truncate px-3 py-2 text-zinc-200" title={ins?.modelo}>
                                  {ins?.modelo ?? '—'}
                                </td>
                                <td className="px-3 py-2">
                                  {ins ? (
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:text-[11px] ${estadoBadgeClass(ins.estado)}`}
                                    >
                                      {etiquetaEstadoInsumo(ins.estado)}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500">—</span>
                                  )}
                                </td>
                                <td className="w-[15rem] min-w-[13rem] max-w-[16rem] align-top px-3 py-2">
                                  <CeldaContextoPrestamoUso
                                    cargando={contextoOperativoLoading}
                                    prestamo={prestamoPorId[row.id_insumo]}
                                    uso={usoPorId[row.id_insumo]}
                                    noUbicable={row.no_ubicable || noUbCat}
                                  />
                                </td>
                                <td className="min-w-0 px-3 py-2 align-top text-zinc-300">
                                  {row.observacion.trim() ? (
                                    <span className="whitespace-pre-wrap text-xs leading-snug">{row.observacion}</span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {!errorCarga && chartData.length > 0 ? (
                <section className="mb-8">
                  <InformeMensualAreaChart year={yearInforme} data={chartData} />
                </section>
              ) : null}

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Usos en los últimos 30 días</h3>
                <p className="mb-2 text-xs text-zinc-500">Datos actuales del sistema (contexto al visualizar).</p>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
                  <div className="max-h-56 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[58rem] border-collapse text-left text-xs sm:text-sm">
                      <thead className="sticky top-0 z-[1] border-b border-white/10 bg-zinc-800/90">
                        <tr>
                          <th className="min-w-[9rem] px-3 py-2.5 font-medium text-zinc-400">Fecha uso</th>
                          <th className="min-w-[10rem] px-3 py-2.5 font-medium text-zinc-400">Insumo</th>
                          <th className="min-w-[7rem] px-3 py-2.5 font-medium text-zinc-400">Estado</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Cama</th>
                          <th className="min-w-[9rem] px-3 py-2.5 font-medium text-zinc-400">Fecha devolución</th>
                          <th className="min-w-[8rem] px-3 py-2.5 font-medium text-zinc-400">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usos30.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                              No hay usos en este período.
                            </td>
                          </tr>
                        ) : (
                          usos30.map((u) => (
                            <tr key={u.id} className="border-b border-white/5 last:border-0">
                              <td className="align-top px-3 py-2.5">
                                <InformeCeldaFechaInstalaUso
                                  fechaIso={u.fecha_uso}
                                  instaladorNombre={nombreInstaladorUso(u)}
                                />
                              </td>
                              <td className="min-w-0 align-top px-3 py-2.5 text-zinc-200">
                                <InsumoLineModal ins={insumoEmbedUno(u.insumos)} />
                              </td>
                              <td className="align-top px-3 py-2.5">
                                {u.insumos ? (
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:text-[11px] ${estadoBadgeClass(u.insumos.estado)}`}
                                  >
                                    {etiquetaEstadoInsumo(u.insumos.estado)}
                                  </span>
                                ) : (
                                  <span className="text-zinc-500">—</span>
                                )}
                              </td>
                              <td className="align-top px-3 py-2.5 text-zinc-400">{u.cama?.trim() || '—'}</td>
                              <td className="align-top px-3 py-2.5">
                                <InformeCeldaDevolucionUso
                                  fechaDev={u.fecha_devolucion}
                                  recepcionNombre={nombreRecepcionUso(u)}
                                />
                              </td>
                              <td className="min-w-0 align-top px-3 py-2.5 text-zinc-400">
                                {u.observaciones?.trim() ? (
                                  <span className="line-clamp-3 break-words" title={u.observaciones ?? ''}>
                                    {u.observaciones}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Préstamos en los últimos 30 días</h3>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
                  <div className="max-h-56 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[58rem] border-collapse text-left text-xs sm:text-sm">
                      <thead className="sticky top-0 z-[1] border-b border-white/10 bg-zinc-800/90">
                        <tr>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Nº</th>
                          <th className="min-w-[11rem] px-3 py-2.5 font-medium text-zinc-400">Préstamo</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Estado</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Servicio</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Cama</th>
                          <th className="min-w-[10rem] px-3 py-2.5 font-medium text-zinc-400">Soportes</th>
                          <th className="min-w-[11rem] px-3 py-2.5 font-medium text-zinc-400">Devoluciones</th>
                          <th className="min-w-[8rem] px-3 py-2.5 font-medium text-zinc-400">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prestamos30.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                              No hay préstamos en este período.
                            </td>
                          </tr>
                        ) : (
                          prestamos30.map((p) => {
                            const prest = nombrePrestadorPrestamo(p)
                            const n = p.numero_publico
                            const num =
                              n !== null && n !== undefined && String(n).trim() !== ''
                                ? String(n)
                                : p.id.slice(0, 8)
                            return (
                              <tr key={p.id} className="border-b border-white/5 last:border-0">
                                <td className="align-top px-3 py-2.5 font-medium tabular-nums text-emerald-400">{num}</td>
                                <td className="align-top px-3 py-2.5">
                                  <InformeCeldaPrestamoOrigen
                                    fechaIso={p.fecha_prestamo}
                                    nombreEntrega={prest}
                                    klgoSolicita={fmtKlgoInforme(p.klgo_solicitante)}
                                  />
                                </td>
                                <td className="align-top px-3 py-2.5">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${estadoPrestamoBadgeClass(p.estado)}`}
                                  >
                                    {p.estado}
                                  </span>
                                </td>
                                <td
                                  className="max-w-[8rem] align-top truncate px-3 py-2.5 text-zinc-300"
                                  title={p.servicio_prestamo}
                                >
                                  {p.servicio_prestamo}
                                </td>
                                <td className="align-top px-3 py-2.5 text-zinc-400">{p.cama_prestamo?.trim() || '—'}</td>
                                <td className="min-w-0 align-top px-3 py-2.5 text-[11px] leading-snug text-zinc-300">
                                  {resumenSoportesPrestamo(p)}
                                </td>
                                <td className="align-top px-3 py-2.5">
                                  <InformeListaDevolucionesPrestamo actos={p.prestamos_devoluciones ?? []} />
                                </td>
                                <td className="min-w-0 align-top px-3 py-2.5 text-zinc-400">
                                  {p.observaciones?.trim() ? (
                                    <span className="line-clamp-3 break-words" title={p.observaciones ?? ''}>
                                      {p.observaciones}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Todos los usos activos</h3>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
                  <div className="max-h-56 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[58rem] border-collapse text-left text-xs sm:text-sm">
                      <thead className="sticky top-0 z-[1] border-b border-white/10 bg-zinc-800/90">
                        <tr>
                          <th className="min-w-[9rem] px-3 py-2.5 font-medium text-zinc-400">Fecha uso</th>
                          <th className="min-w-[10rem] px-3 py-2.5 font-medium text-zinc-400">Insumo</th>
                          <th className="min-w-[7rem] px-3 py-2.5 font-medium text-zinc-400">Estado</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Cama</th>
                          <th className="min-w-[9rem] px-3 py-2.5 font-medium text-zinc-400">Fecha devolución</th>
                          <th className="min-w-[8rem] px-3 py-2.5 font-medium text-zinc-400">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usosActivosTodos.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                              No hay usos activos.
                            </td>
                          </tr>
                        ) : (
                          usosActivosTodos.map((u) => {
                            const ins = u.insumos
                            return (
                              <tr key={u.id} className="border-b border-white/5 last:border-0">
                                <td className="align-top px-3 py-2.5">
                                  <InformeCeldaFechaInstalaUso
                                    fechaIso={u.fecha_uso}
                                    instaladorNombre={nombreInstaladorUso(u)}
                                  />
                                </td>
                                <td className="min-w-0 align-top px-3 py-2.5 text-zinc-200">
                                  {ins ? <InsumoLineModal ins={ins} /> : <span className="text-zinc-500">—</span>}
                                </td>
                                <td className="align-top px-3 py-2.5">
                                  {ins ? (
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:text-[11px] ${estadoBadgeClass(ins.estado)}`}
                                    >
                                      {etiquetaEstadoInsumo(ins.estado)}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500">—</span>
                                  )}
                                </td>
                                <td className="align-top px-3 py-2.5 text-zinc-400">{u.cama?.trim() || '—'}</td>
                                <td className="align-top px-3 py-2.5">
                                  <InformeCeldaDevolucionUso
                                    fechaDev={u.fecha_devolucion}
                                    recepcionNombre={nombreRecepcionUso(u)}
                                  />
                                </td>
                                <td className="min-w-0 align-top px-3 py-2.5 text-zinc-400">
                                  {u.observaciones?.trim() ? (
                                    <span className="line-clamp-3 break-words" title={u.observaciones ?? ''}>
                                      {u.observaciones}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="mb-4">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Todos los préstamos activos</h3>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
                  <div className="max-h-56 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[58rem] border-collapse text-left text-xs sm:text-sm">
                      <thead className="sticky top-0 z-[1] border-b border-white/10 bg-zinc-800/90">
                        <tr>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Nº</th>
                          <th className="min-w-[11rem] px-3 py-2.5 font-medium text-zinc-400">Préstamo</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Estado</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Servicio</th>
                          <th className="px-3 py-2.5 font-medium text-zinc-400">Cama</th>
                          <th className="min-w-[10rem] px-3 py-2.5 font-medium text-zinc-400">Soportes</th>
                          <th className="min-w-[11rem] px-3 py-2.5 font-medium text-zinc-400">Devoluciones</th>
                          <th className="min-w-[8rem] px-3 py-2.5 font-medium text-zinc-400">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prestamosActivosTodos.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                              No hay préstamos activos.
                            </td>
                          </tr>
                        ) : (
                          prestamosActivosTodos.map((p) => {
                            const prest = nombrePrestadorPrestamo(p)
                            const n = p.numero_publico
                            const num =
                              n !== null && n !== undefined && String(n).trim() !== ''
                                ? String(n)
                                : p.id.slice(0, 8)
                            return (
                              <tr key={p.id} className="border-b border-white/5 last:border-0">
                                <td className="align-top px-3 py-2.5 font-medium tabular-nums text-emerald-400">{num}</td>
                                <td className="align-top px-3 py-2.5">
                                  <InformeCeldaPrestamoOrigen
                                    fechaIso={p.fecha_prestamo}
                                    nombreEntrega={prest}
                                    klgoSolicita={fmtKlgoInforme(p.klgo_solicitante)}
                                  />
                                </td>
                                <td className="align-top px-3 py-2.5">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${estadoPrestamoBadgeClass(p.estado)}`}
                                  >
                                    {p.estado}
                                  </span>
                                </td>
                                <td
                                  className="max-w-[8rem] align-top truncate px-3 py-2.5 text-zinc-300"
                                  title={p.servicio_prestamo}
                                >
                                  {p.servicio_prestamo}
                                </td>
                                <td className="align-top px-3 py-2.5 text-zinc-400">{p.cama_prestamo?.trim() || '—'}</td>
                                <td className="min-w-0 align-top px-3 py-2.5 text-[11px] leading-snug text-zinc-300">
                                  {resumenSoportesPrestamo(p)}
                                </td>
                                <td className="align-top px-3 py-2.5">
                                  <InformeListaDevolucionesPrestamo actos={p.prestamos_devoluciones ?? []} />
                                </td>
                                <td className="min-w-0 align-top px-3 py-2.5 text-zinc-400">
                                  {p.observaciones?.trim() ? (
                                    <span className="line-clamp-3 break-words" title={p.observaciones ?? ''}>
                                      {p.observaciones}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4 md:px-6">
          <button
            type="button"
            onClick={() => onImprimir(informe)}
            disabled={imprimiendo}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-5 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {imprimiendo ? 'Preparando impresión…' : 'Imprimir'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
