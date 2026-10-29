import { localISO, todayISO } from '../lib/utils'
import { participantProgress } from './store'
import { attendanceRows, type AttendanceStatus } from './teams/attendance'
import type { AdminAlert, AdminData, AdminTraining, FeedbackForm, FeedbackResponse, IssuedCertificate } from './types'
import { combinedJourney } from './journeys'

/*
 * Derived numbers shared by reports, the certification tracker, the trainer
 * dashboard and alerts, so every screen counts attendance, feedback and passes the same way.
 */

export type AttendanceMark = AttendanceStatus | 'Not yet'

/** Attendance per participant: portal check-ins win, then the Teams attendance report, else Absent once the session is over. */
export function attendanceMap(data: AdminData, t: AdminTraining): Map<string, AttendanceMark> {
  const out = new Map<string, AttendanceMark>()
  const teams = t.attendance ? new Map(attendanceRows(t, data.people, data.attendanceRules).map((r) => [r.person.id, r.status])) : null
  const over = t.date < todayISO() || t.status === 'COMPLETED'
  for (const pid of t.participantIds) {
    const c = t.checkins?.find((x) => x.personId === pid)
    if (c) out.set(pid, c.status)
    else if (teams?.has(pid)) out.set(pid, teams.get(pid)!)
    else out.set(pid, over ? 'Absent' : 'Not yet')
  }
  return out
}

export const attended = (m?: AttendanceMark) => m === 'Present' || m === 'Late'

export function attendanceRate(data: AdminData, t: AdminTraining) {
  const marks = [...attendanceMap(data, t).values()].filter((m) => m !== 'Not yet')
  return marks.length ? Math.round((marks.filter(attended).length / marks.length) * 100) : null
}

const questionType = (form: FeedbackForm | undefined, i: number) => form?.questionTypes?.[i] ?? 'likert'

/** Average of a response's Likert answers (Yes/No and open questions are left out). */
export function responseAverage(r: FeedbackResponse, form?: FeedbackForm) {
  const vals = r.ratings.filter((_, i) => questionType(form, i) === 'likert')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export function feedbackAverage(data: AdminData, responses: FeedbackResponse[]) {
  const avgs = responses.map((r) => responseAverage(r, data.feedbackForms.find((f) => f.id === r.formId))).filter((v): v is number => v !== null)
  return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null
}

/** Best graded score of a participant on the training's post-assessment. */
export function bestScore(data: AdminData, t: AdminTraining, pid: string) {
  const scores = data.submissions.filter((s) => s.trainingId === t.id && s.personId === pid && s.assessmentId === t.postAssessmentId && s.score !== undefined).map((s) => s.score!)
  return scores.length ? Math.max(...scores) : undefined
}

/** Passed = post-assessment pass mark met; without a post-assessment, every module complete. */
export function passed(data: AdminData, t: AdminTraining, pid: string) {
  const a = data.assessments.find((x) => x.id === t.postAssessmentId)
  if (a) {
    const s = bestScore(data, t, pid)
    return s !== undefined && s >= a.passMark
  }
  const mids = combinedJourney(data, t)?.modules.map((m) => m.id) ?? []
  return participantProgress(t, pid, mids) >= 100
}

/** Certificate rule (D6, TA-6.5): attended (Present/Late) + feedback submitted + passed. */
export function eligibility(data: AdminData, t: AdminTraining, pid: string, marks = attendanceMap(data, t)) {
  const mark = marks.get(pid)
  const feedback = data.feedbackResponses.some((r) => r.trainingId === t.id && r.participantId === pid)
  const pass = passed(data, t, pid)
  return { mark, attended: attended(mark), feedback, passed: pass, eligible: attended(mark) && feedback && pass }
}

/** Template for a training: the one assigned to its type, otherwise the default (X03). */
export function templateFor(data: AdminData, t: AdminTraining) {
  return data.templates.find((tp) => tp.assignedTypeIds?.includes(t.typeId)) ?? data.templates.find((tp) => tp.isDefault) ?? data.templates[0]
}

/** Issues certificates to every eligible participant who doesn't have one yet (automatic issuing, X02). */
export function runIssuing(data: AdminData, t: AdminTraining, by: string): AdminTraining {
  const marks = attendanceMap(data, t)
  const have = new Set((t.certificates ?? []).map((c) => c.personId))
  const templateId = templateFor(data, t)?.id ?? ''
  const fresh: IssuedCertificate[] = t.participantIds
    .filter((pid) => !have.has(pid) && eligibility(data, t, pid, marks).eligible)
    .map((pid) => ({ personId: pid, issuedAt: localISO(), issuedBy: by, method: 'auto', templateId }))
  return { ...t, certificates: [...(t.certificates ?? []), ...fresh], certificatesRunAt: localISO() }
}

/**
 * New alerts for low feedback responses (F04) and low group attendance (T06), skipping ones
 * already raised. Each is "emailed" to the training manager (simulated until email, Y05).
 */
export function scanAlerts(data: AdminData): AdminAlert[] {
  const seen = new Set(data.alerts.map((a) => a.id))
  const manager = data.people.find((p) => p.role === 'Admin')?.email ?? 'training.manager@safaricom.et'
  const out: AdminAlert[] = []
  for (const r of data.feedbackResponses) {
    const id = `al-fb-${r.id}`
    const avg = responseAverage(r, data.feedbackForms.find((f) => f.id === r.formId))
    if (seen.has(id) || avg === null || avg >= data.alertRules.feedbackBelow) continue
    const t = data.trainings.find((x) => x.id === r.trainingId)
    out.push({ id, kind: 'low-feedback', trainingId: r.trainingId, message: `Feedback of ${avg.toFixed(1)} / 5 on ${t?.name ?? 'a training'}`, at: `${r.submittedAt}${r.submittedAt.length === 10 ? 'T18:00:00' : ''}`, read: false, emailedTo: manager })
  }
  for (const t of data.trainings) {
    if (t.status === 'CANCELLED') continue
    const marks = attendanceMap(data, t)
    if (![...marks.values()].some((m) => m !== 'Not yet')) continue
    for (const g of data.groups) {
      const members = t.participantIds.filter((pid) => data.people.find((p) => p.id === pid)?.groupIds.includes(g.id))
      if (members.length < 3) continue
      const rate = Math.round((members.filter((pid) => attended(marks.get(pid))).length / members.length) * 100)
      const id = `al-at-${t.id}-${g.id}`
      if (seen.has(id) || rate >= data.alertRules.attendanceBelow) continue
      out.push({ id, kind: 'low-attendance', trainingId: t.id, message: `${g.name}: ${rate}% attendance at ${t.name}`, at: `${t.date}T${t.endTime}:00`, read: false, emailedTo: manager })
    }
  }
  return out
}

/** Swaps names and emails for stable "Trainee 001" labels in exports (D03). */
export function anonymiser() {
  const ids = new Map<string, string>()
  return (key: string) => {
    if (!ids.has(key)) ids.set(key, `Trainee ${String(ids.size + 1).padStart(3, '0')}`)
    return ids.get(key)!
  }
}
