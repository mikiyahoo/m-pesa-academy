import { useEffect, useState } from 'react'
import { loadAdminData, saveAdminData } from '../admin/storage'
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

export const isAssigned = (m: Material) => (m.assignedGroupIds?.length ?? 0) > 0

/** Everyone an assignment reaches: active members of the assigned groups (the demo learner is a member of ISON). */
export function assignedPeople(data: AdminData, m: Material) {
  const groups = new Set(m.assignedGroupIds ?? [])
  const people = data.people.filter((p) => p.status !== 'Inactive' && p.groupIds.some((g) => groups.has(g))).map((p) => ({ id: p.id, name: p.name, email: p.email }))
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

const EVENT = 'mpesa-learning:assignments-change'

function learnerList(data = loadAdminData()) {
  return data.materials
    .filter((m) => m.assignedGroupIds?.some((g) => activeLearner().groupIds.includes(g)))
    .sort((a, b) => Number(assignmentDone(a, myLearnerId())) - Number(assignmentDone(b, myLearnerId())) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
}

/** Materials assigned to the signed-in learner, unfinished first; refreshes when one is opened or acknowledged. */
export function useLearnerAssignments() {
  const id = myLearnerId()
  const [list, setList] = useState(() => learnerList())
  useEffect(() => {
    setList(learnerList())
  }, [id])
  useEffect(() => {
    const sync = () => setList(learnerList())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return list
}

function track(id: string, field: 'openedAt' | 'acknowledgedAt') {
  const data = loadAdminData()
  const at = localISO()
  saveAdminData({
    ...data,
    materials: data.materials.map((m) => {
      if (m.id !== id) return m
      const prev = m.assignmentProgress?.[myLearnerId()] ?? {}
      if (prev[field]) return m
      return { ...m, assignmentProgress: { ...m.assignmentProgress, [myLearnerId()]: { ...prev, openedAt: prev.openedAt ?? at, [field]: at } } }
    }),
  })
  window.dispatchEvent(new Event(EVENT))
}

export const markAssignmentOpened = (id: string) => track(id, 'openedAt')
export const acknowledgeAssignment = (id: string) => track(id, 'acknowledgedAt')
