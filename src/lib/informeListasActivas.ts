import { etiquetaEstadoInsumo } from '../constants/estadoInsumo'
import { nombreCompletoDesdeUsuariosRow, type UsuarioNombreRow } from './authUsuario'
import { codigoInventarioSeisDigitos } from './codigoInventario'
import type { InformePdfPrestamoActivoLinea, InformePdfUsoActivoLinea } from './informeInsumoPdf'
import { supabase } from './supabase'

function fmtFechaPdf(iso: string) {
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

/** Préstamo aún abierto: distinto de «devuelto» (incluye «Parcialmente devuelto»). */
export function prestamoEstaActivo(estado: string): boolean {
  return estado.trim().toLowerCase() !== 'devuelto'
}

export type UsoActivoInformeRow = {
  id: string
  fecha_uso: string
  cama: string | null
  observaciones: string | null
  fecha_devolucion: string | null
  insumos: {
    codigo_inventario: string
    modelo: string
    numero: string
    tipo_soporte: string
    estado: string
  } | null
  klgo_instalador?: UsuarioNombreRow | UsuarioNombreRow[] | null
  klgo_recepcion?: UsuarioNombreRow | UsuarioNombreRow[] | null
}

export type PrestamoDevolucionActoInforme = {
  id: string
  fecha: string
  klgo_recibe: number | string | null
  kinesiologo_devuelve: string
  recibidor?: UsuarioNombreRow | UsuarioNombreRow[] | null
}

export type PrestamoActivoInformeRow = {
  id: string
  numero_publico: number | string | null
  fecha_prestamo: string
  servicio_prestamo: string
  cama_prestamo: string | null
  estado: string
  klgo_solicitante: number | string | null
  observaciones: string | null
  fecha_devolucion: string | null
  insumos: {
    codigo_inventario: string
    modelo: string
    numero: string
    tipo_soporte: string
  } | null
  prestamos_insumos: Array<{
    orden: number | null
    insumos: {
      codigo_inventario: string
      modelo: string
      numero: string
      tipo_soporte: string
    } | null
  }> | null
  prestamos_devoluciones?: PrestamoDevolucionActoInforme[] | null
  prestador?: UsuarioNombreRow | UsuarioNombreRow[] | null
}

const USOS_ACTIVOS_SELECT = `
  id,
  fecha_uso,
  cama,
  observaciones,
  fecha_devolucion,
  insumos ( codigo_inventario, modelo, numero, tipo_soporte, estado ),
  klgo_instalador:usuarios!usos_id_klgo_fkey ( nombre1, nombre2, apellido1, apellido2 ),
  klgo_recepcion:usuarios!usos_id_klgo_devuelve_fkey ( nombre1, nombre2, apellido1, apellido2 )
`

const PRESTAMOS_ACTIVOS_SELECT = `
  id,
  numero_publico,
  fecha_prestamo,
  servicio_prestamo,
  cama_prestamo,
  estado,
  klgo_solicitante,
  observaciones,
  fecha_devolucion,
  prestador:usuarios!prestamos_id_prestador_fkey ( nombre1, nombre2, apellido1, apellido2 ),
  insumos ( codigo_inventario, modelo, numero, tipo_soporte ),
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

function usuarioUno(u: UsuarioNombreRow | UsuarioNombreRow[] | null | undefined): UsuarioNombreRow | null {
  if (u == null) return null
  return Array.isArray(u) ? (u[0] ?? null) : u
}

export function fmtKlgoInforme(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return String(n)
}

export function resumenSoportesPrestamo(p: {
  insumos: PrestamoActivoInformeRow['insumos']
  prestamos_insumos?: PrestamoActivoInformeRow['prestamos_insumos'] | null
}): string {
  const junction = (p.prestamos_insumos ?? [])
    .filter((x) => x?.insumos)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  const list =
    junction.length > 0
      ? junction.map((x) => x.insumos!).filter(Boolean)
      : p.insumos
        ? [p.insumos]
        : []
  if (list.length === 0) return '—'
  return list
    .map((ins) => {
      const cod = codigoInventarioSeisDigitos(ins.codigo_inventario)
      const m = ins.modelo?.trim() || ins.tipo_soporte?.trim() || '—'
      return `${cod} · ${m}`
    })
    .join('; ')
}

export function nombreInstaladorUso(row: {
  klgo_instalador?: UsuarioNombreRow | UsuarioNombreRow[] | null
}): string {
  const u = usuarioUno(row.klgo_instalador as UsuarioNombreRow | UsuarioNombreRow[] | null)
  if (!u) return '—'
  const s = nombreCompletoDesdeUsuariosRow(u).trim()
  return s || '—'
}

export function nombreRecepcionUso(row: {
  klgo_recepcion?: UsuarioNombreRow | UsuarioNombreRow[] | null
}): string {
  const u = usuarioUno(row.klgo_recepcion as UsuarioNombreRow | UsuarioNombreRow[] | null)
  if (!u) return '—'
  const s = nombreCompletoDesdeUsuariosRow(u).trim()
  return s || '—'
}

export function resumenDevolucionesPrestamo(p: {
  prestamos_devoluciones?: PrestamoDevolucionActoInforme[] | null
}): string {
  const actos = [...(p.prestamos_devoluciones ?? [])].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  )
  if (actos.length === 0) return '—'
  return actos
    .map((a) => {
      const rec = usuarioUno(a.recibidor as UsuarioNombreRow | UsuarioNombreRow[] | null)
      const nombreRec = rec ? nombreCompletoDesdeUsuariosRow(rec).trim() : ''
      const kRec = fmtKlgoInforme(a.klgo_recibe)
      const recep = nombreRec || (kRec !== '—' ? `Klgo. ${kRec}` : '')
      const dev = (a.kinesiologo_devuelve ?? '').trim()
      const parts = [
        fmtFechaPdf(a.fecha),
        recep ? `Recep. ${recep}` : null,
        dev ? `Dev. ${dev}` : null,
      ].filter(Boolean)
      return parts.join(' · ')
    })
    .join(' | ')
}

export function nombrePrestadorPrestamo(row: {
  prestador?: UsuarioNombreRow | UsuarioNombreRow[] | null
}): string {
  const u = usuarioUno(row.prestador as UsuarioNombreRow | UsuarioNombreRow[] | null)
  if (!u) return '—'
  const s = nombreCompletoDesdeUsuariosRow(u).trim()
  return s || '—'
}

/** Todos los usos con `fecha_devolucion` nula (vigentes en cama). */
export async function fetchTodosUsosActivos(): Promise<
  { ok: true; rows: UsoActivoInformeRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('usos')
    .select(USOS_ACTIVOS_SELECT)
    .is('fecha_devolucion', null)
    .order('fecha_uso', { ascending: false })
  if (error) return { ok: false, message: error.message }
  return { ok: true, rows: (data ?? []) as unknown as UsoActivoInformeRow[] }
}

/** Préstamos no cerrados: estado distinto de «devuelto» (incluye parcial). */
export async function fetchTodosPrestamosActivos(): Promise<
  { ok: true; rows: PrestamoActivoInformeRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('prestamos')
    .select(PRESTAMOS_ACTIVOS_SELECT)
    .order('fecha_prestamo', { ascending: false })
  if (error) return { ok: false, message: error.message }
  const rows = (data ?? []) as unknown as PrestamoActivoInformeRow[]
  return { ok: true, rows: rows.filter((r) => prestamoEstaActivo(r.estado)) }
}

export function mapUsosActivosParaPdf(rows: UsoActivoInformeRow[]): InformePdfUsoActivoLinea[] {
  return rows.map((r) => ({
    fecha_uso: fmtFechaPdf(r.fecha_uso),
    instala: nombreInstaladorUso(r),
    codigo: r.insumos ? codigoInventarioSeisDigitos(r.insumos.codigo_inventario) : '—',
    soporte: r.insumos ? (r.insumos.modelo?.trim() || r.insumos.tipo_soporte?.trim() || '—') : '—',
    estado: r.insumos ? etiquetaEstadoInsumo(r.insumos.estado) : '—',
    cama: r.cama?.trim() || '—',
    fecha_devolucion: r.fecha_devolucion ? fmtFechaPdf(r.fecha_devolucion) : '—',
    recepcion: nombreRecepcionUso(r),
    obs: r.observaciones?.trim() || '—',
  }))
}

export function mapPrestamosActivosParaPdf(rows: PrestamoActivoInformeRow[]): InformePdfPrestamoActivoLinea[] {
  return rows.map((r) => {
    const n = r.numero_publico
    const num =
      n !== null && n !== undefined && String(n).trim() !== ''
        ? String(n)
        : r.id.slice(0, 8)
    return {
      fecha: fmtFechaPdf(r.fecha_prestamo),
      numero: num,
      estado: r.estado?.trim() || '—',
      servicio: r.servicio_prestamo?.trim() || '—',
      cama: r.cama_prestamo?.trim() || '—',
      klgo_solicita: fmtKlgoInforme(r.klgo_solicitante),
      prestador: nombrePrestadorPrestamo(r),
      soportes: resumenSoportesPrestamo(r),
      devoluciones: resumenDevolucionesPrestamo(r),
      obs: r.observaciones?.trim() || '—',
    }
  })
}
