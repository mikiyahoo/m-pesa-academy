import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ADMIN_SAVED_EVENT, loadAdminData } from '../admin/storage'
import { seedProgress, trainings as staticTrainings } from '../data/trainings'
import { adminTrainingsFor } from '../lib/adminBridge'
import { syncCheckIn, syncFeedback, syncModules, syncQuiz } from '../lib/adminSync'
import { resolveLearner, scopedKey, setActiveLearner } from '../lib/learner'
import { useAuth } from './Auth'
import { localISO, nextModuleIndex, progressStatus, todayISO } from '../lib/utils'
import type { CheckInMethod, FeedbackSubmission, Training, TrainingProgress } from '../types'

const STORAGE_KEY = 'mpesa-learning:progress:v2'

type Store = {
  trainings: Training[]
  progress: Record<string, TrainingProgress>
  getTraining: (id: string) => Training | undefined
  /** Complete the next module in order; later modules stay locked (TA-3.4). */
  completeModule: (trainingId: string, moduleId: string) => void
  /** Undo the most recently completed module. */
  undoModule: (trainingId: string) => void
  /** Record a check-in (manual, QR, link or Teams); the first one wins (TE-5.1). */
  checkIn: (trainingId: string, method: CheckInMethod) => void
  submitQuiz: (trainingId: string, score: number) => void
  submitFeedback: (trainingId: string, feedback: FeedbackSubmission) => void
  resetProgress: () => void
}

const StoreContext = createContext<Store | null>(null)

/** Each person's progress lives under their own key; only the demo learner starts with seeded progress. */
function load(key: string, demo: boolean): Record<string, TrainingProgress> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {
    // Fall through to the starting point.
  }
  return demo ? seedProgress : {}
}

/** Stamps or clears completedAt depending on whether the training is now complete. */
function withCompletion(t: Training, p: TrainingProgress): TrainingProgress {
  // Completed requires every module, a passing score AND feedback (D5).
  const done = progressStatus(t, p) === 'Completed'
  if (done && !p.completedAt) return { ...p, completedAt: todayISO() }
  if (!done && p.completedAt) return { ...p, completedAt: undefined }
  return p
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user, personId } = useAuth()
  const learner = useMemo(() => resolveLearner(user, personId), [user, personId])
  // Set before children render so scoped keys (favourites, notifications, assignments) follow the person.
  setActiveLearner(learner)
  const key = scopedKey(STORAGE_KEY)

  const [byKey, setByKey] = useState<Record<string, Record<string, TrainingProgress>>>({})
  const progress = useMemo(() => byKey[key] ?? load(key, learner.demo), [byKey, key, learner.demo])
  const setProgress = useCallback(
    (fn: (prev: Record<string, TrainingProgress>) => Record<string, TrainingProgress>) =>
      setByKey((all) => ({ ...all, [key]: fn(all[key] ?? load(key, learner.demo)) })),
    [key, learner.demo],
  )

  useEffect(() => {
    if (!byKey[key]) return
    try {
      localStorage.setItem(key, JSON.stringify(byKey[key]))
    } catch {
      // Storage may be unavailable (private mode); progress stays in memory.
    }
  }, [byKey, key])

  // Trainings the admin portal schedules for this person, refreshed whenever admin data is saved.
  const [adminVersion, setAdminVersion] = useState(0)
  useEffect(() => {
    const bump = () => setAdminVersion((v) => v + 1)
    window.addEventListener(ADMIN_SAVED_EVENT, bump)
    window.addEventListener('storage', bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener(ADMIN_SAVED_EVENT, bump)
      window.removeEventListener('storage', bump)
      window.removeEventListener('focus', bump)
    }
  }, [])
  const trainings = useMemo(
    () => [...staticTrainings, ...adminTrainingsFor(loadAdminData(), learner.personId)],
    // adminVersion re-reads admin data after it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learner.personId, adminVersion],
  )

  const getTraining = useCallback((id: string) => trainings.find((t) => t.id === id), [trainings])

  const update = useCallback(
    (trainingId: string, fn: (p: TrainingProgress) => TrainingProgress) => {
      const t = getTraining(trainingId)
      if (!t) return
      setProgress((prev) => {
        const current = prev[trainingId] ?? { completedModules: [] }
        return { ...prev, [trainingId]: withCompletion(t, fn(current)) }
      })
    },
    [getTraining, setProgress],
  )

  const store = useMemo<Store>(
    () => ({
      trainings,
      progress,
      getTraining,
      // Actions on admin-scheduled trainings are also written back to the admin data (no-op otherwise).
      completeModule: (trainingId, moduleId) => {
        syncModules(trainingId, learner.personId, [...(progress[trainingId]?.completedModules ?? []), moduleId])
        update(trainingId, (p) => {
          const t = getTraining(trainingId)
          if (!t) return p
          // Only the next module in order can be completed; later ones are locked.
          const next = t.modules[nextModuleIndex(t, p)]
          if (!next || next.id !== moduleId) return p
          return { ...p, completedModules: [...p.completedModules, moduleId] }
        })
      },
      undoModule: (trainingId) =>
        update(trainingId, (p) => {
          // Only the last completed module can be undone.
          if (!p.completedModules.length) return p
          return { ...p, completedModules: p.completedModules.slice(0, -1) }
        }),
      checkIn: (trainingId, method) => {
        if (!progress[trainingId]?.checkInAt) syncCheckIn(trainingId, learner.personId, method)
        update(trainingId, (p) => {
          if (p.checkInAt) return p
          return { ...p, checkInAt: localISO(), checkInMethod: method, attended: true }
        })
      },
      submitQuiz: (trainingId, score) => {
        syncQuiz(trainingId, learner.personId, score, (progress[trainingId]?.attempts ?? 0) + 1)
        update(trainingId, (p) => ({
          ...p,
          quizScore: Math.max(score, p.quizScore ?? 0),
          attempts: (p.attempts ?? 0) + 1,
        }))
      },
      submitFeedback: (trainingId, feedback) => {
        syncFeedback(trainingId, learner.personId, feedback)
        update(trainingId, (p) => ({ ...p, feedback }))
      },
      resetProgress: () => setProgress(() => (learner.demo ? seedProgress : {})),
    }),
    [trainings, progress, getTraining, update, setProgress, learner.demo, learner.personId],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside AppStoreProvider')
  return ctx
}
