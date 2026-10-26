import { AlertTriangle, BellRing, CheckCircle2, Globe2, MapPin, Send, ShieldAlert, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { cn } from '../../lib/utils'
import { attended, attendanceMap } from '../insights'
import { filteredParticipants, type useReportFilters } from './filters'
import type { Sheet } from './export'
import { participantProgress } from '../store'
import type { AdminData, AdminTraining } from '../types'
import { Badge, Button, Card, ProgressBar, Table } from '../ui'

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

/* -------------------------------------------------------------------------- */
/*                       1. COURSE COMPLETION FUNNEL                          */
/* -------------------------------------------------------------------------- */

export function buildFunnelReport(
  data: AdminData,
  trainings: AdminTraining[],
  filters: ReturnType<typeof useReportFilters>['filters'],
) {
  const live = trainings.filter((t) => t.status !== 'CANCELLED')
  const totalEnrolled = live.reduce((s, t) => s + filteredParticipants(data, t, filters).length, 0)

  // 1. Attended
  const marks = new Map(live.map((t) => [t.id, attendanceMap(data, t)]))
  const attendedCount = live.reduce((s, t) => {
    const ps = filteredParticipants(data, t, filters)
    const m = marks.get(t.id)
    return s + ps.filter((pid) => m && attended(m.get(pid))).length
  }, 0)

  // 2. Read material (>50% module progress)
  const materialDoneCount = live.reduce((s, t) => {
    const ps = filteredParticipants(data, t, filters)
    const journey = data.journeys.find((j) => j.id === t.journeyId)
    const mids = journey?.modules.map((m) => m.id) ?? []
    return s + ps.filter((pid) => participantProgress(t, pid, mids) >= 50).length
  }, 0)

  // 3. Attempted Assessment
  const attemptedCount = live.reduce((s, t) => {
    const ps = filteredParticipants(data, t, filters)
    const subs = data.submissions.filter((sub) => sub.trainingId === t.id && ps.includes(sub.personId))
    const uniqueAttempted = new Set(subs.map((sub) => sub.personId)).size
    return s + uniqueAttempted
  }, 0)

  // 4. Passed & Certified
  const certifiedCount = live.reduce((s, t) => {
    const ps = filteredParticipants(data, t, filters)
    const certPids = (t.certificates ?? []).map((c) => c.personId)
    return s + ps.filter((pid) => certPids.includes(pid)).length
  }, 0)

  const stages = [
    { name: '1. Enrolled in Course', count: totalEnrolled, pctOfTotal: 100, dropOff: 0 },
    {
      name: '2. Attended Training Session',
      count: attendedCount,
      pctOfTotal: pct(attendedCount, totalEnrolled),
      dropOff: totalEnrolled ? pct(totalEnrolled - attendedCount, totalEnrolled) : 0,
    },
    {
      name: '3. Completed Materials (>50%)',
      count: materialDoneCount,
      pctOfTotal: pct(materialDoneCount, totalEnrolled),
      dropOff: attendedCount ? pct(attendedCount - materialDoneCount, attendedCount) : 0,
    },
    {
      name: '4. Attempted Assessment',
      count: attemptedCount,
      pctOfTotal: pct(attemptedCount, totalEnrolled),
      dropOff: materialDoneCount ? pct(materialDoneCount - attemptedCount, materialDoneCount) : 0,
    },
    {
      name: '5. Passed & Issued Certificate',
      count: certifiedCount,
      pctOfTotal: pct(certifiedCount, totalEnrolled),
      dropOff: attemptedCount ? pct(attemptedCount - certifiedCount, attemptedCount) : 0,
    },
  ]

  // Find worst drop-off
  let worstStage = stages[1]
  for (let i = 2; i < stages.length; i++) {
    if (stages[i].dropOff > worstStage.dropOff) worstStage = stages[i]
  }

  const sheets: Sheet[] = [
    {
      name: 'Completion Funnel',
      header: ['Funnel Stage', 'Participants', '% of Initial Enrolments', 'Stage Drop-off %'],
      rows: stages.map((s) => [s.name, s.count, `${s.pctOfTotal}%`, `${s.dropOff}%`]),
    },
  ]

  const view = (
    <div className="space-y-6">
      {/* Bottleneck insight banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-orange-50/40 p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700">
            <TrendingDown className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-amber-950">Primary Drop-off Bottleneck</h3>
            <p className="mt-0.5 text-xs text-amber-900/80">
              The steepest drop-off occurs at <strong className="font-semibold text-amber-950">{worstStage.name}</strong> with a <span className="font-bold text-brand-700">-{worstStage.dropOff}% drop-off</span>.
              Targeted reminders for this stage will yield the highest completion gains.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Overall Conversion</p>
            <p className="text-xl font-black text-mpesa-600">{stages[4].pctOfTotal}%</p>
          </div>
        </div>
      </div>

      {/* Visual Funnel Cards */}
      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const colors = [
            'from-sky-500 to-blue-600',
            'from-blue-600 to-indigo-600',
            'from-indigo-600 to-purple-600',
            'from-purple-600 to-amber-600',
            'from-emerald-500 to-mpesa-600',
          ]
          return (
            <div
              key={stage.name}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs transition hover:border-zinc-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-700">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900">{stage.name}</h4>
                    <p className="text-xs text-zinc-500">
                      {stage.count.toLocaleString()} learners reached this step
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {idx > 0 && (
                    <div className="text-right">
                      <span className="text-[11px] text-zinc-400 block">Stage Drop-off</span>
                      <span className="text-xs font-bold text-red-600">-{stage.dropOff}%</span>
                    </div>
                  )}
                  <div className="text-right min-w-[70px]">
                    <span className="text-[11px] text-zinc-400 block">Retained</span>
                    <span className="text-base font-black text-zinc-900">{stage.pctOfTotal}%</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', colors[idx])}
                  style={{ width: `${Math.max(stage.pctOfTotal, 3)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return { view, sheets: () => sheets }
}

/* -------------------------------------------------------------------------- */
/*                       2. REGIONAL PERFORMANCE HEATMAP                      */
/* -------------------------------------------------------------------------- */

export function buildHeatmapReport(
  data: AdminData,
  trainings: AdminTraining[],
  filters: ReturnType<typeof useReportFilters>['filters'],
) {
  const live = trainings.filter((t) => t.status !== 'CANCELLED')
  const marks = new Map(live.map((t) => [t.id, attendanceMap(data, t)]))

  // Aggregate by region
  const regionMap: Record<
    string,
    {
      region: string
      enrolments: number
      attended: number
      settled: number
      completed: number
      quizScores: number[]
      certificates: number
    }
  > = {}

  for (const t of live) {
    const ps = filteredParticipants(data, t, filters)
    const m = marks.get(t.id)
    const journey = data.journeys.find((j) => j.id === t.journeyId)
    const mids = journey?.modules.map((mod) => mod.id) ?? []
    const certPids = (t.certificates ?? []).map((c) => c.personId)

    for (const pid of ps) {
      const p = data.people.find((item) => item.id === pid)
      const reg = p?.region || 'Unassigned'
      if (!regionMap[reg]) {
        regionMap[reg] = { region: reg, enrolments: 0, attended: 0, settled: 0, completed: 0, quizScores: [], certificates: 0 }
      }
      const entry = regionMap[reg]
      entry.enrolments++

      if (m) {
        const mark = m.get(pid)
        if (mark && mark !== 'Not yet') {
          entry.settled++
          if (attended(mark)) entry.attended++
        }
      }

      if (participantProgress(t, pid, mids) >= 100) {
        entry.completed++
      }

      const userSub = data.submissions.find((s) => s.trainingId === t.id && s.personId === pid && s.score !== undefined)
      if (userSub?.score !== undefined) {
        entry.quizScores.push(userSub.score)
      }

      if (certPids.includes(pid)) {
        entry.certificates++
      }
    }
  }

  const rows = Object.values(regionMap).map((r) => {
    const attendanceRate = r.settled ? pct(r.attended, r.settled) : 0
    const completionRate = r.enrolments ? pct(r.completed, r.enrolments) : 0
    const avgScore = r.quizScores.length ? Math.round(r.quizScores.reduce((a, b) => a + b, 0) / r.quizScores.length) : 0
    const rating: 'high' | 'medium' | 'low' = completionRate >= 70 && attendanceRate >= 75 ? 'high' : completionRate >= 50 ? 'medium' : 'low'
    return { ...r, attendanceRate, completionRate, avgScore, rating }
  }).sort((a, b) => b.enrolments - a.enrolments)

  const sheets: Sheet[] = [
    {
      name: 'Regional Heatmap',
      header: ['Region', 'Enrolments', 'Attendance %', 'Completion %', 'Avg Quiz Score %', 'Certificates Issued', 'Health Status'],
      rows: rows.map((r) => [r.region, r.enrolments, `${r.attendanceRate}%`, `${r.completionRate}%`, `${r.avgScore}%`, r.certificates, r.rating.toUpperCase()]),
    },
  ]

  const view = (
    <div className="space-y-6">
      {/* Top summary row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <Globe2 className="size-4 text-brand-600" /> Active Regions
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-900">{rows.length}</p>
          <p className="mt-0.5 text-xs text-zinc-500">Across domestic & external branches</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <CheckCircle2 className="size-4 text-emerald-600" /> Top Performing Region
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {rows.find((r) => r.rating === 'high')?.region ?? '—'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Exceeds 70% completion & attendance</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <AlertTriangle className="size-4 text-amber-600" /> Regions Needing Attention
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {rows.filter((r) => r.rating === 'low').length}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Below 50% course completion</p>
        </div>
      </div>

      {/* Heatmap Grid & Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.region}
            className={cn(
              'rounded-2xl border p-5 shadow-xs transition hover:shadow-md',
              r.rating === 'high' && 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/30 to-white',
              r.rating === 'medium' && 'border-zinc-200/80 bg-white',
              r.rating === 'low' && 'border-amber-200/80 bg-gradient-to-br from-amber-50/30 to-white',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="flex items-center gap-1.5 text-base font-bold text-zinc-900">
                  <MapPin className="size-4 text-brand-600" /> {r.region}
                </h4>
                <p className="text-xs text-zinc-500">{r.enrolments} total enrolments</p>
              </div>
              <Badge tone={r.rating === 'high' ? 'green' : r.rating === 'medium' ? 'blue' : 'amber'}>
                {r.rating === 'high' ? 'Optimal' : r.rating === 'medium' ? 'Standard' : 'Needs Focus'}
              </Badge>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-600">Completion Rate</span>
                  <span className="font-bold text-zinc-900">{r.completionRate}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      r.completionRate >= 70 ? 'bg-mpesa-600' : r.completionRate >= 50 ? 'bg-amber-500' : 'bg-brand-600',
                    )}
                    style={{ width: `${r.completionRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-600">Attendance Rate</span>
                  <span className="font-bold text-zinc-900">{r.attendanceRate}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${r.attendanceRate}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-600">Avg Assessment Score</span>
                  <span className="font-bold text-zinc-900">{r.avgScore ? `${r.avgScore}%` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return { view, sheets: () => sheets }
}

/* -------------------------------------------------------------------------- */
/*                       3. AT-RISK LEARNER DETECTION                         */
/* -------------------------------------------------------------------------- */

export function buildAtRiskReport(
  data: AdminData,
  trainings: AdminTraining[],
  filters: ReturnType<typeof useReportFilters>['filters'],
) {
  const live = trainings.filter((t) => t.status !== 'CANCELLED')
  const marks = new Map(live.map((t) => [t.id, attendanceMap(data, t)]))

  const atRiskList: {
    personId: string
    personName: string
    department: string
    region?: string
    trainingName: string
    trainingId: string
    riskReason: string
    severity: 'high' | 'medium'
    progressPct: number
  }[] = []

  for (const t of live) {
    const ps = filteredParticipants(data, t, filters)
    const m = marks.get(t.id)
    const journey = data.journeys.find((j) => j.id === t.journeyId)
    const mids = journey?.modules.map((mod) => mod.id) ?? []

    for (const pid of ps) {
      const p = data.people.find((item) => item.id === pid)
      if (!p) continue

      const progress = participantProgress(t, pid, mids)
      const mark = m ? m.get(pid) : undefined
      const sub = data.submissions.find((s) => s.trainingId === t.id && s.personId === pid)
      const assess = data.assessments.find((a) => a.id === t.postAssessmentId)
      const passMark = assess?.passMark ?? 70

      let reason = ''
      let severity: 'high' | 'medium' = 'medium'

      if (t.status === 'COMPLETED' && progress < 25) {
        reason = `Session finished with only ${progress}% progress`
        severity = 'high'
      } else if (mark === 'Absent') {
        reason = 'Marked absent from mandatory session'
        severity = 'high'
      } else if (sub && sub.score !== undefined && sub.score < passMark) {
        reason = `Failed assessment with score ${sub.score}% (Pass mark: ${passMark}%)`
        severity = 'medium'
      } else if (t.status === 'ONGOING' && progress === 0) {
        reason = 'Enrolled in ongoing course with 0% activity'
        severity = 'medium'
      }

      if (reason) {
        atRiskList.push({
          personId: p.id,
          personName: p.name,
          department: p.department || '—',
          region: p.region || '—',
          trainingName: t.name,
          trainingId: t.id,
          riskReason: reason,
          severity,
          progressPct: progress,
        })
      }
    }
  }

  const sheets: Sheet[] = [
    {
      name: 'At-Risk Trainees',
      header: ['Learner Name', 'Department', 'Region', 'Training Session', 'Progress %', 'Risk Diagnosis', 'Severity'],
      rows: atRiskList.map((r) => [r.personName, r.department, r.region ?? '', r.trainingName, `${r.progressPct}%`, r.riskReason, r.severity.toUpperCase()]),
    },
  ]

  const view = <AtRiskViewInner list={atRiskList} />

  return { view, sheets: () => sheets }
}

function AtRiskViewInner({
  list,
}: {
  list: {
    personId: string
    personName: string
    department: string
    region?: string
    trainingName: string
    trainingId: string
    riskReason: string
    severity: 'high' | 'medium'
    progressPct: number
  }[]
}) {
  const { toast } = useFeedback()
  const [nudged, setNudged] = useState<Set<string>>(new Set())

  const handleNudge = (pid: string, name: string) => {
    setNudged((prev) => new Set(prev).add(pid))
    toast(`Learning reminder dispatched to ${name}!`)
  }

  const handleNudgeAll = () => {
    const all = new Set(list.map((r) => r.personId))
    setNudged(all)
    toast(`Sent automated engagement reminders to all ${list.length} at-risk learners!`)
  }

  return (
    <div className="space-y-6">
      {/* Alert Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 via-white to-amber-50/30 p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-600/10 text-red-600">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-red-950">
              {list.length} Learners Identified as At-Risk
            </h3>
            <p className="mt-0.5 text-xs text-red-900/80">
              Automated detection flags learners who are lagging on modules, failed assessments, or missed check-ins.
            </p>
          </div>
        </div>

        {list.length > 0 && (
          <Button variant="primary" size="sm" onClick={handleNudgeAll}>
            <BellRing className="size-3.5" /> Nudge All At-Risk
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <Card className="py-12 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <h4 className="mt-3 text-base font-bold text-zinc-900">No At-Risk Learners Detected</h4>
          <p className="mt-1 text-xs text-zinc-500">All participants are currently progressing on schedule.</p>
        </Card>
      ) : (
        <Table head={['Learner', 'Training', 'Progress', 'Risk Diagnosis', 'Severity', 'Action']} minWidth={850}>
          {list.map((r) => {
            const isNudged = nudged.has(r.personId)
            return (
              <tr key={`${r.personId}-${r.trainingId}`} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${r.personId}`} className="font-semibold text-zinc-900 hover:text-brand-600">
                    {r.personName}
                  </Link>
                  <p className="text-xs text-zinc-500">{r.department} • {r.region}</p>
                </td>
                <td className="px-4 py-3 max-w-56 truncate text-sm text-zinc-700">
                  {r.trainingName}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={r.progressPct} tone={r.progressPct > 50 ? 'green' : 'red'} className="w-16" />
                    <span className="text-xs font-bold text-zinc-700">{r.progressPct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-700">
                  <span className="font-medium text-red-700">{r.riskReason}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.severity === 'high' ? 'red' : 'amber'}>
                    {r.severity === 'high' ? 'Critical' : 'Moderate'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant={isNudged ? 'ghost' : 'outline'}
                    disabled={isNudged}
                    onClick={() => handleNudge(r.personId, r.personName)}
                  >
                    {isNudged ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-600" /> Nudged
                      </>
                    ) : (
                      <>
                        <Send className="size-3" /> Nudge
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            )
          })}
        </Table>
      )}
    </div>
  )
}
