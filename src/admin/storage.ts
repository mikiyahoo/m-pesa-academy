import { seedAdminData } from './seed'
import type { AdminData } from './types'
import { currentUser, LEARNER_GROUP_IDS } from '../data/trainings'
import { DEMO_LEARNER_ID } from '../lib/learner'

/**
 * The prototype keeps all admin data in this browser's localStorage. It's read outside the
 * admin store too (e.g. the invite sign-in page runs before anyone is logged in).
 * Bump the version when the data shape changes so old browser data is replaced by the new seed.
 */
export const ADMIN_STORAGE_KEY = 'mpesa-learning:admin:v8'

/** The learner portal's demo account as an admin person (group ISON), so admins can invite and assign them. */
function withDemoLearner(data: AdminData): AdminData {
  if (data.people.some((p) => p.id === DEMO_LEARNER_ID)) return data
  return {
    ...data,
    people: [
      {
        id: DEMO_LEARNER_ID,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        role: 'Participant',
        status: 'Active',
        department: 'Agent Relations',
        designation: currentUser.role,
        groupIds: [...LEARNER_GROUP_IDS],
        createdAt: '2026-01-10',
      },
      ...data.people,
    ],
  }
}

export const freshAdminData = () => withDemoLearner(seedAdminData())

export function loadAdminData(): AdminData {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (raw) return withDemoLearner(JSON.parse(raw))
  } catch {
    // Fall through to seed data.
  }
  return withDemoLearner(seedAdminData())
}

/** Fired after admin data is saved, so the learner portal can pick up newly scheduled trainings. */
export const ADMIN_SAVED_EVENT = 'mpesa-learning:admin-saved'

export function saveAdminData(data: AdminData) {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage may be unavailable; changes stay in memory.
  }
  window.dispatchEvent(new Event(ADMIN_SAVED_EVENT))
}
