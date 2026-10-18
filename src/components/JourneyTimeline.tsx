import { Check, ChevronDown, CircleDot, Flag, Route, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { journeys } from '../data/journeys'
import { cn, formatDate, progressStatus } from '../lib/utils'
import { useStore } from '../store/AppStore'
import type { ProgressStatus, Training } from '../types'

/** Up to this many trainings show as a step timeline; longer journeys use a compact checklist. */
const TIMELINE_MAX = 6
/** Journeys listed before "Show all journeys". */
const JOURNEYS_SHOWN = 4
/** Upcoming steps listed in a long journey before "Show all". */
const STEPS_SHOWN = 5

type Step = { t: Training; status: ProgressStatus }

/**
 * Learning journeys on the Profile page. Each journey is one compact row (progress and the next
 * step); opening it shows the milestones. Stays short with many journeys or long journeys.
 */
export function JourneyTimeline() {
  const { getTraining, progress } = useStore()
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)

  const rows = useMemo(
    () =>
      journeys.map((j) => {
        const steps: Step[] = j.trainingIds
          .map(getTraining)
          .filter((t) => !!t)
          .map((t) => ({ t, status: progressStatus(t, progress[t.id]) }))
        const done = steps.filter((s) => s.status === 'Completed').length
        const next = steps.find((s) => s.status === 'In Progress') ?? steps.find((s) => s.status === 'Not Started')
        return { j, steps, done, next, started: steps.some((s) => s.status !== 'Not Started') }
      }),
    [getTraining, progress],
  )
  // Open the journey you're working on first.
  const [open, setOpen] = useState<string>(() => rows.find((r) => r.started && r.done < r.steps.length)?.j.id ?? rows[0]?.j.id ?? '')

  const filtered = rows.filter((r) => !q || `${r.j.title} ${r.j.audience}`.toLowerCase().includes(q.toLowerCase()))
  const visible = showAll || q ? filtered : filtered.slice(0, JOURNEYS_SHOWN)
  const inProgress = rows.filter((r) => r.started && r.done < r.steps.length).length
  const complete = rows.filter((r) => r.steps.length && r.done === r.steps.length).length

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <Route className="size-4 text-brand-600" /> Learning journeys
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {rows.length} journeys · {inProgress} in progress · {complete} complete — take the trainings in any order.
          </p>
        </div>
        {rows.length > JOURNEYS_SHOWN && (
          <label className="relative w-full sm:w-56">
            <span className="sr-only">Search journeys</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search journeys…"
              className="w-full rounded-xl border border-zinc-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80">
        {visible.map(({ j, steps, done, next }) => {
          const isOpen = open === j.id
          const pct = steps.length ? Math.round((done / steps.length) * 100) : 0
          const finished = steps.length > 0 && done === steps.length
          return (
            <li key={j.id}>
              <button onClick={() => setOpen(isOpen ? '' : j.id)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-zinc-50/70">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-zinc-900">{j.title}</span>
                    <span className="text-xs text-zinc-500">{j.audience}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-3">
                    <JourneyBar steps={steps} pct={pct} />
                    <span className="shrink-0 text-xs font-semibold text-zinc-700 tabular-nums">
                      {done}/{steps.length}
                    </span>
                  </span>
                  <span className="mt-1.5 block truncate text-xs text-zinc-500">
                    {finished ? <span className="font-medium text-mpesa-700">Journey complete</span> : next ? <>Next: <span className="font-medium text-zinc-700">{next.t.title}</span></> : 'No trainings yet'}
                  </span>
                </span>
                <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition', isOpen && 'rotate-180 text-brand-600')} />
              </button>
              {isOpen && (
                <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-4">
                  {steps.length <= TIMELINE_MAX ? <Timeline steps={steps} finished={finished} /> : <Checklist steps={steps} />}
                  <Link to={`/learning?journey=${j.id}`} className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
                    View these trainings
                  </Link>
                </div>
              )}
            </li>
          )
        })}
        {!visible.length && <li className="px-4 py-8 text-center text-sm text-zinc-500">No journeys match “{q}”.</li>}
      </ul>

      {!q && filtered.length > JOURNEYS_SHOWN && (
        <button onClick={() => setShowAll((s) => !s)} className="mt-3 text-xs font-semibold text-brand-600 hover:underline">
          {showAll ? 'Show fewer journeys' : `Show all ${filtered.length} journeys`}
        </button>
      )}
    </section>
  )
}

/** One segment per training while it fits; a plain bar for long journeys. */
function JourneyBar({ steps, pct }: { steps: Step[]; pct: number }) {
  if (steps.length && steps.length <= 12)
    return (
      <span className="flex h-1.5 flex-1 gap-1" aria-label={`${pct}% complete`}>
        {steps.map((s) => (
          <span key={s.t.id} className={cn('flex-1 rounded-full', s.status === 'Completed' ? 'bg-mpesa-500' : s.status === 'In Progress' ? 'bg-amber-400' : 'bg-zinc-200')} />
        ))}
      </span>
    )
  return (
    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200" aria-label={`${pct}% complete`}>
      <span className="block h-full rounded-full bg-mpesa-500" style={{ width: `${pct}%` }} />
    </span>
  )
}

function StepDot({ s, i }: { s: Step; i: number }) {
  return (
    <span
      className={cn(
        'relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 ring-white',
        s.status === 'Completed' ? 'bg-mpesa-600 text-white' : s.status === 'In Progress' ? 'bg-amber-500 text-white' : 'border-2 border-zinc-200 bg-white text-zinc-500',
      )}
    >
      {s.status === 'Completed' ? <Check className="size-4" strokeWidth={3} /> : i + 1}
    </span>
  )
}

const statusText = (s: Step) => (s.status === 'Not Started' ? formatDate(s.t.date, { month: 'short', day: 'numeric' }) : s.status)
const statusTone = (s: Step) => (s.status === 'Completed' ? 'text-mpesa-700' : s.status === 'In Progress' ? 'text-amber-700' : 'text-zinc-500')

/** Short journeys: milestones on a line (top-to-bottom on phones) ending in a flag. */
function Timeline({ steps, finished }: { steps: Step[]; finished: boolean }) {
  return (
    <ol className="relative grid gap-4 sm:grid-flow-col sm:auto-cols-fr sm:gap-2">
      {steps.map((s, i) => (
        <li key={s.t.id} className="relative flex gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
          <span
            aria-hidden
            className={cn(
              'absolute top-8 left-[15px] h-[calc(100%-0.5rem)] w-0.5 sm:top-[15px] sm:left-[calc(50%+18px)] sm:h-0.5 sm:w-[calc(100%-36px+0.5rem)]',
              s.status === 'Completed' ? 'bg-mpesa-500' : 'bg-zinc-200',
            )}
          />
          <StepDot s={s} i={i} />
          <Link to={`/trainings/${s.t.id}`} className="group min-w-0 sm:px-1">
            <span className="line-clamp-2 text-xs font-semibold text-zinc-900 group-hover:text-brand-600">{s.t.title}</span>
            <span className={cn('mt-0.5 block text-[11px]', statusTone(s))}>{statusText(s)}</span>
          </Link>
        </li>
      ))}
      <li className="relative flex gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
        <span className={cn('relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white', finished ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-400')}>
          <Flag className="size-4" />
        </span>
        <span className={cn('self-center text-xs font-semibold sm:self-auto', finished ? 'text-brand-700' : 'text-zinc-500')}>{finished ? 'Journey complete' : 'Finish'}</span>
      </li>
    </ol>
  )
}

/** Long journeys: completed steps folded into one line, then the next few, with "Show all". */
function Checklist({ steps }: { steps: Step[] }) {
  const [all, setAll] = useState(false)
  const done = steps.filter((s) => s.status === 'Completed')
  const remaining = steps.filter((s) => s.status !== 'Completed')
  const list = all ? steps : remaining.slice(0, STEPS_SHOWN)
  return (
    <div>
      {!all && done.length > 0 && (
        <p className="mb-2 flex items-center gap-2 text-xs font-medium text-mpesa-700">
          <Check className="size-4" strokeWidth={3} /> {done.length} completed
        </p>
      )}
      <ol className={cn('space-y-1', all && 'max-h-80 overflow-y-auto pr-1')}>
        {list.map((s) => (
          <li key={s.t.id}>
            <Link to={`/trainings/${s.t.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white">
              {s.status === 'Completed' ? (
                <Check className="size-4 shrink-0 text-mpesa-600" strokeWidth={3} />
              ) : s.status === 'In Progress' ? (
                <CircleDot className="size-4 shrink-0 text-amber-500" />
              ) : (
                <span className="size-4 shrink-0 rounded-full border-2 border-zinc-300" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 group-hover:text-brand-600">{s.t.title}</span>
              <span className={cn('shrink-0 text-xs', statusTone(s))}>{statusText(s)}</span>
            </Link>
          </li>
        ))}
      </ol>
      {steps.length > list.length || all ? (
        <button onClick={() => setAll((a) => !a)} className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
          {all ? 'Show less' : `Show all ${steps.length} trainings`}
        </button>
      ) : null}
    </div>
  )
}
