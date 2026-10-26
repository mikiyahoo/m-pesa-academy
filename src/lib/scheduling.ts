import { todayISO, formatDate } from './utils'

export type ReminderChannel = 'push' | 'email' | 'sms'

export type ReminderCadence = '7d' | '3d' | '1d' | '1h'

export type ReminderPreferences = {
  push: boolean
  email: boolean
  sms: boolean
  cadence: ReminderCadence[]
  emailAddress: string
  phoneNumber: string
}

export type TeamSchedule = {
  id: string
  trainingId: string
  trainingTitle: string
  targetGroup: string
  assignedBy: string
  assignedDate: string
  deadlineDate: string
  mandatory: boolean
  remindersEnabled: boolean
  learnerCount: number
}

const PREFS_KEY = 'mpesa-learning:reminder-preferences'
const SCHEDULES_KEY = 'mpesa-learning:team-schedules'

export const DEFAULT_REMINDER_PREFS: ReminderPreferences = {
  push: true,
  email: true,
  sms: false,
  cadence: ['3d', '1d', '1h'],
  emailAddress: 'fasil.wolde@mpesa.et',
  phoneNumber: '+251 91 123 4567',
}

export function loadReminderPrefs(): ReminderPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_REMINDER_PREFS, ...JSON.parse(raw) } : DEFAULT_REMINDER_PREFS
  } catch {
    return DEFAULT_REMINDER_PREFS
  }
}

export function saveReminderPrefs(prefs: ReminderPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Local storage fallback
  }
}

const SEED_SCHEDULES: TeamSchedule[] = [
  {
    id: 'sched-1',
    trainingId: 'account-optimization',
    trainingTitle: 'M-PESA Account Optimization & Float Management',
    targetGroup: 'Agent Relations & Sales (Region A)',
    assignedBy: 'Alemayehu Tadesse (Regional Manager)',
    assignedDate: '2026-10-20',
    deadlineDate: '2026-10-30',
    mandatory: true,
    remindersEnabled: true,
    learnerCount: 24,
  },
  {
    id: 'sched-2',
    trainingId: 'fraud-awareness',
    trainingTitle: 'Fraud Awareness & Security Best Practices',
    targetGroup: 'Front-line & Customer Operations',
    assignedBy: 'Bethlehem Haile (Head of Compliance)',
    assignedDate: '2026-10-22',
    deadlineDate: '2026-11-05',
    mandatory: true,
    remindersEnabled: true,
    learnerCount: 68,
  },
]

export function loadTeamSchedules(): TeamSchedule[] {
  try {
    const raw = localStorage.getItem(SCHEDULES_KEY)
    if (!raw) {
      localStorage.setItem(SCHEDULES_KEY, JSON.stringify(SEED_SCHEDULES))
      return SEED_SCHEDULES
    }
    return JSON.parse(raw)
  } catch {
    return SEED_SCHEDULES
  }
}

export function addTeamSchedule(schedule: Omit<TeamSchedule, 'id' | 'assignedDate'>): TeamSchedule {
  const current = loadTeamSchedules()
  const created: TeamSchedule = {
    ...schedule,
    id: `sched-${Date.now()}`,
    assignedDate: todayISO(),
  }
  const updated = [created, ...current]
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(updated))
  } catch {
    // Local storage fallback
  }
  return created
}

export function removeTeamSchedule(id: string): void {
  const current = loadTeamSchedules().filter((s) => s.id !== id)
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(current))
  } catch {
    // Local storage fallback
  }
}

export function getScheduleStatus(deadlineDate: string): {
  status: 'upcoming' | 'due-soon' | 'overdue'
  daysLeft: number
  label: string
} {
  const today = new Date(todayISO()).getTime()
  const deadline = new Date(deadlineDate).getTime()
  const diffDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      status: 'overdue',
      daysLeft: diffDays,
      label: `Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`,
    }
  }
  if (diffDays <= 2) {
    return {
      status: 'due-soon',
      daysLeft: diffDays,
      label: diffDays === 0 ? 'Due Today' : diffDays === 1 ? 'Due Tomorrow' : 'Due in 2 days',
    }
  }
  return {
    status: 'upcoming',
    daysLeft: diffDays,
    label: `Due in ${diffDays} days (${formatDate(deadlineDate, { month: 'short', day: 'numeric' })})`,
  }
}
