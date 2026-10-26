import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  Lock,
  Play,
  Route,
  Share2,
  Sparkles,
} from 'lucide-react'
import { journeys } from '../data/journeys'
import { checkPrerequisites, getJourneyMetrics } from '../lib/learningPaths'
import { cn, isPassed, progressPercent, progressStatus } from '../lib/utils'
import { useStore } from '../store/AppStore'
import { useFeedback } from './Feedback'

export function LearningPathsTracker() {
  const { trainings, progress } = useStore()
  const { toast } = useFeedback()
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(journeys[0]?.id || '')

  const currentJourney = journeys.find((j) => j.id === selectedJourneyId) || journeys[0]
  const metrics = currentJourney ? getJourneyMetrics(currentJourney, trainings, progress) : null

  const handleShareBadge = (badgeName: string) => {
    const text = `I just earned the ${badgeName} credential on the M-PESA Training Academy!`
    if (navigator.share) {
      navigator.share({ title: badgeName, text, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text} ${window.location.href}`)
      toast('Achievement copied to clipboard! Share on LinkedIn or WhatsApp.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Track Selector Pills */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Route className="size-4" />
            </span>
            <h2 className="text-xl font-bold text-zinc-900">Structured Learning Pathways</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Curated course tracks with prerequisites, step progressions, and verified credential badges.
          </p>
        </div>
      </div>

      {/* Pathway Cards Tabs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {journeys.map((j) => {
          const m = getJourneyMetrics(j, trainings, progress)
          const active = j.id === selectedJourneyId
          return (
            <button
              key={j.id}
              onClick={() => setSelectedJourneyId(j.id)}
              className={cn(
                'group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition duration-200',
                active
                  ? 'border-brand-600 bg-white ring-2 ring-brand-600/20 shadow-md'
                  : 'border-zinc-200/80 bg-white hover:border-zinc-300 hover:shadow-sm',
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {j.audience}
                  </span>
                  {m.isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mpesa-50 px-2 py-0.5 text-[11px] font-bold text-mpesa-700">
                      <CheckCircle2 className="size-3 text-mpesa-600" />
                      Completed
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-500">{m.percent}%</span>
                  )}
                </div>

                <h3 className="mt-2.5 font-bold text-zinc-900 group-hover:text-brand-600 line-clamp-1">
                  {j.title}
                </h3>
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{j.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                  <span>{m.completed}/{m.total} courses</span>
                  {j.badgeName && (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                      <Award className="size-3" />
                      {j.badgeName}
                    </span>
                  )}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      m.isCompleted ? 'bg-mpesa-600' : 'bg-brand-600',
                    )}
                    style={{ width: `${m.percent}%` }}
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Track Detail & Interactive Progression Map */}
      {currentJourney && metrics && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-sm">
          {/* Track Banner */}
          <div className="flex flex-col gap-4 border-b border-zinc-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-zinc-900">{currentJourney.title}</h3>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  {metrics.completed} of {metrics.total} Completed
                </span>
              </div>
              <p className="text-sm text-zinc-600">{currentJourney.description}</p>
            </div>

            {/* Capstone Badge Card */}
            {currentJourney.badgeName && (
              <div
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-2xl border p-3 sm:px-4',
                  metrics.isCompleted
                    ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/60 shadow-sm'
                    : 'border-zinc-200 bg-zinc-50/70',
                )}
              >
                <div
                  className={cn(
                    'grid size-11 place-items-center rounded-xl shadow-xs',
                    metrics.isCompleted
                      ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white'
                      : 'bg-zinc-200 text-zinc-500',
                  )}
                >
                  <Award className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Track Credential
                    </p>
                    {metrics.isCompleted && <Sparkles className="size-3 text-amber-600" />}
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{currentJourney.badgeName}</p>
                  <p className="text-[11px] text-zinc-500">
                    {metrics.isCompleted
                      ? 'Earned & verified'
                      : 'Complete all courses in track to earn'}
                  </p>
                </div>
                {metrics.isCompleted && (
                  <button
                    onClick={() => handleShareBadge(currentJourney.badgeName!)}
                    className="ml-2 rounded-xl bg-white p-2 text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-brand-600 transition"
                    title="Share Credential"
                  >
                    <Share2 className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sequential Progression Steps */}
          <div className="mt-8">
            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Pathway Sequence &amp; Prerequisites
            </h4>
            <div className="mt-4 relative">
              <ol className="space-y-4">
                {metrics.steps.map((training, index) => {
                  const p = progress[training.id]
                  const status = progressStatus(training, p)
                  const percent = progressPercent(training, p)
                  const passed = isPassed(p)
                  const isDone = status === 'Completed' && passed

                  const { isLocked, missingPrerequisites } = checkPrerequisites(
                    training.id,
                    trainings,
                    progress,
                  )

                  return (
                    <li
                      key={training.id}
                      className={cn(
                        'relative flex flex-col gap-4 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between sm:p-5',
                        isDone
                          ? 'border-mpesa-200 bg-mpesa-50/20'
                          : isLocked
                            ? 'border-zinc-200 bg-zinc-50/80 opacity-80'
                            : 'border-brand-200/80 bg-white ring-1 ring-brand-100 shadow-sm',
                      )}
                    >
                      {/* Step Number & Course Details */}
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-xl font-bold text-sm',
                            isDone
                              ? 'bg-mpesa-600 text-white'
                              : isLocked
                                ? 'bg-zinc-200 text-zinc-600'
                                : 'bg-brand-600 text-white shadow-sm shadow-brand-600/30',
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="size-5" />
                          ) : isLocked ? (
                            <Lock className="size-4" />
                          ) : (
                            index + 1
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Step {index + 1}
                            </span>
                            <span className="text-zinc-300">•</span>
                            <span className="text-xs font-medium text-zinc-600">
                              {training.category}
                            </span>
                            {isDone && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-mpesa-100 px-2 py-0.5 text-[11px] font-bold text-mpesa-800">
                                Completed
                              </span>
                            )}
                            {isLocked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                <Lock className="size-3" />
                                Locked by Prerequisite
                              </span>
                            )}
                          </div>

                          <h5 className="mt-1 text-base font-bold text-zinc-900">
                            {training.title}
                          </h5>

                          <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                            {training.description}
                          </p>

                          {/* Missing Prerequisite Warning */}
                          {isLocked && missingPrerequisites.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200/60">
                              <span className="font-semibold">Prerequisite Required:</span> Complete{' '}
                              {missingPrerequisites.map((mp, mi) => (
                                <Link
                                  key={mp.id}
                                  to={`/trainings/${mp.id}`}
                                  className="underline font-bold text-brand-700 hover:text-brand-800"
                                >
                                  {mp.title}
                                  {mi < missingPrerequisites.length - 1 ? ', ' : ''}
                                </Link>
                              ))}{' '}
                              first to unlock this course.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Action Button & Progress */}
                      <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-3 sm:border-0 sm:pt-0 sm:justify-end">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold text-zinc-700">
                            {training.modules.length} Modules
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {isDone ? '100% Done' : `${percent}% Done`}
                          </p>
                        </div>

                        {isDone ? (
                          <Link
                            to={`/certificates/${training.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-mpesa-200 bg-white px-3.5 py-2 text-xs font-bold text-mpesa-700 shadow-xs hover:bg-mpesa-50 transition"
                          >
                            <Award className="size-3.5" />
                            View Certificate
                          </Link>
                        ) : isLocked ? (
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-400 cursor-not-allowed"
                          >
                            <Lock className="size-3.5" />
                            Locked
                          </button>
                        ) : (
                          <Link
                            to={`/trainings/${training.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 transition"
                          >
                            <Play className="size-3.5 fill-current" />
                            {percent > 0 ? 'Continue' : 'Start Course'}
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
