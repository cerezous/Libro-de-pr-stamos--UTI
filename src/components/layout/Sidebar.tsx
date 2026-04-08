import { NavLink, useLocation } from 'react-router-dom'

function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600/90 text-sm font-bold text-white ${className ?? ''}`}
      aria-hidden
    >
      L
    </div>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  )
}

function UsosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  )
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  )
}

function InformesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

const subNavLinkClass =
  'flex items-center gap-2 rounded-lg py-2 pl-9 pr-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white'

function navSubActiveClass({ isActive }: { isActive: boolean }) {
  return `${subNavLinkClass} ${isActive ? 'bg-white/10 text-white' : ''}`
}

type SidebarProps = {
  userEmail: string | undefined
  onSignOut: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({ userEmail, onSignOut, mobileOpen, onCloseMobile }: SidebarProps) {
  const location = useLocation()
  const insumosActivo = location.pathname.startsWith('/insumos')
  const usosPrestamosActivo = location.pathname === '/usos' || location.pathname === '/prestamos'

  function handleNavClick() {
    onCloseMobile?.()
  }

  return (
    <>
      {/* Overlay móvil */}
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-label="Cerrar menú"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(17.5rem,85vw)] flex-col border-r border-white/10 bg-zinc-900 transition-transform duration-200 md:z-30 md:w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-3 py-3.5">
          <LogoMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Libro de préstamos
            </p>
            <p className="truncate text-xs text-zinc-500">Logística de insumos</p>
          </div>
        </header>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Principal">
          <div
            className={`rounded-lg ${insumosActivo ? 'bg-white/[0.04]' : ''}`}
            role="group"
            aria-label="Insumos"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Insumos
            </p>
            <NavLink to="/insumos" end className={navSubActiveClass} onClick={handleNavClick}>
              <BoxIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              Catálogo
            </NavLink>
            <NavLink to="/insumos/informes" end className={navSubActiveClass} onClick={handleNavClick}>
              <InformesIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              Informes
            </NavLink>
          </div>

          <div
            className={`mt-1 rounded-lg ${usosPrestamosActivo ? 'bg-white/[0.04]' : ''}`}
            role="group"
            aria-label="Usos y préstamos"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Usos y préstamos
            </p>
            <NavLink to="/usos" end className={navSubActiveClass} onClick={handleNavClick}>
              <UsosIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              Usos
            </NavLink>
            <NavLink to="/prestamos" end className={navSubActiveClass} onClick={handleNavClick}>
              <ClipboardIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              Préstamos
            </NavLink>
          </div>
        </nav>

        <footer className="shrink-0 border-t border-white/5 p-2">
          {userEmail ? (
            <p className="mb-2 truncate px-2 text-xs text-zinc-500" title={userEmail}>
              {userEmail}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <LogOutIcon className="h-5 w-5 shrink-0 text-zinc-400" />
            Salir
          </button>
        </footer>
      </aside>
    </>
  )
}
