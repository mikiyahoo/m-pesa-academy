import { PASS_MARK } from '../data/trainings'
import type { AttendanceMark, ProgressStatus, SessionStatus, Training, TrainingProgress } from '../types'

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Local "YYYY-MM-DDTHH:mm:ss". Stored timestamps have no zone suffix and are read back as local time. */
export const localISO = (d: Date | number = new Date()) => {
  const x = new Date(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`
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

export const modulesDone = (t: Training, p?: TrainingProgress) => !!p && t.modules.every((m) => p.completedModules.includes(m.id))

/** First module that isn't complete yet; later ones stay locked (TA-3.4, URS 2.4 sequential learning). */
export const nextModuleIndex = (t: Training, p?: TrainingProgress) => {
  const i = t.modules.findIndex((m) => !p?.completedModules.includes(m.id))
  return i === -1 ? t.modules.length : i
}

/** Completed = all modules, assessment passed and feedback submitted (D5 default: feedback is mandatory). */
export function progressStatus(t: Training, p?: TrainingProgress): ProgressStatus {
  if (!p) return 'Not Started'
  if (modulesDone(t, p) && isPassed(p) && p.feedback) return 'Completed'
  if (p.completedModules.length > 0 || p.attended || p.checkInAt || p.quizScore !== undefined) return 'In Progress'
  return 'Not Started'
}

export function progressPercent(t: Training, p?: TrainingProgress) {
  if (!p) return 0
  // Modules 70%, passing the assessment 20%, feedback the final 10%.
  const modules = p.completedModules.filter((id) => t.modules.some((m) => m.id === id)).length / t.modules.length
  return Math.round(modules * 70 + (isPassed(p) ? 20 : 0) + (p.feedback ? 10 : 0))
}

/** Present if checked in within the late window after the start, Late after it, Absent if the session passed without a check-in (URS 2.7). */
export function attendanceMark(t: Training, p: TrainingProgress | undefined, lateMinutes: number, today = todayISO()): AttendanceMark {
  if (p?.checkInAt) {
    const late = (new Date(p.checkInAt).getTime() - new Date(`${t.date}T${t.startTime}:00`).getTime()) / 60000
    return late > lateMinutes ? 'Late' : 'Present'
  }
  return t.date < today ? 'Absent' : 'Not yet'
}

/** Certificate eligibility (TA-6.5, URS 5): Present or Late, feedback completed, assessment score met. */
export function certificateChecks(t: Training, p: TrainingProgress | undefined, lateMinutes: number) {
  const mark = attendanceMark(t, p, lateMinutes)
  const checks = [
    { key: 'attendance', label: 'Attendance recorded', ok: mark === 'Present' || mark === 'Late', detail: mark === 'Not yet' ? 'Check in at the session' : mark },
    { key: 'feedback', label: 'Feedback submitted', ok: !!p?.feedback, detail: p?.feedback ? 'Done' : 'Required after you finish' },
    { key: 'assessment', label: 'Assessment passed', ok: isPassed(p), detail: p?.quizScore !== undefined ? `Best score ${p.quizScore}%` : 'Not taken yet' },
  ]
  return { checks, eligible: checks.every((c) => c.ok), mark }
}

export const certificateId = (t: Training) =>
  `MPL-${t.date.replaceAll('-', '')}-${t.id.replace(/^adm-/, '').replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}`

export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
