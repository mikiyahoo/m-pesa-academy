import { loadAdminData, saveAdminData } from '../admin/storage'
import type { AdminData, AdminTraining } from '../admin/types'
import { LATE_WINDOW_MINUTES } from '../data/trainings'
import type { CheckInMethod, FeedbackSubmission } from '../types'
import { ADMIN_TRAINING_PREFIX } from './adminBridge'
import { localISO } from './utils'

/**
 * Learner actions on admin-scheduled trainings are written back to the admin data, so the
 * admin's attendance, grading, feedback and certificate screens see what the learner did.
 */

const adminId = (learnerTrainingId: string) => (learnerTrainingId.startsWith(ADMIN_TRAINING_PREFIX) ? learnerTrainingId.slice(ADMIN_TRAINING_PREFIX.length) : null)

function withTraining(learnerTrainingId: string, fn: (d: AdminData, t: AdminTraining) => AdminData) {
  const id = adminId(learnerTrainingId)
  if (!id) return
  const data = loadAdminData()
  const t = data.trainings.find((x) => x.id === id)
  if (t) saveAdminData(fn(data, t))
}

const replaceTraining = (d: AdminData, t: AdminTraining): AdminData => ({ ...d, trainings: d.trainings.map((x) => (x.id === t.id ? t : x)) })

export function syncCheckIn(learnerTrainingId: string, personId: string, method: CheckInMethod) {
  withTraining(learnerTrainingId, (d, t) => {
    if (t.checkins?.some((c) => c.personId === personId)) return d
    const at = localISO()
    const [h, m] = t.startTime.split(':').map(Number)
    const minutesLate = (new Date(at).getTime() - new Date(`${t.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()) / 60000
    const checkin = {
      personId,
      at,
      method: method === 'qr' ? ('qr' as const) : method === 'manual' ? ('manual' as const) : ('link' as const),
      status: minutesLate > LATE_WINDOW_MINUTES ? ('Late' as const) : ('Present' as const),
      verified: method !== 'manual',
      by: method === 'teams' ? 'Teams join (learner portal)' : 'Learner portal',
    }
    return replaceTraining(d, { ...t, checkins: [...(t.checkins ?? []), checkin] })
  })
}

/** Learner module ids are `<adminTrainingId>-<journeyModuleId>`. */
export function syncModules(learnerTrainingId: string, personId: string, completedModuleIds: string[]) {
  withTraining(learnerTrainingId, (d, t) => {
    const done = Object.fromEntries(completedModuleIds.filter((m) => m.startsWith(`${t.id}-`)).map((m) => [m.slice(t.id.length + 1), 100]))
    return replaceTraining(d, { ...t, progress: { ...t.progress, [personId]: { ...t.progress[personId], ...done } } })
  })
}

export function syncQuiz(learnerTrainingId: string, personId: string, score: number, attempt: number) {
  withTraining(learnerTrainingId, (d, t) => {
    if (!t.postAssessmentId) return d
    const at = localISO()
    return {
      ...d,
      submissions: [
        ...d.submissions,
        { id: `sub-${t.id}-${personId}-${attempt}`, assessmentId: t.postAssessmentId, trainingId: t.id, personId, attempt, answers: {}, score, status: 'graded', startedAt: at, submittedAt: at },
      ],
    }
  })
}

export function syncFeedback(learnerTrainingId: string, personId: string, f: FeedbackSubmission) {
  withTraining(learnerTrainingId, (d, t) => {
    if (d.feedbackResponses.some((r) => r.trainingId === t.id && r.participantId === personId)) return d
    const formId = t.feedbackFormId ?? d.feedbackForms[0]?.id ?? 'form'
    return {
      ...d,
      feedbackResponses: [
        ...d.feedbackResponses,
        { id: `fb-${t.id}-${personId}`, formId, trainingId: t.id, participantId: personId, ratings: [...f.likert, f.recommend ? 1 : 0], comment: f.comment, submittedAt: f.submittedAt },
      ],
    }
  })
}
