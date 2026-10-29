import { ChevronDown, Globe2, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { loadAdminData } from '../../admin/storage'
import { REGIONS } from '../../admin/temporary'
import { publicAccessSettings, validateGuest, type GuestSignUp, type GuestSignUpErrors } from '../../lib/publicAccess'
import { cn } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { AuthShell } from './AuthShell'

const FIELDS: { key: Exclude<keyof GuestSignUp, 'region'>; label: string; placeholder: string; type?: string; autoComplete?: string; half?: boolean }[] = [
  { key: 'name', label: 'Full name', placeholder: 'e.g. Liya Bekele', autoComplete: 'name' },
  { key: 'email', label: 'Email', placeholder: 'name@company.com', type: 'email', autoComplete: 'email' },
  { key: 'phone', label: 'Mobile number', placeholder: '09XXXXXXXX', type: 'tel', autoComplete: 'tel', half: true },
  { key: 'organization', label: 'Organisation', placeholder: 'Company, agent shop or “Individual”', autoComplete: 'organization', half: true },
  { key: 'designation', label: 'Your role', placeholder: 'e.g. Agent, merchant, student', half: true },
]

/** Self sign-up for people outside the company: a guest account limited to public trainings. */
export function SignUp() {
  const { signUp } = useAuth()
  const settings = publicAccessSettings(loadAdminData())
  const [form, setForm] = useState<GuestSignUp>({ name: '', email: '', phone: '', organization: '', designation: '', region: '' })
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<GuestSignUpErrors & { agreed?: string }>({})
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simulated network latency.
    setTimeout(() => {
      // Check everything (including the terms) before creating the account.
      const found: GuestSignUpErrors & { agreed?: string } = validateGuest(form, loadAdminData())
      if (!agreed) found.agreed = 'Please accept the terms to continue.'
      setErrors(Object.keys(found).length ? found : (signUp(form) ?? {}))
      setLoading(false)
    }, 600)
  }

  const input = (bad?: string) =>
    cn('mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100', bad ? 'border-brand-500' : 'border-zinc-200')

  if (!settings.enabled) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-bold tracking-tight">Guest sign-up is closed</h2>
        <p className="mt-2 text-sm text-zinc-500">The training team isn’t accepting new guest accounts right now. If you were invited, use the link in your invite email.</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Back to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold tracking-tight">Create a guest account</h2>
      <p className="mt-1 text-sm text-zinc-500">Join M-PESA Academy’s public trainings. No password — we’ll text you a sign-in code.</p>

      <p className="mt-5 flex gap-3 rounded-xl bg-brand-50/70 px-3.5 py-3 text-xs leading-relaxed text-brand-800">
        <Globe2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
        <span>
          Guest accounts see <b>public trainings</b> only, plus any training the team invites you to. Access lasts <b>{settings.accessDays} days</b> and can be extended by the training team.
        </span>
      </p>

      <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {FIELDS.map((f) => (
          <label key={f.key} className={cn('block', !f.half && 'sm:col-span-2')}>
            <span className="text-sm font-medium text-zinc-700">{f.label}</span>
            <input
              type={f.type ?? 'text'}
              autoComplete={f.autoComplete}
              autoFocus={f.key === 'name'}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              aria-invalid={!!errors[f.key]}
              className={input(errors[f.key])}
            />
            {errors[f.key] && <span className="mt-1 block text-xs text-brand-600">{errors[f.key]}</span>}
          </label>
        ))}
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Region</span>
          <span className="relative block">
            <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} aria-invalid={!!errors.region} className={cn(input(errors.region), 'cursor-pointer appearance-none bg-white pr-9')}>
              <option value="">Choose your region…</option>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 mt-0.5 size-4 -translate-y-1/2 text-zinc-500" />
          </span>
          {errors.region && <span className="mt-1 block text-xs text-brand-600">{errors.region}</span>}
        </label>

        <label className="flex items-start gap-2 text-sm text-zinc-600 sm:col-span-2">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
          <span>I agree to the M-PESA Academy terms of use and to my details being used to manage my training.</span>
        </label>
        {errors.agreed && <p className="-mt-2 text-xs text-brand-600 sm:col-span-2">{errors.agreed}</p>}

        {errors.form && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 sm:col-span-2">{errors.form}</p>}

        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70 sm:col-span-2">
          {loading && <Loader2 className="size-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have a guest account?{' '}
        <Link to="/?mode=code" className="font-semibold text-brand-600 hover:underline">
          Sign in with a code
        </Link>
      </p>
    </AuthShell>
  )
}
