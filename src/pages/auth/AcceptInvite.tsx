import { AlertCircle, CalendarDays, Loader2, MailCheck, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { longDate, shortDate } from '../../admin/helpers'
import { loadAdminData } from '../../admin/storage'
import { accessBlock, trainingsFor } from '../../admin/temporary'
import { useAuth } from '../../store/Auth'
import { AuthShell } from './AuthShell'

/** Landing page for the link in a temporary trainee's invite email (TE-1.2, URS 2.1). */
export function AcceptInvite({ token }: { token: string }) {
  const { loginWithInvite } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { person, inviter, trainings, blocked } = useMemo(() => {
    const data = loadAdminData()
    const p = data.people.find((x) => x.inviteToken === token)
    return {
      person: p,
      inviter: p?.invitedBy,
      trainings: p ? trainingsFor(p.id, data.trainings).sort((a, b) => a.date.localeCompare(b.date)) : [],
      blocked: p ? accessBlock(p) : null,
    }
  }, [token])

  const go = () => {
    setLoading(true)
    setError(null)
    setTimeout(() => {
      setError(loginWithInvite(token))
      setLoading(false)
    }, 500)
  }

  if (!person || blocked) {
    return (
      <AuthShell>
        <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <AlertCircle className="size-6" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">{person ? 'You can’t sign in right now' : 'This invite link isn’t valid'}</h2>
        <p className="mt-2 text-sm text-zinc-600">{blocked ?? 'Check that you opened the whole link from your invite email, or ask the trainer to send a new invite.'}</p>
        <Link to="/" className="mt-8 inline-block text-sm font-semibold text-brand-600 hover:underline">
          Go to the sign-in page
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <span className="grid size-12 place-items-center rounded-xl bg-mpesa-500/10 text-mpesa-600">
        <MailCheck className="size-6" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">Welcome, {person.name.split(' ')[0]}</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {inviter ? `${inviter} invited you` : 'You’ve been invited'} to M-PESA Academy{person.organization ? ` as part of ${person.organization}` : ''}.
      </p>

      {trainings.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Your training</p>
          <ul className="mt-2 space-y-2">
            {trainings.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-start gap-2.5 text-sm">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                <span>
                  <span className="block font-medium text-zinc-900">{t.name}</span>
                  <span className="text-xs text-zinc-500">{longDate(t.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Your access runs {person.accessStart ? `from ${shortDate(person.accessStart)} ` : ''}until {person.accessEnd ? shortDate(person.accessEnd) : 'your trainer removes it'}. Use this same link whenever you want to sign in.
      </p>

      {error && <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>}

      <button
        onClick={go}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-70"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        Send me a verification code
      </button>
      <p className="mt-3 text-center text-xs text-zinc-500">We’ll text a 6-digit code to the phone number on your invite. No password needed.</p>
    </AuthShell>
  )
}
