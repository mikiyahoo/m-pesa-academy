import { PASS_MARK } from '../data/trainings'
import type { ProgressStatus, SessionStatus, Training, TrainingProgress } from '../types'

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const parseDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }) =>
  parseDate(iso).toLocaleDateString('en-US', opts)

export const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`
}

export const timeRange = (t: Training) => `${formatTime(t.startTime)} - ${formatTime(t.endTime)}`

export const durationMinutes = (t: Training) => t.modules.reduce((sum, m) => sum + m.minutes, 0)

export function sessionStatus(t: Training, today = todayISO()): SessionStatus {
  if (t.date < today) return 'Completed'
  if (t.date > today) return 'Upcoming'
  return 'Active'
}

export function isPassed(p?: TrainingProgress) {
  return p?.quizScore !== undefined && p.quizScore >= PASS_MARK
}

export function progressStatus(t: Training, p?: TrainingProgress): ProgressStatus {
  if (!p) return 'Not Started'
  const allModules = t.modules.every((m) => p.completedModules.includes(m.id))
  if (allModules && isPassed(p)) return 'Completed'
  if (p.completedModules.length > 0 || p.attended || p.quizScore !== undefined) return 'In Progress'
  return 'Not Started'
}

export function progressPercent(t: Training, p?: TrainingProgress) {
  if (!p) return 0
  // Modules count for 80%, passing the quiz for the final 20%.
  const modules = p.completedModules.filter((id) => t.modules.some((m) => m.id === id)).length / t.modules.length
  return Math.round(modules * 80 + (isPassed(p) ? 20 : 0))
}

export const certificateId = (t: Training) =>
  `MPL-${t.date.replaceAll('-', '')}-${t.id.slice(0, 4).toUpperCase()}`

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
