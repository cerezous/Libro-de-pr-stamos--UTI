import { etiquetaEstadoInsumo } from '../constants/estadoInsumo'
import type { UsuarioNombreRow } from './authUsuario'
import { supabase } from './supabase'

/** Resumen préstamo activo (misma forma que en InsumosTable). */
export type PrestamoResumenPorInsumo = {
  id: string
  numero_publico: number | string | null
  fecha_prestamo: string
  servicio_prestamo: string
  cama_prestamo: string | null
  klgo_solicitante: number | string | null
  estado: string
  prestador: UsuarioNombreRow | null
}

/** Uso sin devolver (`fecha_devolucion` null). */
export type UsoResumenPorInsumo = {
  id: string
  fecha_uso: string
  cama: string | null
  observaciones: string | null
  klgo_instalador: UsuarioNombreRow | null
}

export type VistaEstadoOperativo = {
  /** Clave para clases CSS (`estadoStyles`). */
  claveEstilo: string
  etiqueta: string
  /** Si el catálogo `insumos.estado` no coincide con préstamos/usos. */
  aviso?: string
}

/**
 * Estado mostrado en catálogo: prioriza mantenimiento/fuera de servicio,
 * luego préstamo activo, luego uso activo, luego el valor en BD.
 */
export function estadoOperativoDesdeContexto(
  estadoDb: string,
  prestamo: PrestamoResumenPorInsumo | undefined,
  uso: UsoResumenPorInsumo | undefined,
): VistaEstadoOperativo {
  const db = estadoDb.trim().toLowerCase()
  if (db === 'mantenimiento') {
    return { claveEstilo: 'mantenimiento', etiqueta: etiquetaEstadoInsumo(estadoDb) }
  }
  if (db === 'fuera_de_servicio' || db === 'baja') {
    return { claveEstilo: 'fuera_de_servicio', etiqueta: etiquetaEstadoInsumo(estadoDb) }
  }
  if (prestamo) {
    return {
      claveEstilo: 'prestado',
      etiqueta: 'Prestado',
      aviso: db !== 'prestado' ? `Catálogo: ${etiquetaEstadoInsumo(estadoDb)}` : undefined,
    }
  }
  if (uso) {
    return {
      claveEstilo: 'en_uso',
      etiqueta: 'En uso',
      aviso: db !== 'en_uso' ? `Catálogo: ${etiquetaEstadoInsumo(estadoDb)}` : undefined,
    }
  }
  if (db === 'prestado') {
    return {
      claveEstilo: 'prestado',
      etiqueta: 'Prestado',
      aviso: 'Sin préstamo vigente — actualiza el catálogo',
    }
  }
  if (db === 'en_uso') {
    return {
      claveEstilo: 'en_uso',
      etiqueta: 'En uso',
      aviso: 'Sin uso vigente — actualiza el catálogo',
    }
  }
  return { claveEstilo: db, etiqueta: etiquetaEstadoInsumo(estadoDb) }
}

/** True si existe algún préstamo no devuelto que incluya este insumo. */
export async function tienePrestamoActivoParaInsumo(insumoId: string): Promise<boolean> {
  const { data: junction, error: ej } = await supabase
    .from('prestamos_insumos')
    .select('prestamo_id')
    .eq('id_insumo', insumoId)
  if (ej) return false
  const pids = [...new Set((junction ?? []).map((x) => x.prestamo_id as string))]
  if (pids.length > 0) {
    const { data: prs, error: ep } = await supabase.from('prestamos').select('estado').in('id', pids)
    if (ep) return false
    return (prs ?? []).some((r) => String(r.estado).trim().toLowerCase() !== 'devuelto')
  }
  const { data: leg, error: el } = await supabase.from('prestamos').select('estado').eq('id_insumo', insumoId)
  if (el) return false
  return (leg ?? []).some((r) => String(r.estado).trim().toLowerCase() !== 'devuelto')
}

function usuarioUno(u: UsuarioNombreRow | UsuarioNombreRow[] | null | undefined): UsuarioNombreRow | null {
  if (u == null) return null
  return Array.isArray(u) ? (u[0] ?? null) : u
}

function prestamoEsActivo(estado: string) {
  return estado.trim().toLowerCase() !== 'devuelto'
}

/**
 * Préstamo vigente más reciente por insumo (`prestamos_insumos` + legado `prestamos.id_insumo`).
 */
