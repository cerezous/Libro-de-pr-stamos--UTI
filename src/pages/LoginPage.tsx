import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EyeSlashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

const steps = [
  { n: 1, title: 'Accede', desc: 'Correo y contraseña seguros.' },
  { n: 2, title: 'Insumos', desc: 'Modelo, número y código MINSAL.' },
  { n: 3, title: 'Préstamos', desc: 'Servicio, cama y devoluciones.' },
] as const

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (signError) {
      setError(signError.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-black px-4 py-8 sm:px-6 sm:py-10 md:py-12">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center justify-center sm:min-h-[calc(100dvh-5rem)]">
        <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-emerald-950/20 md:min-h-[560px] md:flex-row">
          {/* Columna izquierda: visual + pasos (en móvil va debajo del formulario con order) */}
          <aside className="relative order-2 flex min-h-[280px] flex-1 flex-col justify-between p-8 md:order-1 md:min-h-0 md:max-w-[50%] md:p-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-black to-teal-950" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_20%_30%,rgba(16,185,129,0.28),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(20,184,166,0.2),transparent_50%)]" />
              {/* Sustituye por tu foto: colócala en public/ e importa o usa URL */}
              {/* <img src="/login-hero.jpg" alt="" className="h-full w-full object-cover opacity-35 mix-blend-overlay" /> */}
            </div>

            <div className="relative z-10">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Libro de préstamos
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
                Logística de insumos: registra dónde está cada elemento y el flujo de préstamos en
                servicio.
              </p>
            </div>

            <div className="relative z-10 mt-8 grid grid-cols-3 gap-2 sm:gap-3">
              {steps.map((s, i) => {
                const active = i === 0
                return (
                  <div
                    key={s.n}
                    className={
                      active
                        ? 'rounded-xl bg-white px-2 py-3 text-center shadow-lg sm:px-3 sm:py-4'
                        : 'rounded-xl border border-white/15 bg-white/10 px-2 py-3 text-center backdrop-blur-md sm:px-3 sm:py-4'
                    }
                  >
                    <div
                      className={
                        active
                          ? 'mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-black text-xs font-semibold text-white'
                          : 'mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/5 text-xs font-medium text-white/90'
                      }
                    >
                      {s.n}
                    </div>
                    <p
                      className={`mt-2 text-[10px] font-semibold leading-tight sm:text-xs ${active ? 'text-black' : 'text-white/90'}`}
                    >
                      {s.title}
                    </p>
                    <p
                      className={`mt-0.5 hidden text-[9px] leading-snug sm:block ${active ? 'text-zinc-600' : 'text-white/55'}`}
                    >
                      {s.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </aside>

          {/* Columna derecha: inicio de sesión */}
          <div className="order-1 flex flex-1 flex-col justify-center border-t border-white/10 bg-zinc-950 px-6 py-10 sm:px-10 md:order-2 md:max-w-[50%] md:border-l md:border-t-0 md:py-12">
            <div className="mx-auto w-full max-w-md">
              <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Iniciar sesión
              </h2>
              <p className="mt-2 text-center text-sm text-zinc-400">
                Ingresa con el correo que usas como usuario en el sistema.
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Correo
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ej. nombre@hospital.cl"
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-medium text-zinc-400"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-white/10 bg-zinc-900 py-2.5 pl-3.5 pr-11 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">Mínimo 8 caracteres.</p>
                </div>

                {error ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-white py-3 text-sm font-bold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Entrando…' : 'Iniciar sesión'}
                </button>
              </form>

              <p className="mt-8 text-center text-sm text-zinc-400">
                ¿No tienes cuenta?{' '}
                <Link
                  to="/registro"
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  Regístrate
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
