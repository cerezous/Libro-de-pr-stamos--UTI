import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    debug: false,
  },
  realtime: {
    logLevel: 'error',
  },
})

/**
 * True si columnas de auditoría de estado (fecha / id_actualizacion_estado) no están en el esquema expuesto.
 */
export function insumosDbSinColumnasEstadoManual(message: string): boolean {
  const m = message.toLowerCase()
  const col =
    m.includes('estado_manual') ||
    m.includes('fecha_actualizacion_estado') ||
    m.includes('id_actualizacion_estado') ||
    m.includes('actualizacion_estado') ||
    m.includes('no_ubicable') ||
    m.includes('fecha_no_ubicable') ||
    m.includes('id_usuario_no_ubicable')
  if (!col) return false
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  )
}
