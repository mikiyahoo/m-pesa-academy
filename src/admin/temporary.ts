import { parseDate, todayISO } from '../lib/utils'
import { isInternalEmail } from './requests'
import type { AdminTraining, Person } from './types'

export type AccessState = 'pending' | 'scheduled' | 'active' | 'expiring' | 'expired' | 'revoked'

/** Days left before access ends that count as "expiring soon". */
export const EXPIRING_DAYS = 7

/** Default access window: from today until 30 days after the person's last training (A10). */
export const DEFAULT_GRACE_DAYS = 30

export const isTemporary = (p: Pick<Person, 'email'>) => !isInternalEmail(p.email)

const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)

export function addDays(iso: string, n: number) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function accessState(p: Person, today = todayISO()): AccessState {
  if (p.revokedAt || p.status === 'Inactive') return 'revoked'
  if (p.accessEnd && p.accessEnd < today) return 'expired'
  if (p.accessStart && p.accessStart > today) return 'scheduled'
  if (!p.acceptedAt) return 'pending'
  if (p.accessEnd && daysBetween(today, p.accessEnd) <= EXPIRING_DAYS) return 'expiring'
  return 'active'
}

export const accessLabel: Record<AccessState, string> = {
  pending: 'Invited',
  scheduled: 'Starts later',
  active: 'Active',
  expiring: 'Expiring soon',
  expired: 'Expired',
  revoked: 'Revoked',
}

export const daysLeft = (p: Person, today = todayISO()) => (p.accessEnd ? daysBetween(today, p.accessEnd) : null)

/** Why a temporary user can't sign in right now, or null if they can. */
export function accessBlock(p: Person, today = todayISO()): string | null {
  const fmt = (iso: string) => parseDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  if (p.revokedAt || p.status === 'Inactive') return 'Your access to M-PESA Academy has been removed. Contact the trainer who invited you.'
  if (p.accessStart && p.accessStart > today) return `Your access starts on ${fmt(p.accessStart)}. Come back then using the same link.`
  if (p.accessEnd && p.accessEnd < today) return `Your access ended on ${fmt(p.accessEnd)}. Ask your trainer to extend it if you still need your records.`
  return null
}

export const makeInviteToken = () => `inv-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`
export const acceptLink = (token: string) => `${window.location.origin}/accept/${token}`

/** Trainings a person is enrolled in (used for the invite page and default expiry). */
export const trainingsFor = (personId: string, trainings: AdminTraining[]) => trainings.filter((t) => t.participantIds.includes(personId) && t.status !== 'CANCELLED')

/** Profile fields TE-1.1 marks mandatory, plus email from sign-in. */
export const PROFILE_FIELDS = [
  { key: 'designation', label: 'Role / designation' },
  { key: 'organization', label: 'Organisation / team' },
  { key: 'department', label: 'Department' },
  { key: 'region', label: 'Location / region' },
] as const

export const missingProfile = (p: Person) => PROFILE_FIELDS.filter((f) => !String(p[f.key] ?? '').trim())

export const REGIONS = ['Addis Ababa', 'Amhara', 'Oromia', 'Sidama', 'Tigray', 'Afar', 'Somali', 'SNNP', 'Dire Dawa', 'Harari', 'Benishangul-Gumuz', 'Gambela', 'South West']
