import { nombreCompletoDesdeUsuariosRow, type UsuarioNombreRow } from '../../lib/authUsuario'
import type { PrestamoResumenPorInsumo, UsoResumenPorInsumo } from '../../lib/insumoOperativo'

export function fmtFechaInformeModal(iso: string | null) {
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

function fmtKlgoModal(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'string' ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return String(n)
}

function textoCodigoPrestamo(p: { id: string; numero_publico: number | string | null }) {
  const n =
    p.numero_publico === null || p.numero_publico === undefined
      ? NaN
      : typeof p.numero_publico === 'string'
        ? Number(p.numero_publico)
        : p.numero_publico
  if (Number.isFinite(n) && n >= 1 && n <= 999_999) {
    return String(Math.floor(n))
  }
  return p.id
}

/** Préstamo / uso vigente y no ubicable (mismo bloque que en «Nuevo informe»). */
export function CeldaContextoPrestamoUso({
  cargando,
  prestamo,
  uso,
  noUbicable,
}: {
  cargando: boolean
  prestamo: PrestamoResumenPorInsumo | undefined
  uso: UsoResumenPorInsumo | undefined
  noUbicable?: boolean
}) {
  if (cargando) {
    return <p className="text-[10px] leading-snug text-zinc-500">Sincronizando préstamo y uso…</p>
  }
  if (!prestamo && !uso && !noUbicable) {
    return <span className="text-[11px] text-zinc-500">Sin préstamo ni uso activo registrado.</span>
  }
  const nombreEntrega = prestamo?.prestador
    ? nombreCompletoDesdeUsuariosRow(prestamo.prestador).trim()
    : ''
  const nombreInstala = uso?.klgo_instalador
    ? nombreCompletoDesdeUsuariosRow(
        (Array.isArray(uso.klgo_instalador) ? uso.klgo_instalador[0] : uso.klgo_instalador) as UsuarioNombreRow,
      ).trim()
    : ''
  return (
    <div className="min-w-0 space-y-2 break-words">
      {noUbicable ? (
        <div className="rounded-lg border border-red-500/35 bg-red-500/[0.08] px-2 py-1.5 text-[10px] leading-snug">
          <p className="font-semibold text-red-100/95">No ubicable</p>
          <p className="mt-0.5 text-zinc-400">Marcado en el catálogo de soportes.</p>
        </div>
      ) : null}
      {prestamo ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug">
          <p className="font-semibold text-amber-100">Préstamo activo</p>
          <p className="mt-1 text-zinc-200">
            <span className="text-zinc-500">Nº</span>{' '}
            <span className="font-mono tabular-nums text-emerald-300/90">{textoCodigoPrestamo(prestamo)}</span>
            {' · '}
            {prestamo.servicio_prestamo}
            {prestamo.cama_prestamo?.trim() ? (
              <>
                {' · '}
                <span className="text-zinc-500">Cama</span> {prestamo.cama_prestamo}
              </>
            ) : null}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Fecha préstamo</span> {fmtFechaInformeModal(prestamo.fecha_prestamo)}
          </p>
          <p className="mt-0.5 text-zinc-300">
            <span className="text-zinc-500">Solicita Klgo.</span> {fmtKlgoModal(prestamo.klgo_solicitante)}
          </p>
          {nombreEntrega ? (
            <p className="mt-0.5 text-zinc-200">
              <span className="text-zinc-500">Entrega</span> <span className="font-medium">{nombreEntrega}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[9px] text-amber-200/80">Sin nombre de quien entrega en catálogo.</p>
          )}
        </div>
      ) : null}
      {uso ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-[10px] leading-snug">
          <p className="font-semibold text-cyan-100">Uso activo</p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">Fecha uso</span> {fmtFechaInformeModal(uso.fecha_uso)}
          </p>
          {nombreInstala ? (
            <p className="mt-0.5 text-zinc-200">
              <span className="text-zinc-500">Instala</span> <span className="font-medium">{nombreInstala}</span>
            </p>
          ) : null}
          {uso.cama?.trim() ? (
            <p className="mt-0.5 text-zinc-300">
              <span className="text-zinc-500">Cama</span> {uso.cama}
            </p>
          ) : null}
          {uso.observaciones?.trim() ? (
            <p className="mt-1 text-zinc-400">{uso.observaciones}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
