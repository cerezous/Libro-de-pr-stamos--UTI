import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  nombreCompletoDesdeUsuariosRow,
  type UsuarioNombreRow,
} from '../../lib/authUsuario'
import { codigoInventarioSeisDigitos } from '../../lib/codigoInventario'
import { tienePrestamoActivoParaInsumo } from '../../lib/insumoOperativo'
import { supabase } from '../../lib/supabase'

type InsumoEmbed = {
  codigo_inventario: string
  modelo: string
  numero: string
  codigo_minsal: string
  tipo_soporte: string
} | null

const USOS_SELECT = `
  id,
  id_klgo,
  id_klgo_devuelve,
  id_insumo,
  cama,
  observaciones,
  fecha_uso,
  fecha_devolucion,
  insumos ( codigo_inventario, modelo, numero, codigo_minsal, tipo_soporte ),
  klgo_instalador:usuarios!usos_id_klgo_fkey ( nombre1, nombre2, apellido1, apellido2 ),
  klgo_recepcion:usuarios!usos_id_klgo_devuelve_fkey ( nombre1, nombre2, apellido1, apellido2 )
`

export type UsoRow = {
  id: string
  id_klgo: string | null
  id_klgo_devuelve: string | null
  id_insumo: string
  cama: string | null
  observaciones: string | null
  fecha_uso: string
  fecha_devolucion: string | null
  insumos: InsumoEmbed
  klgo_instalador?: UsuarioNombreRow | null
  klgo_recepcion?: UsuarioNombreRow | null
}

const COL_COUNT = 6

const thBase =
  'px-2 py-3 text-left text-[10px] font-medium leading-tight text-zinc-300 sm:px-3 sm:text-xs sm:leading-normal md:text-sm'

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
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

function nombreDesdeUsuarioEmbed(u: UsuarioNombreRow | null | undefined): string {
  if (!u || typeof u !== 'object') return ''
  return nombreCompletoDesdeUsuariosRow(u).trim()
}

function InsumoLine({ ins }: { ins: InsumoEmbed }) {
  if (!ins) return <span className="text-zinc-500">—</span>
  const modelo = ins.modelo?.trim() || ins.tipo_soporte?.trim() || '—'
  const cod = codigoInventarioSeisDigitos(ins.codigo_inventario)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-medium text-zinc-100">{modelo}</span>
      <span className="font-medium tabular-nums text-emerald-400">({cod})</span>
    </span>
  )
}

type UsosTableProps = {
  refreshSignal?: number
}

