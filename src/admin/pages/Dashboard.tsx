import { ArrowRight, CalendarDays, CheckCircle2, FileQuestion, GraduationCap, MapPin, Plus, Star, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { todayISO } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { dateTime, shortDate, time12 } from '../helpers'
import { participantProgress, useAdmin } from '../store'
import { Badge, Button, Card, CardTitle, PageHeader, trainingStatusTone } from '../ui'
import { NewTrainingModal } from './Trainings'

export function AdminDashboard() {
  const { data } = useAdmin()
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const today = todayISO()

  const active = data.trainings.filter((t) => t.status !== 'CANCELLED')
  const learners = new Set(active.flatMap((t) => t.participantIds)).size
  const completionRates = active
    .filter((t) => t.participantIds.length)
    .map((t) => {
      const mids = data.journeys.find((j) => j.id === t.journeyId)?.modules.map((m) => m.id) ?? []
      return t.participantIds.reduce((s, pid) => s + participantProgress(t, pid, mids), 0) / t.participantIds.length
    })
  const avgCompletion = completionRates.length ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length : 0
  const ratings = data.feedbackResponses.flatMap((r) => r.ratings)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const pending = data.requests.filter((r) => r.status === 'PENDING')

  const upcoming = data.trainings
    .filter((t) => t.date >= today && (t.status === 'SCHEDULED' || t.status === 'ONGOING'))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  // Sessions per month for the last 6 months through next 2.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - 3 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const items = data.trainings.filter((t) => t.date.startsWith(key) && t.status !== 'CANCELLED')
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), sessions: items.length, learners: items.reduce((s, t) => s + t.participantIds.length, 0) }
  })
  const maxLearners = Math.max(1, ...months.map((m) => m.learners))

  const stats = [
    { label: 'Total trainings', value: data.trainings.length, icon: GraduationCap, sub: `${upcoming.length} upcoming` },
    { label: 'Learners enrolled', value: learners, icon: Users, sub: `${data.people.filter((p) => p.role === 'Participant').length} registered users` },
    { label: 'Avg. completion', value: `${avgCompletion.toFixed(0)}%`, icon: CheckCircle2, sub: 'across active trainings' },
    { label: 'Avg. feedback', value: avgRating.toFixed(1), icon: Star, sub: `${data.feedbackResponses.length} responses` },
  ]

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(' ')[0]}`}
        description="Here’s what’s happening across M-PESA trainings."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New training
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-sm text-zinc-500">{s.label}</p>
              <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <s.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle action={<span className="text-xs text-zinc-500">Learners per month</span>}>Training activity</CardTitle>
          <div className="flex h-52 items-end gap-3">
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
                  <Link to="/admin/requests" className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
                    <FileQuestion className="size-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{r.topic}</span>
                      <span className="text-xs text-zinc-500">
                        {r.participants} participants · prefers {shortDate(r.preferredDate)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No pending requests. 🎉</p>
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
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-zinc-100 py-1.5">
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
            {!upcoming.length && <li className="py-6 text-center text-sm text-zinc-500">Nothing scheduled.</li>}
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
            {data.auditLogs.slice(0, 6).map((l) => (
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
