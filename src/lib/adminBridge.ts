import type { AdminData, AdminTraining, Material } from '../admin/types'
import type { BannerTheme, Module, QuizQuestion, Training } from '../types'
import { TEAMS_DEMO } from '../data/trainings'
import { trainerIdsOf } from '../admin/scheduling'
import { combinedJourney } from '../admin/journeys'

/**
 * Turns trainings scheduled in the admin portal into learner trainings, so a session an admin
 * schedules (with its journey's materials and post-assessment) shows up for the people invited.
 * Files aren't stored in the prototype, so videos and decks use the bundled sample files.
 */

export const ADMIN_TRAINING_PREFIX = 'adm-'
const THEMES: BannerTheme[] = ['red', 'green', 'optimization', 'merchant', 'dark', 'fayda']
const SAMPLE_VIDEOS = ['/trainings/Module (1).mp4', '/trainings/Module (2).mp4', '/trainings/Module (3).mp4', '/trainings/Module (4).mp4', '/trainings/Module (5).mp4']

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)

function toModule(id: string, title: string, m: Material | undefined, i: number): Module {
  if (m?.type === 'VIDEO') {
    const direct = m.url && /\.(mp4|webm)(\?|$)/i.test(m.url) ? m.url : undefined
    return { id, title, minutes: m.minutes || 10, kind: 'video', video: direct ?? SAMPLE_VIDEOS[i % SAMPLE_VIDEOS.length] }
  }
  return {
    id,
    title,
    minutes: m?.minutes || 10,
    kind: 'document',
    deck: m?.type === 'PRESENTATION' ? '/trainings/Sample Training.pptx' : undefined,
    downloadGroupIds: m?.downloadableGroupIds,
    slides: [
      { title: m?.title ?? title, bullets: [m?.description || `Key points of ${title.toLowerCase()}.`, ...(m?.skills.length ? [`Skills: ${m.skills.join(', ')}`] : [])] },
    ],
  }
}

/** Fallback questions when the admin hasn't attached a post-assessment, so the training can still be completed. */
const fallbackQuiz = (name: string): QuizQuestion[] => [
  { id: 'q1', question: `Did ${name} cover what your role needs day to day?`, options: ['Yes, the core steps and tools', 'No, it was unrelated'], answer: 0 },
  { id: 'q2', question: 'Where do you go when something is unclear after the session?', options: ['Ask your trainer or Learning & Development', 'Guess and carry on'], answer: 0 },
  { id: 'q3', question: 'What should you never share with anyone?', options: ['Your PIN or one-time codes', 'Your work email address'], answer: 0 },
]

export function adminToLearnerTraining(data: AdminData, t: AdminTraining): Training {
  const journey = combinedJourney(data, t)
  const trainer = trainerIdsOf(t).map((id) => data.people.find((person) => person.id === id)?.name).filter(Boolean).join(', ') || 'Training team'
  const type = data.trainingTypes.find((x) => x.id === t.typeId)
  const material = (id?: string) => data.materials.find((m) => m.id === id)
  const modules = (journey?.modules ?? []).map((jm, i) => toModule(`${t.id}-${jm.id}`, jm.title, material(jm.materialIds[0]), i))
  const post = data.assessments.find((a) => a.id === t.postAssessmentId)
  const mcq = (post?.questions ?? []).filter((q) => q.type === 'mcq' && q.options?.length && typeof q.answer === 'number')
  return {
    id: `${ADMIN_TRAINING_PREFIX}${t.id}`,
    title: t.name,
    trainer,
    date: t.date,
    startTime: t.startTime,
    endTime: t.endTime,
    venue: t.location,
    // The invite link is a portal link, not a meeting; without a real Teams meeting use the demo meeting.
    teamsJoinUrl: t.teamsMeeting?.joinUrl ?? (t.delivery === 'Online' ? TEAMS_DEMO : undefined),
    category: type?.name ?? 'Training',
    banner: THEMES[hash(t.id) % THEMES.length],
    cover: t.coverId ? data.trainingCovers?.[t.coverId] : undefined,
    bannerTitle: t.name,
    description: t.description || journey?.description || `${t.name} — scheduled by the training team.`,
    modules: modules.length ? modules : [toModule(`${t.id}-intro`, 'Session overview', undefined, 0)],
    quiz: mcq.length ? mcq.map((q) => ({ id: q.id, question: q.question, options: q.options!, answer: q.answer as number })) : fallbackQuiz(t.name),
    quizSettings: post ? { timeLimitMinutes: post.timeLimitMinutes, maxAttempts: post.maxAttempts, shuffle: post.shuffle } : undefined,
    isPublic: t.isPublic,
  }
}

/** Admin-scheduled trainings this person is invited to, plus public ones open to everyone (cancelled sessions are left out). */
export const adminTrainingsFor = (data: AdminData, personId: string): Training[] =>
  data.trainings.filter((t) => t.status !== 'CANCELLED' && (t.participantIds.includes(personId) || t.isPublic)).map((t) => adminToLearnerTraining(data, t))
