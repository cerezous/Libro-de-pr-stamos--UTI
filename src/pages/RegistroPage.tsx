import { Link } from 'react-router-dom'

export function RegistroPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-4 text-center text-zinc-300">
      <p className="text-lg text-white">Registro</p>
      <p className="mt-2 max-w-sm text-sm">Próximamente: formulario de alta enlazado a Supabase Auth.</p>
      <Link
        to="/login"
        className="mt-6 text-sm font-semibold text-emerald-400 underline-offset-2 hover:underline"
      >
        Volver al inicio de sesión
      </Link>
    </div>
  )
}
