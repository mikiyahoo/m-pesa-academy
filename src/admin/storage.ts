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
const ASSIGNMENT_SAMPLE_MIGRATION_KEY = 'mpesa-learning:assignment-samples:v1'

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

/** Restore the two seeded pending-request examples (r1 and r5) so the admin always has 2 pending requests to review. */
const PENDING_REQUEST_SAMPLE_MIGRATION_KEY = 'mpesa-learning:pending-request-samples:v2'
function withPendingRequestSamples(data: AdminData): AdminData {
  try {
    const pendingCount = data.requests.filter((r) => r.status === 'PENDING').length
    const alreadyRun = localStorage.getItem(PENDING_REQUEST_SAMPLE_MIGRATION_KEY) === 'done'
    if (alreadyRun && pendingCount >= 2) return data

    const samples = new Map(seedAdminData().requests.filter((request) => request.id === 'r1' || request.id === 'r5').map((request) => [request.id, request]))
    let changed = false
    const requests = data.requests.map((request) => {
      const sample = samples.get(request.id)
      if (!sample || request.status === 'PENDING') return request
      changed = true
      return {
        ...request,
        status: 'PENDING' as const,
        trainerId: undefined,
        trainerIds: undefined,
        trainingId: undefined,
        joinLink: undefined,
        rejection: undefined,
        history: sample.history,
      }
    })
    localStorage.setItem(PENDING_REQUEST_SAMPLE_MIGRATION_KEY, 'done')
    return changed ? { ...data, requests } : data
  } catch {
    return data
  }
}

/** Add demo reading assignments once for existing browser profiles that predate assignment samples. */
function withSampleAssignments(data: AdminData): AdminData {
  try {
    if (localStorage.getItem(ASSIGNMENT_SAMPLE_MIGRATION_KEY) === 'done') return data

    const assigned = (material: AdminData['materials'][number]) => !!(material.assignedGroupIds?.length || material.assignedPersonIds?.length)
    const alreadyAssigned = data.materials.filter(assigned).length
    let remaining = Math.max(0, 3 - alreadyAssigned)
    if (!remaining) {
      localStorage.setItem(ASSIGNMENT_SAMPLE_MIGRATION_KEY, 'done')
      return data
    }

    const samples = new Map(seedAdminData().materials.filter(assigned).map((material) => [material.id, material]))
    const materials = data.materials.map((material) => {
      if (!remaining || assigned(material)) return material
      const sample = samples.get(material.id)
      if (!sample) return material
      remaining -= 1
      return {
        ...material,
        assignedGroupIds: sample.assignedGroupIds,
        assignedPersonIds: sample.assignedPersonIds,
        dueDate: sample.dueDate,
        requiresAck: sample.requiresAck,
        assignedAt: sample.assignedAt,
        assignmentProgress: sample.assignmentProgress,
      }
    })
    localStorage.setItem(ASSIGNMENT_SAMPLE_MIGRATION_KEY, 'done')
    return { ...data, materials }
  } catch {
    return data
  }
}

export function loadAdminData(): AdminData {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (raw) return withSampleAssignments(withPendingRequestSamples(withDemoLearner(JSON.parse(raw))))
  } catch {
    // Fall through to seed data.
  }
  return withSampleAssignments(withPendingRequestSamples(withDemoLearner(seedAdminData())))
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
