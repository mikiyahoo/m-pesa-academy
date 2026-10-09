import type { AdminTraining, AttendanceRecord, AttendanceRules, Person } from '../types'

export type AttendanceStatus = 'Present' | 'Late' | 'Incomplete' | 'Absent'

export type AttendanceRow = {
  person: Person
  record?: AttendanceRecord
  join?: Date
  leave?: Date
  seconds: number
  pct: number
  status: AttendanceStatus
  rejoins: number
}

export const DEFAULT_RULES: AttendanceRules = { presentPct: 80, lateMinutes: 15, absentBelowPct: 30 }

/** Session start/end as local Date objects. */
export function sessionWindow(t: AdminTraining) {
  return { start: new Date(`${t.date}T${t.startTime}:00`), end: new Date(`${t.date}T${t.endTime}:00`) }
}

/**
 * Classifies one participant. Order matters:
 * 1. Absent      – no record, or attended < absentBelowPct of the session
 * 2. Late        – first joined more than lateMinutes after the start
 * 3. Present     – attended ≥ presentPct
 * 4. Incomplete  – everything in between
 */
export function classify(t: AdminTraining, person: Person, record: AttendanceRecord | undefined, rules: AttendanceRules): AttendanceRow {
  const { start, end } = sessionWindow(t)
  const sessionSeconds = Math.max(1, (end.getTime() - start.getTime()) / 1000)
  if (!record || !record.attendanceIntervals.length) return { person, seconds: 0, pct: 0, status: 'Absent', rejoins: 0 }

  const joins = record.attendanceIntervals.map((i) => new Date(i.joinDateTime).getTime())
  const leaves = record.attendanceIntervals.map((i) => new Date(i.leaveDateTime).getTime())
  const join = new Date(Math.min(...joins))
  const leave = new Date(Math.max(...leaves))
  const seconds = record.totalAttendanceInSeconds
  const pct = Math.min(100, (seconds / sessionSeconds) * 100)
  const lateBy = (join.getTime() - start.getTime()) / 60000

  let status: AttendanceStatus
  if (pct < rules.absentBelowPct) status = 'Absent'
  else if (lateBy > rules.lateMinutes) status = 'Late'
  else if (pct >= rules.presentPct) status = 'Present'
  else status = 'Incomplete'

  return { person, record, join, leave, seconds, pct, status, rejoins: record.attendanceIntervals.length - 1 }
}

export function attendanceRows(t: AdminTraining, people: Person[], rules: AttendanceRules): AttendanceRow[] {
  const byEmail = new Map((t.attendance?.records ?? []).map((r) => [r.emailAddress.toLowerCase(), r]))
  return t.participantIds
    .map((pid) => people.find((p) => p.id === pid))
    .filter((p): p is Person => !!p)
    .map((p) => classify(t, p, byEmail.get(p.email.toLowerCase()), rules))
}

