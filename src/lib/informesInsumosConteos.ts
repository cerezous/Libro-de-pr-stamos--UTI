import type { SupabaseClient } from '@supabase/supabase-js'

/** Conteos de filas `insumos` (soportes) según columna `estado` y bandera `no_ubicable`. */
export type ConteosInformeInsumos = {
  insumos_disponibles: number
  insumos_en_uso: number
  insumos_mantencion: number
  insumos_fuera_servicio: number
  insumos_prestados: number
  insumos_no_ubicables: number
}

export function conteosDesdeEstadosInsumos(estados: string[]): ConteosInformeInsumos {
  const o: ConteosInformeInsumos = {
    insumos_disponibles: 0,
    insumos_en_uso: 0,
    insumos_mantencion: 0,
    insumos_fuera_servicio: 0,
    insumos_prestados: 0,
    insumos_no_ubicables: 0,
  }
  for (const raw of estados) {
    const e = raw.trim().toLowerCase()
    if (e === 'disponible') o.insumos_disponibles += 1
    else if (e === 'en_uso') o.insumos_en_uso += 1
    else if (e === 'mantenimiento') o.insumos_mantencion += 1
    else if (e === 'fuera_de_servicio' || e === 'baja') o.insumos_fuera_servicio += 1
    else if (e === 'prestado') o.insumos_prestados += 1
  }
  return o
}

export function conteosDesdeFilasInsumo(
  filas: { estado: string; no_ubicable?: boolean | null }[],
): ConteosInformeInsumos {
  const base = conteosDesdeEstadosInsumos(filas.map((r) => r.estado))
  base.insumos_no_ubicables = filas.filter((r) => r.no_ubicable === true).length
  return base
}

const BATCH_INSERT = 150

/** Inserta snapshot en `informes_insumos` y una fila por equipo en `informes_insumos_observaciones` (incl. detalle del catálogo). */
export async function guardarInformeInsumosConObservaciones(
  client: SupabaseClient,
  catalogo: { id: string; estado: string; no_ubicable?: boolean | null; detalle?: string | null }[],
  observacionesPorInsumoId: Record<string, string>,
): Promise<{ ok: true; informeId: string } | { ok: false; message: string }> {
  const {
    data: { user },
    error: uErr,
  } = await client.auth.getUser()
  if (uErr || !user) {
    return { ok: false, message: 'Debes iniciar sesión para guardar el informe.' }
  }
  const c = conteosDesdeFilasInsumo(catalogo)
  const { data: inserted, error: insErr } = await client
    .from('informes_insumos')
    .insert({
      id_responsable: user.id,
      insumos_disponibles: c.insumos_disponibles,
      insumos_en_uso: c.insumos_en_uso,
      insumos_mantencion: c.insumos_mantencion,
      insumos_fuera_servicio: c.insumos_fuera_servicio,
      insumos_prestados: c.insumos_prestados,
      insumos_no_ubicables: c.insumos_no_ubicables,
    })
    .select('id')
    .single()

  if (insErr || !inserted?.id) {
    return { ok: false, message: insErr?.message ?? 'No se pudo crear el informe.' }
  }

  const informeId = inserted.id as string
  const obsRows = catalogo.map((row) => ({
    informe_id: informeId,
    id_insumo: row.id,
    detalle: String(row.detalle ?? '').trim(),
    observacion: (observacionesPorInsumoId[row.id] ?? '').trim(),
    no_ubicable: row.no_ubicable === true,
  }))

  for (let i = 0; i < obsRows.length; i += BATCH_INSERT) {
    const slice = obsRows.slice(i, i + BATCH_INSERT)
    const { error: oErr } = await client.from('informes_insumos_observaciones').insert(slice)
    if (oErr) {
      await client.from('informes_insumos').delete().eq('id', informeId)
      return { ok: false, message: oErr.message }
    }
  }

  return { ok: true, informeId }
}
