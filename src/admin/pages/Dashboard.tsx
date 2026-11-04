import { ArrowDown, ArrowRight, ArrowUp, BarChart3, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, FilePlus2, FileQuestion, GraduationCap, MapPin, Minus, Pencil, Plus, Star, Trash2, UserPlus, Users, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn, todayISO } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { shortDate, time12 } from '../helpers'
import { participantProgress, useAdmin } from '../store'
import { DateRangePicker } from '../../components/DateRangePicker'
import { filterActivityLogs, isInRange, type DateRange } from '../reports/filters'
import { auditActionCategory, auditEntityType } from '../audit'
import { Badge, Button, Empty, PageHeader, Select, trainingStatusTone } from '../ui'
import { NewTrainingModal, type TrainingPreset } from './Trainings'
import { ApproveModal, RejectModal, requestPreset } from './Requests'
import { combinedJourney } from '../journeys'
import type { TrainingRequest } from '../types'

/** Completion target shown on the completion card. */
const COMPLETION_TARGET = 70

function dateAtOffset(date: string, offset: number) {
  const shifted = new Date(`${date}T00:00:00`)
  shifted.setDate(shifted.getDate() + offset)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`
}

type Trend = { text: string; dir: 'up' | 'down' | 'flat' | 'none' }
function trendOf(current: number | null, previous: number | null, unit: 'count' | 'percent' | 'decimal'): Trend {
  if (current === null || previous === null) return { text: '—', dir: 'none' }
  const delta = current - previous
  if (unit === 'count' && previous > 0) return { text: `${Math.abs(Math.round((delta / previous) * 100))}%`, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }
  return { text: `${Math.abs(delta).toFixed(unit === 'count' ? 0 : 1)}${unit === 'percent' ? '%' : ''}`, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }
}

const relative = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return shortDate(iso.slice(0, 10))
}

const tones = {
  red: 'bg-brand-50 text-brand-600',
  zinc: 'bg-zinc-100 text-zinc-700',
  green: 'bg-mpesa-500/10 text-mpesa-600',
  amber: 'bg-amber-500/10 text-amber-600',
} as const

/** Number card: tinted icon, value with its change vs the last 30 days, and a footer row (bar or note) that links on. */
function DashStat({ icon: Icon, tone, label, value, trend, to, footer }: { icon: LucideIcon; tone: keyof typeof tones; label: string; value: ReactNode; trend: Trend; to: string; footer: ReactNode }) {
  const TrendIcon = trend.dir === 'up' ? ArrowUp : trend.dir === 'down' ? ArrowDown : Minus
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3.5">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', tones[tone])}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-800">{label}</p>
          <div className="mt-0 flex items-end justify-between gap-2">
            <p className="text-[1.65rem] leading-tight font-bold tracking-tight whitespace-nowrap text-zinc-900 tabular-nums">{value}</p>
            <div className="shrink-0 pb-0.5 text-right">
              <p className={cn('inline-flex items-center gap-0.5 text-sm font-bold tabular-nums', trend.dir === 'up' ? 'text-mpesa-600' : trend.dir === 'down' ? 'text-brand-600' : 'text-zinc-500')}>
                {trend.dir !== 'none' && <TrendIcon className="size-4" strokeWidth={2.5} />} {trend.text}
              </p>
              <p className="text-[11px] leading-tight whitespace-nowrap text-zinc-500">vs last 30 days</p>
            </div>
          </div>
        </div>
      </div>
      <Link to={to} className="group mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3.5 text-xs text-zinc-600">
        <span className="min-w-0 flex-1">{footer}</span>
        <ChevronRight className="size-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" />
      </Link>
    </div>
  )
}

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-zinc-100', className)}>
      <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </span>
  )
}

type Metric = 'learners' | 'trainings' | 'completions'

/** Activity icons stay neutral; the icon shape says what changed. */
const NEUTRAL = "bg-zinc-100 text-zinc-600"

/** Icon for an activity row, by what changed. */
function activityIcon(entity: string, action: string): { icon: LucideIcon; tone: string } {
  const cat = auditActionCategory(action)
  if (cat === 'Invite' || entity === 'User') return { icon: UserPlus, tone: NEUTRAL }
  if (cat === 'Approve' || /complete/i.test(action)) return { icon: CheckCircle2, tone: NEUTRAL }
  if (cat === 'Delete' || cat === 'Reject' || cat === 'Cancel') return { icon: Trash2, tone: NEUTRAL }
  if (cat === 'Create') return { icon: FilePlus2, tone: NEUTRAL }
  if (entity === 'Training Request') return { icon: FileQuestion, tone: NEUTRAL }
  return { icon: Pencil, tone: NEUTRAL }
}

export function AdminDashboard() {
  const { data } = useAdmin()
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)
  const [scheduling, setScheduling] = useState<TrainingPreset | null>(null)
  const [acting, setActing] = useState<{ kind: 'approve' | 'reject'; request: TrainingRequest } | null>(null)
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [metric, setMetric] = useState<Metric>('learners')
  const [monthsBack, setMonthsBack] = useState(6)
  const [activityFilter, setActivityFilter] = useState('ALL')
  const today = todayISO()

  const trainings = data.trainings.filter((t) => t.status !== 'CANCELLED')
  const filtered = trainings.filter((t) => isInRange(t.date, range))
  const learners = new Set(filtered.flatMap((t) => t.participantIds)).size
  const registered = data.people.filter((p) => p.role === 'Participant').length
  const completed = filtered.filter((t) => t.status === 'COMPLETED').length

  const progressOf = (t: (typeof trainings)[number]) => {
    const mids = combinedJourney(data, t)?.modules.map((m) => m.id) ?? []
    return t.participantIds.map((pid) => participantProgress(t, pid, mids))
  }
  const completionRates = filtered.filter((t) => t.participantIds.length).map((t) => progressOf(t).reduce((a, b) => a + b, 0) / t.participantIds.length)
  const avgCompletion = completionRates.length ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length : 0

  const ratings = data.feedbackResponses.flatMap((r) => r.ratings)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const pending = data.requests.filter((r) => r.status === 'PENDING')

  const periodMetrics = (from: string, to: string) => {
    const inPeriod = trainings.filter((t) => t.date >= from && t.date <= to)
    const rates = inPeriod.filter((t) => t.participantIds.length).map((t) => progressOf(t).reduce((a, b) => a + b, 0) / t.participantIds.length)
    const periodRatings = data.feedbackResponses.filter((r) => r.submittedAt.slice(0, 10) >= from && r.submittedAt.slice(0, 10) <= to).flatMap((r) => r.ratings)
    return {
      trainings: inPeriod.length ? inPeriod.length : null,
      learners: inPeriod.length ? new Set(inPeriod.flatMap((t) => t.participantIds)).size : null,
      completion: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      feedback: periodRatings.length ? periodRatings.reduce((a, b) => a + b, 0) / periodRatings.length : null,
    }
  }
  const now = periodMetrics(dateAtOffset(today, -29), today)
  const before = periodMetrics(dateAtOffset(today, -59), dateAtOffset(today, -30))

  // Upcoming / ongoing sessions in the selected date range.
  const upcoming = filtered
    .filter((t) => t.date >= today && (t.status === 'SCHEDULED' || t.status === 'ONGOING'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 4)

  // Bars: the last N months up to this one.
  const base = new Date(`${today}T00:00:00`)
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (monthsBack - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const items = trainings.filter((t) => t.date.startsWith(key))
    const value =
      metric === 'learners' ? items.reduce((s, t) => s + t.participantIds.length, 0) : metric === 'trainings' ? items.length : items.reduce((s, t) => s + progressOf(t).filter((p) => p >= 100).length, 0)
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), value }
  })
  // A rounded axis top (10, 20, 50…) with five gridlines.
  const peak = Math.max(1, ...months.map((m) => m.value))
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => s * 5 >= peak) ?? Math.ceil(peak / 5)
  const axisMax = step * 5
  const ticks = Array.from({ length: 6 }, (_, i) => axisMax - i * step)

  const logs = filterActivityLogs(data, range)
  const activityTypes = [...new Set(logs.map((l) => auditEntityType(l)))].sort()
  const activity = logs.filter((l) => activityFilter === 'ALL' || auditEntityType(l) === activityFilter).slice(0, 5)

  const metricLabel: Record<Metric, string> = { learners: 'Learners', trainings: 'Trainings', completions: 'Completions' }

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(' ')[0]} 👋`}
        description="Here’s your training overview and performance."
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
        <DashStat
          icon={GraduationCap}
          tone="red"
          label="Total trainings"
          value={filtered.length}
          trend={trendOf(now.trainings, before.trainings, 'count')}
          to="/admin/trainings"
          footer={
            <>
              <span className="flex items-center justify-between gap-2">
                <span>Completed trainings</span>
                <span className="font-bold text-zinc-900 tabular-nums">
                  {completed} / {filtered.length}
                </span>
              </span>
              <Bar pct={filtered.length ? (completed / filtered.length) * 100 : 0} className="mt-1.5" />
            </>
          }
        />
        <DashStat
          icon={Users}
          tone="red"
          label="Active learners"
          value={learners}
          trend={trendOf(now.learners, before.learners, 'count')}
          to="/admin/users"
          footer={
            <>
              <span className="font-semibold text-zinc-800 tabular-nums">{registered}</span> registered in portal
            </>
          }
        />
        <DashStat
          icon={CheckCircle2}
          tone="green"
          label="Avg. completion"
          value={`${avgCompletion.toFixed(0)}%`}
          trend={trendOf(now.completion, before.completion, 'percent')}
          to="/admin/reports"
          footer={
            <span className="flex items-center gap-3">
              <span className="relative min-w-0 flex-1">
                <Bar pct={avgCompletion} />
                {/* Target marker on the bar. */}
                <span className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-zinc-400" style={{ left: `${COMPLETION_TARGET}%` }} aria-hidden />
              </span>
              <span className="shrink-0">Target {COMPLETION_TARGET}%</span>
            </span>
          }
        />
        <DashStat
          icon={Star}
          tone="amber"
          label="Avg. feedback"
          value={
            <>
              {avgRating.toFixed(1)} <span className="text-lg font-semibold text-zinc-400">/ 5</span>
            </>
          }
          trend={trendOf(now.feedback, before.feedback, 'decimal')}
          to="/admin/feedback/responses"
          footer={
            <>
              <span className="font-semibold text-zinc-800 tabular-nums">{data.feedbackResponses.length}</span> total responses
            </>
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Activity chart */}
        <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-900">Training activity</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-zinc-200 p-0.5" role="tablist" aria-label="Chart metric">
                {(Object.keys(metricLabel) as Metric[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={metric === m}
                    onClick={() => setMetric(m)}
                    className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', metric === m ? 'bg-brand-600 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900')}
                  >
                    {metricLabel[m]}
                  </button>
                ))}
              </div>
              <div className="w-36">
                <Select value={String(monthsBack)} onChange={(e) => setMonthsBack(Number(e.target.value))} aria-label="Period" className="py-1.5 text-xs">
                  <option value="3">Last 3 months</option>
                  <option value="6">Last 6 months</option>
                  <option value="12">Last 12 months</option>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-3" role="img" aria-label={`${metricLabel[metric]} per month: ${months.map((m) => `${m.label} ${m.value}`).join(', ')}`}>
            <div className="flex h-60 flex-col justify-between pb-6 text-right text-[11px] text-zinc-500 tabular-nums" aria-hidden>
              {ticks.map((t) => (
                <span key={t} className="-translate-y-1/2 leading-none">
                  {t}
                </span>
              ))}
            </div>
            <div className="relative h-60 flex-1">
              {/* Gridlines */}
              <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
                {ticks.map((t) => (
                  <span key={t} className={cn('border-t', t === 0 ? 'border-zinc-300' : 'border-dashed border-zinc-200')} />
                ))}
              </div>
              <div className="absolute inset-x-0 top-0 bottom-0 flex items-end gap-3 sm:gap-5">
                {months.map((m) => (
                  <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    <div className="flex h-[calc(100%-1.5rem)] w-full flex-col items-center justify-end">
                      <span className="mb-1 text-xs font-semibold text-zinc-800 tabular-nums">{m.value}</span>
                      <div
                        className={cn('w-full max-w-16 rounded-t-lg bg-gradient-to-b transition-all', m.key === today.slice(0, 7) ? 'from-brand-500 to-brand-700' : 'from-brand-500 to-brand-600')}
                        style={{ height: `${(m.value / axisMax) * 100}%`, minHeight: m.value ? 4 : 0 }}
                        title={`${m.label}: ${m.value} ${metricLabel[metric].toLowerCase()}`}
                      />
                    </div>
                    <span className="mt-2 h-4 text-xs text-zinc-600">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pending requests */}
        <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
          <Link to="/admin/requests" className="group flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-900">Pending requests</h2>
            <ChevronRight className="size-5 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-800" aria-label="Open all requests" />
          </Link>
          {pending.length ? (
            <ul className="mt-3 divide-y divide-zinc-100">
              {pending.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                  <Link to="/admin/requests" className="min-w-0 flex-1 hover:opacity-80">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{r.topic}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {r.team} · {r.participants.length} participant{r.participants.length === 1 ? '' : 's'} · {shortDate((r.submittedAt ?? r.createdAt).slice(0, 10))}
                    </span>
                  </Link>
                  <button type="button" onClick={() => setActing({ kind: 'approve', request: r })} aria-label={`Approve ${r.topic}`} title="Approve" className="grid size-8 shrink-0 place-items-center rounded-full border border-mpesa-500/40 text-mpesa-700 transition hover:bg-mpesa-500/10">
                    <Check className="size-4" strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => setActing({ kind: 'reject', request: r })} aria-label={`Reject ${r.topic}`} title="Reject" className="grid size-8 shrink-0 place-items-center rounded-full border border-brand-200 text-brand-700 transition hover:bg-brand-50">
                    <X className="size-4" strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={CheckCircle2} title="No pending requests" text="You’re all caught up for now." />
          )}
        </section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Upcoming trainings */}
        <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <CalendarDays className="size-4" />
              </span>
              Upcoming trainings
            </h2>
            <Link to="/admin/trainings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="mt-3 divide-y divide-zinc-100">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link to={`/admin/trainings/${t.id}`} className="flex items-center gap-4 py-3 hover:opacity-80">
                    <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-brand-50 py-1.5">
                      <span className="text-[10px] font-bold text-brand-600 uppercase">{new Date(`${t.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-lg leading-none font-bold text-zinc-900">{Number(t.date.slice(8))}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{t.name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" /> {time12(t.startTime)}
                        </span>
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin className="size-3 shrink-0" /> <span className="truncate">{t.location}</span>
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
            </ul>
          ) : (
            <div className="mx-auto mt-4 flex min-h-52 w-full max-w-2xl flex-col items-center justify-center gap-5 py-6 text-center sm:flex-row sm:gap-6 sm:text-left">
              <span className="relative grid size-28 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <CalendarDays className="size-12" />
                <span className="absolute right-0 bottom-1 grid size-11 place-items-center rounded-full border-4 border-surface bg-white text-brand-600 shadow-card">
                  <Clock3 className="size-5" />
                </span>
              </span>
              <span className="max-w-md">
                <span className="block text-lg font-bold text-zinc-900">No upcoming trainings</span>
                <span className="mt-1 block text-sm text-zinc-500">Your training calendar is currently empty. Schedule your next training session to get started.</span>
                <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> Create training
                </Button>
              </span>
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-900">Recent activity</h2>
            <div className="w-40">
              <Select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} aria-label="Activity type" className="py-1.5 text-xs">
                <option value="ALL">All activity</option>
                {activityTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {activity.length ? (
            <ul className="mt-3 divide-y divide-zinc-100">
              {activity.map((l) => {
                const { icon: Icon, tone } = activityIcon(auditEntityType(l), l.action)
                return (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', tone)}>
                      <Icon className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-zinc-700" title={`${l.actor} ${l.action} · ${l.target}`}>
                      <span className="font-semibold text-brand-600">{l.actor}</span> {l.action.charAt(0).toLowerCase() + l.action.slice(1)} <span className="text-zinc-500">“{l.target}”</span>
                    </p>
                    <span className="shrink-0 text-xs text-zinc-500">{relative(l.at)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty icon={BarChart3} title="No activity yet" text="Changes across trainings and users appear here." />
          )}
          <Link to="/admin/audit-logs" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
            View audit logs <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>

      {creating && <NewTrainingModal open onClose={() => setCreating(false)} />}
      {scheduling && <NewTrainingModal open onClose={() => setScheduling(null)} preset={scheduling} />}
      {acting?.kind === 'reject' && <RejectModal request={acting.request} onClose={() => setActing(null)} />}
      {acting?.kind === 'approve' && (
        <ApproveModal
          request={acting.request}
          onClose={() => setActing(null)}
          onApproved={(trainerIds) => {
            const r = acting.request
            setActing(null)
            setScheduling(requestPreset(r, data.people, trainerIds))
          }}
        />
      )}
    </>
  )
}
