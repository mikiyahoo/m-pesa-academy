import { loadAdminData } from '../admin/storage'
import { currentUser, LEARNER_GROUP_IDS } from '../data/trainings'
import type { User } from '../types'

/**
 * Who is learning right now. Progress, favourites, read notifications and assignment status
 * are kept per person, so two accounts on the same browser don't share them.
 * The original demo learner keeps the unsuffixed storage keys (and the seeded progress).
 */

/** The demo learner's id in admin data (people, assignments, training participants). */
export const DEMO_LEARNER_ID = 'learner-demo'

export type LearnerIdentity = { personId: string; name: string; email: string; groupIds: string[]; demo: boolean }

const DEMO: LearnerIdentity = { personId: DEMO_LEARNER_ID, name: currentUser.name, email: currentUser.email, groupIds: LEARNER_GROUP_IDS, demo: true }

export function resolveLearner(user?: User, personId?: string): LearnerIdentity {
  if (!user || user.email.toLowerCase() === currentUser.email.toLowerCase()) return DEMO
  const person = loadAdminData().people.find((p) => p.id === personId || p.email.toLowerCase() === user.email.toLowerCase())
  return { personId: person?.id ?? `u-${user.email.toLowerCase()}`, name: user.name, email: user.email, groupIds: person?.groupIds ?? [], demo: false }
}

let active: LearnerIdentity = DEMO

/** Set by the app store whenever the signed-in person changes. */
export const setActiveLearner = (l: LearnerIdentity) => {
  active = l
}
export const activeLearner = () => active

/** Storage key for the active learner: the base key for the demo learner, suffixed for everyone else. */
export const scopedKey = (base: string) => (active.demo ? base : `${base}:${active.personId}`)
