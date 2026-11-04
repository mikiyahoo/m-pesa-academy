/**
 * Profile change requests from company staff. Their details come from the company directory, so
 * changes go to the training admins as an email-style request and apply only once approved.
 * Passwords are kept here too (demo only — a real system stores hashes on the server).
 */

export type ProfileField = 'name' | 'email' | 'phone' | 'role'

export type ProfileChange = { field: ProfileField; label: string; from: string; to: string }

export type ProfileRequest = {
  id: string
  /** Email the person signs in with when they asked. */
  personEmail: string
  personName: string
  changes: ProfileChange[]
  subject: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  /** Reason shown to the person when declined. */
  note?: string
  /** Set once the approved details reached the person's own session. */
  appliedAt?: string
}

const KEY = 'mpesa-learning:profile-requests'
const PASSWORDS_KEY = 'mpesa-learning:passwords'
const CHANGE = 'mpesa-profile-requests-change'

export function loadProfileRequests(): ProfileRequest[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(list: ProfileRequest[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked.
  }
  window.dispatchEvent(new Event(CHANGE))
}

export function onProfileRequestsChange(fn: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && fn()
  window.addEventListener(CHANGE, fn)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE, fn)
    window.removeEventListener('storage', onStorage)
  }
}

export function submitProfileRequest(r: Omit<ProfileRequest, 'id' | 'status' | 'createdAt'>): ProfileRequest {
  // A newer request replaces an older pending one from the same person.
  const request: ProfileRequest = { ...r, id: `pr-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() }
  save([request, ...loadProfileRequests().filter((x) => !(x.status === 'pending' && same(x.personEmail, r.personEmail)))])
  return request
}

export function updateProfileRequest(id: string, patch: Partial<ProfileRequest>) {
  save(loadProfileRequests().map((r) => (r.id === id ? { ...r, ...patch } : r)))
}

export function cancelProfileRequest(id: string) {
  save(loadProfileRequests().filter((r) => r.id !== id))
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The latest request a person made (matched on either their old or their new email). */
export const myLatestRequest = (email: string) =>
  loadProfileRequests().find((r) => same(r.personEmail, email) || r.changes.some((c) => c.field === 'email' && same(c.to, email)))

/* -------------------------------- Passwords -------------------------------- */

function passwords(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PASSWORDS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** The password set for this account, if the person has changed it. */
export const customPassword = (email: string): string | undefined => passwords()[email.trim().toLowerCase()]

export function setPassword(email: string, password: string) {
  try {
    localStorage.setItem(PASSWORDS_KEY, JSON.stringify({ ...passwords(), [email.trim().toLowerCase()]: password }))
  } catch {
    // Storage full or blocked.
  }
}

/** Minimum rules for a new password; returns the first unmet rule, or null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) return 'Mix upper- and lower-case letters.'
  if (!/\d/.test(pw)) return 'Add at least one number.'
  return null
}

/** Sign-in email after an approved email change maps back to the account's original email. */
export function originalEmail(email: string): string {
  const id = email.trim().toLowerCase()
  const approved = loadProfileRequests().find((r) => r.status === 'approved' && r.changes.some((c) => c.field === 'email' && same(c.to, id)))
  return approved ? approved.personEmail.toLowerCase() : id
}

/** A user with every approved change applied, oldest first. */
export function approvedDetails<U extends { name: string; email: string; phone: string; role: string }>(user: U): U {
  const mine = loadProfileRequests()
    .filter((r) => r.status === 'approved' && same(r.personEmail, user.email))
    .reverse()
  return mine.reduce((u, r) => r.changes.reduce((acc, c) => ({ ...acc, [c.field]: c.to }), u), user)
}
