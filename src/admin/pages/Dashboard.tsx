import { ArrowRight, CalendarDays, CheckCircle2, GraduationCap, MapPin, Plus, Star, Users, FileQuestion } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { todayISO } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { dateTime, shortDate, time12 } from '../helpers'
import { participantProgress, useAdmin } from '../store'
import { DateRangePicker } from '../../components/DateRangePicker'
import { filterActivityLogs, isInRange, type DateRange } from '../reports/filters'
import { Badge, Button, Card, CardTitle, Empty, PageHeader, StatCard, trainingStatusTone, type StatCardTrend } from '../ui'
import { NewTrainingModal } from './Trainings'
import { combinedJourney } from '../journeys'

function dateAtOffset(date: string, offset: number) {
  const shifted = new Date(`${date}T00:00:00`)
  shifted.setDate(shifted.getDate() + offset)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`
}

function comparisonTrend(current: number | null, previous: number | null, unit: 'count' | 'percent' | 'decimal', points: (number | null)[]): StatCardTrend {
  if (current === null || previous === null) return { text: '—', period: 'No recent data', direction: 'unavailable', tone: 'neutral' }
  const delta = current - previous
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  const suffix = unit === 'percent' ? '%' : ''
  const trendPoints = points.filter((point): point is number => point !== null)
  return {
    text: `${sign}${Math.abs(delta).toFixed(unit === 'count' ? 0 : 1)}${suffix}`,
    period: 'vs last 30 days',
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    tone: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
    points: trendPoints.length > 1 ? trendPoints : undefined,
  }
}

export function AdminDashboard() {
  const { data } = useAdmin()
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const today = todayISO()

  const trainings = data.trainings.filter((t) => t.status !== 'CANCELLED')
  const filtered = trainings.filter((t) => isInRange(t.date, range))
  const learners = new Set(filtered.flatMap((t) => t.participantIds)).size

  // Completion across filtered trainings with participants and modules.
  const completionRates = filtered
    .filter((t) => t.participantIds.length)
    .map((t) => {
      const mids = combinedJourney(data, t)?.modules.map((m) => m.id) ?? []
      return t.participantIds.reduce((s, pid) => s + participantProgress(t, pid, mids), 0) / t.participantIds.length
    })
  const avgCompletion = completionRates.length ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length : 0

  const ratings = data.feedbackResponses.flatMap((r) => r.ratings)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const pending = data.requests.filter((r) => r.status === 'PENDING')

  const periodMetrics = (from: string, to: string) => {
    const periodTrainings = trainings.filter((t) => t.date >= from && t.date <= to)
    const participantIds = new Set(periodTrainings.flatMap((t) => t.participantIds))
    const completionRates = periodTrainings.filter((t) => t.participantIds.length).map((t) => {
      const moduleIds = combinedJourney(data, t)?.modules.map((module) => module.id) ?? []
      return t.participantIds.reduce((sum, participantId) => sum + participantProgress(t, participantId, moduleIds), 0) / t.participantIds.length
    })
    const periodRatings = data.feedbackResponses
      .filter((response) => response.submittedAt.slice(0, 10) >= from && response.submittedAt.slice(0, 10) <= to)
      .flatMap((response) => response.ratings)
    return {
      trainings: periodTrainings.length ? periodTrainings.length : null,
      learners: periodTrainings.length ? participantIds.size : null,
      completion: completionRates.length ? completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length : null,
      feedback: periodRatings.length ? periodRatings.reduce((sum, value) => sum + value, 0) / periodRatings.length : null,
    }
  }
  const previousMetrics = periodMetrics(dateAtOffset(today, -59), dateAtOffset(today, -30))
  const weeklyMetrics = Array.from({ length: 5 }, (_, index) => {
    const offset = -29 + index * 6
    return periodMetrics(dateAtOffset(today, offset), dateAtOffset(today, Math.min(offset + 5, 0)))
  })
  const currentMetrics = periodMetrics(dateAtOffset(today, -29), today)
  const dashboardTrend = (key: keyof typeof currentMetrics, unit: 'count' | 'percent' | 'decimal') =>
    comparisonTrend(currentMetrics[key], previousMetrics[key], unit, weeklyMetrics.map((metrics) => metrics[key]))

  // Upcoming / ongoing sessions in the selected date range.
  const upcoming = filtered
    .filter((t) => t.date >= today && (t.status === 'SCHEDULED' || t.status === 'ONGOING'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  // Sessions per month across the selected range.
  const mins = range.from ? Number(range.from.slice(0, 4)) : Number(today.slice(0, 4))
  const maxs = range.to ? Number(range.to.slice(0, 4)) : Number(today.slice(0, 4))
  const months = Array.from({ length: maxs - mins + 1 }, (_, i) => {
    const d = new Date(mins + i, (Number(today.slice(5, 7)) - 1) % 12, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const items = trainings.filter((t) => t.date.startsWith(key))
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), sessions: items.length, learners: items.reduce((s, t) => s + t.participantIds.length, 0) }
  })
  const maxLearners = Math.max(1, ...months.map((m) => m.learners))

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(' ')[0]}`}
        description="Here’s what’s happening across M-PESA trainings."
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New training
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} tone="red" label="Total trainings" value={filtered.length} hint={`${upcoming.length} upcoming sessions`} trend={dashboardTrend('trainings', 'count')} />
        <StatCard icon={Users} tone="zinc" label="Active learners" value={learners} hint={`${data.people.filter((p) => p.role === 'Participant').length} registered in portal`} trend={dashboardTrend('learners', 'count')} />
        <StatCard icon={CheckCircle2} tone="green" label="Avg. completion" value={`${avgCompletion.toFixed(0)}%`} hint="Across active modules" trend={dashboardTrend('completion', 'percent')} />
        <StatCard
          icon={Star}
          tone="amber"
          label="Avg. feedback"
          value={
            <>
              {avgRating.toFixed(1)} <span className="text-base font-normal text-zinc-400">/ 5</span>
            </>
          }
          hint={`${data.feedbackResponses.length} total responses`}
          trend={dashboardTrend('feedback', 'decimal')}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle action={<span className="text-xs text-zinc-500">Learners per month</span>}>Training activity</CardTitle>
          {/* Visual bars carry a text summary so the chart isn't mouse/eyes-only. */}
          <div
            role="img"
            aria-label={`Learners per month: ${months.map((m) => `${m.label}, ${m.learners} learners in ${m.sessions} sessions`).join('; ')}`}
            className="flex h-52 items-end gap-3"
          >
            {months.map((m) => (
              <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-medium text-zinc-700">{m.learners || ''}</span>
                <div
                  className={`w-full max-w-12 rounded-t-md ${m.key === today.slice(0, 7) ? 'bg-brand-600' : 'bg-brand-600/25'}`}
                  style={{ height: `${Math.max(2, (m.learners / maxLearners) * 100)}%` }}
                  title={`${m.sessions} sessions · ${m.learners} learners`}
                />
                <span className="text-xs text-zinc-500">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle
            action={
              <Link to="/admin/requests" className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          >
            Pending requests
          </CardTitle>
          {pending.length ? (
            <ul className="space-y-2">
              {pending.map((r) => (
                <li key={r.id}>
                  <Link to="/admin/requests" className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50">
                    <FileQuestion className="size-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{r.topic}</span>
                      <span className="text-xs text-zinc-500">
                        {r.team} · {r.participants.length} participants · prefers {shortDate(r.preferredDate)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={CheckCircle2} title="No pending requests" text="You’re all caught up for now." />
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle
            action={
              <Link to="/admin/trainings" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                All trainings <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            Upcoming trainings
          </CardTitle>
          <ul className="divide-y divide-zinc-100">
            {upcoming.map((t) => (
              <li key={t.id}>
                <Link to={`/admin/trainings/${t.id}`} className="flex items-center gap-4 py-3 hover:opacity-80">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-zinc-100 py-1.5">
                    <span className="text-[10px] font-semibold text-brand-600 uppercase">{new Date(t.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-lg leading-none font-bold text-zinc-900">{Number(t.date.slice(8))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">{t.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" /> {time12(t.startTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {t.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {t.participantIds.length}
                      </span>
                    </span>
                  </span>
                  <Badge tone={trainingStatusTone[t.status]}>{t.status}</Badge>
                </Link>
              </li>
            ))}
            {!upcoming.length && (
              <li>
                <Empty icon={CalendarDays} title="Nothing scheduled" text="Create a training to fill the calendar." />
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle
            action={
              <Link to="/admin/audit-logs" className="text-xs font-medium text-brand-600 hover:underline">
                View logs
              </Link>
            }
          >
            Recent activity
          </CardTitle>
          <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
            {filterActivityLogs(data, range).slice(0, 6).map((l) => (
              <li key={l.id} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-brand-600 ring-4 ring-surface" />
                <p className="text-sm text-zinc-800">
                  <span className="font-medium">{l.actor}</span> {l.action.charAt(0).toLowerCase() + l.action.slice(1)}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {l.target} · {dateTime(l.at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {creating && <NewTrainingModal open onClose={() => setCreating(false)} />}
    </>
  )
}
