import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { ESTADO_PRESTAMO_PARCIAL, estadoPrestamoBadgeClass } from '../../constants/estadoPrestamo'
import { SERVICIOS_PRESTAMO } from '../../constants/serviciosPrestamo'
import {
  nombreCompletoDesdeUsuariosRow,
  type UsuarioNombreRow,
} from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { lineasInventariadoPrestamo, type PrestamoInsumoJunction } from '../../lib/prestamosLineasInventario'
import { supabase } from '../../lib/supabase'

type InsumoEmbed = {
  codigo_inventario: string
  modelo: string
  numero: string
  codigo_minsal: string
  tipo_soporte: string
} | null

export type OtroInsumoRow = {
  id: string
  descripcion: string
  orden: number
}

export type PrestamoDevolucionActo = {
  /** Fila `prestamos_devoluciones.id` (para enlazar ítems devueltos). */
  id?: string
  fecha: string
  id_recibidor: string | null
  /** Embed `usuarios` del usuario que recepciona (`id_recibidor`). */
  recibidor?: UsuarioNombreRow | null
  klgo_recibe: number | string | null
  kinesiologo_devuelve: string
  /** Líneas de texto: ítems devueltos en ese acto (insumos / otros). */
  detalleLineas?: string[]
}

export type PrestamoRow = {
  id: string
  id_insumo: string | null
  /** Usuario que registra / entrega el préstamo (`usuarios.id` = `auth.users.id`). */
  id_prestador: string | null
  /** Fila `usuarios` del prestador (`id_prestador`); embed vía `prestamos_id_prestador_fkey`. */
  prestador?: UsuarioNombreRow | null
  /** Código corto 1–999999 (columna `numero_publico`). */
  numero_publico: number | string | null
  fecha_prestamo: string
  servicio_prestamo: string
  cama_prestamo: string | null
  klgo_solicitante: number | string | null
  fecha_devolucion: string | null
  /** Usuario que recepciona al cierre total (`prestamos.id_recibidor`). */
  id_recibidor: string | null
  /** Embed del recepcionista final; FK `prestamos_id_recibidor_fkey`. */
  recibidor_final?: UsuarioNombreRow | null
  klgo_devuelve: number | string | null
  observaciones: string | null
  estado: string
  insumos: InsumoEmbed | null
  prestamos_insumos?: PrestamoInsumoJunction[] | null
  prestamos_otros_insumos?: OtroInsumoRow[] | null
  /** Ids `id_insumo` con al menos un registro en `prestamos_devoluciones_items`. */
  insumosDevueltosIds?: string[]
  /** Ids de fila `prestamos_otros_insumos` devueltos al menos una vez. */
  otrosInsumosDevueltosIds?: string[]
  /** Actos en `prestamos_devoluciones` (fecha, Klgo. recepción, quién devuelve). */
  devolucionesActos?: PrestamoDevolucionActo[]
}

const COL_COUNT = 9

const thBase =
  'px-2 py-3 text-left text-[10px] font-medium leading-tight text-zinc-300 sm:px-3 sm:text-xs sm:leading-normal md:text-sm'

function fmtFecha(iso: string | null) {
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

function fmtKlgo(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return String(n)
}

function InsumoPrincipalLine({ ins }: { ins: InsumoEmbed }) {
  if (!ins) return <span>—</span>
  const modelo = ins.modelo?.trim() || ins.tipo_soporte?.trim() || '—'
  const cod = codigoInventarioSeisDigitos(ins.codigo_inventario)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-medium text-zinc-100">{modelo}</span>
      <span className="font-medium tabular-nums text-emerald-400">({cod})</span>
    </span>
  )
}

