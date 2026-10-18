import { ArrowUpDown, Award, BookOpen, CalendarDays, CalendarX2, CheckCircle2, ChevronDown, Clock3, Download, MessageSquare, PlayCircle, Search, SearchX, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { RowMenu } from '../components/RowMenu'
import { EmptyState } from '../components/EmptyState'
import { SegmentTabs } from '../components/SegmentTabs'
import { SegmentRing } from '../components/SegmentRing'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LATE_WINDOW_MINUTES } from '../data/trainings'
import { daysAgoISO, metricsWithTrend } from '../lib/stats'
import { attendanceMark, cn, durationMinutes, formatDate, parseDate, progressPercent, progressStatus, sessionStatus, todayISO } from '../lib/utils'
import { useStore } from '../store/AppStore'

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function ProgressDonut({ rows, completed, inProgress, notStarted, overall }: { rows: number; completed: number; inProgress: number; notStarted: number; overall: number }) {
  return (
    <SegmentRing
      className="size-36"
      size={112}
      stroke={12}
      label={`${overall}% overall progress`}
      segments={
        rows
          ? [
              { value: completed, color: '#39b54a' },
              { value: inProgress, color: '#f59e0b' },
              { value: notStarted, color: '#e4e4e7' },
            ]
          : []
      }
    >
      <span className="text-2xl font-bold tracking-tight text-zinc-900">{overall}%</span>
      <span className="mt-0.5 text-[10px] font-medium text-zinc-500">Overall Progress</span>
    </SegmentRing>
  )
}

