import { Download } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { progressColor } from '../components/TrainingCard'
import { computeMetrics } from '../lib/stats'
import { cn, durationMinutes, formatDate, progressPercent, progressStatus, sessionStatus } from '../lib/utils'
import { useStore } from '../store/AppStore'

export function Report() {
  const { trainings, progress } = useStore()
  const metrics = useMemo(() => computeMetrics(trainings, progress), [trainings, progress])

  const rows = trainings
    .map((t) => ({
      t,
      status: progressStatus(t, progress[t.id]),
      session: sessionStatus(t),
      percent: progressPercent(t, progress[t.id]),
      score: progress[t.id]?.quizScore,
    }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date))

  const hoursLearned = trainings.reduce((sum, t) => {
    const done = progress[t.id]?.completedModules ?? []
    return sum + t.modules.filter((m) => done.includes(m.id)).reduce((s, m) => s + m.minutes, 0)
  }, 0)

  const byStatus = (['Completed', 'In Progress', 'Not Started'] as const).map((s) => ({
    s,
    n: rows.filter((r) => r.status === s).length,
  }))

  const byCategory = Object.entries(
    rows.reduce<Record<string, { total: number; done: number }>>((acc, r) => {
      acc[r.t.category] ??= { total: 0, done: 0 }
      acc[r.t.category].total++
      if (r.status === 'Completed') acc[r.t.category].done++
      return acc
    }, {}),
  )

  const exportCsv = () => {
    const header = ['Training', 'Trainer', 'Date', 'Venue', 'Session', 'Progress', 'Percent', 'Score']
    const lines = rows.map((r) =>
      [r.t.title, r.t.trainer, r.t.date, r.t.venue, r.session, r.status, `${r.percent}%`, r.score ?? ''].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','),
    )
    const url = URL.createObjectURL(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'mpesa-learning-report.csv' }).click()
    URL.revokeObjectURL(url)
  }

  const statColors = { Completed: 'bg-mpesa-500', 'In Progress': 'bg-amber-500', 'Not Started': 'bg-zinc-300' }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Report</h1>
          <p className="text-sm text-zinc-500">A summary of your training activity.</p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Courses enrolled', String(metrics.total)],
          ['Completed', String(metrics.completed)],
          ['Average score', `${metrics.averageScore.toFixed(1)}%`],
          ['Learning time', `${(hoursLearned / 60).toFixed(1)} h`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Progress breakdown</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-100">
            {byStatus.map(({ s, n }) => (
              <div key={s} className={statColors[s]} style={{ width: `${(n / rows.length) * 100}%` }} title={`${s}: ${n}`} />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {byStatus.map(({ s, n }) => (
              <li key={s} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className={cn('size-2.5 rounded-full', statColors[s])} /> {s}
                </span>
                <span className="font-medium">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Completion by category</h2>
          <ul className="mt-4 space-y-3">
            {byCategory.map(([cat, { total, done }]) => (
              <li key={cat}>
                <div className="flex justify-between text-sm">
                  <span>{cat}</span>
                  <span className="text-zinc-500">
                    {done}/{total}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-mpesa-500" style={{ width: `${(done / total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Training</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.t.id} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <Link to={`/trainings/${r.t.id}`} className="font-medium hover:text-brand-700">
                      {r.t.title}
                    </Link>
                    <p className="text-xs text-zinc-500">{r.t.trainer}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{formatDate(r.t.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-zinc-600">{durationMinutes(r.t)} min</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-mpesa-500" style={{ width: `${r.percent}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500">{r.percent}%</span>
                    </div>
                  </td>
                  <td className={cn('px-4 py-3 text-xs font-medium', progressColor[r.status])}>{r.status}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.score !== undefined ? `${r.score}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
