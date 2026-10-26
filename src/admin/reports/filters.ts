import { useSearchParams } from 'react-router-dom'
import { trainerIdsOf } from '../scheduling'
import type { AdminData, AdminTraining, Person, TrainingStatus } from '../types'

/** One half of a date range (ISO date, e.g. `2026-10-01`). */
export type DateRange = { from: string; to: string }

export type ReportFilters = {
  from: string
  to: string
  typeId: string
  groupId: string
  region: string
  trainerId: string
  status: '' | TrainingStatus
  delivery: '' | 'Online' | 'Physical'
}

const KEYS: (keyof ReportFilters)[] = ['from', 'to', 'typeId', 'groupId', 'region', 'trainerId', 'status', 'delivery']

/** Report filters kept in the URL so a filtered report can be bookmarked or shared (D02). */
export function useReportFilters() {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])) as ReportFilters
  const set = (patch: Partial<ReportFilters>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const clear = () => {
    const next = new URLSearchParams(params)
    KEYS.forEach((k) => next.delete(k))
    setParams(next, { replace: true })
  }
  const active = KEYS.filter((k) => filters[k]).length
  return { filters, set, clear, active }
}

/** Whether a date is inside an open range (inclusive; empty bounds mean "no limit"). */
export function isInRange(date: string, range: DateRange) {
  if (!range.from && !range.to) return true
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

/** Trainings filtered by the date range. Matches `filterTrainings` semantics: empty bounds = "all". */
export function filterTrainingsByDate(data: AdminData, range: DateRange, base: AdminTraining[] = data.trainings) {
  return base.filter((t) => isInRange(t.date, range))
}

/** Participant ids of a training that fall inside the date range. */
export function filteredParticipantsByDate(_: AdminData, t: AdminTraining, range: DateRange) {
  return t.participantIds.filter((pid) => {
    // Only keep participants whose own activity (check-ins/feedback) overlaps the range.
    const activity = t.checkins?.filter((c) => c.personId === pid)
    return activity?.some((c) => isInRange(c.at, range)) ?? isInRange(t.date, range)
  })
}

/** Audit logs scoped to the date range. */
export function filterActivityLogs(data: AdminData, range: DateRange) {
  return data.auditLogs.filter((l) => isInRange(l.at, range))
}

/** People matching the team / region filters. */
export function personMatches(p: Person | undefined, f: ReportFilters) {
  if (!p) return false
  if (f.groupId && !p.groupIds.includes(f.groupId)) return false
  if (f.region && p.region !== f.region) return false
  return true
}

/** Trainings matching the filters; team and region keep trainings that include at least one matching participant. */
export function filterTrainings(data: AdminData, f: ReportFilters, base: AdminTraining[] = data.trainings) {
  return base.filter((t) => {
    if (f.from && t.date < f.from) return false
    if (f.to && t.date > f.to) return false
    if (f.typeId && t.typeId !== f.typeId) return false
    if (f.trainerId && !trainerIdsOf(t).includes(f.trainerId)) return false
    if (f.status && t.status !== f.status) return false
    if (f.delivery && (t.delivery ?? (t.location === 'ONLINE' ? 'Online' : 'Physical')) !== f.delivery) return false
    if (f.groupId || f.region) return t.participantIds.some((pid) => personMatches(data.people.find((p) => p.id === pid), f))
    return true
  })
}

/** Participant ids of a training that pass the team / region filters. */
export function filteredParticipants(data: AdminData, t: AdminTraining, f: ReportFilters) {
  if (!f.groupId && !f.region) return t.participantIds
  return t.participantIds.filter((pid) => personMatches(data.people.find((p) => p.id === pid), f))
}

export const monthKey = (iso: string) => iso.slice(0, 7)
export const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
