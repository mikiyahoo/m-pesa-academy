import { Award, Building2, Check, Sparkles, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { attended, bestScore, eligibility, type AttendanceMark } from '../insights'
import type { AdminData, AdminTraining } from '../types'
import { useAdmin } from '../store'
import { Avatar, Button, Card, CardTitle, Empty, ProgressBar, StatCard, Table, Tabs } from '../ui'
import { AppreciationModal, type Recipient } from './AppreciationModal'
import type { Sheet } from './export'
import { useReportStatTrend } from './ReportParts'

export type TraineeRow = {
  id: string
  name: string
  department: string
  groups: string[]
  enrolled: number
  attended: number
  settled: number
  completed: number
  certificates: number
  scores: number[]
}

type Rank = { key: string; label: string; people: number; enrolled: number; attendance: number; completion: number; avgScore: number | null; certificates: number }

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/**
 * Per-person results across the trainings in view: attendance, completion (eligible or certified),
 * certificates and best scores. Ranked by certificates, then completion, attendance and score.
 */
export function traineeRows(data: AdminData, live: AdminTraining[], participantsOf: (t: AdminTraining) => string[], marks: Map<string, Map<string, AttendanceMark>>): TraineeRow[] {
  const byId = new Map<string, TraineeRow>()
  for (const t of live) {
    const m = marks.get(t.id)!
    for (const pid of participantsOf(t)) {
      const p = data.people.find((x) => x.id === pid)
      if (!p) continue
      const row =
        byId.get(pid) ??
        ({ id: pid, name: p.name, department: p.department || 'Other', groups: p.groupIds.map((g) => data.groups.find((x) => x.id === g)?.name ?? g), enrolled: 0, attended: 0, settled: 0, completed: 0, certificates: 0, scores: [] } as TraineeRow)
      const mark = m.get(pid)
      row.enrolled++
      if (mark && mark !== 'Not yet') row.settled++
      if (attended(mark)) row.attended++
      const certified = (t.certificates ?? []).some((c) => c.personId === pid)
      if (certified) row.certificates++
      if (certified || eligibility(data, t, pid, m).eligible) row.completed++
      const s = bestScore(data, t, pid)
      if (s !== undefined) row.scores.push(s)
      byId.set(pid, row)
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.certificates - a.certificates ||
      pct(b.completed, b.enrolled) - pct(a.completed, a.enrolled) ||
      pct(b.attended, b.settled) - pct(a.attended, a.settled) ||
      (avg(b.scores) ?? 0) - (avg(a.scores) ?? 0),
  )
}

function rankBy(rows: TraineeRow[], keysOf: (r: TraineeRow) => string[]): Rank[] {
  const groups = new Map<string, TraineeRow[]>()
  rows.forEach((r) => keysOf(r).forEach((k) => groups.set(k, [...(groups.get(k) ?? []), r])))
  return [...groups.entries()]
    .map(([key, rs]) => {
      const enrolled = rs.reduce((s, r) => s + r.enrolled, 0)
      return {
        key,
        label: key,
        people: rs.length,
        enrolled,
        attendance: pct(
          rs.reduce((s, r) => s + r.attended, 0),
          rs.reduce((s, r) => s + r.settled, 0),
        ),
        completion: pct(
          rs.reduce((s, r) => s + r.completed, 0),
          enrolled,
        ),
        avgScore: avg(rs.flatMap((r) => r.scores)),
        certificates: rs.reduce((s, r) => s + r.certificates, 0),
      }
    })
    // Same rule as people: certificates first, so a one-person team can't top the list on a single result.
    .sort((a, b) => b.certificates - a.certificates || b.completion - a.completion || b.attendance - a.attendance || b.people - a.people)
}

export function traineeSheets(rows: TraineeRow[], name: (id: string) => string): Sheet[] {
  const head = ['Department', 'People', 'Enrolments', 'Attendance %', 'Completion %', 'Avg score', 'Certificates']
  const toRow = (r: Rank) => [r.label, r.people, r.enrolled, r.attendance, r.completion, r.avgScore !== null ? Math.round(r.avgScore) : '', r.certificates]
  return [
    {
      name: 'Top trainees',
      header: ['Rank', 'Trainee', 'Department', 'Trainings', 'Attendance %', 'Completion %', 'Avg score', 'Certificates'],
      rows: rows.map((r, i) => [i + 1, name(r.id), r.department, r.enrolled, pct(r.attended, r.settled), pct(r.completed, r.enrolled), r.scores.length ? Math.round(avg(r.scores)!) : '', r.certificates]),
    },
    { name: 'By department', header: head, rows: rankBy(rows, (r) => [r.department]).map(toRow) },
    { name: 'By group', header: ['Group', ...head.slice(1)], rows: rankBy(rows, (r) => (r.groups.length ? r.groups : ['No group'])).map(toRow) },
  ]
}

const medal = ['bg-amber-400 text-amber-950', 'bg-zinc-300 text-zinc-800', 'bg-[#d8a37b] text-[#4a2a12]']

/** Leaderboard of trainees and a ranking of departments or groups (teams). */
export function TopTraineesView({ rows }: { rows: TraineeRow[] }) {
  const [by, setBy] = useState<'department' | 'group'>('department')
  const [showAll, setShowAll] = useState(false)
  const ranks = rankBy(rows, (r) => (by === 'department' ? [r.department] : r.groups.length ? r.groups : ['No group']))
  const people = showAll ? rows : rows.slice(0, 10)
  const top = rows[0]
  const { data } = useAdmin()
  const traineeTrend = useReportStatTrend('Trainees')
  const certificatesTrend = useReportStatTrend('Certificates')
  const [appreciating, setAppreciating] = useState<Recipient[] | null>(null)
  const lastSent = (id: string) => (data.appreciations ?? []).filter((a) => a.personId === id).sort((a, b) => b.at.localeCompare(a.at))[0]
  const reasonOf = (r: TraineeRow) =>
    `You completed ${r.completed} of ${r.enrolled} trainings${r.certificates ? `, earned ${r.certificates} certificate${r.certificates === 1 ? '' : 's'}` : ''}${r.settled ? ` and attended ${pct(r.attended, r.settled)}% of your sessions` : ''}.`
  const toRecipient = (r: TraineeRow): Recipient => ({ id: r.id, name: r.name, email: data.people.find((p) => p.id === r.id)?.email ?? '', reason: reasonOf(r) })
  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} tone="zinc" label="Trainees" value={rows.length} trend={traineeTrend} />
        <StatCard icon={Trophy} tone="amber" label="Top trainee" value={<span className="text-base sm:text-lg">{top?.name ?? '—'}</span>} hint={top ? `${top.certificates} certificate${top.certificates === 1 ? '' : 's'} · ${pct(top.completed, top.enrolled)}% complete` : undefined} />
        <StatCard icon={Building2} tone="red" label={by === 'department' ? 'Top department' : 'Top group'} value={<span className="text-base sm:text-lg">{ranks[0]?.label ?? '—'}</span>} hint={ranks[0] ? `${ranks[0].completion}% completion` : undefined} />
        <StatCard icon={Award} tone="green" label="Certificates" value={rows.reduce((s, r) => s + r.certificates, 0)} trend={certificatesTrend} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <Card className="p-0">
          <div className="px-5 pt-5">
            <CardTitle
              action={
                <Button size="sm" variant="primary" disabled={!rows.length} onClick={() => setAppreciating(rows.slice(0, 3).map(toRecipient))}>
                  <Sparkles className="size-3.5" /> Send appreciation
                </Button>
              }
            >
              Top trainees
            </CardTitle>
          </div>
          <Table head={['#', 'Trainee', 'Trainings', 'Attendance', 'Avg score', 'Certificates', '']} minWidth={720}>
            {people.map((r, i) => {
              const att = pct(r.attended, r.settled)
              return (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <span className={cn('grid size-7 place-items-center rounded-full text-xs font-bold', medal[i] ?? 'bg-zinc-100 text-zinc-600')}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900">{r.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{r.department}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600 tabular-nums">
                    {r.completed}/{r.enrolled} done
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex min-w-28 items-center gap-2">
                      <ProgressBar value={att} tone={att >= 80 ? 'green' : 'red'} className="flex-1" />
                      <span className="w-9 text-right text-xs font-semibold text-zinc-700 tabular-nums">{r.settled ? `${att}%` : '—'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 tabular-nums">{r.scores.length ? `${Math.round(avg(r.scores)!)}%` : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-900 tabular-nums">{r.certificates}</td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const sent = lastSent(r.id)
                      return (
                        <button
                          onClick={() => setAppreciating([toRecipient(r)])}
                          title={sent ? `Last sent ${sent.at.slice(0, 10)} — send again` : 'Send an appreciation email'}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition',
                            sent ? 'bg-mpesa-500/10 text-mpesa-700 hover:bg-mpesa-500/15' : 'border border-zinc-200 text-zinc-700 hover:border-brand-300 hover:text-brand-700',
                          )}
                        >
                          {sent ? <Check className="size-3.5" strokeWidth={3} /> : <Sparkles className="size-3.5" />}
                          {sent ? 'Sent' : 'Appreciate'}
                        </button>
                      )
                    })()}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                  No trainees for these filters.
                </td>
              </tr>
            )}
          </Table>
          {rows.length > 10 && (
            <div className="px-5 py-3">
              <button onClick={() => setShowAll((s) => !s)} className="text-xs font-semibold text-brand-600 hover:underline">
                {showAll ? 'Show top 10' : `Show all ${rows.length} trainees`}
              </button>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle
            action={
              <Tabs
                value={by}
                onChange={setBy}
                label="Rank by"
                items={[
                  { value: 'department', label: 'Department' },
                  { value: 'group', label: 'Group' },
                ]}
              />
            }
          >
            Top teams
          </CardTitle>
          <ol className="space-y-3">
            {ranks.map((r, i) => (
              <li key={r.key} className="flex items-center gap-3">
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', medal[i] ?? 'bg-zinc-100 text-zinc-600')}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900">{r.label}</span>
                    <span className="shrink-0 text-xs font-semibold text-zinc-700 tabular-nums">{r.completion}%</span>
                  </span>
                  <ProgressBar value={r.completion} tone="green" className="mt-1.5" />
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    {r.people} {r.people === 1 ? 'person' : 'people'} · {r.attendance}% attendance · {r.avgScore !== null ? `${Math.round(r.avgScore)}% avg` : 'no scores'} · {r.certificates} certificate{r.certificates === 1 ? '' : 's'}
                  </span>
                </span>
              </li>
            ))}
            {!ranks.length && (
              <li>
                <Empty compact icon={Users} title="No teams for these filters" />
              </li>
            )}
          </ol>
        </Card>
      </div>
      {appreciating && <AppreciationModal recipients={appreciating} onClose={() => setAppreciating(null)} />}
    </>
  )
}
