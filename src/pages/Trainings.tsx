import { ArrowRight, Award, BookOpen, BookOpenCheck, CalendarDays, ChevronRight, Crown, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateTile } from '../components/CalendarParts'
import { SegmentRing } from '../components/SegmentRing'
import { TrophyIllustration } from '../components/Illustrations'
import { TrainingCard } from '../components/TrainingCard'
import { metricsWithTrend } from '../lib/stats'
import { AssignmentReader } from '../components/Assignments'
import { LATE_WINDOW_MINUTES } from '../data/trainings'
import type { Material } from '../admin/types'
import { assignmentDone, myLearnerId, useLearnerAssignments } from '../lib/assignments'
import { certificateChecks, cn, formatDate, progressStatus, timeRange, todayISO } from '../lib/utils'
import { loadView, ViewToggle } from './Learning'
import { useStore } from '../store/AppStore'

function Trend({ delta, suffix = '%' }: { delta: number; suffix?: string }) {
  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <div className="mt-2 text-xs text-zinc-500">
      <p className="flex items-center gap-1 whitespace-nowrap">
        <Icon className={cn('size-3.5', up ? 'text-mpesa-600' : delta < 0 ? 'text-brand-600' : 'text-zinc-400')} />
        <span className={cn('font-semibold', up ? 'text-mpesa-600' : delta < 0 ? 'text-brand-600' : 'text-zinc-500')}>
          {up ? '+' : ''}
          {delta.toFixed(1)}
          {suffix}
        </span>
      </p>
      <p className="mt-0.5 hidden whitespace-nowrap sm:block">vs last 30 days</p>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(value, 100))
  return (
    <SegmentRing
      className="size-28"
      label={`${Math.round(v)}% complete`}
      segments={[
        { value: v, color: '#39b54a' },
        { value: 100 - v, color: '#e4e4e7' },
      ]}
    >
      <span className="text-2xl font-bold text-zinc-900 tabular-nums">{Math.round(v)}%</span>
      <span className="text-[10px] text-zinc-500">Complete</span>
    </SegmentRing>
  )
}

