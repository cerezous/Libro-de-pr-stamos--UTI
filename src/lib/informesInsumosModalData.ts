import { TIPOS_SOPORTE } from '../components/insumos/tiposSoporte'
import { insumosDbSinColumnasEstadoManual, supabase } from './supabase'

export type InsumoCatalogoInforme = {
  id: string
  codigo_inventario: string
  tipo_soporte: string
  modelo: string
  numero: string
  estado: string
  no_ubicable: boolean
  /** Campo `insumos.detalle` (texto libre de catálogo). */
  detalle: string | null
}

function mapInsumoRaw(raw: Record<string, unknown>): InsumoCatalogoInforme {
  const nu = raw.no_ubicable
  const noUbicable = typeof nu === 'boolean' ? nu : String(nu).toLowerCase() === 'true'
  return {
    id: raw.id as string,
    codigo_inventario: String(raw.codigo_inventario ?? ''),
    tipo_soporte: String(raw.tipo_soporte ?? ''),
    modelo: String(raw.modelo ?? ''),
    numero: String(raw.numero ?? ''),
    estado: String(raw.estado ?? ''),
    no_ubicable: noUbicable,
    detalle:
      'detalle' in raw && raw.detalle != null && String(raw.detalle).trim() !== ''
        ? String(raw.detalle)
        : null,
  }
}

function tipoSoporteRank(tipo: string): number {
  const t = tipo.trim()
  const i = TIPOS_SOPORTE.indexOf(t as (typeof TIPOS_SOPORTE)[number])
  if (i !== -1) return i
  return TIPOS_SOPORTE.length
}

