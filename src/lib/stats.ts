import type { Training, TrainingProgress } from '../types'
import { parseDate, progressStatus, todayISO } from './utils'

export type Metrics = { total: number; completed: number; averageScore: number; completionRate: number }

export function computeMetrics(trainings: Training[], progress: Record<string, TrainingProgress>, asOf = todayISO()): Metrics {
  // Only count completions/scores achieved on or before asOf so we can compare periods.
  const scoped = trainings.filter((t) => t.date <= asOf || progress[t.id]?.completedAt)
  const scores = scoped.map((t) => progress[t.id]?.quizScore).filter((s): s is number => s !== undefined)
  const completed = scoped.filter((t) => {
    const p = progress[t.id]
    return progressStatus(t, p) === 'Completed' && (!p?.completedAt || p.completedAt <= asOf)
  }).length
  const total = trainings.filter((t) => t.date <= asOf || asOf === todayISO()).length
  return {
    total,
    completed,
    averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    completionRate: total ? (completed / total) * 100 : 0,
  }
}

export function daysAgoISO(days: number) {
  const d = parseDate(todayISO())
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function metricsWithTrend(trainings: Training[], progress: Record<string, TrainingProgress>) {
  const now = computeMetrics(trainings, progress)
  const prev = computeMetrics(trainings, progress, daysAgoISO(30))
  return {
    now,
    delta: {
      total: now.total - prev.total,
      completed: now.completed - prev.completed,
      averageScore: now.averageScore - prev.averageScore,
      completionRate: now.completionRate - prev.completionRate,
    },
  }
}
