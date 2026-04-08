/**
 * Catálogo de estados operativos del equipo (columna `insumos.estado`).
 * Valores en snake_case en BD; etiquetas para UI.
 */
export const ESTADOS_INSUMO = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_uso', label: 'En uso' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'fuera_de_servicio', label: 'Fuera de servicio' },
  { value: 'prestado', label: 'Prestado' },
] as const

export type EstadoInsumoValor = (typeof ESTADOS_INSUMO)[number]['value']

/**
 * Estados que se pueden elegir manualmente en el formulario (equipo no en préstamo ni en uso).
 * Desde **Disponible** solo tiene sentido pasar a mantenimiento o fuera de servicio (o quedar disponible).
 */
export const ESTADOS_INSUMO_EDITABLES = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'fuera_de_servicio', label: 'Fuera de servicio' },
] as const

const VALORES = new Set<string>(ESTADOS_INSUMO.map((o) => o.value))

/** Antes `baja`; se normaliza a fuera de servicio. */
export function normalizarEstadoInsumoDesdeDb(raw: string): EstadoInsumoValor {
  const e = raw.trim().toLowerCase()
  if (e === 'baja') return 'fuera_de_servicio'
  if (VALORES.has(e)) return e as EstadoInsumoValor
  return 'disponible'
}

export function etiquetaEstadoInsumo(estado: string): string {
  const e = estado.trim().toLowerCase()
  if (e === 'baja') return 'Fuera de servicio'
  const found = ESTADOS_INSUMO.find((x) => x.value === e)
  return found?.label ?? estado
}

export function estadoInsumoEsPrestado(estado: string): boolean {
  return estado.trim().toLowerCase() === 'prestado'
}

/** Préstamo o uso activo actualizan el estado; no se edita a mano en el formulario. */
export function estadoInsumoGestionadoPorPrestamosUsos(estado: string): boolean {
  const e = estado.trim().toLowerCase()
  return e === 'prestado' || e === 'en_uso'
}
