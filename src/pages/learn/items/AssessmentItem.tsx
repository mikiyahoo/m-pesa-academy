import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock, ListChecks, RotateCcw, Shuffle, Target, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TargetIllustration } from '../../../components/Illustrations'
import { PASS_MARK } from '../../../data/trainings'
import { cn } from '../../../lib/utils'
import type { Training, TrainingProgress } from '../../../types'
import { btnPrimary, btnSecondary, clock } from './shared'

type Props = {
  training: Training
  progress?: TrainingProgress
  onSubmit: (score: number) => void
  /** The player hides its outline while a quiz is running. */
  onFocusChange: (focused: boolean) => void
  onNext: () => void
  onReview: () => void
}

/**
 * Graded assessment (Q07): rules shown before starting, a focused full-width
 * quiz with an optional timer that auto-submits, shuffled options, an attempt
 * cap, and a result screen. The best score is kept.
 */
export function AssessmentItem({ training, progress: p, onSubmit, onFocusChange, onNext, onReview }: Props) {
  const settings = training.quizSettings ?? {}
  const attempts = p?.attempts ?? 0
  const best = p?.quizScore
  const passed = best !== undefined && best >= PASS_MARK
  const maxAttempts = settings.maxAttempts
  const exhausted = maxAttempts !== undefined && attempts >= maxAttempts && !passed

  const [mode, setMode] = useState<'intro' | 'running' | 'result'>('intro')
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | undefined>()
  const [run, setRun] = useState(0)
  const [openQ, setOpenQ] = useState(0)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onFocusChange(mode === 'running')
  }, [mode, onFocusChange])
  useEffect(() => {
    return () => onFocusChange(false)
  }, [onFocusChange])

  // New option order on every attempt; answers keep the original indexes.
  const orders = useMemo(() => {
    void run
    return training.quiz.map((q) => {
      const idx = q.options.map((_, i) => i)
      if (!settings.shuffle) return idx
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[idx[i], idx[j]] = [idx[j], idx[i]]
      }
      return idx
    })
  }, [run, settings.shuffle, training.quiz])

  const start = () => {
    setAnswers({})
    setResult(null)
    setSecondsLeft(settings.timeLimitMinutes ? settings.timeLimitMinutes * 60 : undefined)
    setRun((r) => r + 1)
    setOpenQ(0)
    setMode('running')
  }

  const submit = () => {
    const correct = training.quiz.filter((q) => answers[q.id] === q.answer).length
    const score = Math.round((correct / training.quiz.length) * 100)
    setResult(score)
    onSubmit(score)
    setMode('result')
  }

  useEffect(() => {
    if (mode !== 'running' || secondsLeft === undefined) return
    if (secondsLeft <= 0) {
      submit()
      return
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => (s === undefined ? s : s - 1)), 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, secondsLeft])

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' })
  }, [mode])

  const answered = Object.keys(answers).length
  const total = training.quiz.length

  // Picking an answer opens the next unanswered question, so there is no "Next" button.
  const choose = (qi: number, qid: string, oi: number) => {
    const next = { ...answers, [qid]: oi }
    setAnswers(next)
    const after = training.quiz.findIndex((q, i) => i > qi && next[q.id] === undefined)
    const before = training.quiz.findIndex((q) => next[q.id] === undefined)
    const target = after !== -1 ? after : before
    if (target !== -1) window.setTimeout(() => setOpenQ(target), 220)
  }

  if (mode === 'running') {
    return (
      <div ref={top} className="flex min-h-full flex-col">
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setMode('intro')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
              <ArrowLeft className="size-4" /> Back to assessment
            </button>
          </div>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-[1.75rem]">Final assessment</h1>
              <p className="mt-0.5 text-sm text-zinc-500">Answer all {total} questions to complete your assessment.</p>
            </div>
            {secondsLeft !== undefined && (
              <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold tabular-nums', secondsLeft <= 60 ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700')}>
                <Clock className="size-4" /> {clock(secondsLeft)}
              </span>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200 p-4">
            <p className="flex items-center justify-between text-sm">
              <span className="font-semibold text-zinc-900">Your progress</span>
              <span className="text-zinc-500">
                {answered} of {total} answered
              </span>
            </p>
            <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <span className="block h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${(answered / total) * 100}%` }} />
            </span>
          </div>

          <ol className="mt-4 space-y-3">
            {training.quiz.map((q, qi) => {
              const open = openQ === qi
              const chosen = answers[q.id]
              const done = chosen !== undefined
              return (
                <li key={q.id} className={cn('rounded-2xl border bg-white transition', open ? 'border-zinc-200' : 'border-zinc-200/80')}>
                  <button onClick={() => setOpenQ(open ? -1 : qi)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5">
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                        open ? 'bg-brand-600 text-white' : done ? 'bg-mpesa-600 text-white' : 'bg-zinc-100 text-zinc-600',
                      )}
                    >
                      {done && !open ? <CheckCircle2 className="size-4" /> : qi + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-zinc-900">{q.question}</span>
                      {done && !open && <span className="mt-0.5 block truncate text-xs text-zinc-500">Your answer: {q.options[chosen]}</span>}
                    </span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">1 point</span>
                    <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition', open && 'rotate-180')} />
                  </button>
                  {open && (
                    <fieldset className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
                      <legend className="sr-only">{q.question}</legend>
                      {orders[qi].map((oi) => {
                        const on = chosen === oi
                        return (
                          <label
                            key={oi}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition',
                              on ? 'border-brand-500 bg-brand-50/70 text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
                            )}
                          >
                            <input type="radio" name={q.id} checked={on} onChange={() => choose(qi, q.id, oi)} className="size-4 accent-brand-600" />
                            <span className="flex-1">{q.options[oi]}</span>
                            {on && <CheckCircle2 className="size-5 fill-brand-600 text-white" />}
                          </label>
                        )
                      })}
                    </fieldset>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="sticky bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-xs text-zinc-500">
                {answered} of {total} answered
              </span>
              <span className="hidden gap-1 sm:flex">
                {training.quiz.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setOpenQ(i)}
                    aria-label={`Question ${i + 1}`}
                    className={cn('h-1.5 w-8 rounded-full transition', answers[q.id] !== undefined ? 'bg-brand-600' : openQ === i ? 'bg-brand-200' : 'bg-zinc-200')}
                  />
                ))}
              </span>
            </div>
            <button onClick={submit} disabled={answered < total} className={btnPrimary}>
              Submit assessment
            </button>
          </div>
        </div>
      </div>
    )
  }

  const shown = mode === 'result' && result !== null ? result : best
  const shownPassed = shown !== undefined && shown >= PASS_MARK
  const canRetry = !passed && !exhausted

  return (
    <div ref={top} className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-4 py-6 sm:px-8 sm:py-10">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
        {/* Hero */}
        <div className="relative flex flex-col gap-6 bg-gradient-to-br from-brand-50 via-[#fff6f7] to-white px-6 py-8 sm:flex-row sm:items-center sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-500">Graded assessment</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">Final assessment</h1>
            <p className="mt-2 text-sm text-zinc-600">Covers all {training.modules.length} modules of {training.title}.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {passed ? (
                <button onClick={onNext} className={btnPrimary}>
                  Continue to feedback <ArrowRight className="size-4" />
                </button>
              ) : exhausted ? null : (
                <button onClick={start} className={btnPrimary}>
                  {attempts ? 'Try again' : 'Start assessment'}
                  {attempts > 0 && maxAttempts ? <span className="font-normal text-white/80">· attempt {attempts + 1} of {maxAttempts}</span> : null}
                </button>
              )}
              {passed && (
                <button onClick={start} className={btnSecondary}>
                  <RotateCcw className="size-4" /> Retake
                </button>
              )}
            </div>
          </div>
          <TargetIllustration className="hidden w-40 shrink-0 sm:block" />
        </div>

        {/* Result */}
        {shown !== undefined && (
          <div className={cn('flex flex-wrap items-center gap-5 border-t px-6 py-5 sm:px-8', shownPassed ? 'border-mpesa-500/20 bg-mpesa-500/[0.05]' : 'border-brand-100 bg-brand-50/40')}>
            <ScoreRing score={shown} passed={shownPassed} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold text-zinc-900">
                {shownPassed ? <CheckCircle2 className="size-5 text-mpesa-600" /> : <XCircle className="size-5 text-brand-600" />}
                {mode === 'result' ? (shownPassed ? 'Passed — well done!' : 'Not passed this time') : shownPassed ? 'You passed' : 'Not passed yet'}
              </p>
              <p className="mt-0.5 text-sm text-zinc-600">
                {mode === 'result' && best !== undefined && best !== shown ? `Your best score of ${best}% is kept. ` : ''}
                {shownPassed ? `You needed ${PASS_MARK}%.` : `You need ${PASS_MARK}% to pass.`}
                {exhausted && ' No attempts left — ask your trainer about a retake.'}
              </p>
            </div>
            {!shownPassed && (
              <button onClick={onReview} className={btnSecondary}>
                <BookOpen className="size-4" /> Review modules
              </button>
            )}
            {canRetry && mode === 'result' && (
              <button onClick={start} className={btnPrimary}>
                <RotateCcw className="size-4" /> Try again
              </button>
            )}
          </div>
        )}

        {/* Details */}
        <div className="grid gap-6 border-t border-zinc-200 px-6 py-6 sm:grid-cols-[minmax(0,1fr)_260px] sm:px-8">
          <div className="text-sm text-zinc-600">
            <p className="font-medium text-zinc-900">You must pass this assessment to earn your certificate.</p>
            <ul className="mt-3 space-y-2">
              <li>• Answer every question before submitting{settings.timeLimitMinutes ? ' — the timer submits automatically when it runs out' : ''}.</li>
              <li>• Your best score is kept{maxAttempts ? `; you have ${maxAttempts} attempts in total` : ''}.</li>
              <li>• After passing, share quick feedback to complete the training.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-semibold text-zinc-900">What to expect</p>
            <ul className="mt-3 space-y-2.5 text-sm text-zinc-700">
              <li className="flex items-center gap-2.5">
                <ListChecks className="size-4 text-zinc-500" /> {total} questions • 1 point each
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="size-4 text-zinc-500" /> {settings.timeLimitMinutes ? `${settings.timeLimitMinutes} min time limit` : 'No time limit'}
              </li>
              <li className="flex items-start gap-2.5">
                <RotateCcw className="mt-0.5 size-4 text-zinc-500" />
                <span>
                  {maxAttempts ? `${maxAttempts} attempts` : 'Unlimited attempts'}
                  <span className="block text-xs text-zinc-500">{attempts} used</span>
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Target className="size-4 text-zinc-500" /> Pass mark {PASS_MARK}%
              </li>
              {settings.shuffle && (
                <li className="flex items-center gap-2.5">
                  <Shuffle className="size-4 text-zinc-500" /> Options are shuffled
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScoreRing({ score, passed }: { score: number; passed: boolean }) {
  const c = 2 * Math.PI * 22
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
        <circle cx="26" cy="26" r="22" fill="none" stroke="#e4e4e7" strokeWidth="5" />
        <circle cx="26" cy="26" r="22" fill="none" stroke={passed ? 'var(--color-mpesa-600)' : 'var(--color-brand-600)'} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="text-sm font-bold text-zinc-900">{score}%</span>
    </span>
  )
}
