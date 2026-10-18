import { ArrowRight, Award, CalendarDays, CalendarPlus, CheckCircle2, Circle, Clock, Lock, MapPin, MessageSquare, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../../../components/Feedback'
import { FeedbackSurvey } from '../../../components/FeedbackForm'
import { TrophyIllustration } from '../../../components/Illustrations'
import { LATE_WINDOW_MINUTES, LIKERT } from '../../../data/trainings'
import { downloadIcs } from '../../../lib/ics'
import { certificateChecks, cn, formatDate, sessionStatus, timeRange } from '../../../lib/utils'
import { CertificateArt } from '../../Certificates'
import type { CheckInMethod, FeedbackSubmission, Training, TrainingProgress } from '../../../types'
import type { OutlineItem } from '../outline'
import { ItemTitle, btnPrimary, btnSecondary } from './shared'

const markTone = (mark: string) =>
  mark === 'Present' ? 'bg-mpesa-500/10 text-mpesa-700' : mark === 'Late' ? 'bg-amber-500/10 text-amber-700' : mark === 'Absent' ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-zinc-600'

/** Live session: when and where, attendance status, and the check-in / Teams join action (TE-5.1). */
export function SessionItem({ training: t, progress: p, onCheckIn }: { training: Training; progress?: TrainingProgress; onCheckIn: (method: CheckInMethod) => void }) {
  const { toast } = useFeedback()
  const session = sessionStatus(t)
  const { mark } = certificateChecks(t, p, LATE_WINDOW_MINUTES)
  const isTeams = !!t.teamsJoinUrl

  const join = () => {
    onCheckIn('teams')
    if (t.teamsJoinUrl!.includes('DEMO')) toast('Demo meeting — in production this opens Microsoft Teams', { tone: 'info' })
    else window.open(t.teamsJoinUrl, '_blank', 'noopener')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <ItemTitle
        eyebrow={
          <>
            {isTeams ? <Video className="size-4 text-brand-600" /> : <MapPin className="size-4 text-brand-600" />} Live session
          </>
        }
        title={t.title}
        aside={<span className={cn('rounded-full px-3 py-1 text-xs font-semibold', markTone(mark))}>{mark === 'Not yet' ? 'Not checked in' : mark}</span>}
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: CalendarDays, label: 'Date', value: formatDate(t.date, { weekday: 'short', month: 'short', day: 'numeric' }) },
          { icon: Clock, label: 'Time', value: timeRange(t) },
          { icon: isTeams ? Video : MapPin, label: isTeams ? 'Where' : 'Venue', value: isTeams ? (t.venue === 'ONLINE' ? 'Microsoft Teams' : `Teams or ${t.venue}`) : t.venue },
        ].map((d) => (
          <div key={d.label} className="rounded-2xl border border-zinc-200 p-4">
            <d.icon className="size-5 text-brand-600" />
            <p className="mt-3 text-xs text-zinc-500">{d.label}</p>
            <p className="text-sm font-semibold text-zinc-900">{d.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
        {p?.checkInAt ? (
          <p className="flex items-start gap-3 text-sm text-zinc-700">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mpesa-600" />
            <span>
              You checked in at {new Date(p.checkInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              {p.checkInMethod === 'teams' ? ' via Microsoft Teams' : ''} — marked <b>{mark}</b>. Check-ins more than {LATE_WINDOW_MINUTES} minutes after the start count as Late.
            </span>
          </p>
        ) : session === 'Active' ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-zinc-700">
              The session is live today. {isTeams ? 'Joining on Teams records your attendance automatically.' : 'Check in when you arrive — or scan the QR code your trainer shows.'}
            </p>
            {isTeams ? (
              <button onClick={join} className="inline-flex items-center gap-2 rounded-xl bg-[#5b5fc7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4b4fb5]">
                <Video className="size-4" /> Join on Teams
              </button>
            ) : (
              <button
                onClick={() => {
                  onCheckIn('manual')
                  toast('Checked in — attendance recorded')
                }}
                className={btnPrimary}
              >
                <MapPin className="size-4" /> Check in
              </button>
            )}
          </div>
        ) : session === 'Upcoming' ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-zinc-700">Check-in opens on the day of the session. You can start the modules now.</p>
            <button
              onClick={() => {
                downloadIcs(t)
                toast('Calendar invite downloaded')
              }}
              className={btnSecondary}
            >
              <CalendarPlus className="size-4" /> Add to calendar
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-700">This session has passed and no check-in was recorded, so you're marked Absent. Contact your trainer if this is wrong — attendance is needed for the certificate.</p>
        )}
      </div>
    </div>
  )
}

/** Feedback survey, inline in the player (D5: required to complete). */
export function FeedbackItem({ training: t, progress: p, onSubmit, onNext }: { training: Training; progress?: TrainingProgress; onSubmit: (f: FeedbackSubmission) => void; onNext: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <ItemTitle
        eyebrow={
          <>
            <MessageSquare className="size-4 text-brand-600" /> Survey • 2 min
          </>
        }
        title="How was the training?"
      />
      <p className="mt-3 text-sm text-zinc-600">
        {t.title} with {t.trainer}. Your feedback is required to complete the training and helps us improve the next session.
      </p>
      <div className="mt-8">
        {p?.feedback ? (
          <div className="rounded-2xl border border-mpesa-500/20 bg-mpesa-500/[0.05] p-5">
            <p className="flex items-center gap-2 font-semibold text-zinc-900">
              <CheckCircle2 className="size-5 text-mpesa-600" /> Thanks — feedback submitted
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Sent {formatDate(p.feedback.submittedAt.slice(0, 10))}
              {p.feedback.anonymous ? ' anonymously' : ''} • overall: {LIKERT[(p.feedback.likert.at(-1) ?? 3) - 1]} • {p.feedback.recommend ? 'would recommend' : "wouldn't recommend"}
            </p>
            <button onClick={onNext} className={cn(btnPrimary, 'mt-4')}>
              {certificateChecks(t, p, LATE_WINDOW_MINUTES).eligible ? 'Go to certificate' : 'See what’s left for your certificate'} <ArrowRight className="size-4" />
            </button>
          </div>
        ) : (
          <FeedbackSurvey onSubmit={onSubmit} />
        )}
      </div>
    </div>
  )
}

/** Certificate: shown once every requirement is met (D6). */
export function CertificateItem({ training: t, progress: p }: { training: Training; progress?: TrainingProgress }) {
  const { checks } = certificateChecks(t, p, LATE_WINDOW_MINUTES)
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <ItemTitle
        eyebrow={
          <>
            <Award className="size-4 text-brand-600" /> Certificate
          </>
        }
        title="Congratulations — you did it!"
      />
      <p className="mt-3 text-sm text-zinc-600">You met every requirement for {t.title}. Your certificate is ready to view, download and share.</p>
      <div className="mt-7 overflow-hidden rounded-2xl border border-zinc-200">{p && <CertificateArt training={t} progress={p} />}</div>
      <ul className="mt-6 grid gap-2 sm:grid-cols-3">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
            <CheckCircle2 className="size-4 shrink-0 text-mpesa-600" /> {c.label}
          </li>
        ))}
      </ul>
      <Link to={`/certificates/${t.id}`} className={cn(btnPrimary, 'mt-6 bg-mpesa-600 shadow-mpesa-600/25 hover:bg-mpesa-700')}>
        <Award className="size-4" /> Open certificate
      </Link>
    </div>
  )
}

