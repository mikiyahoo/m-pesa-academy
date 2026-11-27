import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFeedback } from '../components/Feedback'
import { localISO } from '../lib/utils'
import { useAuth } from '../store/Auth'
import { ADMIN_STORAGE_KEY, freshAdminData, loadAdminData, saveAdminData } from './storage'
import { scanAlerts } from './insights'
import { captureAuditContext, resolveAuditEntity } from './audit'
import { trainerIdsOf } from './scheduling'
import type { AdminData, AdminTraining, AuditChange, AuditContext } from './types'

type AdminStore = {
  data: AdminData
  /**
   * Applies an immutable update. When `log` is given it is recorded in the audit log
   * and confirmed with a toast that offers Undo.
   */
  update: (fn: (d: AdminData) => AdminData, log?: { action: string; target: string; silent?: boolean; changes?: AuditChange[]; entityId?: string; entityType?: string; remarks?: string; context?: AuditContext[] }) => void
  reset: () => void
}

const Ctx = createContext<AdminStore | null>(null)

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(loadAdminData)
  const { toast } = useFeedback()
  const { user } = useAuth()
  // Latest committed data, read by update() so it can snapshot state for Undo.
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    saveAdminData(data)
  }, [data])

  // Changes saved in another tab (e.g. an assessment created from "+ Create new") show up here too.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === ADMIN_STORAGE_KEY && e.newValue) setData(loadAdminData())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  // Raise low-feedback / low-attendance alerts as soon as the data that triggers them appears (F04, T06).
  useEffect(() => {
    const fresh = scanAlerts(data)
    if (!fresh.length) return
    dataRef.current = { ...data, alerts: [...fresh, ...data.alerts] }
    setData(dataRef.current)
  }, [data])

  const update = useCallback<AdminStore['update']>(
    (fn, log) => {
      const before = dataRef.current
      const next = fn(before)
      if (!log) {
        dataRef.current = next
        setData(next)
        return
      }
      const changes = log.changes?.filter((c) => c.from !== c.to)
      const currentEntity = resolveAuditEntity(next, log.action, log.target)
      const previousEntity = resolveAuditEntity(before, log.action, log.target)
      const entityId = log.entityId ?? currentEntity.entityId ?? previousEntity.entityId
      const entityType = log.entityType ?? currentEntity.entityType ?? previousEntity.entityType
      const recordContext = captureAuditContext(next, entityType, entityId).length
        ? captureAuditContext(next, entityType, entityId)
        : captureAuditContext(before, entityType, entityId)
      const actor = before.people.find((person) => person.name === user.name)
      const context = [
        ...(log.context ?? recordContext),
        ...(actor ? [
          { label: 'Actor email', value: actor.email },
          { label: 'Actor department', value: actor.department },
          { label: 'Actor role', value: actor.role },
        ].filter((item) => item.value.trim()) : []),
      ]
      const entry = {
        id: uid('al'),
        actor: user.name,
        action: log.action,
        target: log.target,
        at: localISO(),
        ...(entityId ? { entityId } : {}),
        entityType,
        ...(log.remarks ? { remarks: log.remarks } : {}),
        ...(changes?.length ? { changes } : {}),
        ...(context.length ? { context } : {}),
      }
      dataRef.current = { ...next, auditLogs: [entry, ...next.auditLogs] }
      setData(dataRef.current)
      if (!log.silent) toast(`${log.action} · ${log.target}`, { action: { label: 'Undo', onClick: () => setData(before) } })
    },
    [toast, user.name],
  )

  const value = useMemo(() => ({ data, update, reset: () => setData(freshAdminData()) }), [data, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Trainer view of the admin data (D04, S10): only the sessions they conduct, with their
 * submissions, feedback and the requests assigned to them. Updates still apply to the full data.
 */
export function TrainerScope({ trainerId, children }: { trainerId: string; children: ReactNode }) {
  const ctx = useAdmin()
  const value = useMemo(() => {
    // A trainer sees the sessions they scheduled and the ones they're assigned to teach.
    const own = new Set(ctx.data.trainings.filter((t) => t.createdById === trainerId || trainerIdsOf(t).includes(trainerId)).map((t) => t.id))
    return {
      ...ctx,
      data: {
        ...ctx.data,
        trainings: ctx.data.trainings.filter((t) => own.has(t.id)),
        submissions: ctx.data.submissions.filter((s) => own.has(s.trainingId)),
        feedbackResponses: ctx.data.feedbackResponses.filter((r) => own.has(r.trainingId)),
        requests: ctx.data.requests.filter((r) => trainerIdsOf(r).includes(trainerId)),
        alerts: ctx.data.alerts.filter((a) => own.has(a.trainingId)),
      },
    }
  }, [ctx, trainerId])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Department admin: one department only. Its trainings, requests from its teams, and the
 * submissions, feedback and alerts of those trainings; its people (plus the trainers and learners
 * on its trainings, so names resolve), its groups and its own audit trail. Nothing from other departments.
 */
export function DepartmentScope({ department, children }: { department: string; children: ReactNode }) {
  const ctx = useAdmin()
  const value = useMemo(() => {
    const d = ctx.data
    const inDept = new Set(d.people.filter((p) => p.department === department).map((p) => p.id))
    const trainings = d.trainings.filter((t) => t.department === department)
    const own = new Set(trainings.map((t) => t.id))
    const requests = d.requests.filter((r) => r.team === department || inDept.has(r.requesterId))
    // People: the department, plus whoever teaches or attends its trainings and whoever sent its requests.
    const visible = new Set([...inDept, ...trainings.flatMap((t) => [...t.participantIds, ...trainerIdsOf(t)]), ...requests.map((r) => r.requesterId)])
    const people = d.people.filter((p) => visible.has(p.id))
    const names = new Set([...people.filter((p) => inDept.has(p.id)).map((p) => p.name), ...trainings.map((t) => t.name)])
    return {
      ...ctx,
      data: {
        ...d,
        trainings,
        people,
        groups: d.groups.filter((g) => people.some((p) => inDept.has(p.id) && p.groupIds.includes(g.id))),
        submissions: d.submissions.filter((s) => own.has(s.trainingId)),
        feedbackResponses: d.feedbackResponses.filter((r) => own.has(r.trainingId)),
        requests,
        alerts: d.alerts.filter((a) => own.has(a.trainingId)),
        auditLogs: d.auditLogs.filter((l) => names.has(l.actor) || names.has(l.target) || l.target === department),
      },
    }
  }, [ctx, department])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdmin must be used inside AdminStoreProvider')
  return ctx
}

/** Average completion of one module across a training's participants, capped at 100%. */
export function classProgress(t: AdminTraining, moduleId: string) {
  if (!t.participantIds.length) return 0
  const sum = t.participantIds.reduce((s, pid) => s + Math.min(100, t.progress[pid]?.[moduleId] ?? 0), 0)
  return Math.round(sum / t.participantIds.length)
}

/** A participant's overall completion across all modules of the training's journey. */
export function participantProgress(t: AdminTraining, participantId: string, moduleIds: string[]) {
  if (!moduleIds.length) return 0
  const sum = moduleIds.reduce((s, mid) => s + Math.min(100, t.progress[participantId]?.[mid] ?? 0), 0)
  return Math.round(sum / moduleIds.length)
}
