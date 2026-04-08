/**
 * Normaliza el código de inventario a prefijo + 6 dígitos (ej. VMI-1 → VMI-000001).
 * Si no coincide el patijo PREFIJO-NÚMEROS, devuelve el texto tal cual (o — si vacío).
 */
export function codigoInventarioSeisDigitos(codigo: string | null | undefined): string {
  const t = codigo?.trim()
  if (!t) return '—'
  const m = t.match(/^(.+)-([0-9]+)$/)
  if (!m) return t
  const pref = m[1]
  const n = Number.parseInt(m[2], 10)
  if (!Number.isFinite(n) || n < 0) return t
  const clamped = Math.min(Math.trunc(n), 999_999)
  return `${pref}-${String(clamped).padStart(6, '0')}`
}
