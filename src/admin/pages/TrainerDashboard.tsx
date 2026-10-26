import { ArrowRight, CalendarDays, ClipboardCheck, FileQuestion, MapPin, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { todayISO } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { shortDate, time12 } from '../helpers'
import { attendanceRate, feedbackAverage } from '../insights'
import { Bars, Stat } from '../reports/ReportParts'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import { DateTile } from '../../components/CalendarParts'
import { Badge, Card, CardTitle, Empty, PageHeader, Table, trainingStatusTone } from '../ui'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Trainer dashboard (D04): own sessions only — upcoming calendar, requests assigned to them,
 * attendance and feedback per session and over the last 30 days, assessment results and content use.
 */
export function TrainerDashboard() {
  const { data } = useAdmin()
  const { user } = useAuth()
  const scope = useScope()
  const today = todayISO()
  const live = data.trainings.filter((t) => t.status !== 'CANCELLED')
  const upcoming = live.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  const past = live.filter((t) => t.date < today || t.status === 'COMPLETED').sort((a, b) => b.date.localeCompare(a.date))
  const last30 = past.filter((t) => t.date >= daysAgo(30))
  const rate = (ts: typeof live) => {
    const rates = ts.map((t) => attendanceRate(data, t)).filter((v): v is number => v !== null)
    return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  }
  const fb30 = feedbackAverage(data, data.feedbackResponses.filter((r) => last30.some((t) => t.id === r.trainingId)))
  const fbAll = feedbackAverage(data, data.feedbackResponses)
  const graded = data.submissions.filter((s) => s.score !== undefined)
  const passN = graded.filter((s) => s.score! >= (data.assessments.find((a) => a.id === s.assessmentId)?.passMark ?? 70)).length
  const needsGrading = data.submissions.filter((s) => s.status === 'needs-grading').length
  const pendingRequests = data.requests.filter((r) => r.status === 'PENDING' || (r.status === 'APPROVED' && !r.trainingId))
  const myMaterials = data.materials.filter((m) => scope.trainerId && m.taggedTrainerIds.includes(scope.trainerId))

  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.split(' ')[0]}`} description="Your sessions, results and feedback at a glance." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Upcoming sessions" value={upcoming.length} hint={upcoming[0] ? `Next: ${shortDate(upcoming[0].date)}` : 'Nothing scheduled'} />
        <Stat label="Attendance · 30 days" value={rate(last30) !== null ? `${rate(last30)}%` : '—'} hint={`All time ${rate(past) ?? '—'}%`} tone="green" />
        <Stat label="Feedback · 30 days" value={fb30 ? fb30.toFixed(1) : '—'} hint={`All time ${fbAll ? fbAll.toFixed(1) : '—'} / 5`} tone="green" />
        <Stat label="Pass rate" value={graded.length ? `${Math.round((passN / graded.length) * 100)}%` : '—'} hint={`${graded.length} graded attempts`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle
            action={
              <Link to="/admin/trainings?view=calendar" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                Calendar <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            Coming up
          </CardTitle>
          {upcoming.length ? (
            <ul className="space-y-2.5">
              {upcoming.slice(0, 5).map((t) => {
                return (
                  <li key={t.id}>
                    <Link to={`/admin/trainings/${t.id}`} className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3 transition hover:border-zinc-200 hover:bg-zinc-50">
                      <DateTile date={t.date} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-900">{t.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                          {t.location === 'ONLINE' ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
                          {time12(t.startTime)} – {time12(t.endTime)} · {t.participantIds.length} trainees
                        </span>
                      </span>
                      <Badge tone={trainingStatusTone[t.status]}>{t.status}</Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty icon={CalendarDays} title="No upcoming sessions" />
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle>To do</CardTitle>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/admin/submissions" className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 hover:bg-zinc-100">
                  <ClipboardCheck className="size-4 text-amber-600" />
                  <span className="flex-1">Answers to grade</span>
                  <span className="font-semibold">{needsGrading}</span>
                </Link>
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                <FileQuestion className="size-4 text-brand-600" />
                <span className="flex-1">Requests assigned to you, not yet scheduled</span>
                <span className="font-semibold">{pendingRequests.length}</span>
              </li>
            </ul>
            {pendingRequests.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate">{r.topic}</span>
                    <span className="shrink-0 text-zinc-400">{r.preferredDate ? shortDate(r.preferredDate) : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>Your content</CardTitle>
            <Bars
              tone="green"
              items={myMaterials.map((m) => ({ label: m.title, value: data.contentStats[m.id]?.views ?? 0, hint: `${data.contentStats[m.id]?.downloads ?? 0} downloads` }))}
              format={(v) => `${v} views`}
            />
          </Card>
        </div>
      </div>

      <h2 className="mt-6 mb-3 font-bold text-zinc-900">Past sessions</h2>
      <Table head={['Session', 'Date', 'Attendance', 'Feedback', 'Avg score', 'Certificates']} minWidth={760}>
        {past.map((t) => {
          const subs = data.submissions.filter((s) => s.trainingId === t.id && s.score !== undefined)
          const fb = feedbackAverage(data, data.feedbackResponses.filter((r) => r.trainingId === t.id))
          const att = attendanceRate(data, t)
          return (
            <tr key={t.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 font-medium">
                <Link to={`/admin/trainings/${t.id}`} className="hover:text-brand-600">
                  {t.name}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(t.date)}</td>
              <td className="px-4 py-3">{att !== null ? `${att}%` : '—'}</td>
              <td className="px-4 py-3">{fb ? `${fb.toFixed(1)} / 5` : '—'}</td>
              <td className="px-4 py-3">{subs.length ? `${Math.round(subs.reduce((a, s) => a + s.score!, 0) / subs.length)}%` : '—'}</td>
              <td className="px-4 py-3">{t.certificates?.length ?? 0}</td>
            </tr>
          )
        })}
      </Table>
    </>
  )
}
