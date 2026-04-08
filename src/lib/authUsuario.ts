import type { SupabaseClient, User } from '@supabase/supabase-js'

/** Fila mínima de `public.usuarios` para armar el nombre en pantalla. */
export type UsuarioNombreRow = {
  nombre1: string
  nombre2: string | null
  apellido1: string
  apellido2: string | null
}

export function nombreCompletoDesdeUsuariosRow(row: UsuarioNombreRow): string {
  const parts = [row.nombre1, row.nombre2, row.apellido1, row.apellido2]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  return parts.join(' ')
}

/**
 * Klgo. de recepción desde la sesión: `user_metadata.klgo` y, si falta, `app_metadata.klgo`.
 */
export function klgoDesdeMetadataUsuario(user: User): number | null {
  for (const meta of [user.user_metadata, user.app_metadata] as const) {
    if (!meta || typeof meta !== 'object') continue
    const raw = (meta as Record<string, unknown>).klgo
    if (raw == null) continue
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return null
}

function nombreDesdeClavesMeta(meta: Record<string, unknown> | undefined | null): string | null {
  if (!meta) return null
  for (const k of ['full_name', 'name', 'display_name', 'nombre_completo', 'nombre'] as const) {
    const v = String(meta[k] ?? '').trim()
    if (v) return v
  }
  const given = String(meta.given_name ?? '').trim()
  const family = String(meta.family_name ?? '').trim()
  if (given && family) return `${given} ${family}`
  if (given) return given
  if (family) return family
  return null
}

/**
 * Fallback si no hay fila en `usuarios` o viene vacía: metadata Auth → OAuth → correo.
 */
export function nombreCompletoKinesiologoSesion(user: User): string {
  const m = user.user_metadata
  if (m && typeof m === 'object') {
    const n = nombreDesdeClavesMeta(m as Record<string, unknown>)
    if (n) return n
  }
  for (const ident of user.identities ?? []) {
    const d = ident.identity_data as Record<string, unknown> | undefined
    const n = nombreDesdeClavesMeta(d)
    if (n) return n
  }
  const email = user.email?.trim()
  if (email) return email
  return `${user.id.slice(0, 8)}…`
}

/**
 * Etiqueta «quien recepciona / registra»: prioriza `public.usuarios` (mismo `id` que Auth).
 */
export async function etiquetaRegistradorRecepcion(
  client: SupabaseClient,
  user: User,
): Promise<string> {
  const { data, error } = await client
    .from('usuarios')
    .select('nombre1,nombre2,apellido1,apellido2')
    .eq('id', user.id)
    .maybeSingle()
  if (!error && data) {
    const full = nombreCompletoDesdeUsuariosRow(data as UsuarioNombreRow)
    if (full) return full
  }
  return nombreCompletoKinesiologoSesion(user)
}

/** Errores de PostgREST no son instancias de Error: evita "[object Object]" en pantalla. */
export function mensajeErrorDesconocido(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return 'Ocurrió un error inesperado.'
}
