import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { shortDate } from '../helpers'
import { anonymiser, attendanceMap, attended, bestScore, eligibility, feedbackAverage, responseAverage } from '../insights'
import { filteredParticipants, filterTrainings, monthKey, monthLabel, useReportFilters } from '../reports/filters'
import type { Sheet } from '../reports/export'
import { Bars, ExportMenu, FilterBar, Stat, Trend } from '../reports/ReportParts'
import { participantProgress, useAdmin } from '../store'
import type { AdminData, AdminTraining, TrainingStatus } from '../types'
import { Badge, Card, CardTitle, PageHeader, ProgressBar, Table, Tabs, trainingStatusTone } from '../ui'
import { useScope } from '../scope'
import { TopTraineesView, traineeRows, traineeSheets } from '../reports/TopTrainees'

type Tab = 'overview' | 'trainees' | 'attendance' | 'assessments' | 'feedback' | 'certificates' | 'requests' | 'trainers' | 'content'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'trainees', label: 'Top trainees' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'assessments', label: 'Assessments' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'requests', label: 'Requests' },
  { value: 'trainers', label: 'Trainers' },
  { value: 'content', label: 'Content' },
]

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const fmtPct = (v: number) => `${v}%`
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const statusColor: Record<TrainingStatus, string> = { SCHEDULED: 'bg-zinc-400', ONGOING: 'bg-amber-500', COMPLETED: 'bg-mpesa-500', CANCELLED: 'bg-brand-600' }

/** Months between the earliest and latest key, so trends have no gaps. */
function monthsOf(keys: string[]) {
  if (!keys.length) return []
  const sorted = [...new Set(keys)].sort()
  const out: string[] = []
  const d = new Date(`${sorted[0]}-01T00:00:00`)
  const end = sorted[sorted.length - 1]
  while (monthKey(d.toISOString().slice(0, 10)) <= end && out.length < 24) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

/** Reports hub (D01): shared filters (D02) and Excel / CSV / PDF export (D03) on every tab. */
export function AdminReports() {
  const { data } = useAdmin()
  const scope = useScope()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }
  const { filters, set, clear, active } = useReportFilters()
  const base = scope.trainerId ? data.trainings.filter((t) => t.trainerId === scope.trainerId) : data.trainings
  const trainings = useMemo(() => filterTrainings(data, filters, base).sort((a, b) => b.date.localeCompare(a.date)), [data, filters, base])
  const tabs = scope.trainerId ? TABS.filter((t) => !['requests', 'trainers'].includes(t.value)) : TABS

  const report = buildReport(tab, data, trainings, filters)

  return (
    <>
      <PageHeader
        title="Reports"
        description={scope.trainerId ? 'Results for the sessions you conduct.' : 'Participation, results, feedback and certificates across all trainings.'}
        actions={<ExportMenu filename={`report-${tab}`} title={`M-PESA Academy — ${TABS.find((t) => t.value === tab)?.label} report`} sheets={report.sheets} personal={report.personal} />}
      />
      <div className="mb-4 overflow-x-auto scrollbar-none print:hidden">
        <Tabs value={tab} onChange={setTab} items={tabs} />
      </div>
      <FilterBar filters={filters} set={set} clear={clear} active={active} hide={report.hide} />
      <p className="mb-4 hidden text-sm text-zinc-500 print:block">
        {TABS.find((t) => t.value === tab)?.label} report · {trainings.length} trainings · generated {new Date().toLocaleString('en-US')}
      </p>
      {report.view}
    </>
  )
}

type Built = { view: React.ReactNode; sheets: (anon: boolean) => Sheet[]; personal?: boolean; hide?: (keyof ReturnType<typeof useReportFilters>['filters'])[] }

