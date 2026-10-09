import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { shortDate } from '../helpers'
import { attendanceRows } from '../teams/attendance'
import { participantProgress, useAdmin } from '../store'
import type { TrainingStatus } from '../types'
import { Badge, Button, Card, CardTitle, downloadCsv, PageHeader, ProgressBar, Select, Table, trainingStatusTone } from '../ui'

const statusColor: Record<TrainingStatus, string> = {
  SCHEDULED: 'bg-zinc-400',
  ONGOING: 'bg-sky-500',
  COMPLETED: 'bg-mpesa-500',
  CANCELLED: 'bg-brand-600',
}

export function AdminReports() {
  const { data } = useAdmin()
  const [journeyId, setJourneyId] = useState('')

  const rows = useMemo(
    () =>
      data.trainings
        .filter((t) => !journeyId || t.journeyId === journeyId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => {
          const mids = data.journeys.find((j) => j.id === t.journeyId)?.modules.map((m) => m.id) ?? []
          const progresses = t.participantIds.map((pid) => participantProgress(t, pid, mids))
          const completion = progresses.length ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0
          const completed = progresses.filter((p) => p >= 100).length
          const ratings = data.feedbackResponses.filter((r) => r.trainingId === t.id).flatMap((r) => r.ratings)
          const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
          const att = t.attendance ? attendanceRows(t, data.people, data.attendanceRules) : []
          const attendance = att.length ? Math.round((att.filter((a) => a.status !== 'Absent').length / att.length) * 100) : null
          return { t, completion, completed, rating, attendance, journey: data.journeys.find((j) => j.id === t.journeyId)?.name ?? '—' }
        }),
    [data, journeyId],
  )

  const totals = {
    trainings: rows.length,
    enrolments: rows.reduce((s, r) => s + r.t.participantIds.length, 0),
    certified: rows.reduce((s, r) => s + r.completed, 0),
    hours: rows.reduce((s, r) => {
      const [sh, sm] = r.t.startTime.split(':').map(Number)
      const [eh, em] = r.t.endTime.split(':').map(Number)
      return r.t.status === 'CANCELLED' ? s : s + ((eh * 60 + em - sh * 60 - sm) / 60) * r.t.participantIds.length
    }, 0),
  }

  const byStatus = (['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as TrainingStatus[]).map((s) => ({ s, n: rows.filter((r) => r.t.status === s).length }))

  const byDepartment = Object.entries(
    rows.flatMap((r) => r.t.participantIds).reduce<Record<string, number>>((acc, pid) => {
      const dept = data.people.find((p) => p.id === pid)?.department ?? 'Other'
      acc[dept] = (acc[dept] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  const maxDept = Math.max(1, ...byDepartment.map(([, n]) => n))

  return (
    <>
      <PageHeader
        title="Reports"
        description="Training reach, completion and satisfaction."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              downloadCsv(
                'training-report.csv',
                ['Training', 'Journey', 'Date', 'Status', 'Participants', 'Attendance %', 'Completion %', 'Certified', 'Avg rating'],
                rows.map((r) => [r.t.name, r.journey, r.t.date, r.t.status, r.t.participantIds.length, r.attendance ?? '', r.completion, r.completed, r.rating ? r.rating.toFixed(1) : '']),
              )
            }
          >
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <div className="mb-5 max-w-xs">
        <Select value={journeyId} onChange={(e) => setJourneyId(e.target.value)} aria-label="Filter by journey">
          <option value="">All journeys</option>
          {data.journeys.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Trainings', totals.trainings],
          ['Enrolments', totals.enrolments],
          ['Fully completed', totals.certified],
          ['Learning hours', Math.round(totals.hours).toLocaleString()],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Trainings by status</CardTitle>
          <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
            {byStatus.map(({ s, n }) => (
              <div key={s} className={statusColor[s]} style={{ width: `${(n / Math.max(1, rows.length)) * 100}%` }} title={`${s}: ${n}`} />
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
        </Card>
        <Card>
          <CardTitle>Enrolments by department</CardTitle>
          <ul className="space-y-2.5">
            {byDepartment.map(([dept, n]) => (
              <li key={dept} className="grid grid-cols-[120px_1fr_32px] items-center gap-3 text-sm">
                <span className="truncate text-zinc-700">{dept}</span>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${(n / maxDept) * 100}%` }} />
                </div>
                <span className="text-right font-medium text-zinc-900">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5">
        <Table head={['Training', 'Date', 'Status', 'Participants', 'Attendance', 'Completion', 'Avg rating']} minWidth={900}>
          {rows.map((r) => (
            <tr key={r.t.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <Link to={`/admin/trainings/${r.t.id}`} className="font-medium text-zinc-900 hover:text-brand-600">
                  {r.t.name}
                </Link>
                <p className="text-xs text-zinc-500">{r.journey}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(r.t.date)}</td>
              <td className="px-4 py-3">
                <Badge tone={trainingStatusTone[r.t.status]}>{r.t.status}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-600">{r.t.participantIds.length}</td>
              <td className="px-4 py-3 text-zinc-700">{r.attendance !== null ? `${r.attendance}%` : <span className="text-zinc-400">—</span>}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <ProgressBar value={r.completion} tone="green" className="w-24" />
                  <span className="text-xs text-zinc-600">{r.completion}%</span>
                </div>
              </td>
              <td className="px-4 py-3 text-zinc-700">{r.rating ? `${r.rating.toFixed(1)} / 5` : '—'}</td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  )
}