export function Trainings() {
  const { trainings, progress } = useStore()
  const [view, setView] = useState<'grid' | 'list'>(loadView)
  const today = todayISO()
  const assigned = useLearnerAssignments()
  const [reading, setReading] = useState<Material | null>(null)

  const { now, delta } = useMemo(() => metricsWithTrend(trainings, progress), [trainings, progress])
  // Latest three trainings (newest session date first); the full list lives on the Learning tab.
  const latest = [...trainings].sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)).slice(0, 4)

  // Next milestone: the started training closest to its certificate.
  const milestone = useMemo(() => {
    const open = trainings
      .filter((t) => progressStatus(t, progress[t.id]) !== 'Not Started')
      .map((t) => ({ t, ...certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES) }))
      .filter((x) => !x.eligible)
      .sort((a, b) => a.checks.filter((c) => !c.ok).length - b.checks.filter((c) => !c.ok).length)
    const earned = trainings.filter((t) => certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES).eligible).length
    return { next: open[0], earned }
  }, [trainings, progress])

  // Up next: unfinished assigned reading (overdue first) and upcoming sessions, in one list.
  const upNext = [
    ...assigned
      .filter((m) => !assignmentDone(m, myLearnerId()))
      .map((m) => ({ kind: 'reading' as const, key: `r-${m.id}`, sort: m.dueDate ?? '9999', m })),
    ...trainings.filter((t) => t.date >= today).map((t) => ({ kind: 'session' as const, key: `s-${t.id}`, sort: t.date, t })),
  ]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(0, 5)
  const stats = [
    { label: 'Courses', value: String(now.total), delta: delta.total, suffix: '', icon: BookOpen, tint: 'bg-brand-50 text-brand-600' },
    { label: 'Avg. Score', value: `${now.averageScore.toFixed(1)}%`, delta: delta.averageScore, suffix: '%', icon: Star, tint: 'bg-amber-500/10 text-amber-600' },
    { label: 'Completion', value: `${now.completionRate.toFixed(1)}%`, delta: delta.completionRate, suffix: '%', icon: Award, tint: 'bg-mpesa-500/10 text-mpesa-600' },
  ]

  const widget = 'rounded-2xl border border-zinc-200/80 bg-white p-5'

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="grid grid-cols-1 gap-5 rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="relative flex flex-col lg:col-span-2 2xl:col-span-1">
          <h1 className="text-[1.75rem] leading-[1.08] font-extrabold tracking-tight text-charcoal sm:text-[2rem]">
            Keep learning,
            <br />
            <span className="text-brand-600">keep growing</span>
          </h1>
          <p className="mt-2.5 max-w-xs text-[13px] leading-relaxed text-zinc-500">Your training journey is making a difference. Build on your progress and reach your goals.</p>
          <p className="mt-auto inline-flex w-fit items-center gap-2 rounded-xl bg-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 max-2xl:mt-4">
            <span className="grid size-5 place-items-center rounded-md bg-brand-600 text-white">
              <TrendingUp className="size-3" />
            </span>
            {now.completionRate >= 50 ? 'You’re making great progress this month!' : 'Keep going — every module counts!'}
          </p>
        </div>

        {/* Stats: three separate white cards */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="@container flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-card 2xl:p-5">
              {/* Icon on the left when the card is wide enough, on top when it is narrow. */}
              <div className="flex min-w-0 flex-col gap-3 @[10.5rem]:flex-row @[10.5rem]:items-center">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full sm:size-11', s.tint)}>
                  <s.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-600 sm:text-[13px]">{s.label}</p>
                  <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">{s.value}</p>
                </div>
              </div>
              {/* Trend sits at the bottom of the card. */}
              <div className="mt-auto pt-3">
                <Trend delta={s.delta} suffix={s.suffix} />
              </div>
            </div>
          ))}
        </div>

        {/* Next milestone */}
        <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-[#303238] bg-gradient-to-br from-[#2b2d33] to-[#1f2126] p-6 text-white shadow-card">
          <div className="absolute -top-20 -right-12 size-56 rounded-full bg-white/[0.04]" aria-hidden />
          <TrophyIllustration className="absolute right-3 bottom-2 size-24 sm:size-28" />
          <div className="relative max-w-[74%]">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/90 uppercase">
              <Crown className="size-3.5 text-amber-300" /> Your next milestone
            </span>
            {milestone.next ? (
              <>
                <h2 className="mt-3 text-lg leading-tight font-bold sm:text-xl">
                  {(() => {
                    const left = milestone.next.checks.filter((c) => !c.ok).length
                    return `${left} step${left === 1 ? '' : 's'} to your next certificate`
                  })()}
                </h2>
                <p className="mt-2 line-clamp-1 text-sm text-slate-300">{milestone.next.t.title}</p>
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full rounded-full bg-amber-300" style={{ width: `${(milestone.next.checks.filter((c) => c.ok).length / milestone.next.checks.length) * 100}%` }} />
                  </span>
                  <span className="text-xs font-semibold text-white/80 tabular-nums">
                    {milestone.next.checks.filter((c) => c.ok).length}/{milestone.next.checks.length}
                  </span>
                </div>
              </>
            ) : milestone.earned ? (
              <>
                <h2 className="mt-3 text-lg leading-tight font-bold sm:text-xl">All caught up — {milestone.earned} certificate{milestone.earned === 1 ? '' : 's'} earned.</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Start a new training to unlock the next one.</p>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-lg leading-tight font-bold sm:text-xl">Small steps develop big skills.</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Start a training to work towards your first certificate.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Latest trainings */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Latest Trainings</h2>
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle view={view} onChange={setView} />
              <Link to="/learning" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                View all <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className={cn('mt-4 grid gap-4', view === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
            {latest.map((t) => (
              <TrainingCard key={t.id} training={t} progress={progress[t.id]} layout={view} barWidth={120} />
            ))}
          </div>
        </section>

        {/* Right column */}
        <aside className="space-y-4 lg:pt-[3.75rem]">
          {/* Two columns: icon, title and description on the left; ring on top and arrow at the bottom on the right. */}
          <div className={cn(widget, 'flex gap-4 bg-gradient-to-br from-white to-mpesa-500/[0.06]')}>
            <div className="min-w-0 flex-1">
              <span className="grid size-12 place-items-center rounded-2xl bg-mpesa-500/10 text-mpesa-600">
                <Award className="size-6" />
              </span>
              <h3 className="mt-3 text-xl leading-tight font-bold text-zinc-900">Your Learning Progress</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">Track your progress across all courses and see what’s next.</p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-3">
              <ProgressRing value={now.completionRate} />
              <Link to="/report" aria-label="View progress report" className="p-1 text-zinc-900 transition hover:translate-x-0.5 hover:text-brand-600">
                <ArrowRight className="size-5" strokeWidth={2.25} />
              </Link>
            </div>
          </div>

          <div className={widget}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-zinc-900">
                <CalendarDays className="size-5 text-zinc-800" /> Up next
              </h3>
              <Link to="/learning?view=calendar" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                View calendar <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-zinc-100">
              {upNext.map((item) =>
                item.kind === 'session' ? (
                  <li key={item.key}>
                    <Link to={`/trainings/${item.t.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <DateTile date={item.t.date} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold text-zinc-900">{item.t.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">Session · {timeRange(item.t)}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-zinc-400" />
                    </Link>
                  </li>
                ) : (
                  <li key={item.key}>
                    <button onClick={() => setReading(item.m)} className="flex w-full items-center gap-3 py-3 text-left hover:opacity-80">
                      <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-brand-50 py-2.5 text-brand-600">
                        <BookOpenCheck className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold text-zinc-900">{item.m.title}</span>
                        <span className={cn('mt-0.5 block truncate text-xs', item.m.dueDate && item.m.dueDate < today ? 'font-medium text-brand-700' : 'text-zinc-500')}>
                          Assigned reading{item.m.dueDate ? ` · due ${formatDate(item.m.dueDate, { month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-zinc-400" />
                    </button>
                  </li>
                ),
              )}
              {!upNext.length && <li className="py-6 text-center text-xs text-zinc-500">Nothing coming up — you’re all caught up.</li>}
            </ul>
          </div>
        </aside>
      </div>
      {reading && <AssignmentReader m={reading} onClose={() => setReading(null)} />}
    </div>
  )
}