function buildReport(tab: Tab, data: AdminData, trainings: AdminTraining[], filters: ReturnType<typeof useReportFilters>['filters']): Built {
  const person = (id: string) => data.people.find((p) => p.id === id)
  const name = (id: string, anon?: (k: string) => string) => (anon ? anon(id) : (person(id)?.name ?? id))
  const live = trainings.filter((t) => t.status !== 'CANCELLED')

  // Attendance marks for every training in view, computed once.
  const marks = new Map(live.map((t) => [t.id, attendanceMap(data, t)]))
  const counted = live.flatMap((t) => filteredParticipants(data, t, filters).map((pid) => ({ t, pid, mark: marks.get(t.id)!.get(pid)! })))
  const settled = counted.filter((c) => c.mark !== 'Not yet')
  const attendanceRate = pct(settled.filter((c) => attended(c.mark)).length, settled.length)
  const responses = data.feedbackResponses.filter((r) => live.some((t) => t.id === r.trainingId) && filteredParticipants(data, live.find((t) => t.id === r.trainingId)!, filters).includes(r.participantId))
  const subs = data.submissions.filter((s) => live.some((t) => t.id === s.trainingId) && filteredParticipants(data, live.find((t) => t.id === s.trainingId)!, filters).includes(s.personId))
  const certs = live.flatMap((t) => (t.certificates ?? []).filter((c) => filteredParticipants(data, t, filters).includes(c.personId)).map((c) => ({ t, c })))

  switch (tab) {
    case 'overview': {
      const enrol = live.reduce((s, t) => s + filteredParticipants(data, t, filters).length, 0)
      const graded = subs.filter((s) => s.score !== undefined)
      const passMark = (id: string) => data.assessments.find((a) => a.id === id)?.passMark ?? 70
      const byStatus = (['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as TrainingStatus[]).map((s) => ({ s, n: trainings.filter((t) => t.status === s).length }))
      const dept = Object.entries(
        live.flatMap((t) => filteredParticipants(data, t, filters)).reduce<Record<string, number>>((acc, pid) => {
          const d = person(pid)?.department || 'Other'
          acc[d] = (acc[d] ?? 0) + 1
          return acc
        }, {}),
      ).sort((a, b) => b[1] - a[1])
      const months = monthsOf(live.map((t) => monthKey(t.date)))
      const rows = trainings.map((t) => {
        const ps = filteredParticipants(data, t, filters)
        const m = marks.get(t.id)
        const done = ps.filter((pid) => m && m.get(pid) !== 'Not yet')
        const mids = data.journeys.find((j) => j.id === t.journeyId)?.modules.map((x) => x.id) ?? []
        const completion = ps.length ? Math.round(ps.reduce((s, pid) => s + participantProgress(t, pid, mids), 0) / ps.length) : 0
        const fb = feedbackAverage(data, responses.filter((r) => r.trainingId === t.id))
        return { t, ps, rate: done.length ? pct(done.filter((pid) => attended(m!.get(pid))).length, done.length) : null, completion, fb }
      })
      return {
        sheets: () => [
          {
            name: 'Trainings',
            header: ['Training', 'Date', 'Status', 'Type', 'Trainer', 'Participants', 'Attendance %', 'Completion %', 'Avg feedback'],
            rows: rows.map((r) => [r.t.name, r.t.date, r.t.status, data.trainingTypes.find((x) => x.id === r.t.typeId)?.name ?? '', name(r.t.trainerId), r.ps.length, r.rate ?? '', r.completion, r.fb ? r.fb.toFixed(1) : '']),
          },
        ],
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Trainings" value={trainings.length} hint={`${enrol} enrolments`} />
              <Stat label="Attendance" value={settled.length ? `${attendanceRate}%` : '—'} hint="Present or late, finished sessions" tone="green" />
              <Stat label="Pass rate" value={graded.length ? `${pct(graded.filter((s) => s.score! >= passMark(s.assessmentId)).length, graded.length)}%` : '—'} hint={`${graded.length} graded attempts`} />
              <Stat label="Certificates" value={certs.length} hint={`Avg feedback ${feedbackAverage(data, responses)?.toFixed(1) ?? '—'} / 5`} tone="red" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardTitle>Enrolments by month</CardTitle>
                <Trend points={months.map((k) => ({ label: monthLabel(k), value: live.filter((t) => monthKey(t.date) === k).reduce((s, t) => s + filteredParticipants(data, t, filters).length, 0) }))} />
              </Card>
              <Card>
                <CardTitle>Trainings by status</CardTitle>
                <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
                  {byStatus.map(({ s, n }) => (
                    <div key={s} className={statusColor[s]} style={{ width: `${pct(n, trainings.length)}%` }} title={`${s}: ${n}`} />
                  ))}
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {byStatus.map(({ s, n }) => (
                    <li key={s} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                      <span className="flex items-center gap-2 text-zinc-700">
                        <span className={`size-2.5 rounded-full ${statusColor[s]}`} /> {s[0] + s.slice(1).toLowerCase()}
                      </span>
                      <span className="font-semibold text-zinc-900">{n}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-5 mb-3 text-sm font-semibold text-zinc-900">Enrolments by department</h3>
                <Bars items={dept.map(([label, value]) => ({ label, value }))} />
              </Card>
            </div>
            <div className="mt-5">
              <Table head={['Training', 'Date', 'Status', 'Participants', 'Attendance', 'Completion', 'Avg feedback']} minWidth={900}>
                {rows.map((r) => (
                  <tr key={r.t.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link to={`/admin/trainings/${r.t.id}`} className="font-medium text-zinc-900 hover:text-brand-600">
                        {r.t.name}
                      </Link>
                      <p className="text-xs text-zinc-500">{name(r.t.trainerId)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(r.t.date)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={trainingStatusTone[r.t.status]}>{r.t.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{r.ps.length}</td>
                    <td className="px-4 py-3 text-zinc-700">{r.rate !== null ? `${r.rate}%` : <span className="text-zinc-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={r.completion} tone="green" className="w-24" />
                        <span className="text-xs text-zinc-600">{r.completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{r.fb ? `${r.fb.toFixed(1)} / 5` : '—'}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        ),
      }
    }

    case 'attendance': {
      const byTraining = live.map((t) => {
        const cs = counted.filter((c) => c.t.id === t.id)
        const n = (m: string) => cs.filter((c) => c.mark === m).length
        const done = cs.filter((c) => c.mark !== 'Not yet')
        return { t, invited: cs.length, present: n('Present'), late: n('Late'), incomplete: n('Incomplete'), absent: n('Absent'), notYet: n('Not yet'), rate: done.length ? pct(n('Present') + n('Late'), done.length) : null }
      })
      const people = [...new Set(settled.map((c) => c.pid))].map((pid) => {
        const cs = settled.filter((c) => c.pid === pid)
        const p = person(pid)
        return { pid, team: data.groups.filter((g) => p?.groupIds.includes(g.id)).map((g) => g.name).join(', ') || p?.department || '', region: p?.region ?? '', sessions: cs.length, attendedN: cs.filter((c) => attended(c.mark)).length, late: cs.filter((c) => c.mark === 'Late').length, rate: pct(cs.filter((c) => attended(c.mark)).length, cs.length) }
      }).sort((a, b) => a.rate - b.rate)
      const dates = [...new Set(settled.map((c) => c.t.date))].sort().reverse().map((d) => {
        const cs = settled.filter((c) => c.t.date === d)
        return { d, sessions: new Set(cs.map((c) => c.t.id)).size, invited: cs.length, attendedN: cs.filter((c) => attended(c.mark)).length }
      })
      const months = monthsOf(settled.map((c) => monthKey(c.t.date)))
      return {
        personal: true,
        sheets: (anon) => {
          const a = anon ? anonymiser() : undefined
          return [
            { name: 'By training', header: ['Training', 'Date', 'Invited', 'Present', 'Late', 'Incomplete', 'Absent', 'Not yet', 'Attendance %'], rows: byTraining.map((r) => [r.t.name, r.t.date, r.invited, r.present, r.late, r.incomplete, r.absent, r.notYet, r.rate ?? '']) },
            { name: 'By trainee', header: ['Trainee', 'Team', 'Region', 'Sessions', 'Attended', 'Late', 'Attendance %'], rows: people.map((r) => [name(r.pid, a), r.team, r.region, r.sessions, r.attendedN, r.late, r.rate]) },
            { name: 'By date', header: ['Date', 'Sessions', 'Invited', 'Attended', 'Attendance %'], rows: dates.map((r) => [r.d, r.sessions, r.invited, r.attendedN, pct(r.attendedN, r.invited)]) },
            { name: 'Detail', header: ['Training', 'Date', 'Trainee', 'Status'], rows: counted.map((c) => [c.t.name, c.t.date, name(c.pid, a), c.mark]) },
          ]
        },
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Attendance rate" value={settled.length ? `${attendanceRate}%` : '—'} tone="green" />
              <Stat label="Present" value={settled.filter((c) => c.mark === 'Present').length} />
              <Stat label="Late" value={settled.filter((c) => c.mark === 'Late').length} tone="amber" />
              <Stat label="Absent / incomplete" value={settled.filter((c) => !attended(c.mark)).length} tone="red" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardTitle>Attendance by month</CardTitle>
                <Trend tone="green" format={fmtPct} points={months.map((k) => {
                  const cs = settled.filter((c) => monthKey(c.t.date) === k)
                  return { label: monthLabel(k), value: pct(cs.filter((c) => attended(c.mark)).length, cs.length) }
                })} />
              </Card>
              <Card>
                <CardTitle>Lowest attendance by trainee</CardTitle>
                <Bars tone="amber" max={100} format={fmtPct} items={people.slice(0, 6).map((r) => ({ label: name(r.pid), value: r.rate, hint: `${r.attendedN} of ${r.sessions}` }))} />
              </Card>
            </div>
            <h3 className="mt-6 mb-3 font-semibold text-zinc-900">By training</h3>
            <Table head={['Training', 'Date', 'Invited', 'Present', 'Late', 'Incomplete', 'Absent', 'Not yet', 'Rate']} minWidth={860}>
              {byTraining.map((r) => (
                <tr key={r.t.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/admin/trainings/${r.t.id}`} className="hover:text-brand-600">
                      {r.t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(r.t.date)}</td>
                  <td className="px-4 py-3">{r.invited}</td>
                  <td className="px-4 py-3 text-mpesa-700">{r.present}</td>
                  <td className="px-4 py-3 text-amber-700">{r.late}</td>
                  <td className="px-4 py-3">{r.incomplete}</td>
                  <td className="px-4 py-3 text-brand-700">{r.absent}</td>
                  <td className="px-4 py-3 text-zinc-400">{r.notYet}</td>
                  <td className="px-4 py-3 font-semibold">{r.rate !== null ? `${r.rate}%` : '—'}</td>
                </tr>
              ))}
            </Table>
            <h3 className="mt-6 mb-3 font-semibold text-zinc-900">By date</h3>
            <Table head={['Date', 'Sessions', 'Invited', 'Attended', 'Rate']} minWidth={560}>
              {dates.map((r) => (
                <tr key={r.d}>
                  <td className="px-4 py-3">{shortDate(r.d)}</td>
                  <td className="px-4 py-3">{r.sessions}</td>
                  <td className="px-4 py-3">{r.invited}</td>
                  <td className="px-4 py-3">{r.attendedN}</td>
                  <td className="px-4 py-3 font-semibold">{pct(r.attendedN, r.invited)}%</td>
                </tr>
              ))}
            </Table>
          </>
        ),
      }
    }

    case 'assessments': {
      const graded = subs.filter((s) => s.score !== undefined)
      const pm = (id: string) => data.assessments.find((a) => a.id === id)?.passMark ?? 70
      const failed = graded.filter((s) => s.score! < pm(s.assessmentId))
      const per = data.assessments
        .map((a) => {
          const ss = subs.filter((s) => s.assessmentId === a.id)
          const g = ss.filter((s) => s.score !== undefined)
          return { a, attempts: ss.length, trainees: new Set(ss.map((s) => s.personId)).size, avg: avg(g.map((s) => s.score!)), pass: pct(g.filter((s) => s.score! >= a.passMark).length, g.length), pending: ss.filter((s) => s.status === 'needs-grading').length }
        })
        .filter((r) => r.attempts)
      const topics = [...new Set(graded.map((s) => data.assessments.find((a) => a.id === s.assessmentId)?.topic ?? 'Other'))]
      const months = monthsOf(graded.map((s) => monthKey(s.submittedAt)))
      const mins = (s: (typeof subs)[number]) => Math.max(1, Math.round((new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 60000))
      return {
        personal: true,
        sheets: (anon) => {
          const an = anon ? anonymiser() : undefined
          return [
            { name: 'By assessment', header: ['Assessment', 'Topic', 'Attempts', 'Trainees', 'Average %', 'Pass rate %', 'Needs grading'], rows: per.map((r) => [r.a.title, r.a.topic ?? '', r.attempts, r.trainees, r.avg?.toFixed(0) ?? '', r.pass, r.pending]) },
            {
              name: 'Attempts',
              header: ['Trainee', 'Assessment', 'Training', 'Attempt', 'Score %', 'Result', 'Minutes', 'Submitted'],
              rows: subs.map((s) => [name(s.personId, an), data.assessments.find((a) => a.id === s.assessmentId)?.title ?? '', data.trainings.find((t) => t.id === s.trainingId)?.name ?? '', s.attempt, s.score ?? '', s.score === undefined ? 'Needs grading' : s.score >= pm(s.assessmentId) ? 'Pass' : 'Fail', mins(s), s.submittedAt.replace('T', ' ')]),
            },
          ]
        },
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Attempts" value={subs.length} hint={`${new Set(subs.map((s) => s.personId)).size} trainees`} />
              <Stat label="Average score" value={graded.length ? `${Math.round(avg(graded.map((s) => s.score!))!)}%` : '—'} />
              <Stat label="Pass rate" value={graded.length ? `${pct(graded.length - failed.length, graded.length)}%` : '—'} tone="green" />
              <Stat label="Needs grading" value={subs.filter((s) => s.status === 'needs-grading').length} tone="amber" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardTitle>Failed attempts by month</CardTitle>
                <Trend points={months.map((k) => ({ label: monthLabel(k), value: failed.filter((s) => monthKey(s.submittedAt) === k).length }))} />
              </Card>
              <Card>
                <CardTitle>Failure rate by topic</CardTitle>
                <Bars max={100} format={fmtPct} items={topics.map((tp) => {
                  const g = graded.filter((s) => (data.assessments.find((a) => a.id === s.assessmentId)?.topic ?? 'Other') === tp)
                  return { label: tp, value: pct(g.filter((s) => s.score! < pm(s.assessmentId)).length, g.length), hint: `${g.length} graded` }
                }).sort((a, b) => b.value - a.value)} />
              </Card>
            </div>
            <div className="mt-5">
              <Table head={['Assessment', 'Attempts', 'Trainees', 'Average', 'Pass rate', 'Needs grading']} minWidth={720}>
                {per.map((r) => (
                  <tr key={r.a.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.a.title}</p>
                      <p className="text-xs text-zinc-500">{r.a.topic}</p>
                    </td>
                    <td className="px-4 py-3">{r.attempts}</td>
                    <td className="px-4 py-3">{r.trainees}</td>
                    <td className="px-4 py-3">{r.avg !== null ? `${Math.round(r.avg)}%` : '—'}</td>
                    <td className="px-4 py-3 font-semibold">{r.pass}%</td>
                    <td className="px-4 py-3">{r.pending ? <Badge tone="amber">{r.pending}</Badge> : '—'}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        ),
      }
    }

    case 'feedback': {
      const attendees = settled.filter((c) => attended(c.mark))
      const questions = data.feedbackForms.flatMap((f) =>
        f.questions.map((q, i) => ({ f, q, i, type: f.questionTypes?.[i] ?? 'likert' })).filter((x) => x.type !== 'open'),
      )
      const trainers = [...new Set(live.map((t) => t.trainerId))]
      const months = monthsOf(responses.map((r) => monthKey(r.submittedAt)))
      const sessions = live
        .map((t) => {
          const rs = responses.filter((r) => r.trainingId === t.id)
          const form = data.feedbackForms.find((f) => f.id === t.feedbackFormId)
          const yes = form?.questionTypes?.indexOf('yesno') ?? -1
          const att = counted.filter((c) => c.t.id === t.id && attended(c.mark)).length
          return { t, n: rs.length, rate: pct(rs.length, att), avg: feedbackAverage(data, rs), recommend: yes >= 0 && rs.length ? pct(rs.filter((r) => r.ratings[yes] === 1).length, rs.length) : null }
        })
        .filter((r) => r.n)
      return {
        sheets: () => [
          { name: 'By session', header: ['Training', 'Date', 'Trainer', 'Responses', 'Response rate %', 'Average', 'Recommend %'], rows: sessions.map((r) => [r.t.name, r.t.date, name(r.t.trainerId), r.n, r.rate, r.avg?.toFixed(2) ?? '', r.recommend ?? '']) },
          {
            name: 'By question',
            header: ['Form', 'Question', 'Type', 'Average / Yes %'],
            rows: questions.map((x) => {
              const rs = responses.filter((r) => r.formId === x.f.id)
              return [x.f.title, x.q, x.type, x.type === 'yesno' ? pct(rs.filter((r) => r.ratings[x.i] === 1).length, rs.length) : (avg(rs.map((r) => r.ratings[x.i])) ?? 0).toFixed(2)]
            }),
          },
          { name: 'Comments', header: ['Training', 'Date', 'Average', 'Comment'], rows: responses.filter((r) => r.comment || r.texts).map((r) => [data.trainings.find((t) => t.id === r.trainingId)?.name ?? '', r.submittedAt.slice(0, 10), responseAverage(r, data.feedbackForms.find((f) => f.id === r.formId))?.toFixed(1) ?? '', [r.comment, ...Object.values(r.texts ?? {})].filter(Boolean).join(' / ')]) },
        ],
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Average rating" value={feedbackAverage(data, responses)?.toFixed(1) ?? '—'} hint="out of 5" tone="green" />
              <Stat label="Responses" value={responses.length} />
              <Stat label="Response rate" value={attendees.length ? `${pct(responses.length, attendees.length)}%` : '—'} hint="of trainees who attended" />
              <Stat label="Low scores" value={responses.filter((r) => (responseAverage(r, data.feedbackForms.find((f) => f.id === r.formId)) ?? 5) < data.alertRules.feedbackBelow).length} hint={`below ${data.alertRules.feedbackBelow}`} tone="red" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardTitle>Average by question</CardTitle>
                <Bars tone="green" max={5} format={(v) => v.toFixed(1)} items={questions.filter((x) => x.type === 'likert').map((x) => ({ label: x.q, value: avg(responses.filter((r) => r.formId === x.f.id).map((r) => r.ratings[x.i])) ?? 0, hint: `${x.f.title}: ${x.q}` }))} />
              </Card>
              <Card>
                <CardTitle>Trainer comparison</CardTitle>
                <Bars tone="green" max={5} format={(v) => v.toFixed(1)} items={trainers.map((id) => ({ label: name(id), value: feedbackAverage(data, responses.filter((r) => live.find((t) => t.id === r.trainingId)?.trainerId === id)) ?? 0 })).filter((x) => x.value)} />
              </Card>
              <Card className="lg:col-span-2">
                <CardTitle>Average rating by month</CardTitle>
                <Trend tone="green" format={(v) => v.toFixed(1)} points={months.map((k) => ({ label: monthLabel(k), value: feedbackAverage(data, responses.filter((r) => monthKey(r.submittedAt) === k)) ?? 0 }))} />
              </Card>
            </div>
            <div className="mt-5">
              <Table head={['Session', 'Trainer', 'Responses', 'Response rate', 'Average', 'Recommend']} minWidth={760}>
                {sessions.map((r) => (
                  <tr key={r.t.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.t.name}</p>
                      <p className="text-xs text-zinc-500">{shortDate(r.t.date)}</p>
                    </td>
                    <td className="px-4 py-3">{name(r.t.trainerId)}</td>
                    <td className="px-4 py-3">{r.n}</td>
                    <td className="px-4 py-3">{r.rate}%</td>
                    <td className="px-4 py-3 font-semibold">{r.avg?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-3">{r.recommend !== null ? `${r.recommend}%` : '—'}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        ),
      }
    }

    case 'certificates': {
      const eligibleOpen = live.flatMap((t) => {
        const m = marks.get(t.id)!
        const have = new Set((t.certificates ?? []).map((c) => c.personId))
        return filteredParticipants(data, t, filters).filter((pid) => !have.has(pid) && eligibility(data, t, pid, m).eligible).map((pid) => ({ t, pid }))
      })
      const months = monthsOf(certs.map((x) => monthKey(x.c.issuedAt)))
      const types = data.trainingTypes.map((tt) => ({ label: tt.name, value: certs.filter((x) => x.t.typeId === tt.id).length })).filter((x) => x.value)
      return {
        personal: true,
        sheets: (anon) => {
          const an = anon ? anonymiser() : undefined
          return [
            {
              name: 'Issued',
              header: ['Trainee', 'Training', 'Session date', 'Issued', 'Method', 'Template', 'Score %'],
              rows: certs.map(({ t, c }) => [name(c.personId, an), t.name, t.date, c.issuedAt.slice(0, 10), c.method, data.templates.find((x) => x.id === c.templateId)?.name ?? '', bestScore(data, t, c.personId) ?? '']),
            },
          ]
        },
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Issued" value={certs.length} tone="green" />
              <Stat label="Manual" value={certs.filter((x) => x.c.method === 'manual').length} />
              <Stat label="Eligible, not issued" value={eligibleOpen.length} tone="amber" hint="Open the tracker to issue" />
              <Stat label="Sessions not triggered" value={live.filter((t) => t.status === 'COMPLETED' && !t.certificatesRunAt).length} tone="red" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardTitle>Issued by month</CardTitle>
                <Trend tone="green" points={months.map((k) => ({ label: monthLabel(k), value: certs.filter((x) => monthKey(x.c.issuedAt) === k).length }))} />
              </Card>
              <Card>
                <CardTitle action={<Link to="/admin/certificates" className="text-xs font-semibold text-brand-600 hover:underline print:hidden">Open tracker</Link>}>By training type</CardTitle>
                <Bars tone="green" items={types} />
              </Card>
            </div>
          </>
        ),
      }
    }

    case 'requests': {
      const reqs = data.requests.filter((r) => r.status !== 'DRAFT' && (!filters.from || (r.submittedAt ?? '') >= filters.from) && (!filters.to || (r.submittedAt ?? '').slice(0, 10) <= filters.to) && (!filters.typeId || r.trainingTypeId === filters.typeId))
      const decided = reqs.map((r) => ({ r, at: r.history.find((h) => h.label === 'Approved' || h.label === 'Rejected')?.at })).filter((x) => x.at && x.r.submittedAt)
      const hours = avg(decided.map((x) => (new Date(x.at!).getTime() - new Date(x.r.submittedAt!).getTime()) / 3_600_000))
      const teams = Object.entries(reqs.reduce<Record<string, number>>((a, r) => ({ ...a, [r.team]: (a[r.team] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
      return {
        hide: ['groupId', 'region', 'trainerId', 'status', 'delivery'],
        sheets: () => [
          { name: 'Requests', header: ['Topic', 'Team', 'Requester', 'Submitted', 'Status', 'Preferred date', 'Participants', 'Decision'], rows: reqs.map((r) => [r.topic, r.team, name(r.requesterId), (r.submittedAt ?? '').slice(0, 10), r.status, r.preferredDate, r.participants.length, r.rejection?.reason ?? (r.status === 'APPROVED' ? 'Approved' : '')]) },
        ],
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Requests" value={reqs.length} />
              <Stat label="Pending" value={reqs.filter((r) => r.status === 'PENDING').length} tone="amber" />
              <Stat label="Approved" value={reqs.filter((r) => r.status === 'APPROVED').length} hint={`${pct(reqs.filter((r) => r.status === 'APPROVED').length, reqs.length)}% approval rate`} tone="green" />
              <Stat label="Avg decision time" value={hours !== null ? (hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} d`) : '—'} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardTitle>Requests by team</CardTitle>
                <Bars items={teams.map(([label, value]) => ({ label, value }))} />
              </Card>
              <Card>
                <CardTitle>By status</CardTitle>
                <Bars items={(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => ({ label: s[0] + s.slice(1).toLowerCase(), value: reqs.filter((r) => r.status === s).length }))} />
              </Card>
            </div>
          </>
        ),
      }
    }

    case 'trainees': {
      // Leaderboard of people and ranking of departments / groups, using the report filters.
      const rows = traineeRows(data, live, (t) => filteredParticipants(data, t, filters), marks)
      return {
        personal: true,
        sheets: (anon) => {
          const a = anon ? anonymiser() : undefined
          return traineeSheets(rows, (id) => name(id, a))
        },
        view: <TopTraineesView rows={rows} />,
      }
    }

    case 'trainers': {
      const rows = data.people
        .filter((p) => p.role === 'Trainer' || live.some((t) => t.trainerId === p.id))
        .map((p) => {
          const ts = live.filter((t) => t.trainerId === p.id)
          const cs = settled.filter((c) => c.t.trainerId === p.id)
          const g = subs.filter((s) => ts.some((t) => t.id === s.trainingId) && s.score !== undefined)
          const passN = g.filter((s) => s.score! >= (data.assessments.find((a) => a.id === s.assessmentId)?.passMark ?? 70)).length
          return { p, delivered: ts.filter((t) => t.status === 'COMPLETED').length, upcoming: ts.filter((t) => t.status === 'SCHEDULED' || t.status === 'ONGOING').length, trainees: ts.reduce((s, t) => s + t.participantIds.length, 0), att: cs.length ? pct(cs.filter((c) => attended(c.mark)).length, cs.length) : null, fb: feedbackAverage(data, responses.filter((r) => ts.some((t) => t.id === r.trainingId))), pass: g.length ? pct(passN, g.length) : null, certs: certs.filter((x) => x.t.trainerId === p.id).length }
        })
      return {
        hide: ['trainerId'],
        sheets: () => [{ name: 'Trainers', header: ['Trainer', 'Delivered', 'Upcoming', 'Trainees', 'Attendance %', 'Avg feedback', 'Pass rate %', 'Certificates'], rows: rows.map((r) => [r.p.name, r.delivered, r.upcoming, r.trainees, r.att ?? '', r.fb?.toFixed(2) ?? '', r.pass ?? '', r.certs]) }],
        view: (
          <Table head={['Trainer', 'Delivered', 'Upcoming', 'Trainees', 'Attendance', 'Avg feedback', 'Pass rate', 'Certificates']} minWidth={860}>
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.p.name}</p>
                  <p className="text-xs text-zinc-500">{r.p.department}</p>
                </td>
                <td className="px-4 py-3">{r.delivered}</td>
                <td className="px-4 py-3">{r.upcoming}</td>
                <td className="px-4 py-3">{r.trainees}</td>
                <td className="px-4 py-3">{r.att !== null ? `${r.att}%` : '—'}</td>
                <td className="px-4 py-3 font-semibold">{r.fb?.toFixed(1) ?? '—'}</td>
                <td className="px-4 py-3">{r.pass !== null ? `${r.pass}%` : '—'}</td>
                <td className="px-4 py-3">{r.certs}</td>
              </tr>
            ))}
          </Table>
        ),
      }
    }

    case 'content': {
      const rows = data.materials.map((m) => ({ m, ...(data.contentStats[m.id] ?? { views: 0, downloads: 0 }) })).sort((a, b) => b.views - a.views)
      return {
        hide: ['from', 'to', 'groupId', 'region', 'trainerId', 'status', 'delivery', 'typeId'],
        sheets: () => [{ name: 'Content', header: ['Material', 'Type', 'Level', 'Version', 'Views', 'Downloads'], rows: rows.map((r) => [r.m.title, r.m.type, r.m.level ?? '', r.m.version, r.views, r.downloads]) }],
        view: (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Materials" value={rows.length} />
              <Stat label="Views" value={rows.reduce((s, r) => s + r.views, 0)} tone="green" />
              <Stat label="Downloads" value={rows.reduce((s, r) => s + r.downloads, 0)} />
              <Stat label="Videos (stream only)" value={rows.filter((r) => r.m.type === 'VIDEO').length} />
            </div>
            <Card className="mt-5">
              <CardTitle>Most viewed</CardTitle>
              <Bars tone="green" items={rows.slice(0, 8).map((r) => ({ label: r.m.title, value: r.views, hint: `${r.downloads} downloads` }))} />
            </Card>
            <div className="mt-5">
              <Table head={['Material', 'Type', 'Level', 'Version', 'Views', 'Downloads']} minWidth={680}>
                {rows.map((r) => (
                  <tr key={r.m.id}>
                    <td className="px-4 py-3 font-medium">{r.m.title}</td>
                    <td className="px-4 py-3">{r.m.type}</td>
                    <td className="px-4 py-3">{r.m.level ?? '—'}</td>
                    <td className="px-4 py-3">v{r.m.version}</td>
                    <td className="px-4 py-3">{r.views}</td>
                    <td className="px-4 py-3">{r.m.type === 'VIDEO' ? <span className="text-zinc-400">stream only</span> : r.downloads}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        ),
      }
    }
  }
}