/** Shown when a locked item is opened directly: what's still needed and where to go next. */
export function LockedItem({
  item,
  training: t,
  progress: p,
  doneModules,
  current,
  onGo,
}: {
  item: OutlineItem
  training: Training
  progress?: TrainingProgress
  doneModules: number
  current: OutlineItem
  onGo: () => void
}) {
  const { checks } = certificateChecks(t, p, LATE_WINDOW_MINUTES)
  const steps = [
    { label: `Complete all ${t.modules.length} modules`, detail: `${doneModules} of ${t.modules.length} done`, ok: doneModules === t.modules.length },
    ...checks.filter((c) => c.key !== 'feedback').map((c) => ({ label: c.label, detail: c.detail, ok: c.ok })),
    { label: 'Share your feedback', detail: p?.feedback ? 'Done' : 'After the assessment', ok: !!p?.feedback },
  ]
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-12 text-center sm:px-8 sm:py-20">
      <div className="relative">
        <span className="absolute inset-0 -z-0 rotate-12 rounded-3xl bg-brand-50" />
        <TrophyIllustration className="relative w-28" />
        <span className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-full bg-charcoal text-white ring-4 ring-white">
          <Lock className="size-4" />
        </span>
      </div>
      <h1 className="mt-8 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Keep going! This unlocks soon.</h1>
      <p className="mt-2 max-w-xl text-[15px] text-zinc-600">
        <span className="font-semibold text-zinc-900">{item.title}</span> is locked. {item.lockedReason}.
      </p>
      <ul className="mt-7 w-full max-w-xl space-y-2 text-left">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 px-4 py-3">
            {s.ok ? <CheckCircle2 className="size-5 shrink-0 text-mpesa-600" /> : <Circle className="size-5 shrink-0 text-zinc-300" />}
            <span className={cn('flex-1 text-sm font-medium', s.ok ? 'text-zinc-500 line-through decoration-zinc-300' : 'text-zinc-900')}>{s.label}</span>
            <span className="text-xs text-zinc-500">{s.detail}</span>
          </li>
        ))}
      </ul>
      <button onClick={onGo} className={cn(btnPrimary, 'mt-8')}>
        Continue: {current.title} <ArrowRight className="size-4" />
      </button>
    </div>
  )
}
