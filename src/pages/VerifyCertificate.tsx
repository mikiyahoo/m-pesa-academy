import { BadgeCheck, CalendarDays, CircleX, GraduationCap, Hash, Star, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { currentUser, LATE_WINDOW_MINUTES } from '../data/trainings'
import { certificateChecks, certificateId, formatDate } from '../lib/utils'
import { useAuth } from '../store/Auth'
import { useStore } from '../store/AppStore'

/**
 * Public page behind the certificate QR code: anyone can confirm a certificate is genuine
 * without signing in. In this prototype the register is the demo learner's records.
 */
export function VerifyCertificate({ id }: { id: string }) {
  const { trainings, progress } = useStore()
  const { stage } = useAuth()
  const training = trainings.find((t) => certificateId(t) === id)
  const p = training ? progress[training.id] : undefined
  const valid = !!training && certificateChecks(training, p, LATE_WINDOW_MINUTES).eligible

  const rows = training
    ? [
        { icon: UserRound, label: 'Awarded to', value: currentUser.name },
        { icon: GraduationCap, label: 'Training', value: training.title },
        { icon: CalendarDays, label: 'Date issued', value: formatDate(p?.completedAt ?? training.date) },
        { icon: Star, label: 'Assessment score', value: p?.quizScore != null ? `${p.quizScore}%` : '—' },
        { icon: UserRound, label: 'Trainer', value: training.trainer },
      ]
    : []

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
          <span className="leading-none font-bold tracking-tight text-zinc-900">
            <span className="block text-base leading-[1.05]">M-PESA</span>
            <span className="block text-sm leading-[1.05] font-semibold text-zinc-500">Academy</span>
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white">
          <div className={valid ? 'bg-mpesa-500/10 px-6 py-7 text-center' : 'bg-brand-50 px-6 py-7 text-center'}>
            <span className={valid ? 'mx-auto grid size-14 place-items-center rounded-full bg-mpesa-600 text-white' : 'mx-auto grid size-14 place-items-center rounded-full bg-brand-600 text-white'}>
              {valid ? <BadgeCheck className="size-7" /> : <CircleX className="size-7" />}
            </span>
            <h1 className="mt-4 text-xl font-bold text-zinc-900">{valid ? 'Certificate verified' : 'Certificate not found'}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {valid ? 'This certificate was issued by M-PESA Academy and is valid.' : 'We couldn’t match this ID to an issued certificate. Check the ID and try again.'}
            </p>
          </div>

          <dl className="divide-y divide-zinc-100 px-6">
            <div className="flex items-center gap-3 py-3.5">
              <Hash className="size-4 shrink-0 text-zinc-400" />
              <dt className="w-36 shrink-0 text-xs text-zinc-500">Certificate ID</dt>
              <dd className="min-w-0 truncate font-mono text-sm font-semibold text-zinc-900">{id}</dd>
            </div>
            {valid &&
              rows.map((r) => (
                <div key={r.label} className="flex items-center gap-3 py-3.5">
                  <r.icon className="size-4 shrink-0 text-zinc-400" />
                  <dt className="w-36 shrink-0 text-xs text-zinc-500">{r.label}</dt>
                  <dd className="min-w-0 text-sm font-medium text-zinc-900">{r.value}</dd>
                </div>
              ))}
          </dl>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          {stage === 'signedIn' ? (
            <Link to="/certificates" className="font-semibold text-brand-600 hover:underline">
              Go to my certificates
            </Link>
          ) : (
            <Link to="/" className="font-semibold text-brand-600 hover:underline">
              Sign in to M-PESA Academy
            </Link>
          )}
        </p>
      </div>
    </div>
  )
}