export function UsosTable({ refreshSignal = 0 }: UsosTableProps) {
  const [rows, setRows] = useState<UsoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchRows = useCallback(() => {
    return supabase.from('usos').select(USOS_SELECT).order('fecha_uso', { ascending: false })
  }, [])

  const applyFetchResult = useCallback(
    (qError: { message: string } | null, data: UsoRow[] | null) => {
      if (qError) {
        setError(qError.message)
        setRows([])
      } else {
        setError(null)
        setRows((data ?? []) as UsoRow[])
      }
    },
    [],
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchRows().then(({ data, error: qError }) => {
      if (!active) return
      applyFetchResult(qError, data as UsoRow[] | null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [fetchRows, applyFetchResult, refreshSignal])

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchRows().then(({ data, error: qError }) => {
      applyFetchResult(qError, data as UsoRow[] | null)
      setLoading(false)
    })
  }, [fetchRows, applyFetchResult])

  const registrarDevolucion = useCallback(
    async (id: string) => {
      const idInsumo = rows.find((r) => r.id === id)?.id_insumo
      setUpdatingId(id)
      const ahora = new Date().toISOString()
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()
      if (authErr || !user) {
        setUpdatingId(null)
        setError('Debes iniciar sesión para registrar la devolución.')
        return
      }
      const { error: uError } = await supabase
        .from('usos')
        .update({ fecha_devolucion: ahora, id_klgo_devuelve: user.id })
        .eq('id', id)
      if (uError) {
        setUpdatingId(null)
        setError(uError.message)
        return
      }
      const { data: rowActualizada, error: fetchErr } = await supabase
        .from('usos')
        .select(USOS_SELECT)
        .eq('id', id)
        .maybeSingle()
      setUpdatingId(null)
      if (fetchErr || !rowActualizada) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, fecha_devolucion: ahora } : r)),
        )
        if (fetchErr) setError(fetchErr.message)
      } else {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? (rowActualizada as unknown as UsoRow) : r)),
        )
      }
      if (idInsumo) {
        const siguePrestado = await tienePrestamoActivoParaInsumo(idInsumo)
        if (!siguePrestado) {
          const { error: upIns } = await supabase
            .from('insumos')
            .update({ estado: 'disponible' })
            .eq('id', idInsumo)
          if (upIns) {
            setError(
              `Devolución guardada, pero no se pudo poner el equipo como Disponible: ${upIns.message}`,
            )
          }
        }
      }
    },
    [rows],
  )

  let body: ReactNode
  if (loading) {
    body = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-400">
          Cargando usos…
        </td>
      </tr>
    )
  } else if (error) {
    body = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-6">
          <p className="text-sm text-red-200">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 text-xs font-medium text-red-100 underline-offset-2 hover:underline"
          >
            Reintentar
          </button>
        </td>
      </tr>
    )
  } else if (rows.length === 0) {
    body = (
      <tr>
        <td colSpan={COL_COUNT} className="px-3 py-12 text-center text-sm text-zinc-500">
          No hay registros de uso todavía.
        </td>
      </tr>
    )
  } else {
    body = rows.map((row) => {
      const pendiente = row.fecha_devolucion == null
      const busy = updatingId === row.id
      return (
        <tr
          key={row.id}
          className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.04]"
        >
          <td className="min-w-0 px-3 py-3 text-xs text-zinc-200">
            {(() => {
              const nombreInstala = nombreDesdeUsuarioEmbed(row.klgo_instalador)
              const titulo = [fmtFecha(row.fecha_uso), nombreInstala ? `Instala ${nombreInstala}` : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <div className="min-w-0 whitespace-normal wrap-break-word" title={titulo}>
                  <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
                    {fmtFecha(row.fecha_uso)}
                  </span>
                  {nombreInstala ? (
                    <p className="mt-1 text-[10px] leading-snug text-zinc-100 sm:text-[11px]">
                      <span className="font-medium text-zinc-500">Instala</span>{' '}
                      <span className="font-medium">{nombreInstala}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-[9px] leading-tight text-amber-200/80 sm:text-[10px]">
                      Sin datos del kinesiólogo en el catálogo: revisa usuarios o el registro.
                    </p>
                  )}
                </div>
              )
            })()}
          </td>
          <td className="min-w-0 px-3 py-3">
            <span className="line-clamp-2 break-words" title={row.insumos?.modelo ?? ''}>
              <InsumoLine ins={row.insumos} />
            </span>
          </td>
          <td className="min-w-0 px-3 py-3 text-zinc-300">
            <span className="block truncate" title={row.cama ?? ''}>
              {row.cama?.trim() ? row.cama : '—'}
            </span>
          </td>
          <td className="min-w-0 px-3 py-3 text-xs text-zinc-200">
            {row.fecha_devolucion ? (
              (() => {
                const nombreRecepcion = nombreDesdeUsuarioEmbed(row.klgo_recepcion)
                const titulo = [fmtFecha(row.fecha_devolucion), nombreRecepcion ? `Retirado por ${nombreRecepcion}` : null]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div className="min-w-0 whitespace-normal wrap-break-word" title={titulo}>
                    <span className="block text-[11px] tabular-nums leading-snug text-zinc-300 sm:text-xs">
                      {fmtFecha(row.fecha_devolucion)}
                    </span>
                    {nombreRecepcion ? (
                      <p className="mt-1 text-[10px] leading-snug text-zinc-100 sm:text-[11px]">
                        <span className="font-medium text-zinc-500">Retirado por</span>{' '}
                        <span className="font-medium">{nombreRecepcion}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-[9px] leading-tight text-amber-200/80 sm:text-[10px]">
                        Sin datos de retiro en el catálogo.
                      </p>
                    )}
                  </div>
                )
              })()
            ) : (
              <span className="text-zinc-500">—</span>
            )}
          </td>
          <td className="min-w-0 px-3 py-3 text-xs text-zinc-400">
            {row.observaciones?.trim() ? (
              <span className="line-clamp-2 break-words" title={row.observaciones}>
                {row.observaciones}
              </span>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </td>
          <td className="min-w-0 whitespace-nowrap px-2 py-3 sm:px-3">
            {pendiente ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void registrarDevolucion(row.id)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 sm:text-xs"
              >
                {busy ? 'Guardando…' : 'Registrar devolución'}
              </button>
            ) : (
              <span className="text-[10px] text-zinc-500 sm:text-xs" title="Devolución registrada">
                —
              </span>
            )}
          </td>
        </tr>
      )
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 shadow-xl shadow-black/20">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-zinc-800/60">
            <th className={`w-[15%] ${thBase}`}>Fecha uso</th>
            <th className={`w-[26%] ${thBase}`}>Insumo</th>
            <th className={`w-[10%] ${thBase}`}>Cama</th>
            <th className={`w-[15%] ${thBase}`}>Fecha devolución</th>
            <th className={`w-[22%] ${thBase}`}>Observaciones</th>
            <th className={`w-[12%] ${thBase}`}>Acciones</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  )
}
