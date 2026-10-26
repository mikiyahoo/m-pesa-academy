import { journeys, type Journey } from '../data/journeys'
import { isPassed } from './utils'
import type { Training, TrainingProgress } from '../types'

const BADGES_KEY = 'mpesa-learning:earned-pathway-badges'

export function getEarnedPathwayBadges(): string[] {
  try {
    const raw = localStorage.getItem(BADGES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveEarnedPathwayBadge(journeyId: string): void {
  try {
    const current = getEarnedPathwayBadges()
    if (!current.includes(journeyId)) {
      current.push(journeyId)
      localStorage.setItem(BADGES_KEY, JSON.stringify(current))
    }
  } catch {
    // localStorage fallback
  }
}

/** Check if all prerequisite trainings for a given course are completed */
export function checkPrerequisites(
  trainingId: string,
  allTrainings: Training[],
  progress: Record<string, TrainingProgress>,
): {
  isLocked: boolean
  prerequisites: Training[]
  missingPrerequisites: Training[]
  journey?: Journey
} {
  // Find which journey contains this training and has prerequisites defined
  for (const j of journeys) {
    if (!j.trainingIds.includes(trainingId)) continue
    const prereqIds = j.prerequisites?.[trainingId] ?? []
    if (prereqIds.length === 0) {
      return { isLocked: false, prerequisites: [], missingPrerequisites: [], journey: j }
    }

    const prereqTrainings = prereqIds
      .map((id) => allTrainings.find((t) => t.id === id))
      .filter((t): t is Training => Boolean(t))

    const missing = prereqTrainings.filter((t) => {
      const p = progress[t.id]
      if (!p) return true
      const allModulesDone = t.modules.every((m) => p.completedModules.includes(m.id))
      const quizPassed = isPassed(p)
      return !(allModulesDone && quizPassed)
    })

    return {
      isLocked: missing.length > 0,
      prerequisites: prereqTrainings,
      missingPrerequisites: missing,
      journey: j,
    }
  }

  return { isLocked: false, prerequisites: [], missingPrerequisites: [] }
}

/** Compute overall progress, completion state, and milestone status for a journey */
export function getJourneyMetrics(
  journey: Journey,
  allTrainings: Training[],
  progress: Record<string, TrainingProgress>,
) {
  const steps = journey.trainingIds
    .map((id) => allTrainings.find((t) => t.id === id))
    .filter((t): t is Training => Boolean(t))

  const completedSteps = steps.filter((t) => {
    const p = progress[t.id]
    if (!p) return false
    return t.modules.every((m) => p.completedModules.includes(m.id)) && isPassed(p)
  })

  const inProgressSteps = steps.filter((t) => {
    const p = progress[t.id]
    if (!p) return false
    const isComp = t.modules.every((m) => p.completedModules.includes(m.id)) && isPassed(p)
    return !isComp && (p.completedModules.length > 0 || p.attended)
  })

  const total = steps.length
  const completed = completedSteps.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const isCompleted = total > 0 && completed === total

  // Find the current active or next step to take
  const nextStep = steps.find((t) => {
    const p = progress[t.id]
    if (!p) return true
    return !(t.modules.every((m) => p.completedModules.includes(m.id)) && isPassed(p))
  })

  // Auto-record earned pathway badge if completed
  if (isCompleted) {
    saveEarnedPathwayBadge(journey.id)
  }

  const earnedBadges = getEarnedPathwayBadges()
  const isBadgeClaimed = earnedBadges.includes(journey.id)

  return {
    steps,
    total,
    completed,
    inProgress: inProgressSteps.length,
    percent,
    isCompleted,
    nextStep,
    isBadgeClaimed,
  }
}
