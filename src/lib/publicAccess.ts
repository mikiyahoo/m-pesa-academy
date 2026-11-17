import { addDays, isTemporary } from '../admin/temporary'
import { EMAIL_RE } from '../admin/requests'
import type { AdminData, Person, PublicAccessSettings } from '../admin/types'
import type { Training } from '../types'
import { localISO, todayISO } from './utils'

/**
 * Guest access: people outside the company can sign up themselves and see public trainings
 * (plus anything they were invited to). Invited temporary trainees get the same limited list.
 */

export const DEFAULT_PUBLIC_ACCESS: PublicAccessSettings = { enabled: true, accessDays: 90 }

export const publicAccessSettings = (data: AdminData): PublicAccessSettings => ({ ...DEFAULT_PUBLIC_ACCESS, ...data.publicAccess })

/** External = not on a company domain (invited temporary trainees and self sign-up guests). */
export const isExternalPerson = (data: AdminData, personId?: string) => {
  const person = personId ? data.people.find((p) => p.id === personId) : undefined
  return !!person && isTemporary(person)
}

export const isGuest = (p: Pick<Person, 'source'>) => p.source === 'self-signup'

/** Built-in trainings an external learner may see: only the public ones. */
export const trainingsForExternal = (all: Training[]) => all.filter((t) => t.isPublic)

export type GuestSignUp = {
  name: string
  email: string
  phone: string
  organization: string
  designation: string
  region: string
}

export type GuestSignUpErrors = Partial<Record<keyof GuestSignUp | 'form', string>>

const PHONE_RE = /^(\+?251|0)?[79]\d{8}$/

export function validateGuest(form: GuestSignUp, data: AdminData): GuestSignUpErrors {
  const errors: GuestSignUpErrors = {}
  if (!publicAccessSettings(data).enabled) errors.form = 'Sign-up is currently closed. Ask the training team for an invite.'
  if (form.name.trim().split(/\s+/).length < 2) errors.name = 'Enter your first and last name.'
  const email = form.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.'
  else if (!isTemporary({ email })) errors.email = 'Company staff sign in with their work account instead.'
  else if (data.people.some((p) => p.email.toLowerCase() === email)) errors.email = 'An account already exists for this email. Sign in with a code instead.'
  // The mobile number is added on first sign-in (profile setup); check it only if given here.
  if (form.phone.trim() && !PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))) errors.phone = 'Enter the 9 digits after +251, starting with 9 or 7 (e.g. 912345678).'
  // Organisation, role and region are asked for on first sign-in (profile setup), not here.
  return errors
}

/** Adds the guest to the people list with a time-limited access window. */
export function createGuest(data: AdminData, form: GuestSignUp): { data: AdminData; person: Person } {
  const today = todayISO()
  const at = localISO()
  const name = form.name.trim().replace(/\s+/g, ' ')
  const { accessDays } = publicAccessSettings(data)
  const person: Person = {
    id: `g-${Math.random().toString(36).slice(2, 10)}`,
    name,
    email: form.email.trim().toLowerCase(),
    // Stored in the local 0… form so sign-in matches it however the number is typed.
    phone: form.phone.trim() ? `0${form.phone.replace(/[\s-]/g, '').replace(/^(\+?251|0)/, '')}` : '',
    role: 'Participant',
    status: 'Active',
    department: 'External',
    groupIds: [],
    createdAt: today,
    designation: form.designation.trim() || undefined,
    organization: form.organization.trim() || undefined,
    region: form.region || undefined,
    createdBy: 'Self sign-up',
    source: 'self-signup',
    accessStart: today,
    accessEnd: addDays(today, accessDays),
    accessHistory: [{ at, by: name, change: `Signed up as a guest · ${accessDays} days of access` }],
  }
  const log = { id: `al-${Math.random().toString(36).slice(2, 10)}`, actor: person.name, action: 'Guest signed up', target: person.name, at, entityId: person.id, entityType: 'Person' }
  return { data: { ...data, people: [...data.people, person], auditLogs: [log, ...data.auditLogs] }, person }
}
