import { ArrowRight, Check, ClipboardCheck, Lock, MessageSquare, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ADMIN_TRAINING_PREFIX } from '../lib/adminBridge'
import { cn, isPassed } from '../lib/utils'
import { useStore } from '../store/AppStore'
import { buildOutline, learnPath } from './learn/outline'

/**
 * Where the assessment and feedback QR codes land (after sign-in). Checks that the person is on the
 * training and has done what comes first (journey, then passing the assessment) before opening it.
 */
export function AssessmentGate({ kind = 'assessment' }: { kind?: 'assessment' | 'feedback' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { getTraining, progress } = useStore()
  const training = getTraining(id.startsWith(ADMIN_TRAINING_PREFIX) ? id : `${ADMIN_TRAINING_PREFIX}${id}`) ?? getTraining(id)

  if (!training) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Lock className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-zinc-900">This {kind === 'feedback' ? 'feedback form' : 'assessment'} isn’t on your list</h1>
          <p className="mt-2 text-sm text-zinc-500">You’re not enrolled in this training, so you can’t {kind === 'feedback' ? 'give feedback on it' : 'take its assessment'}. If you think this is a mistake, ask your trainer to add you.</p>
          <Link to="/trainings" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            Go to my trainings <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    )
  }

  const p = progress[training.id]
  const outline = buildOutline(training, p)
  const item = outline.items.find((i) => i.id === 'assessment')
  const done = training.modules.filter((m) => p?.completedModules.includes(m.id)).length
  const passed = isPassed(p)
  const max = training.quizSettings?.maxAttempts
  const used = p?.attempts ?? 0
  const noAttemptsLeft = max !== undefined && used >= max && !passed
  const canStart = item?.state === 'open' && !noAttemptsLeft
  const feedbackItem = outline.items.find((i) => i.id === 'feedback')
  const journeyDone = done === training.modules.length

  if (kind === 'feedback') {
    const given = !!p?.feedback
    const fbChecks = [
      { ok: true, label: 'Enrolled in this training' },
      { ok: journeyDone, label: `Journey completed · ${done} of ${training.modules.length} modules`, hint: journeyDone ? undefined : 'Finish every module first.' },
      { ok: passed, label: passed ? `Assessment passed · ${p?.quizScore}%` : 'Assessment passed', hint: passed ? undefined : 'Pass the final assessment to unlock feedback.' },
    ]
    const canGive = feedbackItem?.state === 'open' || given
    return (
      <div className="mx-auto max-w-lg py-6 sm:py-10">
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <MessageSquare className="size-6" />
          </span>
          <p className="mt-4 text-xs font-semibold tracking-wide text-brand-600 uppercase">Training feedback</p>
          <h1 className="mt-1 text-xl leading-tight font-bold text-zinc-900">{training.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">About 2 minutes · helps the team improve the training</p>
          <ul className="mt-6 space-y-3">
            {fbChecks.map((c) => (
              <li key={c.label} className="flex gap-3">
                <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', c.ok ? 'bg-mpesa-500/15 text-mpesa-700' : 'bg-brand-50 text-brand-600')}>
                  {c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-900">{c.label}</span>
                  {c.hint && <span className="block text-xs text-zinc-500">{c.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
          {given && <p className="mt-6 rounded-xl bg-mpesa-500/10 px-4 py-3 text-sm font-medium text-mpesa-800">Thanks — you’ve already sent your feedback.</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => navigate(learnPath(training.id, canGive ? 'feedback' : journeyDone ? 'assessment' : undefined))}
              className={cn('inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white', canGive ? 'bg-brand-600 shadow-sm shadow-brand-600/25 hover:bg-brand-700' : 'bg-charcoal hover:bg-charcoal-light')}
            >
              {given ? 'View my feedback' : canGive ? 'Give feedback' : journeyDone ? 'Go to the assessment' : 'Continue the journey'} <ArrowRight className="size-4" />
            </button>
            <Link to={`/trainings/${training.id}`} className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
              Training details
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const checks = [
    { ok: true, label: 'Enrolled in this training' },
    { ok: done === training.modules.length, label: `Journey completed · ${done} of ${training.modules.length} modules`, hint: done < training.modules.length ? 'Finish every module to unlock the assessment.' : undefined },
    { ok: !noAttemptsLeft, label: max ? `Attempts · ${used} of ${max} used` : `Attempts · ${used} used, no limit`, hint: noAttemptsLeft ? 'No attempts left — ask your trainer to reset them.' : undefined },
  ]

  return (
    <div className="mx-auto max-w-lg py-6 sm:py-10">
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <ClipboardCheck className="size-6" />
        </span>
        <p className="mt-4 text-xs font-semibold tracking-wide text-brand-600 uppercase">Assessment</p>
        <h1 className="mt-1 text-xl leading-tight font-bold text-zinc-900">{training.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {training.quiz.length} questions{training.quizSettings?.timeLimitMinutes ? ` · ${training.quizSettings.timeLimitMinutes} min` : ''}
        </p>

        <ul className="mt-6 space-y-3">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-3">
              <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', c.ok ? 'bg-mpesa-500/15 text-mpesa-700' : 'bg-brand-50 text-brand-600')}>
                {c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
              </span>
              <span>
                <span className="block text-sm font-medium text-zinc-900">{c.label}</span>
                {c.hint && <span className="block text-xs text-zinc-500">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>

        {passed ? (
          <p className="mt-6 rounded-xl bg-mpesa-500/10 px-4 py-3 text-sm font-medium text-mpesa-800">You’ve already passed this assessment with {p?.quizScore}%.</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {canStart ? (
            <button onClick={() => navigate(learnPath(training.id, 'assessment'))} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700">
              {passed ? 'Open assessment' : used ? 'Try again' : 'Start assessment'} <ArrowRight className="size-4" />
            </button>
          ) : (
            <button onClick={() => navigate(learnPath(training.id))} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-charcoal px-4 py-3 text-sm font-semibold text-white hover:bg-charcoal-light">
              {noAttemptsLeft ? 'Open the training' : 'Continue the journey'} <ArrowRight className="size-4" />
            </button>
          )}
          <Link to={`/trainings/${training.id}`} className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Training details
          </Link>
        </div>
      </div>
    </div>
  )
}
