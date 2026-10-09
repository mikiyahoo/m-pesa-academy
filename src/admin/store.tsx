import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFeedback } from '../components/Feedback'
import { adminUser } from '../data/trainings'
import { seedAdminData } from './seed'
import type { AdminData, AdminTraining } from './types'

// Bump the version when the data shape changes so old browser data is replaced by the new seed.
const STORAGE_KEY = 'mpesa-learning:admin:v2'

type AdminStore = {
  data: AdminData
  /**
   * Applies an immutable update. When `log` is given it is recorded in the audit log
   * and confirmed with a toast that offers Undo.
   */
  update: (fn: (d: AdminData) => AdminData, log?: { action: string; target: string; silent?: boolean }) => void
  reset: () => void
}

const Ctx = createContext<AdminStore | null>(null)

function load(): AdminData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Fall through to seed data.
  }
  return seedAdminData()
}

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(load)
  const { toast } = useFeedback()
  // Latest committed data, read by update() so it can snapshot state for Undo.
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Storage may be unavailable; changes stay in memory.
    }
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
      const entry = { id: uid('al'), actor: adminUser.name, action: log.action, target: log.target, at: new Date().toISOString().slice(0, 19) }
      dataRef.current = { ...next, auditLogs: [entry, ...next.auditLogs] }
      setData(dataRef.current)
      if (!log.silent) toast(`${log.action} · ${log.target}`, { action: { label: 'Undo', onClick: () => setData(before) } })
    },
    [toast],
  )

  const value = useMemo(() => ({ data, update, reset: () => setData(seedAdminData()) }), [data, update])
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
