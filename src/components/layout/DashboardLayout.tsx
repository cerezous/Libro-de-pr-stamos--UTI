import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Sidebar } from './Sidebar'

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function DashboardLayout() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (!s) navigate('/login', { replace: true })
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) navigate('/login', { replace: true })
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-400">
        Cargando…
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar
        userEmail={session.user.email}
        onSignOut={() => void signOut()}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pl-60">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-950 px-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-zinc-300 hover:bg-white/10 hover:text-white"
            aria-label="Abrir menú"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-white">Libro de préstamos</span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
