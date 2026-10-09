export type BannerTheme = 'red' | 'fayda' | 'green' | 'optimization' | 'merchant' | 'dark'

export type Module = {
  id: string
  title: string
  minutes: number
}

export type QuizQuestion = {
  id: string
  question: string
  options: string[]
  answer: number
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
  category: string
  banner: BannerTheme
  /** Cover photo under /public; when set it replaces the drawn banner. */
  cover?: string
  bannerTitle?: string
  description: string
  modules: Module[]
  quiz: QuizQuestion[]
}

export type TrainingProgress = {
  completedModules: string[]
  quizScore?: number
  attended?: boolean
  completedAt?: string
}

export type ProgressStatus = 'Completed' | 'In Progress' | 'Not Started'
export type SessionStatus = 'Active' | 'Upcoming' | 'Completed'

export type User = {
  name: string
  email: string
  phone: string
  role: string
}
