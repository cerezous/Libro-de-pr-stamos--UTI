import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { etiquetaEstadoInsumo } from '../../constants/estadoInsumo'
import {
  nombreCompletoDesdeUsuariosRow,
  type UsuarioNombreRow,
} from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import {
  fetchTodosPrestamosActivos,
  fetchTodosUsosActivos,
  fmtKlgoInforme,
  nombreInstaladorUso,
  nombrePrestadorPrestamo,
  resumenDevolucionesPrestamo,
  resumenSoportesPrestamo,
  type PrestamoActivoInformeRow,
  type UsoActivoInformeRow,
} from '../../lib/informeListasActivas'
import { lineasPdfDesdeObservacionesQuery, type InformePdfLinea } from '../../lib/informeInsumoPdf'
import { supabase } from '../../lib/supabase'
import { VerInformeModal } from './VerInformeModal'

const INFORMES_SELECT = `
  id,
  fecha_informe,
  id_responsable,
  insumos_disponibles,
  insumos_en_uso,
  insumos_mantencion,
  insumos_fuera_servicio,
  insumos_prestados,
  insumos_no_ubicables,
  responsable:usuarios!informes_insumos_id_responsable_fkey ( nombre1, nombre2, apellido1, apellido2 )
`

export type InformeInsumoRow = {
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

function mapInformeDesdeSupabase(raw: Record<string, unknown>): InformeInsumoRow {
  const rel = raw.responsable
  let responsable: UsuarioNombreRow | null = null
  if (rel && typeof rel === 'object' && !Array.isArray(rel)) {
    responsable = rel as UsuarioNombreRow
  } else if (Array.isArray(rel) && rel[0] && typeof rel[0] === 'object') {
    responsable = rel[0] as UsuarioNombreRow
  }
  return {
    id: raw.id as string,
    fecha_informe: raw.fecha_informe as string,
    id_responsable: raw.id_responsable as string,
    insumos_disponibles: Number(raw.insumos_disponibles ?? 0),
    insumos_en_uso: Number(raw.insumos_en_uso ?? 0),
    insumos_mantencion: Number(raw.insumos_mantencion ?? 0),
    insumos_fuera_servicio: Number(raw.insumos_fuera_servicio ?? 0),
    insumos_prestados: Number(raw.insumos_prestados ?? 0),
    insumos_no_ubicables: Number(raw.insumos_no_ubicables ?? 0),
    responsable,
  }
}

const COL_COUNT = 9

const thBase =
  'px-2 py-3 text-left text-[10px] font-medium leading-tight text-zinc-300 sm:px-3 sm:text-xs sm:leading-normal md:text-sm'

function fmtFechaInforme(iso: string | null) {
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

function nombreResponsable(row: InformeInsumoRow): string {
  const u = row.responsable
  if (u && typeof u === 'object') {
    const s = nombreCompletoDesdeUsuariosRow(u).trim()
    if (s) return s
  }
  return row.id_responsable ? `${row.id_responsable.slice(0, 8)}…` : '—'
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function insumosListadoPrestamo(p: PrestamoActivoInformeRow) {
  const junction = (p.prestamos_insumos ?? [])
    .filter((x) => x?.insumos)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  if (junction.length > 0) return junction.map((x) => x.insumos!).filter(Boolean)
  return p.insumos ? [p.insumos] : []
}

function usoActivoPorCodigoInventario(
  rows: UsoActivoInformeRow[],
  codigoRaw: string,
): UsoActivoInformeRow | null {
  const cod = codigoInventarioSeisDigitos(codigoRaw)
  for (const u of rows) {
    if (!u.insumos) continue
    if (codigoInventarioSeisDigitos(u.insumos.codigo_inventario) === cod) return u
  }
  return null
}

function prestamoActivoPorCodigoInventario(
  rows: PrestamoActivoInformeRow[],
  codigoRaw: string,
): PrestamoActivoInformeRow | null {
  const cod = codigoInventarioSeisDigitos(codigoRaw)
  for (const p of rows) {
    for (const ins of insumosListadoPrestamo(p)) {
      if (codigoInventarioSeisDigitos(ins.codigo_inventario) === cod) return p
    }
  }
  return null
}

/**
 * Texto de situación operativa (no ubicable, en uso, mantención, préstamo, etc.)
 * usando listas vigentes al imprimir / al abrir el detalle.
 */
function lineasSituacionInsumo(
  linea: Pick<InformePdfLinea, 'codigo_inventario' | 'estado' | 'no_ubicable'>,
  usos: UsoActivoInformeRow[],
  prestamos: PrestamoActivoInformeRow[],
): string[] {
  const parts: string[] = []
  const e = linea.estado.trim().toLowerCase()
  if (linea.no_ubicable) {
    parts.push('No ubicable actualmente, última información:')
  }
  if (e === 'en_uso') {
    const u = usoActivoPorCodigoInventario(usos, linea.codigo_inventario)
    if (u) {
      parts.push(
        `En uso en cama: fecha ${fmtFechaInforme(u.fecha_uso)} · cama ${u.cama?.trim() || '—'} · instala ${nombreInstaladorUso(u)}.`,
      )
      if (u.observaciones?.trim()) parts.push(`Observación del uso: ${u.observaciones.trim()}`)
    } else {
      parts.push('Estado en catálogo: en uso (no hay un uso activo vigente enlazado en este momento).')
    }
  } else if (e === 'prestado') {
    const pr = prestamoActivoPorCodigoInventario(prestamos, linea.codigo_inventario)
    if (pr) {
      const n = pr.numero_publico
      const num =
        n !== null && n !== undefined && String(n).trim() !== '' ? String(n) : pr.id.slice(0, 8)
      parts.push(
        `En préstamo Nº ${num}: ${fmtFechaInforme(pr.fecha_prestamo)} · servicio ${pr.servicio_prestamo?.trim() || '—'} · cama ${pr.cama_prestamo?.trim() || '—'} · estado préstamo «${pr.estado?.trim() || '—'}».`,
      )
      parts.push(`Soportes en el préstamo: ${resumenSoportesPrestamo(pr)}`)
      const prest = nombrePrestadorPrestamo(pr)
      if (prest && prest !== '—') parts.push(`Prestador: ${prest}`)
      parts.push(`Klgo. solicita: ${fmtKlgoInforme(pr.klgo_solicitante)}`)
      const dev = resumenDevolucionesPrestamo(pr)
      if (dev !== '—') parts.push(`Devoluciones: ${dev}`)
      if (pr.observaciones?.trim()) parts.push(`Observación del préstamo: ${pr.observaciones.trim()}`)
    } else {
      parts.push('Estado en catálogo: prestado (no hay un préstamo activo vigente enlazado en este momento).')
    }
  } else if (e === 'mantenimiento') {
    parts.push('En mantención.')
  } else if (e === 'fuera_de_servicio' || e === 'baja') {
    parts.push('Fuera de servicio.')
  } else if (e === 'disponible') {
    if (!linea.no_ubicable) parts.push('Disponible en almacén.')
  } else {
    parts.push(`Estado en catálogo: ${etiquetaEstadoInsumo(linea.estado)}.`)
  }
  return parts
}

/** HTML para ventana de impresión: resumen + catálogo completo (mismo criterio de filas que el PDF). */
function construirHtmlImpresionInforme(
  row: InformeInsumoRow,
  lineas: InformePdfLinea[],
  usos: UsoActivoInformeRow[],
  prestamos: PrestamoActivoInformeRow[],
): string {
  const fecha = fmtFechaInforme(row.fecha_informe)
  const resp = nombreResponsable(row)
  const rowsMetricas = [
    ['En uso', row.insumos_en_uso],
    ['Disponibles', row.insumos_disponibles],
    ['Mantención', row.insumos_mantencion],
    ['Fuera de servicio', row.insumos_fuera_servicio],
    ['Prestados', row.insumos_prestados],
    ['No ubicables', row.insumos_no_ubicables],
  ]
    .map(
      ([label, n]) =>
        `<tr><th>${escapeHtml(String(label))}</th><td class="num">${n}</td></tr>`,
    )
    .join('')

  const filasCatalogo =
    lineas.length === 0
      ? `<tr><td colspan="6" class="empty">No hay líneas de catálogo guardadas para este informe.</td></tr>`
      : lineas
          .map((linea) => {
            const cod = codigoInventarioSeisDigitos(linea.codigo_inventario)
            const est = escapeHtml(etiquetaEstadoInsumo(linea.estado))
            const situacionInner = lineasSituacionInsumo(linea, usos, prestamos)
              .map((ln) => escapeHtml(ln))
              .join('<br/>')
            return `<tr>
  <td class="num cod">${escapeHtml(cod)}</td>
  <td>${escapeHtml(linea.tipo_soporte)}</td>
  <td>${escapeHtml(linea.modelo)}</td>
  <td class="col-estado">${est}</td>
  <td class="pre situacion">${situacionInner}</td>
  <td class="pre obs">${escapeHtml(linea.observacion)}</td>
</tr>`
          })
          .join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Informe soportes ${escapeHtml(fecha)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 28px 0 10px; }
    .meta { margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    table.metricas { border-collapse: collapse; width: 100%; max-width: 420px; }
    table.metricas th, table.metricas td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    table.metricas th { background: #f4f4f5; font-weight: 600; width: 55%; }
    table.metricas td.num { font-variant-numeric: tabular-nums; text-align: right; }
    table.catalog { border-collapse: collapse; width: 100%; font-size: 10px; margin-top: 4px; table-layout: auto; }
    table.catalog th, table.catalog td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; vertical-align: top; word-break: break-word; }
    table.catalog thead th { background: #e4e4e7; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.02em; }
    /* Código: ancho según contenido (p. ej. 6 dígitos), sin forzar porcentaje */
    table.catalog th:first-child,
    table.catalog td.cod {
      white-space: nowrap;
      width: max-content;
      max-width: none;
    }
    table.catalog td.col-estado { min-width: 6.5rem; }
    table.catalog td.num { font-variant-numeric: tabular-nums; }
    table.catalog td.col-estado { white-space: normal; line-height: 1.35; }
    table.catalog td.pre { white-space: pre-wrap; }
    table.catalog td.situacion { font-size: 9px; }
    table.catalog td.obs { font-size: 9px; }
    table.catalog td.empty { text-align: center; color: #666; padding: 16px; }
    table.catalog thead { display: table-header-group; }
    table.catalog tr { page-break-inside: avoid; }
    @media print {
      body { padding: 12px; }
      table.catalog { font-size: 9px; }
      table.catalog th, table.catalog td { padding: 4px 5px; }
    }
  </style>
</head>
<body>
  <h1>Informe de soportes (insumos)</h1>
  <div class="meta">
    <p><strong>Fecha del informe:</strong> ${escapeHtml(fecha)}</p>
    <p><strong>Responsable:</strong> ${escapeHtml(resp)}</p>
  </div>
  <table class="metricas">
    <thead><tr><th>Concepto</th><th style="text-align:right">Cantidad</th></tr></thead>
    <tbody>${rowsMetricas}</tbody>
  </table>
  <h2>Catálogo completo</h2>
  <table class="catalog">
    <thead>
      <tr>
        <th>Código</th>
        <th>Tipo</th>
        <th>Modelo</th>
        <th>Estado</th>
        <th>Situación</th>
        <th>Observación</th>
      </tr>
    </thead>
    <tbody>${filasCatalogo}</tbody>
  </table>
</body>
</html>`
}

type InformesInsumosTableProps = {
  refreshSignal?: number
}

export function InformesInsumosTable({ refreshSignal = 0 }: InformesInsumosTableProps) {
  const [rows, setRows] = useState<InformeInsumoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [informeModalVer, setInformeModalVer] = useState<InformeInsumoRow | null>(null)
  const [imprimiendoInformeId, setImprimiendoInformeId] = useState<string | null>(null)

  const fetchRows = useCallback(() => {
    return supabase
      .from('informes_insumos')
      .select(INFORMES_SELECT)
      .order('fecha_informe', { ascending: false })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchRows().then(({ data, error: qErr }) => {
      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
        setRows([])
      } else {
        const list = (data ?? []) as Record<string, unknown>[]
        setRows(list.map(mapInformeDesdeSupabase))
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchRows, refreshSignal])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchRows().then(({ data, error: qErr }) => {
      if (qErr) {
        setError(qErr.message)
        setRows([])
      } else {
        const list = (data ?? []) as Record<string, unknown>[]
        setRows(list.map(mapInformeDesdeSupabase))
      }
      setLoading(false)
    })
  }, [fetchRows])

  const handleImprimirInforme = useCallback(async (row: InformeInsumoRow) => {
    setImprimiendoInformeId(row.id)
    try {
      const [obsRes, uAct, pAct] = await Promise.all([
        supabase
          .from('informes_insumos_observaciones')
          .select(
            'observacion, detalle, no_ubicable, id_insumo, insumos ( codigo_inventario, modelo, tipo_soporte, estado, detalle, no_ubicable )',
          )
          .eq('informe_id', row.id),
        fetchTodosUsosActivos(),
        fetchTodosPrestamosActivos(),
      ])
      const qErr = obsRes.error
      if (qErr) {
        window.alert(`No se pudo cargar el catálogo para imprimir: ${qErr.message}`)
        return
      }
      const lineas = lineasPdfDesdeObservacionesQuery((obsRes.data ?? []) as Record<string, unknown>[])
      const usos = uAct.ok ? uAct.rows : []
      const prestamos = pAct.ok ? pAct.rows : []
      const html = construirHtmlImpresionInforme(row, lineas, usos, prestamos)
      const w = window.open('', '_blank')
      if (!w) {
        window.alert('Permite ventanas emergentes para imprimir el informe.')
        return
      }
      w.document.write(html)
      w.document.close()
      w.focus()
      w.print()
    } finally {
      setImprimiendoInformeId(null)
    }
  }, [])

  let body: ReactNode
  if (loading) {
    body = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-400">
          Cargando informes…
        </td>
      </tr>
    )
  } else if (error) {
    body = (
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
    body = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-500">
          No hay informes todavía. Pulsa «Nuevo informe» para generar un snapshot del catálogo.
        </td>
      </tr>
    )
  } else {
    body = rows.map((row) => (
      <tr
        key={row.id}
        className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.04]"
      >
        <td className="min-w-[9rem] whitespace-nowrap px-3 py-3 text-xs tabular-nums text-zinc-200">
          {fmtFechaInforme(row.fecha_informe)}
        </td>
        <td className="min-w-[8rem] px-3 py-3 text-xs text-zinc-200">
          <span className="line-clamp-2 break-words" title={nombreResponsable(row)}>
            {nombreResponsable(row)}
          </span>
        </td>
        <td className="min-w-[3.5rem] px-2 py-3 text-center text-xs tabular-nums text-zinc-200 sm:px-3">
          {row.insumos_en_uso}
        </td>
        <td className="min-w-[3.5rem] px-2 py-3 text-center text-xs tabular-nums text-zinc-200 sm:px-3">
          {row.insumos_disponibles}
        </td>
        <td className="min-w-[3.5rem] px-2 py-3 text-center text-xs tabular-nums text-zinc-200 sm:px-3">
          {row.insumos_mantencion}
        </td>
        <td className="min-w-[3.5rem] px-2 py-3 text-center text-xs tabular-nums text-zinc-200 sm:px-3">
          {row.insumos_fuera_servicio}
        </td>
        <td className="min-w-[3.5rem] px-2 py-3 text-center text-xs tabular-nums text-zinc-200 sm:px-3">
          {row.insumos_prestados}
        </td>
        <td className="min-w-[3.5rem] px-2 py-3 text-center text-xs tabular-nums text-orange-200/95 sm:px-3">
          {row.insumos_no_ubicables}
        </td>
        <td className="min-w-[15rem] whitespace-nowrap px-2 py-3 sm:px-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setInformeModalVer(row)}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] font-medium text-zinc-200 transition-colors hover:bg-white/10 sm:text-xs"
            >
              Ver detalle
            </button>
            <button
              type="button"
              disabled={imprimiendoInformeId === row.id}
              onClick={() => void handleImprimirInforme(row)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
            >
              {imprimiendoInformeId === row.id ? 'Imprimiendo…' : 'Imprimir'}
            </button>
          </div>
        </td>
      </tr>
    ))
  }

  return (
    <>
      <div className="overflow-x-auto overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/20">
        <table className="min-w-[90rem] w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-800/60">
              <th className={`w-[12%] ${thBase}`}>Fecha informe</th>
              <th className={`w-[14%] ${thBase}`}>Responsable</th>
              <th className={`w-[7%] ${thBase} text-center`}>En uso</th>
              <th className={`w-[7%] ${thBase} text-center`}>Disponibles</th>
              <th className={`w-[8%] ${thBase} text-center`}>Mantención</th>
              <th className={`w-[9%] ${thBase} text-center`}>Fuera de servicio</th>
              <th className={`w-[8%] ${thBase} text-center`}>Prestados</th>
              <th className={`w-[8%] ${thBase} text-center`}>No ubic.</th>
              <th className={`w-[16%] ${thBase}`}>Acciones</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>

      <VerInformeModal
        open={informeModalVer !== null}
        onClose={() => setInformeModalVer(null)}
        informe={informeModalVer}
        onImprimir={handleImprimirInforme}
        imprimiendo={
          informeModalVer !== null && imprimiendoInformeId === informeModalVer.id
        }
      />
    </>
  )
}

/** Mismo estilo que «Nuevo préstamo» / «Agregar insumo». */
export function BotonNuevoInforme({
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
      Nuevo informe
    </button>
  )
}
