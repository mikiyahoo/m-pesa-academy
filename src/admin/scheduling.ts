import { parseDate } from '../lib/utils'
import type { AdminTraining, Person, Recurrence, TrainingLevel } from './types'

export const LEVELS: TrainingLevel[] = ['Novice', 'Beginner', 'Intermediate', 'Advanced']

/** Dropdown for reschedule / cancel / delegation; "Other" asks for a custom reason (URS 2.3). */
export const CHANGE_REASONS = [
  'Trainer unavailable',
  'Venue unavailable',
  'Low confirmed attendance',
  'Requested by the business team',
  'Public holiday',
  'Technical issues',
  'Other',
] as const

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Safety cap so a long or daily rule can't create hundreds of sessions by accident. */
export const MAX_OCCURRENCES = 52

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Same date and the time ranges overlap (touching end/start doesn't count). */
export const overlaps = (a: Pick<AdminTraining, 'date' | 'startTime' | 'endTime'>, b: Pick<AdminTraining, 'date' | 'startTime' | 'endTime'>) =>
  a.date === b.date && minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime)

export type Conflict = {
  kind: 'trainer' | 'trainee'
  training: AdminTraining
  /** Affected trainees for a trainee overlap. */
  people: Person[]
}

/**
 * Trainer double-bookings and trainees in two sessions at once (TR-2.1, URS 2.3).
 * Cancelled sessions never conflict.
 */
export function findConflicts(
  candidate: Pick<AdminTraining, 'date' | 'startTime' | 'endTime' | 'trainerId' | 'participantIds'> & { id?: string },
  trainings: AdminTraining[],
  people: Person[],
): Conflict[] {
  const out: Conflict[] = []
  for (const t of trainings) {
    if (t.id === candidate.id || t.status === 'CANCELLED' || !overlaps(candidate, t)) continue
    if (candidate.trainerId && t.trainerId === candidate.trainerId) out.push({ kind: 'trainer', training: t, people: [] })
    const shared = candidate.participantIds.filter((pid) => t.participantIds.includes(pid))
    if (shared.length) out.push({ kind: 'trainee', training: t, people: shared.map((pid) => people.find((p) => p.id === pid)).filter((p): p is Person => !!p) })
  }
  return out
}

/** Every training that currently clashes with something, for badges in lists and the calendar. */
export function conflictIndex(trainings: AdminTraining[], people: Person[]) {
  const map = new Map<string, Conflict[]>()
  for (const t of trainings) {
    if (t.status === 'CANCELLED') continue
    const c = findConflicts(t, trainings, people)
    if (c.length) map.set(t.id, c)
  }
  return map
}

/** Dates produced by a repeat rule, starting with (and including) the first session's date. */
export function occurrenceDates(start: string, rule: Recurrence): string[] {
  const first = parseDate(start)
  const until = parseDate(rule.until)
  const dates: string[] = []
  const step = Math.max(1, rule.interval)
  if (rule.freq === 'daily') {
    for (let d = new Date(first); d <= until && dates.length < MAX_OCCURRENCES; d.setDate(d.getDate() + step)) dates.push(toISO(d))
  } else if (rule.freq === 'weekly') {
    const days = rule.weekdays.length ? [...rule.weekdays].sort() : [first.getDay()]
    // Walk week by week from the Sunday of the first week.
    const weekStart = new Date(first)
    weekStart.setDate(first.getDate() - first.getDay())
    for (let w = new Date(weekStart); w <= until && dates.length < MAX_OCCURRENCES; w.setDate(w.getDate() + 7 * step)) {
      for (const wd of days) {
        const d = new Date(w)
        d.setDate(w.getDate() + wd)
        if (d >= first && d <= until && dates.length < MAX_OCCURRENCES) dates.push(toISO(d))
      }
    }
  } else {
    // Monthly on the same day of the month; months without that day are skipped.
    for (let i = 0; dates.length < MAX_OCCURRENCES; i += step) {
      const d = new Date(first.getFullYear(), first.getMonth() + i, first.getDate())
      if (d > until) break
      if (d.getDate() === first.getDate()) dates.push(toISO(d))
    }
  }
  return dates
}

/** "Every week on Tuesday and Friday until Nov 30, 2026" */
export function describeRecurrence(rule: Recurrence, start?: string) {
  const every = (unit: string) => (rule.interval > 1 ? `Every ${rule.interval} ${unit}s` : `Every ${unit}`)
  const until = parseDate(rule.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (rule.freq === 'daily') return `${every('day')} until ${until}`
  if (rule.freq === 'weekly') {
    const days = (rule.weekdays.length ? rule.weekdays : start ? [parseDate(start).getDay()] : []).map((d) => WEEKDAY_NAMES[d])
    const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days.at(-1)}` : days[0]
    return `${every('week')} on ${list} until ${until}`
  }
  return `${every('month')} on day ${start ? parseDate(start).getDate() : ''} until ${until}`
}

export const sessionMinutes = (t: Pick<AdminTraining, 'startTime' | 'endTime'>) => Math.max(0, minutes(t.endTime) - minutes(t.startTime))

export const makeInviteLink = (trainingId: string) => `${window.location.origin}/invite/${trainingId}-${Math.random().toString(36).slice(2, 8)}`