export async function fetchPrestamoActivoPorInsumoIds(
  ids: string[],
): Promise<Record<string, PrestamoResumenPorInsumo>> {
  if (ids.length === 0) return {}

  const candidates: Array<{ id_insumo: string; p: PrestamoResumenPorInsumo; fechaMs: number }> = []

  const { data: junction, error: ej } = await supabase
    .from('prestamos_insumos')
    .select(
      `
      id_insumo,
      prestamos!inner (
        id,
        numero_publico,
        fecha_prestamo,
        servicio_prestamo,
        cama_prestamo,
        klgo_solicitante,
        estado,
        prestador:usuarios!prestamos_id_prestador_fkey ( nombre1, nombre2, apellido1, apellido2 )
      )
    `,
    )
    .in('id_insumo', ids)

  if (ej) throw new Error(ej.message)

  for (const row of junction ?? []) {
    const insId = row.id_insumo as string
    const raw = row.prestamos as unknown
    const pr = Array.isArray(raw) ? raw[0] : raw
    if (!pr || typeof pr !== 'object') continue
    const p = pr as PrestamoResumenPorInsumo & {
      prestador?: UsuarioNombreRow | UsuarioNombreRow[] | null
    }
    if (!prestamoEsActivo(p.estado)) continue
    const fechaMs = new Date(p.fecha_prestamo).getTime()
    candidates.push({
      id_insumo: insId,
      p: {
        id: p.id,
        numero_publico: p.numero_publico,
        fecha_prestamo: p.fecha_prestamo,
        servicio_prestamo: p.servicio_prestamo,
        cama_prestamo: p.cama_prestamo,
        klgo_solicitante: p.klgo_solicitante,
        estado: p.estado,
        prestador: usuarioUno(p.prestador ?? null),
      },
      fechaMs: Number.isNaN(fechaMs) ? 0 : fechaMs,
    })
  }

  const { data: direct, error: ed } = await supabase
    .from('prestamos')
    .select(
      `
      id,
      id_insumo,
      numero_publico,
      fecha_prestamo,
      servicio_prestamo,
      cama_prestamo,
      klgo_solicitante,
      estado,
      prestador:usuarios!prestamos_id_prestador_fkey ( nombre1, nombre2, apellido1, apellido2 )
    `,
    )
    .in('id_insumo', ids)

  if (ed) throw new Error(ed.message)

  for (const row of direct ?? []) {
    const insId = row.id_insumo as string | null
    if (!insId) continue
    if (!prestamoEsActivo(String(row.estado))) continue
    const p = row as typeof row & {
      prestador?: UsuarioNombreRow | UsuarioNombreRow[] | null
    }
    const fechaMs = new Date(p.fecha_prestamo).getTime()
    candidates.push({
      id_insumo: insId,
      p: {
        id: p.id,
        numero_publico: p.numero_publico,
        fecha_prestamo: p.fecha_prestamo,
        servicio_prestamo: p.servicio_prestamo,
        cama_prestamo: p.cama_prestamo,
        klgo_solicitante: p.klgo_solicitante,
        estado: p.estado,
        prestador: usuarioUno(p.prestador ?? null),
      },
      fechaMs: Number.isNaN(fechaMs) ? 0 : fechaMs,
    })
  }

  const best = new Map<string, { p: PrestamoResumenPorInsumo; fechaMs: number }>()
  for (const c of candidates) {
    const prev = best.get(c.id_insumo)
    if (!prev || c.fechaMs >= prev.fechaMs) {
      best.set(c.id_insumo, { p: c.p, fechaMs: c.fechaMs })
    }
  }

  return Object.fromEntries([...best.entries()].map(([k, v]) => [k, v.p]))
}

/** Uso sin devolver por insumo (más reciente si hubiera varios). */
export async function fetchUsoActivoPorInsumoIds(
  ids: string[],
): Promise<Record<string, UsoResumenPorInsumo>> {
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from('usos')
    .select(
      `
      id,
      id_insumo,
      cama,
      observaciones,
      fecha_uso,
      fecha_devolucion,
      klgo_instalador:usuarios!usos_id_klgo_fkey ( nombre1, nombre2, apellido1, apellido2 )
    `,
    )
    .in('id_insumo', ids)
    .is('fecha_devolucion', null)

  if (error) throw new Error(error.message)

  const candidates: Array<{ id_insumo: string; u: UsoResumenPorInsumo; fechaMs: number }> = []
  for (const row of data ?? []) {
    if (row.fecha_devolucion != null) continue
    const insId = row.id_insumo as string
    const fechaMs = new Date(row.fecha_uso as string).getTime()
    const inst = usuarioUno(
      row.klgo_instalador as unknown as UsuarioNombreRow | UsuarioNombreRow[] | null,
    )
    candidates.push({
      id_insumo: insId,
      u: {
        id: row.id as string,
        fecha_uso: row.fecha_uso as string,
        cama: row.cama as string | null,
        observaciones: row.observaciones as string | null,
        klgo_instalador: inst,
      },
      fechaMs: Number.isNaN(fechaMs) ? 0 : fechaMs,
    })
  }

  const best = new Map<string, { u: UsoResumenPorInsumo; fechaMs: number }>()
  for (const c of candidates) {
    const prev = best.get(c.id_insumo)
    if (!prev || c.fechaMs >= prev.fechaMs) {
      best.set(c.id_insumo, { u: c.u, fechaMs: c.fechaMs })
    }
  }

  return Object.fromEntries([...best.entries()].map(([k, v]) => [k, v.u]))
}
