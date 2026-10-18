import { LATE_WINDOW_MINUTES } from '../../data/trainings'
import { certificateChecks, formatDate, formatTime, isPassed, nextModuleIndex, sessionStatus } from '../../lib/utils'
import type { Training, TrainingProgress } from '../../types'

export type ItemKind = 'session' | 'reading' | 'video' | 'assessment' | 'feedback' | 'certificate'
export type ItemState = 'done' | 'open' | 'locked'

export type OutlineItem = {
  id: string
  kind: ItemKind
  title: string
  meta: string
  state: ItemState
  /** Why a locked item can't be opened yet, e.g. "Finish “Account basics” first". */
  lockedReason?: string
  /** Module position for reading / video items. */
  moduleIndex?: number
}

export type OutlineSection = {
  id: string
  label: string
  title: string
  items: OutlineItem[]
  locked: boolean
}

export const ITEM_LABEL: Record<ItemKind, string> = {
  session: 'Live session',
  reading: 'Reading',
  video: 'Video',
  assessment: 'Graded assessment',
  feedback: 'Survey',
  certificate: 'Certificate',
}

/**
 * The learner's path through a training, grouped like a course outline:
 * live session, modules in order (TA-3.4), assessment, then feedback and certificate (D5, D6).
 */
export function buildOutline(t: Training, p?: TrainingProgress) {
  const next = nextModuleIndex(t, p)
  const modulesDone = next === t.modules.length
  const passed = isPassed(p)
  const { eligible, checks } = certificateChecks(t, p, LATE_WINDOW_MINUTES)
  const session = sessionStatus(t)

  const sessionItem: OutlineItem = {
    id: 'session',
    kind: 'session',
    title: session === 'Completed' ? 'Live session (held)' : 'Live session',
    meta: `${formatDate(t.date, { weekday: 'short', month: 'short', day: 'numeric' })} • ${formatTime(t.startTime)}`,
    state: p?.checkInAt ? 'done' : 'open',
  }

  const moduleItems: OutlineItem[] = t.modules.map((m, i) => ({
    id: m.id,
    kind: m.kind === 'video' ? 'video' : 'reading',
    title: m.title,
    meta: `${m.kind === 'video' ? 'Video' : 'Reading'} • ${m.minutes} min`,
    state: i < next ? 'done' : i === next ? 'open' : 'locked',
    lockedReason: i > next ? `Finish “${t.modules[next].title}” first` : undefined,
    moduleIndex: i,
  }))

  const assessmentItem: OutlineItem = {
    id: 'assessment',
    kind: 'assessment',
    title: 'Final assessment',
    meta: `Graded assessment • ${t.quiz.length} questions`,
    state: passed ? 'done' : modulesDone ? 'open' : 'locked',
    lockedReason: modulesDone ? undefined : `Complete all ${t.modules.length} modules to unlock the assessment`,
  }

  const feedbackItem: OutlineItem = {
    id: 'feedback',
    kind: 'feedback',
    title: 'Training feedback',
    meta: 'Survey • 2 min',
    state: p?.feedback ? 'done' : modulesDone && passed ? 'open' : 'locked',
    lockedReason: modulesDone && passed ? undefined : 'Pass the assessment to share your feedback',
  }

  const missing = checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase())
  const certificateItem: OutlineItem = {
    id: 'certificate',
    kind: 'certificate',
    title: 'Your certificate',
    meta: 'Certificate • Shareable',
    state: eligible ? 'done' : 'locked',
    lockedReason: eligible ? undefined : `Still needed: ${missing.join(', ')}`,
  }

  const sections: OutlineSection[] = [
    { id: 's-session', label: 'Section 1', title: 'Live session', items: [sessionItem], locked: false },
    { id: 's-learn', label: 'Section 2', title: 'Learn', items: moduleItems, locked: false },
    { id: 's-assess', label: 'Section 3', title: 'Assessment', items: [assessmentItem], locked: assessmentItem.state === 'locked' },
    { id: 's-wrap', label: 'Section 4', title: 'Wrap up', items: [feedbackItem, certificateItem], locked: feedbackItem.state === 'locked' },
  ]
  const items = sections.flatMap((s) => s.items)

  // Where "Continue" lands: an open live session first, then the next unfinished step.
  const currentId =
    session === 'Active' && !p?.checkInAt
      ? 'session'
      : !modulesDone
        ? t.modules[next].id
        : !passed
          ? 'assessment'
          : !p?.feedback
            ? 'feedback'
            : eligible
              ? 'certificate'
              : !p?.checkInAt
                ? 'session'
                : 'certificate'

  return {
    sections,
    items,
    currentId,
    doneCount: items.filter((i) => i.state === 'done').length,
    total: items.length,
  }
}

export type Outline = ReturnType<typeof buildOutline>

export const learnPath = (trainingId: string, itemId?: string) => `/trainings/${trainingId}/learn${itemId ? `/${itemId}` : ''}`