/** Icono alineado al tamaño de fuente del renglón (`1em`). */
function IconoEstadoDevolucionLinea({ devuelto }: { devuelto: boolean }) {
  if (devuelto) {
    return (
      <span className="inline-flex shrink-0 text-emerald-400" title="Devuelto" aria-label="Devuelto">
        <svg className="h-[1em] w-[1em]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53-1.97-1.97a.75.75 0 10-1.06 1.06l2.75 2.75a.75.75 0 001.14-.094l3.75-5.25z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 text-amber-400/95"
      title="Pendiente de devolución"
      aria-label="Pendiente de devolución"
    >
      <svg className="h-[1em] w-[1em]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

function prestamoEstadoEsDevueltoTotal(row: PrestamoRow): boolean {
  return row.estado.trim().toLowerCase() === 'devuelto'
}

function insumoMarcadoComoDevuelto(row: PrestamoRow, idInsumo: string): boolean {
  if (prestamoEstadoEsDevueltoTotal(row)) return true
  return (row.insumosDevueltosIds ?? []).includes(idInsumo)
}

function otroInsumoMarcadoComoDevuelto(row: PrestamoRow, otroId: string): boolean {
  if (prestamoEstadoEsDevueltoTotal(row)) return true
  return (row.otrosInsumosDevueltosIds ?? []).includes(otroId)
}

function otrosInsumoRowsOrdenados(row: PrestamoRow): OtroInsumoRow[] {
  const arr = row.prestamos_otros_insumos
  if (!arr?.length) return []
  return [...arr]
    .sort((a, b) => a.orden - b.orden)
    .filter((o) => o.descripcion.trim())
}

function InsumosCelda({ row }: { row: PrestamoRow }) {
  const otrosRows = otrosInsumoRowsOrdenados(row)
  const inv = lineasInventariadoPrestamo(row)
  const lineClass = 'flex items-start gap-1.5 text-xs leading-snug sm:text-sm'
  if (inv.length > 0) {
    return (
      <div className="flex flex-col gap-1.5 break-words text-zinc-200">
        {inv.map((line) => (
          <div key={line.id_insumo} className={lineClass}>
            <span className="mt-[0.12em] shrink-0">
              <IconoEstadoDevolucionLinea devuelto={insumoMarcadoComoDevuelto(row, line.id_insumo)} />
            </span>
            <span className="min-w-0">
              <InsumoPrincipalLine ins={line.insumos} />
            </span>
          </div>
        ))}
        {otrosRows.map((o) => (
          <div key={o.id} className={lineClass}>
            <span className="mt-[0.12em] shrink-0">
              <IconoEstadoDevolucionLinea devuelto={otroInsumoMarcadoComoDevuelto(row, o.id)} />
            </span>
            <span className="min-w-0 border-l border-zinc-600 pl-2 text-[11px] text-zinc-400 sm:text-sm">
              {o.descripcion.trim()}
            </span>
          </div>
        ))}
      </div>
    )
  }
  if (otrosRows.length > 0) {
    return (
      <div className="flex flex-col gap-1.5 break-words text-zinc-200">
        {otrosRows.map((o, idx) => (
          <div key={o.id} className={lineClass}>
            <span className="mt-[0.12em] shrink-0">
              <IconoEstadoDevolucionLinea devuelto={otroInsumoMarcadoComoDevuelto(row, o.id)} />
            </span>
            <span
              className={
                idx === 0
                  ? 'min-w-0 font-medium text-zinc-100'
                  : 'min-w-0 border-l border-zinc-600 pl-2 text-[11px] text-zinc-400 sm:text-sm'
              }
            >
              {o.descripcion.trim()}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return <span className="text-zinc-500">—</span>
}

/** Actos a mostrar: filas en `prestamos_devoluciones`; si no hay, cierre en `prestamos` si existe. */
function actosDevolucionParaMostrar(row: PrestamoRow): PrestamoDevolucionActo[] {
  const actos = row.devolucionesActos ?? []
  if (actos.length > 0) return actos
  if (row.fecha_devolucion) {
    return [
      {
        fecha: row.fecha_devolucion,
        id_recibidor: row.id_recibidor ?? null,
        recibidor: row.recibidor_final ?? null,
        klgo_recibe: null,
        kinesiologo_devuelve:
          row.klgo_devuelve != null && row.klgo_devuelve !== ''
            ? String(fmtKlgo(row.klgo_devuelve))
            : '',
        detalleLineas: [],
      },
    ]
  }
  return []
}

function textoCodigoPrestamo(row: { id: string; numero_publico: number | string | null }) {
  const n =
    row.numero_publico === null || row.numero_publico === undefined
      ? NaN
      : typeof row.numero_publico === 'string'
        ? Number(row.numero_publico)
        : row.numero_publico
  if (Number.isFinite(n) && n >= 1 && n <= 999_999) {
    return String(Math.floor(n))
  }
  return row.id
}

/** Texto plano para buscar en préstamo (insumos, personas, servicio, devoluciones, etc.). */
function textoBusquedaPrestamo(row: PrestamoRow): string {
  const parts: string[] = []
  parts.push(textoCodigoPrestamo(row), row.id)
  parts.push(row.servicio_prestamo, row.cama_prestamo ?? '', row.estado, row.observaciones ?? '')
  parts.push(fmtKlgo(row.klgo_solicitante), fmtKlgo(row.klgo_devuelve))
  if (row.prestador && typeof row.prestador === 'object') {
    parts.push(nombreCompletoDesdeUsuariosRow(row.prestador as UsuarioNombreRow))
  }
  if (row.recibidor_final && typeof row.recibidor_final === 'object') {
    parts.push(nombreCompletoDesdeUsuariosRow(row.recibidor_final as UsuarioNombreRow))
  }
  for (const line of lineasInventariadoPrestamo(row)) {
    parts.push(
      line.insumos.modelo,
      line.insumos.tipo_soporte,
      codigoInventarioSeisDigitos(line.insumos.codigo_inventario),
    )
  }
  for (const o of row.prestamos_otros_insumos ?? []) {
    parts.push(o.descripcion)
  }
  const actos = actosDevolucionParaMostrar(row)
  for (const acto of actos) {
    if (acto.recibidor && typeof acto.recibidor === 'object') {
      parts.push(nombreCompletoDesdeUsuariosRow(acto.recibidor as UsuarioNombreRow))
    }
    parts.push(acto.kinesiologo_devuelve, fmtKlgo(acto.klgo_recibe))
    for (const l of acto.detalleLineas ?? []) parts.push(l)
  }
  return parts.join(' ').toLowerCase()
}

type FiltroEstadoValor = '' | 'en_curso' | 'parcial' | 'devuelto' | 'otro'

function prestamoPasaFiltros(
  row: PrestamoRow,
  q: string,
  filtroEstado: FiltroEstadoValor,
  filtroServicio: string,
  soloSinDevolver: boolean,
): boolean {
  if (soloSinDevolver && row.estado.trim().toLowerCase() === 'devuelto') {
    return false
  }
  if (filtroEstado) {
    const e = row.estado.trim().toLowerCase()
    if (filtroEstado === 'en_curso' && e !== 'a préstamo' && e !== 'activo') return false
    if (filtroEstado === 'parcial' && !e.includes('parcial')) return false
    if (filtroEstado === 'devuelto' && e !== 'devuelto') return false
    if (
      filtroEstado === 'otro' &&
      (e === 'a préstamo' || e === 'activo' || e.includes('parcial') || e === 'devuelto')
    ) {
      return false
    }
  }
  if (filtroServicio && row.servicio_prestamo.trim() !== filtroServicio) {
    return false
  }
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const hay = textoBusquedaPrestamo(row)
  const tokens = needle.split(/\s+/).filter(Boolean)
  return tokens.every((t) => hay.includes(t))
}

/** Carga filas de otros insumos sin embed (evita error de PostgREST si falta FK en el catálogo). */
async function fetchOtrosInsumosPorPrestamoIds(
  prestamoIds: string[],
): Promise<Map<string, OtroInsumoRow[]>> {
  const map = new Map<string, OtroInsumoRow[]>()
  if (prestamoIds.length === 0) return map
  const { data, error } = await supabase
    .from('prestamos_otros_insumos')
    .select('id, prestamo_id, descripcion, orden')
    .in('prestamo_id', prestamoIds)
  if (error) throw error
  for (const r of data ?? []) {
    const pid = r.prestamo_id as string
    const list = map.get(pid) ?? []
    list.push({ id: r.id as string, descripcion: r.descripcion, orden: r.orden })
    map.set(pid, list)
  }
  return map
}

async function fetchDevolucionesItemsPorPrestamoIds(
  prestamoIds: string[],
): Promise<Map<string, { insumos: string[]; otros: string[] }>> {
  const map = new Map<string, { insumos: string[]; otros: string[] }>()
  if (prestamoIds.length === 0) return map
  const { data, error } = await supabase
    .from('prestamos_devoluciones_items')
    .select('prestamo_id, id_insumo, prestamos_otros_insumos_id')
    .in('prestamo_id', prestamoIds)
  if (error) throw error
  for (const r of data ?? []) {
    const pid = r.prestamo_id as string
    let entry = map.get(pid)
    if (!entry) {
      entry = { insumos: [], otros: [] }
      map.set(pid, entry)
    }
    const idi = r.id_insumo as string | null
    if (idi && !entry.insumos.includes(idi)) entry.insumos.push(idi)
    const oid = r.prestamos_otros_insumos_id as string | null
    if (oid && !entry.otros.includes(oid)) entry.otros.push(oid)
  }
  return map
}

async function fetchDetalleLineasPorPrestamoIds(
  prestamoIds: string[],
): Promise<Map<string, string[]>> {
  const porDevolucion = new Map<string, string[]>()
  if (prestamoIds.length === 0) return porDevolucion
  const { data, error } = await supabase
    .from('prestamos_devoluciones_items')
    .select(
      `
      devolucion_id,
      id_insumo,
      prestamos_otros_insumos_id,
      insumos ( modelo, tipo_soporte, codigo_inventario ),
      prestamos_otros_insumos ( descripcion )
    `,
    )
    .in('prestamo_id', prestamoIds)
  if (error) throw error
  for (const r of data ?? []) {
    const did = r.devolucion_id as string
    let line: string
    if (r.id_insumo) {
      const ins = r.insumos as {
        modelo?: string
        tipo_soporte?: string
        codigo_inventario?: string
      } | null
      const modelo = ins?.modelo?.trim() || ins?.tipo_soporte?.trim() || 'Soporte'
      const cod = ins?.codigo_inventario ? codigoInventarioSeisDigitos(ins.codigo_inventario) : '—'
      line = `${modelo} (${cod})`
    } else if (r.prestamos_otros_insumos_id) {
      const o = r.prestamos_otros_insumos as { descripcion?: string } | null
      line = o?.descripcion?.trim() || 'Otro insumo'
    } else {
      continue
    }
    const list = porDevolucion.get(did) ?? []
    list.push(line)
    porDevolucion.set(did, list)
  }
  return porDevolucion
}

async function fetchActosDevolucionPorPrestamoIds(
  prestamoIds: string[],
): Promise<Map<string, PrestamoDevolucionActo[]>> {
  const map = new Map<string, PrestamoDevolucionActo[]>()
  if (prestamoIds.length === 0) return map
  const { data, error } = await supabase
    .from('prestamos_devoluciones')
    .select(
      `id, prestamo_id, fecha, klgo_recibe, kinesiologo_devuelve, id_recibidor,
      recibidor:usuarios!prestamos_devoluciones_id_recibidor_fkey ( nombre1, nombre2, apellido1, apellido2 )`,
    )
    .in('prestamo_id', prestamoIds)
  if (error) throw error
  for (const r of data ?? []) {
    const pid = r.prestamo_id as string
    const list = map.get(pid) ?? []
    const row = r as unknown as {
      id: string
      fecha: string
      klgo_recibe: number | string | null
      kinesiologo_devuelve?: string
      id_recibidor?: string | null
      recibidor?: UsuarioNombreRow | UsuarioNombreRow[] | null
    }
    const recibidorNorm =
      row.recibidor == null
        ? null
        : Array.isArray(row.recibidor)
          ? row.recibidor[0] ?? null
          : row.recibidor
    list.push({
      id: row.id,
      fecha: row.fecha,
      id_recibidor: row.id_recibidor ?? null,
      recibidor: recibidorNorm,
      klgo_recibe: row.klgo_recibe,
      kinesiologo_devuelve: String(row.kinesiologo_devuelve ?? ''),
    })
    map.set(pid, list)
  }
  for (const [pid, arr] of map) {
    arr.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    map.set(pid, arr)
  }
  return map
}


function etiquetaBotonDevolver(estado: string) {
  const e = estado.trim().toLowerCase()
  if (e === ESTADO_PRESTAMO_PARCIAL.toLowerCase() || e.includes('parcial')) {
    return 'Seguir devolución'
  }
  return 'Devolver'
}

type PrestamosTableProps = {
  /** Al incrementarse, se vuelve a cargar la tabla (p. ej. tras crear un préstamo). */
  refreshSignal?: number
  onDevolver?: (row: PrestamoRow) => void
}

export function PrestamosTable({ refreshSignal = 0, onDevolver }: PrestamosTableProps) {
  const busquedaId = useId()
  const filtroEstadoId = useId()
  const filtroServicioId = useId()
  const soloPendientesId = useId()

  const [rows, setRows] = useState<PrestamoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoValor>('')
  const [filtroServicio, setFiltroServicio] = useState('')
  const [soloSinDevolver, setSoloSinDevolver] = useState(false)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

  const filasVisibles = useMemo(
    () =>
      rows.filter((row) =>
        prestamoPasaFiltros(row, busqueda, filtroEstado, filtroServicio, soloSinDevolver),
      ),
    [rows, busqueda, filtroEstado, filtroServicio, soloSinDevolver],
  )

  const filtrosActivos =
    Boolean(filtroEstado) || Boolean(filtroServicio) || soloSinDevolver

  const fetchRows = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('prestamos')
      .select(
        `
        id,
        id_insumo,
        id_prestador,
        prestador:usuarios!prestamos_id_prestador_fkey ( nombre1, nombre2, apellido1, apellido2 ),
        numero_publico,
        fecha_prestamo,
        servicio_prestamo,
        cama_prestamo,
        klgo_solicitante,
        fecha_devolucion,
        id_recibidor,
        recibidor_final:usuarios!prestamos_id_recibidor_fkey ( nombre1, nombre2, apellido1, apellido2 ),
        klgo_devuelve,
        observaciones,
        estado,
        insumos ( codigo_inventario, modelo, numero, codigo_minsal, tipo_soporte ),
        prestamos_insumos (
          orden,
          id_insumo,
          insumos ( codigo_inventario, modelo, numero, codigo_minsal, tipo_soporte )
        )
      `,
      )
      .order('fecha_prestamo', { ascending: false })
    if (qError) return { data: null, error: qError }
    const rows = (data ?? []) as unknown as PrestamoRow[]
    try {
      const ids = rows.map((r) => r.id)
      const [otrosMap, devMap, actosMap, detallePorDev] = await Promise.all([
        fetchOtrosInsumosPorPrestamoIds(ids),
        fetchDevolucionesItemsPorPrestamoIds(ids),
        fetchActosDevolucionPorPrestamoIds(ids),
        fetchDetalleLineasPorPrestamoIds(ids),
      ])
      for (const row of rows) {
        row.prestamos_otros_insumos = otrosMap.get(row.id) ?? []
        const d = devMap.get(row.id)
        row.insumosDevueltosIds = d?.insumos ?? []
        row.otrosInsumosDevueltosIds = d?.otros ?? []
        const actos = actosMap.get(row.id) ?? []
        for (const acto of actos) {
          if (acto.id) {
            acto.detalleLineas = detallePorDev.get(acto.id) ?? []
          }
        }
        row.devolucionesActos = actos
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { data: null, error: { message: msg } }
    }
    return { data: rows, error: null }
  }, [])

  const applyFetchResult = useCallback(
    (qError: { message: string } | null, data: PrestamoRow[] | null) => {
      if (qError) {
        setError(qError.message)
        setRows([])
      } else {
        setError(null)
        setRows((data ?? []) as PrestamoRow[])
      }
    },
    [],
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchRows().then(({ data, error: qError }) => {
      if (!active) return
      applyFetchResult(qError, data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [fetchRows, applyFetchResult, refreshSignal])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    void fetchRows().then(({ data, error: qError }) => {
      applyFetchResult(qError, data)
      setLoading(false)
    })
  }, [fetchRows, applyFetchResult])

  const td = 'min-w-0 px-2 py-3 align-top text-xs text-zinc-200 sm:px-3 sm:text-sm'

  let tbodyContent: ReactNode
  if (loading) {
    tbodyContent = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-400">
          Cargando préstamos…
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
          No hay préstamos registrados. Los nuevos registros aparecerán aquí.
        </td>
      </tr>
    )
  } else if (filasVisibles.length === 0) {
    tbodyContent = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-400">
          Ningún préstamo coincide con la búsqueda o los filtros. Ajusta los criterios o limpia filtros.
        </td>
      </tr>
    )
  } else {
    tbodyContent = filasVisibles.map((row) => (
      <tr
        key={row.id}
        className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.04]"
      >
        <td className={td}>
          <span
            className="block font-mono text-xs tabular-nums leading-snug text-emerald-200/90 sm:text-sm"
            title={`${textoCodigoPrestamo(row)} · ${row.id}`}
          >
            {textoCodigoPrestamo(row)}
          </span>
        </td>
        <td className={td}>
          {(() => {
            const kSol = fmtKlgo(row.klgo_solicitante)
            const nombreEntrega =
              row.prestador && typeof row.prestador === 'object'
                ? nombreCompletoDesdeUsuariosRow(row.prestador as UsuarioNombreRow).trim()
                : ''
            const titulo = [
              fmtFecha(row.fecha_prestamo),
              nombreEntrega ? `${nombreEntrega} (entrega)` : 'Sin prestador en catálogo',
              `Klgo. ${kSol} (solicita)`,
            ].join(' · ')
            return (
              <div
                className="min-w-0 whitespace-normal break-words"
                title={titulo}
              >
                <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
                  {fmtFecha(row.fecha_prestamo)}
                </span>
                {nombreEntrega ? (
                  <>
                    <p className="mt-1 text-[10px] font-medium leading-snug text-zinc-100 sm:text-[11px]">
                      {nombreEntrega}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-tight text-zinc-500 sm:text-[10px]">(entrega)</p>
                  </>
                ) : (
                  <p className="mt-2 text-[9px] leading-tight text-amber-200/80 sm:text-[10px]">
                    Sin datos del prestador en el catálogo: completa tu ficha en usuarios o revisa el registro.
                  </p>
                )}
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
                  <span className="text-zinc-400">Klgo.</span>{' '}
                  <span className="font-medium tabular-nums text-zinc-100">{kSol}</span>
                </p>
                <p className="mt-0.5 text-[9px] leading-tight text-zinc-500 sm:text-[10px]">(solicita)</p>
              </div>
            )
          })()}
        </td>
        <td className={td}>
          <InsumosCelda row={row} />
        </td>
        <td className={td}>
          <span className="block truncate" title={row.servicio_prestamo}>
            {row.servicio_prestamo}
          </span>
        </td>
        <td className={td}>
          <span className="block truncate" title={row.cama_prestamo ?? ''}>
            {row.cama_prestamo?.trim() ? row.cama_prestamo : '—'}
          </span>
        </td>
        <td className={td}>
          {(() => {
            const actos = actosDevolucionParaMostrar(row)
            if (actos.length === 0) {
              return <span className="text-zinc-500">—</span>
            }
            return (
              <div className="flex flex-col gap-1.5">
                {actos.map((acto, i) => (
                  <div
                    key={acto.id ?? `${acto.fecha}-${i}`}
                    className="border-b border-white/[0.06] pb-1.5 last:border-b-0 last:pb-0"
                    title={fmtFecha(acto.fecha)}
                  >
                    <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
                      {fmtFecha(acto.fecha)}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
        </td>
        <td className={td}>
          {(() => {
            const actos = actosDevolucionParaMostrar(row)
            if (actos.length === 0) {
              return <span className="text-zinc-500">—</span>
            }
            return (
              <div className="flex flex-col gap-1.5">
                {actos.map((acto, i) => {
                  const kRec = fmtKlgo(acto.klgo_recibe)
                  const nombreRecepcion =
                    acto.recibidor && typeof acto.recibidor === 'object'
                      ? nombreCompletoDesdeUsuariosRow(acto.recibidor as UsuarioNombreRow).trim()
                      : ''
                  const etiquetaRecepcion =
                    nombreRecepcion ||
                    (kRec !== '—' ? `Klgo. ${kRec}` : '')
                  const kine = acto.kinesiologo_devuelve.trim()
                  const lineas = acto.detalleLineas ?? []
                  const titulo = [
                    etiquetaRecepcion ? `Recepciona ${etiquetaRecepcion}` : null,
                    kine ? `Devuelve: ${kine}` : null,
                    ...lineas,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <div
                      key={acto.id ?? `det-${acto.fecha}-${i}`}
                      className="border-b border-white/[0.06] pb-1.5 last:border-b-0 last:pb-0"
                      title={titulo || undefined}
                    >
                      <p className="text-[10px] leading-snug text-zinc-100 sm:text-[11px]">
                        <span className="text-zinc-500">Recepciona</span>{' '}
                        {etiquetaRecepcion ? (
                          <span className="font-medium">{etiquetaRecepcion}</span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </p>
                      {kine ? (
                        <p className="mt-1 text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
                          <span className="text-zinc-500">Devuelve</span> {kine}
                        </p>
                      ) : null}
                      {lineas.map((line, j) => (
                        <p
                          key={`${acto.id ?? acto.fecha}-d-${j}`}
                          className="mt-1 text-[10px] leading-snug text-zinc-200 sm:text-[11px]"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </td>
        <td className={td}>
          <span
            className={`inline-block max-w-full whitespace-normal break-words rounded-2xl px-2 py-0.5 text-center text-[10px] font-medium leading-snug ring-1 ring-inset sm:px-2.5 sm:text-xs ${estadoPrestamoBadgeClass(row.estado)}`}
            title={row.estado}
          >
            {row.estado}
          </span>
        </td>
        <td className={`${td} whitespace-nowrap`}>
          {onDevolver && row.estado.trim().toLowerCase() !== 'devuelto' ? (
            <button
              type="button"
              onClick={() => onDevolver(row)}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-200/95 hover:bg-sky-500/15"
            >
              {etiquetaBotonDevolver(row.estado)}
            </button>
          ) : null}
        </td>
      </tr>
    ))
  }

  const inputToolbar =
    'w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 pl-9 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30'
  const selectToolbar =
    'w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30'

  return (
    <>
      <div className="mb-4 w-full max-w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-3 shadow-lg shadow-black/15 sm:px-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Buscar y filtrar</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <span
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
              aria-hidden
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </span>
            <label htmlFor={busquedaId} className="sr-only">
              Buscar préstamos
            </label>
            <input
              id={busquedaId}
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, servicio, insumo, nombre, Klgo…"
              className={inputToolbar}
              autoComplete="off"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                filtrosAbiertos || filtrosActivos
                  ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 bg-zinc-950 text-zinc-200 hover:bg-white/5'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                />
              </svg>
              Filtros
              {filtrosActivos ? (
                <span className="rounded-full bg-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
                  activos
                </span>
              ) : null}
            </button>
            {(busqueda.trim() || filtrosActivos) && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setFiltroEstado('')
                  setFiltroServicio('')
                  setSoloSinDevolver(false)
                }}
                className="rounded-lg px-2 py-2 text-xs font-medium text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        {filtrosAbiertos ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-zinc-950/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={filtroEstadoId} className="mb-1 block text-[11px] font-medium text-zinc-500">
                Estado
              </label>
              <select
                id={filtroEstadoId}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as FiltroEstadoValor)}
                className={selectToolbar}
              >
                <option value="">Todos</option>
                <option value="en_curso">A préstamo / en curso</option>
                <option value="parcial">Parcialmente devuelto</option>
                <option value="devuelto">Devuelto</option>
                <option value="otro">Otro estado</option>
              </select>
            </div>
            <div>
              <label htmlFor={filtroServicioId} className="mb-1 block text-[11px] font-medium text-zinc-500">
                Servicio
              </label>
              <select
                id={filtroServicioId}
                value={filtroServicio}
                onChange={(e) => setFiltroServicio(e.target.value)}
                className={selectToolbar}
              >
                <option value="">Todos</option>
                {SERVICIOS_PRESTAMO.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end sm:col-span-2 lg:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2.5">
                <input
                  id={soloPendientesId}
                  type="checkbox"
                  checked={soloSinDevolver}
                  onChange={(e) => setSoloSinDevolver(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/40"
                />
                <span className="text-sm text-zinc-200">Solo préstamos sin devolver (ocultar devueltos)</span>
              </label>
            </div>
          </div>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <p className="mt-3 text-[11px] text-zinc-500">
            Mostrando <span className="font-medium text-zinc-300">{filasVisibles.length}</span> de{' '}
            <span className="font-medium text-zinc-300">{rows.length}</span> préstamos
          </p>
        ) : null}
      </div>

      <div className="w-full max-w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/20">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-800/60">
                <th className={`${thBase} w-[9%]`}>Código</th>
                <th className={`${thBase} w-[13%]`}>
                  <span className="block">Fecha préstamo</span>
                  <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-zinc-500 sm:text-[10px]">
                    Prestador (entrega) · solicita
                  </span>
                </th>
                <th className={`${thBase} w-[17%]`}>Insumo(s)</th>
                <th className={`${thBase} w-[14%]`}>Servicio</th>
                <th className={`${thBase} w-[8%]`}>Cama</th>
                <th className={`${thBase} w-[13%]`}>
                  <span className="block">Fecha devolución</span>
                  <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-zinc-500 sm:text-[10px]">
                    Fecha del acto
                  </span>
                </th>
                <th className={`${thBase} w-[13%]`}>
                  <span className="block">Detalle devolución</span>
                  <span className="mt-0.5 block text-[9px] font-normal normal-case tracking-normal text-zinc-500 sm:text-[10px]">
                    Recepción · devuelve · ítems
                  </span>
                </th>
                <th className={`${thBase} w-[9%]`}>Estado</th>
                <th className={`${thBase} w-[9%]`}>Acciones</th>
              </tr>
            </thead>
            <tbody>{tbodyContent}</tbody>
          </table>
        </div>
      </div>
    </>
  )
}