export function sortInsumosCatalogoInforme(rows: InsumoCatalogoInforme[]): InsumoCatalogoInforme[] {
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

/** Catálogo mínimo para el modal de informe (misma columna base que InsumosTable). */
export async function fetchInsumosCatalogoInforme(): Promise<
  { ok: true; rows: InsumoCatalogoInforme[] } | { ok: false; message: string }
> {
  const selAuditoria =
    'id, codigo_inventario, tipo_soporte, modelo, numero, estado, no_ubicable, detalle'
  const selBase = 'id, codigo_inventario, tipo_soporte, modelo, numero, estado, detalle'

  let { data, error: qError } = await supabase.from('insumos').select(selAuditoria)
  if (qError && insumosDbSinColumnasEstadoManual(qError.message)) {
    ;({ data, error: qError } = await supabase.from('insumos').select(selBase))
  }
  if (qError) {
    return { ok: false, message: qError.message }
  }
  const raw = (data ?? []) as Record<string, unknown>[]
  const rows = raw.map((r) => {
    const m = mapInsumoRaw(r)
    if (!('no_ubicable' in r)) {
      return { ...m, no_ubicable: false }
    }
    return m
  })
  return { ok: true, rows: sortInsumosCatalogoInforme(rows) }
}

const USOS_MODAL = `
  id,
  id_insumo,
  cama,
  observaciones,
  fecha_uso,
  fecha_devolucion,
  insumos ( codigo_inventario, modelo, numero, codigo_minsal, tipo_soporte, estado ),
  klgo_instalador:usuarios!usos_id_klgo_fkey ( nombre1, nombre2, apellido1, apellido2 ),
  klgo_recepcion:usuarios!usos_id_klgo_devuelve_fkey ( nombre1, nombre2, apellido1, apellido2 )
`

export type UsoModalRow = {
  id: string
  id_insumo: string
  cama: string | null
  observaciones: string | null
  fecha_uso: string
  fecha_devolucion: string | null
  insumos: {
    codigo_inventario: string
    modelo: string
    numero: string
    codigo_minsal: string
    tipo_soporte: string
    estado: string
  } | null
  klgo_instalador?: { nombre1: string; nombre2: string | null; apellido1: string; apellido2: string | null } | null
  klgo_recepcion?: { nombre1: string; nombre2: string | null; apellido1: string; apellido2: string | null } | null
}

const PRESTAMOS_MODAL = `
  id,
  numero_publico,
  fecha_prestamo,
  servicio_prestamo,
  cama_prestamo,
  klgo_solicitante,
  estado,
  observaciones,
  fecha_devolucion,
  insumos ( codigo_inventario, modelo, numero, tipo_soporte ),
  prestador:usuarios!prestamos_id_prestador_fkey ( nombre1, nombre2, apellido1, apellido2 ),
  prestamos_insumos (
    orden,
    insumos ( codigo_inventario, modelo, numero, tipo_soporte )
  ),
  prestamos_devoluciones (
    id,
    fecha,
    klgo_recibe,
    kinesiologo_devuelve,
    recibidor:usuarios!prestamos_devoluciones_id_recibidor_fkey ( nombre1, nombre2, apellido1, apellido2 )
  )
`

export type PrestamoModalDevolucionRow = {
  id: string
  fecha: string
  klgo_recibe: number | string | null
  kinesiologo_devuelve: string
  recibidor?: { nombre1: string; nombre2: string | null; apellido1: string; apellido2: string | null } | null
}

export type PrestamoModalRow = {
  id: string
  numero_publico: number | string | null
  fecha_prestamo: string
  servicio_prestamo: string
  cama_prestamo: string | null
  klgo_solicitante: number | string | null
  estado: string
  observaciones: string | null
  fecha_devolucion: string | null
  insumos: {
    codigo_inventario: string
    modelo: string
    numero: string
    tipo_soporte: string
  } | null
  prestador?: { nombre1: string; nombre2: string | null; apellido1: string; apellido2: string | null } | null
  prestamos_insumos?: Array<{
    orden: number | null
    insumos: {
      codigo_inventario: string
      modelo: string
      numero: string
      tipo_soporte: string
    } | null
  }> | null
  prestamos_devoluciones?: PrestamoModalDevolucionRow[] | null
}

/** Inicio del rango «último mes» (30 días). */
export function fechaDesdeUltimos30Dias(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

export function etiquetasMesesAnio(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const s = new Date(year, i, 1).toLocaleString('es-CL', { month: 'short' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })
}

export function contarPorMesIso(fechasIso: string[], year: number): number[] {
  const c = Array.from({ length: 12 }, () => 0)
  for (const iso of fechasIso) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue
    c[d.getMonth()] += 1
  }
  return c
}

export async function fetchSeriesMensualesAnio(year: number): Promise<
  | { ok: true; usosPorMes: number[]; prestamosPorMes: number[] }
  | { ok: false; message: string }
> {
  const desde = `${year}-01-01T00:00:00.000Z`
  const hasta = `${year + 1}-01-01T00:00:00.000Z`
  const [u, p] = await Promise.all([
    supabase.from('usos').select('fecha_uso').gte('fecha_uso', desde).lt('fecha_uso', hasta),
    supabase.from('prestamos').select('fecha_prestamo').gte('fecha_prestamo', desde).lt('fecha_prestamo', hasta),
  ])
  if (u.error) return { ok: false, message: u.error.message }
  if (p.error) return { ok: false, message: p.error.message }
  const usosIso = (u.data ?? []).map((r) => String((r as { fecha_uso: string }).fecha_uso))
  const prestIso = (p.data ?? []).map((r) => String((r as { fecha_prestamo: string }).fecha_prestamo))
  return {
    ok: true,
    usosPorMes: contarPorMesIso(usosIso, year),
    prestamosPorMes: contarPorMesIso(prestIso, year),
  }
}

export async function fetchUsosUltimos30Dias(): Promise<
  { ok: true; rows: UsoModalRow[] } | { ok: false; message: string }
> {
  const desde = fechaDesdeUltimos30Dias()
  const { data, error } = await supabase
    .from('usos')
    .select(USOS_MODAL)
    .gte('fecha_uso', desde)
    .order('fecha_uso', { ascending: false })
  if (error) return { ok: false, message: error.message }
  return { ok: true, rows: (data ?? []) as unknown as UsoModalRow[] }
}

export async function fetchPrestamosUltimos30Dias(): Promise<
  { ok: true; rows: PrestamoModalRow[] } | { ok: false; message: string }
> {
  const desde = fechaDesdeUltimos30Dias()
  const { data, error } = await supabase
    .from('prestamos')
    .select(PRESTAMOS_MODAL)
    .gte('fecha_prestamo', desde)
    .order('fecha_prestamo', { ascending: false })
  if (error) return { ok: false, message: error.message }
  return { ok: true, rows: (data ?? []) as unknown as PrestamoModalRow[] }
}
