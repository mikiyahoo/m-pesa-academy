import { BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { shortDate } from '../admin/helpers'
import { attendanceMap, attended } from '../admin/insights'
import { ExportMenu } from '../admin/reports/ReportParts'
import { Badge, trainingStatusTone } from '../admin/ui'
import { cn } from '../lib/utils'
import { useRequester } from './useRequester'
import { EmptyState } from '../components/EmptyState'

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

/** Requester reports (D05): sessions they requested and how their team attended. */
export function RequesterReports() {
  const { data, mine, team } = useRequester()
  const submitted = mine.filter((r) => r.status !== 'DRAFT')
  // The team = everyone named on my requests.
  const emails = new Set(submitted.flatMap((r) => r.participants.map((p) => p.email.toLowerCase())))
  const teamIds = new Set(data.people.filter((p) => emails.has(p.email.toLowerCase())).map((p) => p.id))
  const requested = new Set(submitted.map((r) => r.trainingId).filter(Boolean))
  const sessions = data.trainings
    .filter((t) => t.status !== 'CANCELLED' && (requested.has(t.id) || t.participantIds.some((pid) => teamIds.has(pid))))
    .sort((a, b) => b.date.localeCompare(a.date))

  const rows = sessions.map((t) => {
    const marks = attendanceMap(data, t)
    const mineIds = t.participantIds.filter((pid) => teamIds.has(pid))
    const settled = mineIds.filter((pid) => marks.get(pid) !== 'Not yet')
    const n = (m: string) => mineIds.filter((pid) => marks.get(pid) === m).length
    return { t, marks, mineIds, requestedHere: requested.has(t.id), present: n('Present'), late: n('Late'), absent: settled.length - n('Present') - n('Late'), rate: settled.length ? pct(n('Present') + n('Late'), settled.length) : null }
  })
  const people = [...teamIds].map((pid) => {
    const mine = rows.filter((r) => r.mineIds.includes(pid))
    const settled = mine.filter((r) => r.marks.get(pid) !== 'Not yet')
    return { p: data.people.find((x) => x.id === pid)!, sessions: mine.length, attendedN: settled.filter((r) => attended(r.marks.get(pid))).length, settled: settled.length }
  })
  const allSettled = people.reduce((s, x) => s + x.settled, 0)
  const allAttended = people.reduce((s, x) => s + x.attendedN, 0)

  const stats = [
    { label: 'Requests submitted', value: submitted.length },
    { label: 'Sessions scheduled', value: submitted.filter((r) => r.trainingId).length },
    { label: 'Team trainees', value: teamIds.size },
    { label: 'Team attendance', value: allSettled ? `${pct(allAttended, allSettled)}%` : '—' },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-gradient-to-br from-white via-[#fff6f6] to-brand-50 p-6 sm:p-7">
        <div>
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">Team reports</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sessions you requested and how <span className="font-semibold text-zinc-800">{team}</span> attended.
          </p>
        </div>
        <ExportMenu
          filename="team-report"
          title={`${team} — training report`}
          personal
          sheets={(anon) => {
            const ids = new Map<string, string>()
            const label = (id: string, name: string) => {
              if (!anon) return name
              if (!ids.has(id)) ids.set(id, `Trainee ${String(ids.size + 1).padStart(3, '0')}`)
              return ids.get(id)!
            }
            return [
              { name: 'Sessions', header: ['Session', 'Date', 'Status', 'Requested by you', 'Team invited', 'Present', 'Late', 'Absent', 'Attendance %'], rows: rows.map((r) => [r.t.name, r.t.date, r.t.status, r.requestedHere ? 'Yes' : 'No', r.mineIds.length, r.present, r.late, r.absent, r.rate ?? '']) },
              { name: 'Trainees', header: ['Trainee', 'Sessions', 'Attended', 'Attendance %'], rows: people.map((x) => [label(x.p.id, x.p.name), x.sessions, x.attendedN, x.settled ? pct(x.attendedN, x.settled) : '']) },
            ]
          }}
        />
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card sm:p-5">
            <p className="text-xs font-medium text-zinc-600 sm:text-[13px]">{s.label}</p>
            <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-zinc-200/80 bg-white">
        <h2 className="border-b border-zinc-100 px-5 py-4 font-bold text-zinc-900">Sessions</h2>
        {rows.length ? (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  {['Session', 'Date', 'Status', 'Team invited', 'Present', 'Late', 'Absent', 'Attendance'].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.t.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-zinc-900">{r.t.name}</p>
                      {r.requestedHere && <p className="text-xs text-brand-600">Requested by you</p>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-zinc-600">{shortDate(r.t.date)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={trainingStatusTone[r.t.status]}>{r.t.status}</Badge>
                    </td>
                    <td className="px-5 py-3">{r.mineIds.length}</td>
                    <td className="px-5 py-3 text-mpesa-700">{r.present}</td>
                    <td className="px-5 py-3 text-amber-700">{r.late}</td>
                    <td className="px-5 py-3 text-brand-700">{r.absent}</td>
                    <td className="px-5 py-3 font-semibold">{r.rate !== null ? `${r.rate}%` : <span className="font-normal text-zinc-400">Not held yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No sessions yet"
            text="Once a request is scheduled, your team’s attendance shows here."
            action={
              <Link to="/requests/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700">
                Request a training
              </Link>
            }
          />
        )}
      </section>

      {people.length > 0 && (
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <h2 className="mb-4 font-bold text-zinc-900">Team attendance</h2>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {people
              .sort((a, b) => pct(a.attendedN, a.settled) - pct(b.attendedN, b.settled))
              .map((x) => {
                const v = x.settled ? pct(x.attendedN, x.settled) : null
                return (
                  <li key={x.p.id} className="grid grid-cols-[minmax(0,1fr)_96px_40px] items-center gap-3 text-sm">
                    <span className="truncate text-zinc-700">{x.p.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <span className={cn('block h-full rounded-full', v === null ? '' : v >= 80 ? 'bg-mpesa-500' : v >= 50 ? 'bg-amber-500' : 'bg-brand-600')} style={{ width: `${v ?? 0}%` }} />
                    </span>
                    <span className="text-right font-medium text-zinc-900 tabular-nums">{v !== null ? `${v}%` : '—'}</span>
                  </li>
                )
              })}
          </ul>
        </section>
      )}
    </div>
  )
}
