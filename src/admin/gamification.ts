/**
 * Gamification engine – derives point events and earned badges from raw AdminData.
 * All logic is pure / derived so it stays consistent with the rest of the data.
 */
import type { AdminData, GamificationData, PersonGamification, PointEvent, EarnedBadge, BadgeId } from './types'
import { ALL_BADGES } from './types'
import { combinedJourney } from './journeys'

// ─── Point values ────────────────────────────────────────────────────────────
export const POINTS = {
  TRAINING_COMPLETED:   200,
  ASSESSMENT_PASSED:    100,
  ASSESSMENT_PERFECT:   50,
  ATTENDANCE_PRESENT:   50,
  ATTENDANCE_EARLY:     25,
  FEEDBACK_SUBMITTED:   30,
  MATERIAL_COMPLETED:   20,
} as const

let _idSeq = 0
function gid() { return `gev${++_idSeq}` }

// ─── Main derivation ─────────────────────────────────────────────────────────
export function deriveGamification(data: AdminData): GamificationData {
  _idSeq = 0
  const map: Record<string, PersonGamification> = {}

  const ensure = (pid: string): PersonGamification => {
    if (!map[pid]) map[pid] = { personId: pid, points: 0, events: [], badges: [] }
    return map[pid]!
  }
  const addEvent = (ev: PointEvent) => {
    const pg = ensure(ev.personId)
    pg.events.push(ev)
  }

  // 1. Training completion (progress == 100% across all modules)
  for (const t of data.trainings) {
    const journey = combinedJourney(data, t)
    if (!journey) continue
    const moduleIds = journey.modules.map(m => m.id)
    for (const pid of t.participantIds) {
      const pProgress = t.progress?.[pid] ?? {}
      const allDone = moduleIds.length > 0 && moduleIds.every(mid => (pProgress[mid] ?? 0) >= 100)
      if (allDone) {
        addEvent({ id: gid(), personId: pid, kind: 'training-completed', points: POINTS.TRAINING_COMPLETED, at: t.date + 'T23:59:00', label: `Completed "${t.name}"`, refId: t.id })
      }
    }
  }

  // 2. Assessment results
  for (const sub of data.submissions) {
    if (sub.status !== 'graded' || sub.score === undefined) continue
    const assess = data.assessments.find(a => a.id === sub.assessmentId)
    if (!assess) continue
    const passed = sub.score >= assess.passMark
    if (!passed) continue
    addEvent({ id: gid(), personId: sub.personId, kind: 'assessment-passed', points: POINTS.ASSESSMENT_PASSED, at: sub.submittedAt, label: `Passed assessment "${assess.title}"`, refId: sub.assessmentId })
    if (sub.score >= 100) {
      addEvent({ id: gid(), personId: sub.personId, kind: 'assessment-perfect', points: POINTS.ASSESSMENT_PERFECT, at: sub.submittedAt, label: `Perfect score on "${assess.title}"`, refId: sub.assessmentId })
    }
  }

  // 3. Attendance
  for (const t of data.trainings) {
    for (const ci of t.checkins ?? []) {
      if (ci.status === 'Present') {
        addEvent({ id: gid(), personId: ci.personId, kind: 'attendance-present', points: POINTS.ATTENDANCE_PRESENT, at: ci.at, label: `Attended "${t.name}"`, refId: t.id })
      }
    }
  }

  // 4. Feedback responses
  for (const resp of data.feedbackResponses) {
    addEvent({ id: gid(), personId: resp.participantId, kind: 'feedback-submitted', points: POINTS.FEEDBACK_SUBMITTED, at: resp.submittedAt, label: 'Submitted training feedback', refId: resp.trainingId })
  }

  // 5. Material completions (acknowledgedAt present)
  for (const mat of data.materials) {
    for (const [pid, prog] of Object.entries(mat.assignmentProgress ?? {})) {
      if (prog.acknowledgedAt) {
        addEvent({ id: gid(), personId: pid, kind: 'material-completed', points: POINTS.MATERIAL_COMPLETED, at: prog.acknowledgedAt, label: `Read "${mat.title}"`, refId: mat.id })
      }
    }
  }

  // 6. Badge derivation
  for (const pid of Object.keys(map)) {
    const pg = map[pid]!
    const completedTrainings = pg.events.filter(e => e.kind === 'training-completed').length
    const perfectScores = pg.events.filter(e => e.kind === 'assessment-perfect').length
    const attendedSessions = pg.events.filter(e => e.kind === 'attendance-present').length

    const toEarn: BadgeId[] = []
    if (completedTrainings >= 1)  toEarn.push('first-complete')
    if (completedTrainings >= 3)  toEarn.push('hat-trick')
    if (perfectScores >= 1)       toEarn.push('perfect-score')
    if (perfectScores >= 5)       toEarn.push('quiz-master')
    if (attendedSessions >= 3)    toEarn.push('team-player')
    toEarn.push('first-login')

    for (const bid of toEarn) {
      if (pg.badges.find(b => b.badgeId === bid)) continue
      const badge = ALL_BADGES.find(b => b.id === bid)!
      const earnedAt = pg.events[0]?.at ?? new Date().toISOString()
      const earned: EarnedBadge = { badgeId: bid, earnedAt }
      pg.badges.push(earned)
      addEvent({ id: gid(), personId: pid, kind: 'badge-earned', points: badge.points, at: earnedAt, label: `Earned badge: ${badge.label}` })
    }
  }

  // 7. Compute total points for each person
  for (const pid of Object.keys(map)) {
    const pg = map[pid]!
    pg.points = pg.events.reduce((s, e) => s + e.points, 0)
    const sorted = [...pg.events].sort((a, b) => b.at.localeCompare(a.at))
    pg.lastActivityAt = sorted[0]?.at
  }

  return { people: map }
}

// ─── Leaderboard helpers ──────────────────────────────────────────────────────
export type LeaderboardRow = {
  rank: number
  person: { id: string; name: string; department: string; region?: string }
  points: number
  badges: EarnedBadge[]
  completedTrainings: number
  assessmentsPassed: number
  trend: 'up' | 'down' | 'same'
}

export function buildLeaderboard(data: AdminData, gData: GamificationData, groupId?: string): LeaderboardRow[] {
  const rows: Omit<LeaderboardRow, 'rank' | 'trend'>[] = []

  for (const person of data.people) {
    if (person.role !== 'Participant') continue
    if (groupId && !person.groupIds.includes(groupId)) continue

    const pg = gData.people[person.id]
    const points = pg?.points ?? 0
    const badges = pg?.badges ?? []
    const events = pg?.events ?? []
    const completedTrainings = events.filter(e => e.kind === 'training-completed').length
    const assessmentsPassed = events.filter(e => e.kind === 'assessment-passed').length

    rows.push({ person: { id: person.id, name: person.name, department: person.department, region: person.region }, points, badges, completedTrainings, assessmentsPassed })
  }

  rows.sort((a, b) => b.points - a.points)

  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    trend: i < Math.ceil(rows.length * 0.33) ? 'up' : i > Math.floor(rows.length * 0.66) ? 'down' : 'same',
  }))
}