function TrendSparkline({ color, delta }: { color: string; delta: number }) {
  const line = delta > 0
    ? 'M2 32 C12 30 15 29 21 29 S30 22 37 24 S48 13 55 17 S68 7 75 10 S87 3 94 2'
    : delta < 0
      ? 'M2 3 C12 5 15 7 21 7 S30 14 37 12 S48 23 55 19 S68 29 75 26 S87 35 94 37'
      : 'M2 20 C18 19 26 21 40 20 S66 19 78 20 S88 20 94 19'
  const area = `${line} L94 40 L2 40 Z`
  return (
    <svg viewBox="0 0 96 42" className="h-full w-full overflow-visible" aria-hidden>
      <path d={area} fill={color} opacity="0.08" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScoreTrendChart({ scores }: { scores: number[] }) {
  const points = scores.map((score, index) => ({
    x: scores.length === 1 ? 100 : 8 + (184 * index) / (scores.length - 1),
    y: 6 + ((100 - Math.max(0, Math.min(100, score))) / 100) * 38,
  }))
  const coordinates = points.map(({ x, y }) => `${x},${y}`).join(' ')
  const area = points.length > 1 ? `M${points[0].x} 48 L${coordinates} L${points[points.length - 1].x} 48 Z` : ''

  return (
    <svg viewBox="0 0 200 52" className="size-full" role="img" aria-label={`Quiz score trend across ${scores.length} scored trainings`}>
      <line x1="4" y1="48" x2="196" y2="48" stroke="var(--color-zinc-200)" strokeWidth="1" />
      {area && <path d={area} fill="var(--color-brand-50)" />}
      {points.length > 1 && <polyline points={coordinates} fill="none" stroke="var(--color-brand-600)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="3.5" fill="var(--color-brand-600)" stroke="white" strokeWidth="2" />)}
    </svg>
  )
}

export function Report() {
  const { trainings, progress } = useStore()
  const [rangeStart, setRangeStart] = useState(() => {
    const now = parseDate(todayISO())
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [rangeEnd, setRangeEnd] = useState(() => {
    const now = parseDate(todayISO())
    return toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  })
  const [statusFilter, setStatusFilter] = useState<'All' | 'Completed' | 'In Progress' | 'Not Started'>('All')
  const [search, setSearch] = useState('')
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('asc')
  // The date panel closes on any click outside it, like the other dropdowns.
  const rangeMenu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (e: Event) => {
      const el = rangeMenu.current
      if (el?.open && !el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [])
  const [rangePreset, setRangePreset] = useState<'All Dates' | 'This Month' | 'Last 30 Days' | 'Custom Range'>('This Month')

  const allRows = trainings
    .map((t) => ({
      t,
      status: progressStatus(t, progress[t.id]),
      session: sessionStatus(t),
      percent: progressPercent(t, progress[t.id]),
      score: progress[t.id]?.quizScore,
      feedback: !!progress[t.id]?.feedback,
      attendance: attendanceMark(t, progress[t.id], LATE_WINDOW_MINUTES),
    }))
  const { now: reportMetrics, delta: reportDelta } = metricsWithTrend(trainings, progress)
  const learningMinutes = trainings.reduce((sum, training) => {
    const completed = progress[training.id]?.completedModules ?? []
    return sum + training.modules.reduce((minutes, module) => minutes + (completed.includes(module.id) ? module.minutes : 0), 0)
  }, 0)
  const previousCutoff = daysAgoISO(30)
  const previousLearningMinutes = trainings.reduce((sum, training) => {
    const completedAt = progress[training.id]?.completedAt
    return completedAt && completedAt <= previousCutoff ? sum + durationMinutes(training) : sum
  }, 0)
  const learningHours = learningMinutes / 60
  const learningHoursDelta = (learningMinutes - previousLearningMinutes) / 60
  const reportStats = [
    { label: 'Courses Enrolled', value: String(trainings.length), delta: reportDelta.total, suffix: '', icon: BookOpen, tone: 'red' },
    { label: 'Completed', value: String(reportMetrics.completed), delta: reportDelta.completed, suffix: '', icon: CheckCircle2, tone: 'green' },
    { label: 'Average Score', value: `${reportMetrics.averageScore.toFixed(1)}%`, delta: reportDelta.averageScore, suffix: '%', icon: Star, tone: 'amber' },
    { label: 'Learning Time', value: `${learningHours.toFixed(1)} h`, delta: learningHoursDelta, suffix: 'h', icon: Clock3, tone: 'blue' },
  ] as const

  const rows = allRows
    .filter((r) => r.t.date >= rangeStart && r.t.date <= rangeEnd)
    .sort((a, b) => dateSort === 'asc' ? a.t.date.localeCompare(b.t.date) : b.t.date.localeCompare(a.t.date))
  const scoreTrendRows = allRows.filter((row) => row.score !== undefined).sort((a, b) => a.t.date.localeCompare(b.t.date))
  const scoreTrendValues = scoreTrendRows.flatMap((row) => row.score === undefined ? [] : [row.score])

  const byStatus = (['Completed', 'In Progress', 'Not Started'] as const).map((s) => ({
    s,
    n: rows.filter((r) => r.status === s).length,
  }))
  const totalRows = rows.length
  const completedCount = byStatus.find((item) => item.s === 'Completed')?.n ?? 0
  const inProgressCount = byStatus.find((item) => item.s === 'In Progress')?.n ?? 0
  const notStartedCount = byStatus.find((item) => item.s === 'Not Started')?.n ?? 0
  const overallProgress = totalRows ? Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / totalRows) : 0
  const tableRows = rows.filter((r) => {
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter
    const needle = search.trim().toLowerCase()
    const matchesSearch = !needle || [r.t.title, r.t.category, r.t.trainer].some((value) => value.toLowerCase().includes(needle))
    return matchesStatus && matchesSearch
  })

  const byCategory = Object.entries(
    rows.reduce<Record<string, { total: number; done: number }>>((acc, r) => {
      acc[r.t.category] ??= { total: 0, done: 0 }
      acc[r.t.category].total++
      if (r.status === 'Completed') acc[r.t.category].done++
      return acc
    }, {}),
  )

  const chooseDatePreset = (preset: Exclude<typeof rangePreset, 'Custom Range'>) => {
    setRangePreset(preset)
    const today = parseDate(todayISO())
    if (preset === 'All Dates') {
      const dates = trainings.map((training) => training.date).sort()
      setRangeStart(dates[0] ?? todayISO())
      setRangeEnd(dates[dates.length - 1] ?? todayISO())
    } else if (preset === 'This Month') {
      setRangeStart(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
      setRangeEnd(toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
    } else {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      setRangeStart(toISODate(start))
      setRangeEnd(todayISO())
    }
  }

  const exportCsv = () => {
    const header = ['Training', 'Trainer', 'Date', 'Venue', 'Session', 'Progress', 'Percent', 'Score', 'Feedback', 'Attendance']
    const lines = tableRows.map((r) =>
      [r.t.title, r.t.trainer, r.t.date, r.t.venue, r.session, r.status, `${r.percent}%`, r.score ?? '', r.feedback ? 'Submitted' : 'Not yet', r.attendance].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','),
    )
    const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'mpesa-learning-report.csv' }).click()
    URL.revokeObjectURL(url)
  }

  const statDotColors = { Completed: 'bg-mpesa-500', 'In Progress': 'bg-amber-500', 'Not Started': 'bg-slate-300' }
  const statusTabs: { value: typeof statusFilter; label: string; count: number }[] = [
    { value: 'All', label: 'All Trainings', count: rows.length },
    { value: 'Completed', label: 'Completed', count: completedCount },
    { value: 'In Progress', label: 'In Progress', count: inProgressCount },
    { value: 'Not Started', label: 'Not Started', count: notStartedCount },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">Report</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details ref={rangeMenu} className="group relative z-30">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50">
              <CalendarDays className="size-4 shrink-0 text-zinc-600" />
              <span className="whitespace-nowrap">{formatDate(rangeStart, { month: 'short', day: 'numeric', year: 'numeric' })} – {formatDate(rangeEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <ChevronDown className="size-3.5 shrink-0 text-zinc-500 transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 mt-2 grid w-[min(18rem,calc(100vw-2rem))] gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:right-0 sm:left-auto">
              <label className="grid gap-1 text-xs font-medium text-zinc-600">From<input type="date" value={rangeStart} max={rangeEnd} onChange={(event) => { if (event.target.value) { setRangeStart(event.target.value); setRangePreset('Custom Range') } }} className="w-full min-w-0 rounded-xl border border-zinc-200 px-2.5 py-2 text-sm text-zinc-800 outline-none focus:border-brand-500" /></label>
              <label className="grid gap-1 text-xs font-medium text-zinc-600">To<input type="date" value={rangeEnd} min={rangeStart} onChange={(event) => { if (event.target.value) { setRangeEnd(event.target.value); setRangePreset('Custom Range') } }} className="w-full min-w-0 rounded-xl border border-zinc-200 px-2.5 py-2 text-sm text-zinc-800 outline-none focus:border-brand-500" /></label>
            </div>
          </details>
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:text-sm">
            <Download className="size-4" /> Export<span className="hidden min-[400px]:inline"> CSV</span>
          </button>
        </div>
      </div>

      <section aria-label="Report summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {reportStats.map(({ label, value, delta, suffix, icon: Icon, tone }) => {
          const positive = delta > 0
          const negative = delta < 0
          const TrendIcon = delta >= 0 ? TrendingUp : TrendingDown
          const toneStyle = {
            red: { bubble: 'bg-brand-50 text-brand-600', stroke: '#d03c3b' },
            green: { bubble: 'bg-mpesa-500/10 text-mpesa-600', stroke: '#2a9a3a' },
            amber: { bubble: 'bg-amber-500/10 text-amber-600', stroke: '#f59e0b' },
            blue: { bubble: 'bg-zinc-100 text-zinc-800', stroke: '#52525b' },
          }[tone]
          return (
            <article key={label} className="relative flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card sm:p-5">
              <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3.5">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full sm:size-12', toneStyle.bubble)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs leading-snug font-medium text-zinc-600 sm:truncate sm:text-[13px]">{label}</p>
                  <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">{value}</p>
                </div>
              </div>
              <div className="absolute top-4 right-4 h-7 w-14 sm:top-auto sm:right-5 sm:bottom-5 sm:w-16" aria-hidden>
                <TrendSparkline color={toneStyle.stroke} delta={delta} />
              </div>
              <div className="mt-auto pt-3 text-xs text-zinc-500">
                <p className={cn('flex items-center gap-1 font-semibold', positive ? 'text-mpesa-600' : negative ? 'text-brand-600' : 'text-zinc-500')}>
                  <TrendIcon className="size-3.5" aria-hidden />
                  {positive ? '+' : ''}
                  {delta.toFixed(label === 'Courses Enrolled' || label === 'Completed' ? 0 : 1)}
                  {suffix}
                </p>
                <p className="mt-0.5">vs last 30 days</p>
              </div>
            </article>
          )
        })}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_232px]">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-zinc-900">Progress Overview</h2>
            <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold', overallProgress >= 50 ? 'bg-mpesa-500/10 text-mpesa-700' : 'bg-zinc-100 text-zinc-600')}>
              {overallProgress >= 50 ? '● On track' : '● In progress'}
            </span>
          </div>
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-7 xl:flex-col 2xl:flex-row">
            <ProgressDonut rows={totalRows} completed={completedCount} inProgress={inProgressCount} notStarted={notStartedCount} overall={overallProgress} />
            <ul className="w-full max-w-sm divide-y divide-zinc-100">
              {byStatus.map(({ s, n }) => (
                <li key={s} className="flex items-center gap-3 py-3 text-xs">
                  <span className={cn('size-3 shrink-0 rounded-full', statDotColors[s])} />
                  <span className="min-w-0 flex-1 text-zinc-600">{s}</span>
                  <span className="w-8 text-right font-semibold text-zinc-900">{n}</span>
                  <span className="w-10 text-right text-zinc-500">{totalRows ? Math.round((n / totalRows) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-zinc-900">Completion by Category</h2>
            <span className="text-xs font-semibold text-brand-600">{byCategory.length} categories</span>
          </div>
          {byCategory.length ? (
            <ul className="mt-4 space-y-3.5">
              {byCategory.map(([cat, { total, done }]) => (
                <li key={cat} className="flex items-center gap-3 text-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-700"><BookOpen className="size-3.5" /></span>
                  <span className="w-24 shrink-0 truncate font-medium text-zinc-700">{cat}</span>
                  <div className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/60 ring-inset">
                    <div className="h-full rounded-full bg-mpesa-500 transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-zinc-500">{done}/{total}</span>
                  <span className="w-10 shrink-0 text-right font-medium text-zinc-600">{Math.round((done / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState compact icon={CalendarX2} title="No training in this date range" />}
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-zinc-900">Average Score Trend</h2>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><Star className="size-4" aria-hidden /></span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-zinc-500">Overall average</p>
              <p className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">{reportMetrics.averageScore.toFixed(1)}%</p>
            </div>
            <span className="mb-0.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-600">{scoreTrendValues.length} scores</span>
          </div>
          <div className="mt-3 h-14">
            {scoreTrendValues.length ? <ScoreTrendChart scores={scoreTrendValues} /> : <p className="grid h-full place-items-center text-xs text-zinc-500">No quiz scores yet.</p>}
          </div>
          <p className={cn('mt-2 flex items-center gap-1 text-[10px] font-semibold', reportDelta.averageScore >= 0 ? 'text-mpesa-600' : 'text-brand-600')}>
            {reportDelta.averageScore >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
            {reportDelta.averageScore > 0 ? '+' : ''}{reportDelta.averageScore.toFixed(1)}% vs last 30 days
          </p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
        <div className="px-5 pt-5">
          <h2 className="text-base font-bold text-zinc-900">Recent Training Activity</h2>
        </div>
        {/* Phones: search on its own row, then the status and date dropdowns side by side. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3.5 sm:gap-3">
          <SegmentTabs label="Filter activity by status" items={statusTabs.map((t) => ({ value: t.value, label: t.label, badge: t.count }))} value={statusFilter} onChange={setStatusFilter} collapse />
          <div className="max-sm:contents sm:flex sm:items-center sm:gap-2">
            <label className="relative min-w-0 max-sm:order-first max-sm:w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search trainings..." className="w-full sm:w-48 rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs outline-none placeholder:text-zinc-400 focus:border-brand-500 lg:w-56" />
            </label>
            <label className="relative max-sm:min-w-0 max-sm:flex-1">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <select
                value={rangePreset}
                onChange={(event) => {
                  const preset = event.target.value as typeof rangePreset
                  if (preset !== 'Custom Range') chooseDatePreset(preset)
                }}
                aria-label="Filter training activity by date"
                className="w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-white py-2 pr-8 pl-9 text-xs font-semibold max-sm:h-10 sm:w-36 text-zinc-700 outline-none focus:border-brand-500"
              >
                <option>All Dates</option>
                <option>This Month</option>
                <option>Last 30 Days</option>
                <option disabled>Custom Range</option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-zinc-500" aria-hidden />
            </label>
          </div>
        </div>
        <div className="relative overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[760px] table-fixed text-left text-xs lg:min-w-0">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="bg-zinc-50/80 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="py-3 pr-3 pl-5 font-semibold">Training</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold">
                  <button onClick={() => setDateSort((direction) => direction === 'asc' ? 'desc' : 'asc')} className="inline-flex items-center gap-1 uppercase hover:text-zinc-900">Date <ArrowUpDown className="size-3.5" /></button>
                </th>
                <th className="px-3 py-3 font-semibold">Duration</th>
                <th className="px-3 py-3 font-semibold">Progress</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Feedback</th>
                <th className="px-3 py-3 font-semibold">Score</th>
                <th className="py-3 pr-5 pl-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tableRows.map((r) => (
                <tr key={r.t.id} className="hover:bg-zinc-50/60">
                  <td className="py-3.5 pr-3 pl-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><BookOpen className="size-4" /></span>
                      <span className="block min-w-0">
                        <Link to={`/trainings/${r.t.id}`} className="line-clamp-2 text-[13px] leading-snug font-semibold text-zinc-900 hover:text-brand-700">{r.t.title}</Link>
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{r.t.trainer}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5"><span className="inline-block max-w-full truncate rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">{r.t.category}</span></td>
                  <td className="px-3 py-3.5 whitespace-nowrap text-xs text-zinc-600">{formatDate(r.t.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-3 py-3.5 whitespace-nowrap text-xs text-zinc-600">{durationMinutes(r.t)} min</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/60 ring-inset">
                        <div className={cn('h-full rounded-full', r.status === 'Completed' ? 'bg-mpesa-600' : r.status === 'In Progress' ? 'bg-brand-600' : 'bg-zinc-300')} style={{ width: `${r.percent}%` }} />
                      </div>
                      <span className={cn('text-[11px] font-bold tabular-nums', r.status === 'Completed' ? 'text-mpesa-600' : r.status === 'In Progress' ? 'text-brand-600' : 'text-zinc-400')}>{r.percent}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5"><span className={cn('inline-block max-w-full truncate rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap', r.status === 'Completed' ? 'bg-mpesa-500/10 text-mpesa-700' : r.status === 'In Progress' ? 'bg-amber-500/10 text-amber-700' : 'bg-zinc-100 text-zinc-600')}>{r.status}</span></td>
                  <td className="px-3 py-3.5 text-xs text-zinc-600">
                    {r.feedback ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-mpesa-500/10 px-2 py-1 text-[11px] font-semibold text-mpesa-700">
                        <CheckCircle2 className="size-3.5 shrink-0" /> <span className="truncate">Submitted</span>
                      </span>
                    ) : (
                      <span className="inline-block max-w-full truncate rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500">Not yet</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap text-[13px] font-semibold text-zinc-800">{r.score !== undefined ? `${r.score}%` : '—'}</td>
                  <td className="py-3.5 pr-5 pl-3 text-right">
                    <RowMenu
                      label={`Actions for ${r.t.title}`}
                      items={[
                        r.status === 'Completed'
                          ? { label: 'View certificate', to: `/certificates/${r.t.id}`, icon: Award, primary: true }
                          : { label: r.status === 'In Progress' ? 'Continue learning' : 'Start learning', to: `/trainings/${r.t.id}/learn`, icon: PlayCircle, primary: true },
                        { label: 'Training details', to: `/trainings/${r.t.id}`, icon: BookOpen },
                        ...(!r.feedback && r.status !== 'Not Started' ? [{ label: 'Give feedback', to: `/trainings/${r.t.id}/learn/feedback`, icon: MessageSquare }] : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {!tableRows.length && <tr><td colSpan={9}><EmptyState compact icon={SearchX} title="No trainings match" text="Try another date range or filter." /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
