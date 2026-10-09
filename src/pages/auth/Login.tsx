import { Eye, EyeOff, Info, Loader2, Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { adminUser, currentUser, DEMO_PASSWORD } from '../../data/trainings'
import { useAuth } from '../../store/Auth'
import { AuthShell } from './AuthShell'

export function Login() {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!identifier.trim() || !password) {
      setError('Enter your email or phone number and password.')
      return
    }
    setLoading(true)
    // Simulated network latency.
    setTimeout(() => {
      setError(login(identifier, password))
      setLoading(false)
    }, 700)
  }

  return (
    <AuthShell>
      <div className="mb-8 lg:hidden">
        <p className="text-4xl font-extrabold tracking-tight text-brand-600">
          m<span className="text-mpesa-500">-</span>pesa
        </p>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
      <p className="mt-1 text-sm text-zinc-500">Sign in to continue to M-PESA Learning.</p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Email or phone number</span>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@mpesa.et"
              className="w-full rounded-lg border border-zinc-200 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-sm font-medium text-zinc-700">
            Password
            <button type="button" className="text-xs font-medium text-brand-600 hover:underline">
              Forgot password?
            </button>
          </span>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-200 py-2.5 pr-10 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-600"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-brand-600" />
          Remember this device
        </label>

        {error && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>}

        <button
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </button>
      </form>

      <div className="mt-8 flex gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600">
        <Info className="mt-0.5 size-4 shrink-0 text-zinc-400" />
        <div className="flex-1">
          <p className="font-medium text-zinc-700">Demo accounts · password {DEMO_PASSWORD}</p>
          {[
            ['Learner', currentUser.email],
            ['Admin', adminUser.email],
          ].map(([label, email]) => (
            <div key={label} className="mt-1.5 flex items-center justify-between gap-2">
              <span>
                <span className="font-medium text-zinc-700">{label}:</span> {email}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIdentifier(email)
                  setPassword(DEMO_PASSWORD)
                }}
                className="shrink-0 font-medium text-brand-600 hover:underline"
              >
                Use
              </button>
            </div>
          ))}
        </div>
      </div>
    </AuthShell>
  )
}
