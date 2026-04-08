import { useCallback, useEffect, useMemo, useState } from 'react'
import { estadoPrestamoBadgeClass } from '../../constants/estadoPrestamo'
import { etiquetaEstadoInsumo } from '../../constants/estadoInsumo'
import { nombreCompletoDesdeUsuariosRow, type UsuarioNombreRow } from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { conteosDesdeFilasInsumo, guardarInformeInsumosConObservaciones } from '../../lib/informesInsumosConteos'
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
  fetchInsumosCatalogoInforme,
  fetchPrestamosUltimos30Dias,
  fetchSeriesMensualesAnio,
  fetchUsosUltimos30Dias,
  type InsumoCatalogoInforme,
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
import { InformeMensualAreaChart, type MesUsoPrestamo } from './InformeMensualAreaChart'
import { CeldaContextoPrestamoUso, fmtFechaInformeModal as fmtFecha } from './InformeModalCeldaContexto'

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

type NuevoInformeModalProps = {
  open: boolean
  onClose: () => void
  onGuardado: () => void
}

export function NuevoInformeModal({ open, onClose, onGuardado }: NuevoInformeModalProps) {
  const year = new Date().getFullYear()
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const [catalogo, setCatalogo] = useState<InsumoCatalogoInforme[]>([])
  const [chartData, setChartData] = useState<MesUsoPrestamo[]>([])
  const [usos30, setUsos30] = useState<UsoModalRow[]>([])
  const [prestamos30, setPrestamos30] = useState<PrestamoModalRow[]>([])
  const [usosActivosTodos, setUsosActivosTodos] = useState<UsoActivoInformeRow[]>([])
  const [prestamosActivosTodos, setPrestamosActivosTodos] = useState<PrestamoActivoInformeRow[]>([])
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [prestamoPorId, setPrestamoPorId] = useState<Record<string, PrestamoResumenPorInsumo>>({})
  const [usoPorId, setUsoPorId] = useState<Record<string, UsoResumenPorInsumo>>({})
  const [contextoOperativoLoading, setContextoOperativoLoading] = useState(false)

  const metricas = useMemo(() => {
    if (catalogo.length === 0) return null
    return conteosDesdeFilasInsumo(catalogo)
  }, [catalogo])

  const cargar = useCallback(async () => {
    setLoading(true)
    setErrorCarga(null)
    setErrorGuardar(null)
    const [cat, series, u30, p30, uAct, pAct] = await Promise.all([
      fetchInsumosCatalogoInforme(),
      fetchSeriesMensualesAnio(year),
      fetchUsosUltimos30Dias(),
      fetchPrestamosUltimos30Dias(),
      fetchTodosUsosActivos(),
      fetchTodosPrestamosActivos(),
    ])
    if (!cat.ok) {
      setErrorCarga(cat.message)
      setCatalogo([])
      setChartData([])
      setUsos30([])
      setPrestamos30([])
      setUsosActivosTodos([])
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    if (!series.ok) {
      setErrorCarga(series.message)
      setCatalogo(cat.rows)
      setChartData([])
      setUsos30([])
      setPrestamos30([])
      setUsosActivosTodos([])
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    if (!u30.ok) {
      setErrorCarga(u30.message)
      setCatalogo(cat.rows)
      setChartData([])
      setUsos30([])
      setPrestamos30([])
      setUsosActivosTodos([])
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    if (!p30.ok) {
      setErrorCarga(p30.message)
      setCatalogo(cat.rows)
      setChartData([])
      setUsos30([])
      setPrestamos30([])
      setUsosActivosTodos([])
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    if (!uAct.ok) {
      setErrorCarga(uAct.message)
      setCatalogo(cat.rows)
      setChartData([])
      setUsos30(u30.rows)
      setPrestamos30(p30.rows)
      setUsosActivosTodos([])
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    if (!pAct.ok) {
      setErrorCarga(pAct.message)
      setCatalogo(cat.rows)
      setChartData([])
      setUsos30(u30.rows)
      setPrestamos30(p30.rows)
      setUsosActivosTodos(uAct.rows)
      setPrestamosActivosTodos([])
      setLoading(false)
      return
    }
    const meses = etiquetasMesesAnio(year)
    const chart: MesUsoPrestamo[] = meses.map((mes, i) => ({
      mes,
      usos: series.usosPorMes[i] ?? 0,
      prestamos: series.prestamosPorMes[i] ?? 0,
    }))
    setCatalogo(cat.rows)
    setChartData(chart)
    setUsos30(u30.rows)
    setPrestamos30(p30.rows)
    setUsosActivosTodos(uAct.rows)
    setPrestamosActivosTodos(pAct.rows)
    setObservaciones({})
    setLoading(false)
  }, [year])

  useEffect(() => {
    if (!open) return
    void cargar()
  }, [open, cargar])

  useEffect(() => {
    if (!open || catalogo.length === 0) {
      setPrestamoPorId({})
      setUsoPorId({})
      setContextoOperativoLoading(false)
      return
    }
    let cancelled = false
    const ids = catalogo.map((c) => c.id)
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
  }, [open, catalogo])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleGuardar() {
    if (catalogo.length === 0) return
    setErrorGuardar(null)
    setGuardando(true)
    const r = await guardarInformeInsumosConObservaciones(supabase, catalogo, observaciones)
    setGuardando(false)
    if (!r.ok) {
      setErrorGuardar(r.message)
      return
    }
    onGuardado()
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/65 p-4 pt-10 pb-12 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nuevo-informe-titulo"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-7xl rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <h2 id="nuevo-informe-titulo" className="text-lg font-semibold text-white md:text-xl">
              Nuevo informe
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Métricas del catálogo, actividad reciente y observaciones por equipo antes de guardar el informe.
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
            <p className="py-16 text-center text-sm text-zinc-400">Cargando datos del informe…</p>
          ) : (
            <>
              {errorCarga ? (
                <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {errorCarga}
                </p>
              ) : null}

              {metricas ? (
                <section className="mb-8">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">Métricas del catálogo</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Disponibles', metricas.insumos_disponibles, 'text-emerald-300'],
                      ['En uso', metricas.insumos_en_uso, 'text-cyan-300'],
                      ['Mantención', metricas.insumos_mantencion, 'text-sky-300'],
                      ['Fuera de servicio', metricas.insumos_fuera_servicio, 'text-red-300'],
                      ['Prestados', metricas.insumos_prestados, 'text-amber-300'],
                      ['No ubicables', metricas.insumos_no_ubicables, 'text-orange-300'],
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
              ) : null}

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Catálogo — observación por equipo</h3>
                <p className="mb-3 text-xs text-zinc-500">
                  «Préstamo / uso» muestra movimientos vigentes. «Observación (informe)» es opcional y solo se guarda en
                  este informe (el detalle del catálogo se sigue incluyendo al guardar).
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
                        {catalogo.map((row) => (
                          <tr key={row.id} className="border-b border-white/5 last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-300">
                              {codigoInventarioSeisDigitos(row.codigo_inventario)}
                            </td>
                            <td className="px-3 py-2 text-zinc-300">{row.tipo_soporte}</td>
                            <td className="max-w-[8rem] truncate px-3 py-2 text-zinc-200" title={row.modelo}>
                              {row.modelo}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:text-[11px] ${estadoBadgeClass(row.estado)}`}
                              >
                                {etiquetaEstadoInsumo(row.estado)}
                              </span>
                            </td>
                            <td className="w-[15rem] min-w-[13rem] max-w-[16rem] align-top px-3 py-2">
                              <CeldaContextoPrestamoUso
                                cargando={contextoOperativoLoading}
                                prestamo={prestamoPorId[row.id]}
                                uso={usoPorId[row.id]}
                                noUbicable={row.no_ubicable === true}
                              />
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <textarea
                                value={observaciones[row.id] ?? ''}
                                onChange={(e) =>
                                  setObservaciones((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                rows={2}
                                className="w-full min-w-[12rem] resize-y rounded-lg border border-white/15 bg-zinc-950/80 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                                placeholder="—"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {!errorCarga && chartData.length > 0 ? (
                <section className="mb-8">
                  <InformeMensualAreaChart year={year} data={chartData} />
                </section>
              ) : null}

              <section className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Usos en los últimos 30 días</h3>
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

              <section className="mb-8">
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

              {errorGuardar ? (
                <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {errorGuardar}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-5 py-4 md:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || loading || !!errorCarga || catalogo.length === 0}
            onClick={() => void handleGuardar()}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar informe'}
          </button>
        </div>
      </div>
    </div>
  )
}
