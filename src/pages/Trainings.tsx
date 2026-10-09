import { ArrowRight, Award, BarChart3, BookOpen, CalendarDays, ChevronRight, Filter, LayoutGrid, List, PlayCircle, SearchX, Star, TrendingDown, TrendingUp, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TargetIllustration, TrophyIllustration } from '../components/Illustrations'
import { TrainingCard } from '../components/TrainingCard'
import { currentUser } from '../data/trainings'
import { metricsWithTrend } from '../lib/stats'
import { cn, formatDate, progressStatus, sessionStatus, timeRange, todayISO } from '../lib/utils'
import { useStore } from '../store/AppStore'
import type { SessionStatus } from '../types'

type Tab = 'All' | SessionStatus
const tabs: { value: Tab; label: string }[] = [
  { value: 'All', label: 'All Trainings' },
  { value: 'Active', label: 'Active' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Completed', label: 'Completed' },
]

const VIEW_KEY = 'mpesa-learning:trainings-view'

function loadView(): 'grid' | 'list' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

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
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f4f4f5" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#39b54a" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-xl font-bold text-zinc-900">{Math.round(value)}%</span>
        <span className="text-[10px] text-zinc-500">Complete</span>
      </div>
    </div>
  )
}

export function Trainings() {
  const { trainings, progress } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('All')
  const [category, setCategory] = useState('')
  const [view, setViewState] = useState<'grid' | 'list'>(loadView)
  const query = params.get('q')?.toLowerCase() ?? ''
  const today = todayISO()

  const setView = (v: 'grid' | 'list') => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // Remembering the view is a convenience only.
    }
  }

  const { now, delta } = useMemo(() => metricsWithTrend(trainings, progress), [trainings, progress])
  const categories = useMemo(() => [...new Set(trainings.map((t) => t.category))].sort(), [trainings])

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: trainings.length }
    trainings.forEach((t) => (c[sessionStatus(t)] = (c[sessionStatus(t)] ?? 0) + 1))
    return c
  }, [trainings])

  const visible = trainings
    .filter((t) => tab === 'All' || sessionStatus(t) === tab)
    .filter((t) => !category || t.category === category)
    .filter((t) => !query || [t.title, t.trainer, t.venue, t.category].some((f) => f.toLowerCase().includes(query)))
    .sort((a, b) => a.date.localeCompare(b.date))

  const upcoming = trainings
    .filter((t) => t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  const next = trainings.find((t) => progressStatus(t, progress[t.id]) === 'In Progress') ?? trainings.find((t) => progressStatus(t, progress[t.id]) === 'Not Started')

  const stats = [
    { label: 'Total Courses', value: String(now.total), delta: delta.total, suffix: '', icon: BookOpen, tint: 'bg-mpesa-500/10 text-mpesa-600' },
    { label: 'Average Score', value: `${now.averageScore.toFixed(1)}%`, delta: delta.averageScore, suffix: '%', icon: Star, tint: 'bg-brand-50 text-brand-600' },
    { label: 'Completion Rate', value: `${now.completionRate.toFixed(1)}%`, delta: delta.completionRate, suffix: '%', icon: Award, tint: 'bg-zinc-100 text-zinc-800' },
  ]

  const quickLinks = [
    { to: '/certificates', label: 'View Certificates', icon: Award, tint: 'bg-mpesa-500/10 text-mpesa-600' },
    { to: '/calendar', label: 'Training Calendar', icon: CalendarDays, tint: 'bg-zinc-100 text-zinc-800' },
    { to: '/report', label: 'Progress Report', icon: BarChart3, tint: 'bg-brand-50 text-brand-600' },
    ...(next ? [{ to: `/trainings/${next.id}`, label: 'Continue Learning', icon: PlayCircle, tint: 'bg-amber-500/10 text-amber-600' }] : []),
  ]

  const widget = 'rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]'

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="grid grid-cols-1 gap-5 rounded-3xl bg-gradient-to-br from-white via-[#fff6f6] to-brand-50 p-5 sm:p-7 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)_minmax(0,0.95fr)]">
        <div className="self-center md:col-span-2 xl:col-span-1">
          <p className="text-sm font-semibold text-zinc-800">Welcome back, {currentUser.name.split(' ')[0]} 👋</p>
          <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Keep learning,
            <br />
            keep growing
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-500">Your training journey is making a difference. Build on your progress and reach your goals.</p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-zinc-100 rounded-2xl border border-zinc-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          {stats.map((s) => (
            <div key={s.label} className="p-3 sm:p-5">
              <span className={cn('grid size-9 place-items-center rounded-full sm:size-11', s.tint)}>
                <s.icon className="size-5" />
              </span>
              <p className="mt-3 text-xs font-medium text-zinc-700 sm:mt-4 sm:text-sm">{s.label}</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{s.value}</p>
              <Trend delta={s.delta} suffix={s.suffix} />
            </div>
          ))}
        </div>

        <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-charcoal p-6 text-white">
          <div className="absolute -top-16 -right-16 size-48 rounded-full bg-brand-600/20" aria-hidden />
          <TrophyIllustration className="absolute top-1/2 -right-1 size-24 -translate-y-1/2 sm:size-28" />
          <div className="relative max-w-[66%]">
            <h2 className="text-xl leading-tight font-bold">You’re making progress!</h2>
            <p className="mt-2 text-sm text-zinc-300">Complete more modules and earn your certificates.</p>
            <Link to="/report" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-zinc-900 transition hover:bg-zinc-100">
              View Progress <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
        <div className="scrollbar-none flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.value
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                aria-pressed={active}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                  active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-zinc-600 hover:bg-zinc-50',
                )}
              >
                {t.label}
                <span className={cn('grid min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold', active ? 'bg-white text-brand-600' : 'bg-zinc-100 text-zinc-600')}>
                  {counts[t.value] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Category</span>
            <Filter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none rounded-xl border border-zinc-200 bg-white py-2 pr-9 pl-9 text-sm text-zinc-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 rotate-90 text-zinc-500" />
          </label>
          <div className="flex rounded-xl border border-zinc-200 p-0.5">
            {(
              [
                ['grid', LayoutGrid, 'Grid view'],
                ['list', List, 'List view'],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={label}
                aria-pressed={view === v}
                className={cn('rounded-lg p-1.5 transition', view === v ? 'bg-charcoal text-white' : 'text-zinc-500 hover:bg-zinc-100')}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trainings */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Available Trainings</h2>
            <p className="text-sm text-zinc-500">Browse and continue your learning journey</p>
          </div>
          {(query || category) && (
            <button
              onClick={() => {
                setParams({})
                setCategory('')
              }}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200"
            >
              {query ? `Results for “${params.get('q')}”` : category} <X className="size-3.5" />
            </button>
          )}
        </div>

        {visible.length ? (
          <div className={cn('mt-4 grid gap-4', view === 'grid' ? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1')}>
            {visible.map((t) => (
              <TrainingCard key={t.id} training={t} progress={progress[t.id]} layout={view} />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center">
            <SearchX className="size-8 text-zinc-300" />
            <p className="mt-3 text-sm font-medium">No trainings found</p>
            <p className="text-xs text-zinc-500">Try another tab, category or search term.</p>
          </div>
        )}
      </section>

      {/* Widgets */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <div className={cn(widget, 'flex flex-col bg-gradient-to-br from-white to-mpesa-500/[0.06]')}>
          <span className="grid size-11 place-items-center rounded-xl bg-mpesa-500/10 text-mpesa-600">
            <Award className="size-5" />
          </span>
          <div className="mt-3 flex flex-1 items-center gap-3">
            <div className="flex-1">
              <h3 className="font-bold text-zinc-900">Your Learning Progress</h3>
              <p className="mt-1 text-xs text-zinc-500">Track your progress across all courses and see what’s next.</p>
            </div>
            <ProgressRing value={now.completionRate} />
          </div>
          <Link to="/report" className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-charcoal-light">
            View Progress <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className={widget}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-zinc-900">
              <CalendarDays className="size-5 text-zinc-800" /> Upcoming Sessions
            </h3>
            <Link to="/calendar" className="text-xs font-semibold text-brand-600 hover:underline">
              View All
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-zinc-100">
            {upcoming.map((t, i) => (
              <li key={t.id}>
                <Link to={`/trainings/${t.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', ['bg-brand-50 text-brand-600', 'bg-zinc-100 text-zinc-800', 'bg-mpesa-500/10 text-mpesa-600'][i % 3])}>
                    <CalendarDays className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-zinc-900">{t.title}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {formatDate(t.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {timeRange(t)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" />
                </Link>
              </li>
            ))}
            {!upcoming.length && <li className="py-6 text-center text-xs text-zinc-500">No upcoming sessions.</li>}
          </ul>
        </div>

        <div className={widget}>
          <h3 className="flex items-center gap-2 font-bold text-zinc-900">
            <Zap className="size-5 text-brand-600" /> Quick Links
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {quickLinks.map((q) => (
              <Link key={q.label} to={q.to} className="flex flex-col items-center gap-2 rounded-xl border border-zinc-100 px-2 py-3.5 text-center transition hover:border-zinc-200 hover:bg-zinc-50">
                <span className={cn('grid size-9 place-items-center rounded-lg', q.tint)}>
                  <q.icon className="size-4" />
                </span>
                <span className="text-[11px] font-semibold text-zinc-700">{q.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-48 flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff5f5] to-brand-50 p-6">
          <TargetIllustration className="absolute -right-2 bottom-2 w-32 opacity-95" />
          <div className="relative max-w-[60%]">
            <h3 className="text-xl leading-tight font-bold text-zinc-900">Small steps develop big skills.</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">Every course you complete brings you closer to your goals.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
