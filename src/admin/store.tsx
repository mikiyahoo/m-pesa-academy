import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFeedback } from '../components/Feedback'
import { localISO } from '../lib/utils'
import { useAuth } from '../store/Auth'
import { freshAdminData, loadAdminData, saveAdminData } from './storage'
import { scanAlerts } from './insights'
import type { AdminData, AdminTraining, AuditChange } from './types'

type AdminStore = {
  data: AdminData
  /**
   * Applies an immutable update. When `log` is given it is recorded in the audit log
   * and confirmed with a toast that offers Undo.
   */
  update: (fn: (d: AdminData) => AdminData, log?: { action: string; target: string; silent?: boolean; changes?: AuditChange[] }) => void
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
      const entry = { id: uid('al'), actor: user.name, action: log.action, target: log.target, at: localISO(), ...(changes?.length ? { changes } : {}) }
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
    const own = new Set(ctx.data.trainings.filter((t) => t.trainerId === trainerId).map((t) => t.id))
    return {
      ...ctx,
      data: {
        ...ctx.data,
        trainings: ctx.data.trainings.filter((t) => own.has(t.id)),
        submissions: ctx.data.submissions.filter((s) => own.has(s.trainingId)),
        feedbackResponses: ctx.data.feedbackResponses.filter((r) => own.has(r.trainingId)),
        requests: ctx.data.requests.filter((r) => r.trainerId === trainerId),
        alerts: ctx.data.alerts.filter((a) => own.has(a.trainingId)),
      },
    }
  }, [ctx, trainerId])
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
