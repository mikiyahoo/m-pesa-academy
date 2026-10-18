export type BannerTheme = 'red' | 'fayda' | 'green' | 'optimization' | 'merchant' | 'dark'

/** One page of a module presentation, rendered by the lesson viewer. */
export type Slide = {
  title: string
  bullets: string[]
}

export type Module = {
  id: string
  title: string
  minutes: number
  /** Documents need a minimum viewing time before they can be marked complete; videos complete when watched (TE-3.1). */
  kind: 'document' | 'video'
  /** Video lesson streamed by the player (sample files under /public/trainings, TE-3.2). */
  video?: string
  /** Source deck offered for download next to the in-app slides (sample file under /public/trainings). */
  deck?: string
  /** Presentation pages shown by the lesson viewer for document modules. */
  slides?: Slide[]
  /** Groups allowed to download the deck (D4); unset = everyone enrolled. Videos never download. */
  downloadGroupIds?: string[]
}

export type QuizQuestion = {
  id: string
  question: string
  options: string[]
  answer: number
}

/** Learner quiz rules (Q07): time limit, attempt cap and option shuffling. */
export type QuizSettings = {
  timeLimitMinutes?: number
  maxAttempts?: number
  shuffle?: boolean
}

export type Training = {
  id: string
  title: string
  trainer: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  venue: string
  /** Microsoft Teams join link for live sessions. */
  teamsJoinUrl?: string
  /** Recording of a held session, streamed in the portal when the trainer shares it. */
  recording?: string
  category: string
  banner: BannerTheme
  /** Cover photo under /public; when set it replaces the drawn banner. */
  cover?: string
  bannerTitle?: string
  description: string
  modules: Module[]
  quiz: QuizQuestion[]
  quizSettings?: QuizSettings
}

/** Post-training feedback (TA-4.1, TE-4.1, URS 2.6). Likert scores are 1 (strongly disagree) to 5. */
export type FeedbackSubmission = {
  likert: number[]
  recommend: boolean
  comment: string
  anonymous: boolean
  submittedAt: string
}

export type CheckInMethod = 'qr' | 'link' | 'manual' | 'teams'

export type TrainingProgress = {
  completedModules: string[]
  quizScore?: number
  /** Quiz attempts used against the maxAttempts cap (Q07). */
  attempts?: number
  attended?: boolean
  /** When and how the trainee checked in (TE-5.1); compared with the start time for Present / Late. */
  checkInAt?: string
  checkInMethod?: CheckInMethod
  feedback?: FeedbackSubmission
  completedAt?: string
}

export type AttendanceMark = 'Present' | 'Late' | 'Absent' | 'Not yet'

export type ProgressStatus = 'Completed' | 'In Progress' | 'Not Started'
export type SessionStatus = 'Active' | 'Upcoming' | 'Completed'

export type User = {
  name: string
  email: string
  phone: string
  role: string
}
