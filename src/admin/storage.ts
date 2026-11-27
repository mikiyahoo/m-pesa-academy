import { seedAdminData } from './seed'
import type { AdminData } from './types'
import { currentUser, departmentAdminUser, LEARNER_GROUP_IDS } from '../data/trainings'
import { DEMO_LEARNER_ID } from '../lib/learner'

/**
 * The prototype keeps all admin data in this browser's localStorage. It's read outside the
 * admin store too (e.g. the invite sign-in page runs before anyone is logged in).
 * Bump the version when the data shape changes so old browser data is replaced by the new seed.
 */
export const ADMIN_STORAGE_KEY = 'mpesa-learning:admin:v8'
const ASSIGNMENT_SAMPLE_MIGRATION_KEY = 'mpesa-learning:assignment-samples:v2'

/** The learner portal's demo account as an admin person (group ISON), so admins can invite and assign them. */
/** Demo department admin (Enterprise) so the role can be tried without setting it up first. */
export const DEMO_DEPARTMENT_ADMIN_ID = 'dept-admin-demo'
/** Demo: when no training is public or run by a department yet, a few get one so the Visibility page has all three kinds. */
function withSampleVisibility(data: AdminData): AdminData {
  if (data.trainings.some((t) => t.isPublic || t.department)) return data
  const pool = data.trainings.filter((t) => t.status === 'SCHEDULED' && t.id !== 'qr-demo-today')
  const picks: Partial<AdminData['trainings'][number]>[] = [{ isPublic: true }, { isPublic: true }, { department: 'Enterprise' }, { department: 'Enterprise' }, { department: 'Retail' }]
  const byId = new Map(pool.slice(0, picks.length).map((t, i) => [t.id, picks[i]]))
  if (!byId.size) return data
  return { ...data, trainings: data.trainings.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)) }
}

/** Demo: when no training has additional materials yet, a few of the demo learner's trainings get some. */
function withSampleExtraMaterials(data: AdminData): AdminData {
  if (data.trainings.some((t) => t.extraMaterialIds?.length)) return data
  const picks = [['mat6', 'mat8'], ['mat5'], ['mat4', 'mat1']]
  const targets = data.trainings.filter((t) => t.participantIds?.includes(DEMO_LEARNER_ID) && t.id !== 'qr-demo-today').slice(0, picks.length)
  if (!targets.length) return data
  const ids = new Map(targets.map((t, i) => [t.id, picks[i].filter((m) => data.materials.some((x) => x.id === m))]))
  return { ...data, trainings: data.trainings.map((t) => (ids.get(t.id)?.length ? { ...t, extraMaterialIds: ids.get(t.id) } : t)) }
}

const QR_DEMO_ID = 'qr-demo-today'

/**
 * Demo: an in-person session later today that hasn't started, with the demo trainee and trainer on it,
 * so opening the check-in QR (admin or trainer) can be tried end to end. It moves to today again
 * on a later day as long as no one has checked in yet.
 */
