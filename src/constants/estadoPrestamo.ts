/** Estado del préstamo al registrar (vigente hasta devolución u otro cierre). */
export const ESTADO_PRESTAMO_EN_CURSO = 'A préstamo' as const

/** Al menos un ítem devuelto; aún faltan otros. */
export const ESTADO_PRESTAMO_PARCIAL = 'Parcialmente devuelto' as const

/**
 * Píldora de estado de préstamo (tabla principal, informes, etc.).
 * «Devuelto» en tono azul para diferenciarlo de «A préstamo» (ámbar) y de parcial (naranja).
 */
export function estadoPrestamoBadgeClass(estado: string): string {
  const e = estado.trim().toLowerCase()
  if (e === 'a préstamo' || e === 'activo') return 'bg-amber-500/15 text-amber-200 ring-amber-400/30'
  if (e.includes('parcial')) return 'bg-orange-500/15 text-orange-200 ring-orange-400/35'
  if (e === 'devuelto') return 'bg-sky-500/15 text-sky-100 ring-sky-400/40'
  if (e === 'vencido') return 'bg-red-500/15 text-red-300 ring-red-500/25'
  if (e === 'pendiente') return 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/35'
  return 'bg-zinc-500/15 text-zinc-300 ring-white/10'
}