export const formatDuration = (seconds: number) => {
  // Round to whole minutes first so 7h 59m 40s shows as 8h 00m, not 7h 60m.
  const total = Math.round(seconds / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export const formatClock = (d?: Date) => (d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—')

/* --------------------------------- Providers --------------------------------- */

export type AttendanceProvider = {
  source: 'graph' | 'simulated'
  fetchAttendance: (t: AdminTraining, people: Person[]) => Promise<AttendanceRecord[]>
}

// Stable pseudo-random number per (training, person) so re-syncing gives the same result.
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  // Murmur3 finalizer: FNV alone barely changes the high bits for near-identical ids.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/**
 * Generates Graph-shaped attendance records for demos. Roughly: 70% on time, 12% late,
 * 10% leave early (some drop and rejoin), 8% never join.
 */
export function simulateAttendance(t: AdminTraining, people: Person[], now = Date.now()): AttendanceRecord[] {
  const { start, end } = sessionWindow(t)
  // While a session is running, attendance only goes up to "now".
  const cutoff = Math.min(end.getTime(), now)
  if (cutoff <= start.getTime()) return []
  const min = 60000

  const records: AttendanceRecord[] = []
  for (const pid of t.participantIds) {
    const p = people.find((x) => x.id === pid)
    if (!p) continue
    const r = hash(`${t.id}:${pid}`)
    const r2 = hash(`${pid}:${t.id}`)
    if (r < 0.08) continue // never joined

    let intervals: [number, number][]
    if (r < 0.78) {
      const j = start.getTime() + (r2 * 8 - 3) * min
      intervals = [[j, cutoff - r2 * 4 * min]]
    } else if (r < 0.9) {
      const j = start.getTime() + (16 + r2 * 40) * min
      intervals = [[j, cutoff - r2 * 3 * min]]
    } else {
      const j = start.getTime() + r2 * 6 * min
      // Leaves after 35–70% of the session; half of them rejoin briefly later.
      const length = end.getTime() - start.getTime()
      const dropAt = j + (0.35 + r2 * 0.35) * length
      intervals = r2 > 0.5 ? [[j, dropAt], [dropAt + 0.05 * length, dropAt + 0.12 * length]] : [[j, dropAt]]
    }

    const clamped = intervals
      .map(([a, b]) => [Math.max(a, start.getTime() - 5 * min), Math.min(b, cutoff)] as [number, number])
      .filter(([a, b]) => b > a)
    if (!clamped.length) continue
    const attendanceIntervals = clamped.map(([a, b]) => ({
      joinDateTime: new Date(a).toISOString(),
      leaveDateTime: new Date(b).toISOString(),
      durationInSeconds: Math.round((b - a) / 1000),
    }))
    records.push({
      emailAddress: p.email,
      displayName: p.name,
      role: 'Attendee',
      totalAttendanceInSeconds: attendanceIntervals.reduce((s, i) => s + i.durationInSeconds, 0),
      attendanceIntervals,
    })
  }
  return records
}

export const simulatedProvider: AttendanceProvider = {
  source: 'simulated',
  async fetchAttendance(t, people) {
    await new Promise((r) => setTimeout(r, 1200))
    return simulateAttendance(t, people)
  },
}

/**
 * Real Microsoft Graph provider.
 *
 * Calls (delegated permission OnlineMeetingArtifact.Read.All, organizer's context):
 *   GET /me/onlineMeetings/{meetingId}/attendanceReports
 *   GET /me/onlineMeetings/{meetingId}/attendanceReports/{reportId}?$expand=attendanceRecords
 *
 * `baseUrl` can be https://graph.microsoft.com/v1.0 (with a token from MSAL) or your own
 * backend proxy that adds the token server-side (recommended: keeps secrets off the browser
 * and allows app-only access via an application access policy).
 */
export function graphProvider(baseUrl: string, getToken?: () => Promise<string>): AttendanceProvider {
  const get = async <T>(path: string): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (getToken) headers.Authorization = `Bearer ${await getToken()}`
    const res = await fetch(`${baseUrl}${path}`, { headers })
    if (!res.ok) throw new Error(`Microsoft Graph returned ${res.status} ${res.statusText}`)
    return res.json()
  }

  return {
    source: 'graph',
    async fetchAttendance(t) {
      if (!t.teamsMeeting?.meetingId) throw new Error('This training has no Teams meeting ID.')
      const id = encodeURIComponent(t.teamsMeeting.meetingId)
      const reports = await get<{ value: { id: string; meetingStartDateTime: string }[] }>(`/me/onlineMeetings/${id}/attendanceReports`)
      // A recurring meeting has one report per occurrence; take the one for this training's date.
      const report = reports.value.find((r) => r.meetingStartDateTime.startsWith(t.date)) ?? reports.value[0]
      if (!report) return []
      const full = await get<{ attendanceRecords: (AttendanceRecord & { identity?: { displayName?: string } })[] }>(
        `/me/onlineMeetings/${id}/attendanceReports/${encodeURIComponent(report.id)}?$expand=attendanceRecords`,
      )
      return full.attendanceRecords.map((r) => ({ ...r, displayName: r.displayName ?? r.identity?.displayName ?? r.emailAddress }))
    },
  }
}

/** Uses the real Graph provider when VITE_GRAPH_BASE_URL is set, otherwise simulated data. */
export function getAttendanceProvider(): AttendanceProvider {
  const base = import.meta.env.VITE_GRAPH_BASE_URL as string | undefined
  return base ? graphProvider(base) : simulatedProvider
}

export const isDemoMeeting = (url: string) => url.includes('DEMO')

export const demoMeeting = (trainingId: string) => ({
  meetingId: `MSo1N2Y5ZGFjYy03MWJmLTQ3NDMtYjQxMy01M2EdemQ${trainingId}`,
  joinUrl: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_DEMO${trainingId}%40thread.v2/0`,
})
