import { useEffect, useState } from 'react'
import { ADMIN_SAVED_EVENT, loadAdminData, saveAdminData } from '../admin/storage'
import type { AdminData, Material } from '../admin/types'
import { activeLearner, DEMO_LEARNER_ID } from './learner'
import { localISO, todayISO } from './utils'

/**
 * Reading assignments: materials sent straight to groups without a training session.
 * The admin side sets them up; the learner side reads and updates the same admin data,
 * which is why both use these helpers.
 */

export { DEMO_LEARNER_ID }

/** The signed-in learner's person id, used for their own assignment progress. */
export const myLearnerId = () => activeLearner().personId

export type AssignmentState = 'Acknowledged' | 'Read' | 'Not opened' | 'Overdue'

export const isAssigned = (m: Material) => (m.assignedGroupIds?.length ?? 0) > 0 || (m.assignedPersonIds?.length ?? 0) > 0

/** Everyone an assignment reaches: active members of assigned groups and directly assigned users. */
export function assignedPeople(data: AdminData, m: Material) {
  const groups = new Set(m.assignedGroupIds ?? [])
  const individuals = new Set(m.assignedPersonIds ?? [])
  const people = data.people
    .filter((p) => p.status !== 'Inactive' && (individuals.has(p.id) || p.groupIds.some((g) => groups.has(g))))
    .map((p) => ({ id: p.id, name: p.name, email: p.email }))
  return people
}

export function assignmentState(m: Material, personId: string, today = todayISO()): AssignmentState {
  const p = m.assignmentProgress?.[personId]
  const done = m.requiresAck ? !!p?.acknowledgedAt : !!p?.openedAt
  if (done) return m.requiresAck ? 'Acknowledged' : 'Read'
  if (m.dueDate && m.dueDate < today) return 'Overdue'
  return p?.openedAt ? 'Read' : 'Not opened'
}

/** True when the person has finished what the assignment asks (opened it, or acknowledged it when required). */
export const assignmentDone = (m: Material, personId: string) => {
  const p = m.assignmentProgress?.[personId]
  return m.requiresAck ? !!p?.acknowledgedAt : !!p?.openedAt
}

// ---- Learner side ----

function learnerList(data = loadAdminData(), personId = myLearnerId()) {
  const person = data.people.find((item) => item.id === personId)
  const groupIds = new Set([
    ...(person?.groupIds ?? []),
    ...(activeLearner().personId === personId ? activeLearner().groupIds : []),
  ])
  return data.materials
    .filter((m) => m.assignedPersonIds?.includes(personId) || m.assignedGroupIds?.some((g) => groupIds.has(g)))
    .sort((a, b) => Number(assignmentDone(a, personId)) - Number(assignmentDone(b, personId)) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
}

/** Materials assigned to the signed-in learner, unfinished first; refreshes when one is opened or acknowledged. */
export function useLearnerAssignments(personId = myLearnerId()) {
  const id = personId
  const [list, setList] = useState(() => learnerList(loadAdminData(), id))
  useEffect(() => {
    setList(learnerList(loadAdminData(), id))
  }, [id])
  useEffect(() => {
    const sync = () => setList(learnerList(loadAdminData(), id))
    window.addEventListener(ADMIN_SAVED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(ADMIN_SAVED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [id])
  return list
}

function track(id: string, field: 'openedAt' | 'acknowledgedAt', personId = myLearnerId()) {
  const data = loadAdminData()
  const at = localISO()
  saveAdminData({
    ...data,
    materials: data.materials.map((m) => {
      if (m.id !== id) return m
      const prev = m.assignmentProgress?.[personId] ?? {}
      if (prev[field]) return m
      return { ...m, assignmentProgress: { ...m.assignmentProgress, [personId]: { ...prev, openedAt: prev.openedAt ?? at, [field]: at } } }
    }),
  })
}

export const markAssignmentOpened = (id: string, personId = myLearnerId()) => track(id, 'openedAt', personId)
export const acknowledgeAssignment = (id: string, personId = myLearnerId()) => track(id, 'acknowledgedAt', personId)
