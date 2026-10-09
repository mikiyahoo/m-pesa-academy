import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { seedProgress, trainings } from '../data/trainings'
import { isPassed, todayISO } from '../lib/utils'
import type { Training, TrainingProgress } from '../types'

const STORAGE_KEY = 'mpesa-learning:progress:v1'

type Store = {
  trainings: Training[]
  progress: Record<string, TrainingProgress>
  getTraining: (id: string) => Training | undefined
  toggleModule: (trainingId: string, moduleId: string) => void
  markAttended: (trainingId: string) => void
  submitQuiz: (trainingId: string, score: number) => void
  resetProgress: () => void
}

const StoreContext = createContext<Store | null>(null)

function load(): Record<string, TrainingProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Fall through to seed data.
  }
  return seedProgress
}

/** Stamps or clears completedAt depending on whether the training is now complete. */
function withCompletion(t: Training, p: TrainingProgress): TrainingProgress {
  const done = t.modules.every((m) => p.completedModules.includes(m.id)) && isPassed(p)
  if (done && !p.completedAt) return { ...p, completedAt: todayISO() }
  if (!done && p.completedAt) return { ...p, completedAt: undefined }
  return p
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Record<string, TrainingProgress>>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // Storage may be unavailable (private mode); progress stays in memory.
    }
  }, [progress])

  const getTraining = useCallback((id: string) => trainings.find((t) => t.id === id), [])

  const update = useCallback(
    (trainingId: string, fn: (p: TrainingProgress) => TrainingProgress) => {
      const t = getTraining(trainingId)
      if (!t) return
      setProgress((prev) => {
        const current = prev[trainingId] ?? { completedModules: [] }
        return { ...prev, [trainingId]: withCompletion(t, fn(current)) }
      })
    },
    [getTraining],
  )

  const store = useMemo<Store>(
    () => ({
      trainings,
      progress,
      getTraining,
      toggleModule: (trainingId, moduleId) =>
        update(trainingId, (p) => ({
          ...p,
          completedModules: p.completedModules.includes(moduleId)
            ? p.completedModules.filter((id) => id !== moduleId)
            : [...p.completedModules, moduleId],
        })),
      markAttended: (trainingId) => update(trainingId, (p) => ({ ...p, attended: true })),
      submitQuiz: (trainingId, score) =>
        update(trainingId, (p) => ({ ...p, quizScore: Math.max(score, p.quizScore ?? 0) })),
      resetProgress: () => setProgress(seedProgress),
    }),
    [progress, getTraining, update],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside AppStoreProvider')
  return ctx
}
