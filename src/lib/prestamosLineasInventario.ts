/** Datos mínimos del insumo embebido en préstamos (PostgREST). */
export type InsumoEmbedPrestamo = {
  codigo_inventario: string
  modelo: string
  numero: string
  codigo_minsal: string
  tipo_soporte: string
} | null

export type PrestamoInsumoJunction = {
  id_insumo: string
  orden: number
  insumos: InsumoEmbedPrestamo
}

export type PrestamoConInventario = {
  id_insumo: string | null
  insumos: InsumoEmbedPrestamo
  prestamos_insumos?: PrestamoInsumoJunction[] | null
}

/**
 * Soportes con etiqueta del préstamo: filas de `prestamos_insumos` si existen;
 * si no hay tabla puente (datos viejos), usa solo `id_insumo` + embed.
 */
export function lineasInventariadoPrestamo(row: PrestamoConInventario): Array<{
  id_insumo: string
  insumos: NonNullable<InsumoEmbedPrestamo>
}> {
  const junction = row.prestamos_insumos
  if (junction?.length) {
    return [...junction]
      .filter((j) => j.id_insumo && j.insumos)
      .sort((a, b) => a.orden - b.orden)
      .map((j) => ({ id_insumo: j.id_insumo, insumos: j.insumos! }))
  }
  if (row.id_insumo && row.insumos) {
    return [{ id_insumo: row.id_insumo, insumos: row.insumos }]
  }
  return []
}