function withQrDemoTraining(data: AdminData): AdminData {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  // Starts at the next full hour (at the latest 21:00), runs two hours.
  const startHour = Math.min(now.getHours() + 1, 21)
  const startTime = `${pad(startHour)}:00`
  const endTime = `${pad(startHour + 2)}:00`
  const existing = data.trainings.find((t) => t.id === QR_DEMO_ID)
  if (existing) {
    if (existing.date >= today || existing.checkins?.length || existing.checkinSession) return data
    return { ...data, trainings: data.trainings.map((t) => (t.id === QR_DEMO_ID ? { ...t, date: today, startTime, endTime, status: 'SCHEDULED' } : t)) }
  }
  const journey = data.journeys[0]
  const others = data.people.filter((p) => p.role === 'Participant' && p.id !== DEMO_LEARNER_ID && p.status === 'Active').slice(0, 4).map((p) => p.id)
  return {
    ...data,
    trainings: [
      {
        id: QR_DEMO_ID,
        name: 'Demo: In-person check-in practice',
        typeId: data.trainingTypes[0]?.id ?? '',
        journeyId: journey?.id,
        trainerId: 's3',
        trainerIds: ['s3'],
        date: today,
        startTime,
        endTime,
        location: 'Addis Ababa HQ — Hall B',
        delivery: 'Physical',
        categoryId: data.categories[0]?.id,
        level: 'Beginner',
        description: 'Open the check-in QR as the trainer or admin, then check in from the trainee course page.',
        status: 'SCHEDULED',
        participantIds: [DEMO_LEARNER_ID, ...others],
        feedbackFormId: data.feedbackForms[0]?.id,
        inviteLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${QR_DEMO_ID}-demo`,
        history: [{ at: `${today}T08:00:00`, by: 'Training team', action: 'Created' }],
        progress: {},
      } as AdminData['trainings'][number],
      ...data.trainings,
    ],
  }
}

function withDemoDepartmentAdmin(data: AdminData): AdminData {
  if (data.people.some((p) => p.id === DEMO_DEPARTMENT_ADMIN_ID)) return data
  return {
    ...data,
    people: [
      ...data.people,
      {
        id: DEMO_DEPARTMENT_ADMIN_ID,
        name: departmentAdminUser.name,
        email: departmentAdminUser.email,
        phone: departmentAdminUser.phone,
        role: 'Department Admin',
        status: 'Active',
        department: 'Enterprise',
        designation: 'Enterprise Training Lead',
        groupIds: [],
        createdAt: '2026-01-12',
      },
    ],
  }
}

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
    const learner = data.people.find((person) => person.id === DEMO_LEARNER_ID)
    const learnerGroups = new Set([...(learner?.groupIds ?? []), ...LEARNER_GROUP_IDS])
    const learnerHasAssignment = (material: AdminData['materials'][number]) =>
      material.assignedPersonIds?.includes(DEMO_LEARNER_ID) || material.assignedGroupIds?.some((id) => learnerGroups.has(id))
    const alreadyAssigned = data.materials.filter(assigned).length
    let remaining = Math.max(0, 3 - alreadyAssigned)
    const samples = new Map(seedAdminData().materials.filter(assigned).map((material) => [material.id, material]))
    let materials = data.materials.map((material) => {
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
    if (!materials.some(learnerHasAssignment)) {
      const sample = samples.get('mat1')
      if (sample) {
        materials = materials.map((material) => material.id !== sample.id ? material : {
          ...material,
          assignedGroupIds: [...new Set([...(material.assignedGroupIds ?? []), ...(sample.assignedGroupIds ?? [])])],
          assignedPersonIds: [...new Set([...(material.assignedPersonIds ?? []), DEMO_LEARNER_ID])],
          dueDate: material.dueDate ?? sample.dueDate,
          requiresAck: material.requiresAck ?? sample.requiresAck,
          assignedAt: material.assignedAt ?? sample.assignedAt,
          assignmentProgress: material.assignmentProgress ?? sample.assignmentProgress,
        })
      }
    }
    localStorage.setItem(ASSIGNMENT_SAMPLE_MIGRATION_KEY, 'done')
    const migrated = { ...data, materials }
    // Persist the one-time migration. Otherwise the next read would see the completion
    // marker but load the old assignments from storage and the learner tab would be empty.
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return data
  }
}

const AUDIT_ID_PATTERN = /^AUD-\d{13}-[A-Z0-9]{6}$/i

/** Migrate legacy/mixed audit IDs once into one stable format without changing entity references. */
function withConsistentAuditIds(data: AdminData): AdminData {
  const used = new Set<string>()
  let next = 1
  let changed = false
  const auditLogs = data.auditLogs.map((log) => {
    const currentId = typeof log.id === 'string' ? log.id.toUpperCase() : ''
    if (AUDIT_ID_PATTERN.test(currentId) && !used.has(currentId)) {
      used.add(currentId)
      if (log.id !== currentId) changed = true
      return log.id === currentId ? log : { ...log, id: currentId }
    }
    let id: string
    do {
      const serial = String(next++).padStart(13, '0')
      id = `AUD-${serial}-${serial.slice(-6)}`
    } while (used.has(id))
    used.add(id)
    changed = true
    return { ...log, id }
  })
  if (!changed) return data
  const migrated = { ...data, auditLogs }
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(migrated))
  } catch {
    // Keep normalized IDs in memory when storage is unavailable.
  }
  return migrated
}

export function loadAdminData(): AdminData {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY)
    if (raw) return withConsistentAuditIds(withSampleVisibility(withSampleExtraMaterials(withQrDemoTraining(withDemoDepartmentAdmin(withSampleAssignments(withPendingRequestSamples(withDemoLearner(JSON.parse(raw)))))))))
  } catch {
    // Fall through to seed data.
  }
  return withConsistentAuditIds(withSampleVisibility(withSampleExtraMaterials(withQrDemoTraining(withDemoDepartmentAdmin(withSampleAssignments(withPendingRequestSamples(withDemoLearner(seedAdminData()))))))))
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
