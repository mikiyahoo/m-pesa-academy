import { ArrowRight, Award, BookOpen, BookOpenCheck, CalendarDays, ChevronRight, Crown, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateTile } from '../components/CalendarParts'
import { SegmentRing } from '../components/SegmentRing'
import { DartTargetIllustration, TrophyIllustration } from '../components/Illustrations'
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
      <section className="grid grid-cols-1 gap-4 sm:gap-5 sm:rounded-3xl sm:border sm:border-zinc-200/80 sm:bg-white sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_355px] 2xl:gap-x-6">
        {/* Intro: soft pink panel with the target illustration in the corner. */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-r from-[#fff7f7] via-[#fff1f1] to-[#ffe4e4] p-5 ring-1 ring-brand-100/70 lg:col-span-2 2xl:col-span-1">
          {/* Pale disc behind the target. */}
          <div className="pointer-events-none absolute top-1/2 -right-8 size-40 -translate-y-[60%] rounded-full bg-gradient-to-br from-white/70 to-brand-100/70 sm:size-48" aria-hidden />
          <DartTargetIllustration className="pointer-events-none absolute top-1/2 right-1 w-24 -translate-y-[62%] drop-shadow-[0_10px_14px_rgba(208,60,59,0.25)] sm:right-3 sm:w-28 2xl:right-2 2xl:w-24" />
          <h1 className="relative pr-24 text-[1.5rem] leading-[1.1] font-extrabold tracking-tight text-charcoal sm:pr-28 sm:text-[1.65rem] 2xl:pr-24">
            Keep learning,
            <br />
            <span className="text-brand-600">keep growing</span>
          </h1>
          <p className="relative mt-2 pr-24 text-[13px] leading-relaxed text-zinc-600 sm:pr-28 2xl:pr-24">
            Your training journey is making
            <br />a difference.
          </p>
          <p className="relative mt-auto inline-flex w-fit items-center gap-2.5 rounded-full bg-brand-100/70 py-1.5 pr-3.5 pl-1.5 text-xs font-semibold text-brand-700 max-2xl:mt-4">
            <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <TrendingUp className="size-3" />
            </span>
            {now.completionRate >= 50 ? 'You’re making great progress this month!' : 'Keep going — every module counts!'}
          </p>
        </div>

        {/* Stats: three separate white cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              to="/report"
              className="group @container flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-zinc-300 max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:px-4 2xl:p-4"
            >
              {/* Icon on the left when the card is wide enough, on top when it is narrow. */}
              <div className="flex min-w-0 flex-col gap-3 @[10.5rem]:flex-row @[10.5rem]:items-center">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full sm:size-11', s.tint)}>
                  <s.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-600 sm:text-[13px]">{s.label}</p>
                  <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[1.65rem] 2xl:text-[1.45rem]">{s.value}</p>
                </div>
              </div>
              {/* Trend sits at the bottom of the card. */}
              <div className="mt-auto flex items-center justify-between gap-2 pt-3 max-sm:mt-0 max-sm:ml-auto max-sm:shrink-0 max-sm:pt-0">
                <Trend delta={s.delta} suffix={s.suffix} />
                <ChevronRight className="size-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-600 sm:hidden" />
              </div>
            </Link>
          ))}
        </div>

        {/* Next milestone: dark-to-red card, trophy on the right, arrow to the training. */}
        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#141012] via-[#1d0c10] to-[#2c0a0f] p-5 text-white shadow-card">
          {/* Soft curved red sweeps rising from the bottom-right corner. */}
          <svg className="pointer-events-none absolute inset-0 size-full -scale-y-100" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMid slice" aria-hidden>
            <defs>
              <linearGradient id="ms-sweep-a" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#6a0f18" stopOpacity="0" />
                <stop offset="0.5" stopColor="#6a0f18" stopOpacity="0.7" />
                <stop offset="1" stopColor="#8e1320" />
              </linearGradient>
              <linearGradient id="ms-sweep-b" x1="0.2" y1="0" x2="1" y2="0.8">
                <stop offset="0" stopColor="#a3111f" stopOpacity="0.2" />
                <stop offset="1" stopColor="#c8142a" />
              </linearGradient>
              <linearGradient id="ms-sweep-c" x1="0.3" y1="0" x2="1" y2="0.6">
                <stop offset="0" stopColor="#d2172c" stopOpacity="0.3" />
                <stop offset="1" stopColor="#ee2337" />
              </linearGradient>
              <filter id="ms-soft" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2.5" />
              </filter>
            </defs>
            <g filter="url(#ms-soft)">
              <path d="M90 -10C170 110 290 170 420 215V-10Z" fill="url(#ms-sweep-a)" />
              <path d="M170 -10C230 80 320 135 420 160V-10Z" fill="url(#ms-sweep-b)" opacity="0.9" />
              <path d="M250 -10C290 45 350 85 420 100V-10Z" fill="url(#ms-sweep-c)" opacity="0.85" />
            </g>
            <path d="M130 0C205 100 300 160 400 192" fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth="1.2" />
            <path d="M210 0C260 70 330 118 400 135" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1" />
          </svg>
          <TrophyIllustration burst className="absolute top-4 right-8 size-24 rotate-[25deg] drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] sm:right-10 sm:size-28" />
          {/* Tag at the top; the rest sits at the bottom so the progress bar lines up with the arrow. */}
          <div className="relative flex max-w-[58%] flex-1 flex-col sm:max-w-[60%]">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/90 uppercase ring-1 ring-white/10">
              <Crown className="size-3.5 text-amber-300" /> Your next milestone
            </span>
            <div className="mt-auto pt-5">
            {milestone.next ? (
              <>
                <h2 className="text-base leading-tight font-bold sm:text-lg">
                  {(() => {
                    const left = milestone.next.checks.filter((c) => !c.ok).length
                    return `${left} step${left === 1 ? '' : 's'} to your next certificate`
                  })()}
                </h2>
                <p className="mt-1.5 truncate text-sm text-white/70">{milestone.next.t.title}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full rounded-full bg-gradient-to-r from-brand-600 to-[#f0283f]" style={{ width: `${(milestone.next.checks.filter((c) => c.ok).length / milestone.next.checks.length) * 100}%` }} />
                  </span>
                  <span className="text-xs font-semibold text-white/80 tabular-nums">
                    {milestone.next.checks.filter((c) => c.ok).length}/{milestone.next.checks.length}
                  </span>
                </div>
              </>
            ) : milestone.earned ? (
              <>
                <h2 className="text-base leading-tight font-bold sm:text-lg">All caught up — {milestone.earned} certificate{milestone.earned === 1 ? '' : 's'} earned.</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">Start a new training to unlock the next one.</p>
              </>
            ) : (
              <>
                <h2 className="text-base leading-tight font-bold sm:text-lg">Small steps develop big skills.</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">Start a training to work towards your first certificate.</p>
              </>
            )}
            </div>
          </div>
          <Link
            to={milestone.next ? `/trainings/${milestone.next.t.id}` : milestone.earned ? '/certificates' : '/learning'}
            aria-label={milestone.next ? `Continue ${milestone.next.t.title}` : milestone.earned ? 'View certificates' : 'Browse trainings'}
            className="absolute right-5 bottom-5 grid size-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
          >
            <ArrowRight className="size-4" />
          </Link>
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
