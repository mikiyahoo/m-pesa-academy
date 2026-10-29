import type { AdminTraining, Checkin, CheckinStatus } from '../types'

/**
 * Check-in logic (TE-5.1, URS 2.7, URS 3.3).
 * The learner portal records a check-in; admins start a session, share a
 * rotating QR / unique link, mark people manually or in bulk, and verify
 * manual entries.
 */

/** Present when checked in within the late window after the start, Late after it. */
export function statusFor(training: AdminTraining, at: string, lateMinutes: number): CheckinStatus {
  const start = new Date(`${training.date}T${training.startTime}:00`).getTime()
  const late = (new Date(at).getTime() - start) / 60000
  return late > lateMinutes ? 'Late' : 'Present'
}

/** Adds a check-in; duplicates per person are rejected (URS 3.3 "no double entries"). */
export function addCheckin(checkins: Checkin[], entry: Checkin): Checkin[] {
  if (checkins.some((c) => c.personId === entry.personId)) return checkins
  return [...checkins, entry]
}

/** FNV-1a hash, base36 — stable, short token material. */
function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0).toString(36)
}

/** The QR payload token; changes every 10 s so a screenshot goes stale. */
export function rotatingToken(sessionToken: string, now = Date.now()): string {
  return hash(`${sessionToken}:${Math.floor(now / 10_000)}`)
}

/** One QR for the whole session: it only works while attendance is open, and each person can check in once. */
export function fixedToken(sessionToken: string): string {
  return hash(sessionToken)
}

/** The unique link a participant opens to check in. */
export function checkinLink(trainingId: string, token: string): string {
  return `${window.location.origin}/checkin/${trainingId}?t=${token}`
}

/** Seconds until the rotating token changes (for the countdown ring). */
export function tokenCountdown(now = Date.now()): number {
  return 10 - Math.floor((now / 1000) % 10)
}
