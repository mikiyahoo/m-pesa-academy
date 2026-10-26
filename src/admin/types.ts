export type MaterialType = 'DOCUMENT' | 'VIDEO' | 'PRESENTATION' | 'LINK'

/** Thumbnail presets offered in the material editor (C01). */
export const MATERIAL_THUMBNAILS = ['red', 'fayda', 'green', 'blue', 'amber', 'zinc'] as const

export type Material = {
  id: string
  title: string
  type: MaterialType
  minutes: number
  description: string
  updatedAt: string
  /** Difficulty level shown on the materials list (TA-3.1, D3). */
  level?: TrainingLevel
  /** Skills practised, used for filtering (TA-3.1). */
  skills: string[]
  /** Colour preset for the card thumbnail. */
  thumbnail?: (typeof MATERIAL_THUMBNAILS)[number]
  /** Documents: minimum seconds before the learner can complete them (TE-3.1). */
  minViewSeconds?: number
  /** Groups that may download the file (D4). Videos are never downloadable. */
  downloadableGroupIds: string[]
  /** Groups that can see the material; empty = everyone enrolled (TA-3.1). */
  visibleGroupIds: string[]
  /** Trainers this material is tagged to (C02). */
  taggedTrainerIds: string[]
  /** Bumped on every file replacement (C03). */
  version: number
  /** Version history: replacements and edits (C03). */
  history: { at: string; by: string; change: string }[]
  /** Uploaded file's metadata. The file bytes live in browser IndexedDB in this prototype. */
  fileId?: string
  fileName?: string
  fileSize?: number
  /** External URL for LINK materials and stream-only videos (URS 5: videos are links). */
  url?: string
  /** Groups assigned this material directly as self-paced mandatory reading (no session). */
  assignedGroupIds?: string[]
  /** Individual users assigned this material directly, in addition to or instead of groups. */
  assignedPersonIds?: string[]
  /** Optional due date for standalone reading assignments. */
  dueDate?: string
  /** Assignment needs an "I have read and understood" acknowledgement from each person. */
  requiresAck?: boolean
  /** When the material was first assigned. */
  assignedAt?: string
  /** Per-person assignment progress, keyed by person id. */
  assignmentProgress?: Record<string, { openedAt?: string; acknowledgedAt?: string; remindedAt?: string }>
}

export type JourneyModule = {
  id: string
  title: string
  materialIds: string[]
  /** Assessment assigned to this module (TA-3.5). */
  assessmentId?: string
}

export type Journey = {
  id: string
  name: string
  description: string
  /** Journey availability window (TA-3.5). */
  startDate?: string
  endDate?: string
  modules: JourneyModule[]
}

export type AdminUserRole = 'Admin' | 'Trainer' | 'Participant'
export type AdminUserStatus = 'Active' | 'Inactive'

export type Person = {
  id: string
  name: string
  email: string
  phone: string
  role: AdminUserRole
  status: AdminUserStatus
  department: string
  groupIds: string[]
  createdAt: string
  /** Can submit training requests for their team (TA-1.7). Internal users only. */
  isRequester?: boolean
  /** Trainer allowed to approve training requests (URS 2.3). */
  canApprove?: boolean
  /** Profile details captured at first login (TE-1.1) and on check-in (TE-5.1). */
  designation?: string
  organization?: string
  region?: string
  /** Admin who originally created the profile. */
  createdBy?: string
  /** Temporary (invited) users only (TA-1.3/1.4, URS 2.1). Dates are inclusive. */
  accessStart?: string
  accessEnd?: string
  inviteToken?: string
  invitedAt?: string
  invitedBy?: string
  acceptedAt?: string
  lastSignInAt?: string
  revokedAt?: string
  /** Access-window changes kept for audit. */
  accessHistory?: { at: string; by: string; change: string }[]
}

export type Group = {
  id: string
  name: string
  description: string
  organization?: string
  createdAt?: string
  createdBy?: string
}

export type TrainingStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

/** How a participant checked in (TE-5.1). */
export type CheckinMethod = 'qr' | 'link' | 'manual' | 'offline'

/** Attendance result of a single check-in (URS 2.7: Present or Late). */
export type CheckinStatus = 'Present' | 'Late'

/** One participant's check-in. Manual marks need a comment and start unverified. */
export type Checkin = {
  personId: string
  at: string // local ISO datetime
  method: CheckinMethod
  status: CheckinStatus
  /** Required for manual marks; optional note for any entry. */
  comment?: string
  /** Manual marks are created unverified until an admin confirms them. */
  verified: boolean
  by: string
}

/** Live check-in session: started by an admin, QR token rotates every 10 s. */
export type CheckinSession = {
  startedAt: string
  token: string
  closedAt?: string
}

/** Mirrors Microsoft Graph `attendanceRecord` (only the fields we use). */
export type AttendanceRecord = {
  emailAddress: string
  displayName: string
  role: 'Organizer' | 'Presenter' | 'Attendee'
  totalAttendanceInSeconds: number
  attendanceIntervals: { joinDateTime: string; leaveDateTime: string; durationInSeconds: number }[]
}

export type TeamsMeeting = {
  joinUrl: string
  /** Graph onlineMeeting id; needed to fetch attendance reports. */
  meetingId: string
}

export type AttendanceSync = {
  syncedAt: string
  source: 'graph' | 'simulated'
  records: AttendanceRecord[]
}

export type AttendanceRules = {
  /** Present when attended at least this % of the scheduled session. */
  presentPct: number
  /** Late when first joined more than this many minutes after the start. */
  lateMinutes: number
  /** Absent below this %; between this and presentPct is Incomplete. */
  absentBelowPct: number
}

/** Training levels from TA-3.1 / URS 2.4 (whether "Novice" stays is open decision D3). */
export type TrainingLevel = 'Novice' | 'Beginner' | 'Intermediate' | 'Advanced'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly'

/** Repeat rule (TA-2.3, URS 2.3), e.g. weekly every 1 week on Tue+Fri until a date. */
export type Recurrence = {
  freq: RecurrenceFreq
  interval: number
  /** 0 = Sunday … 6 = Saturday; weekly only. */
  weekdays: number[]
  until: string
}

/** Schedule changes kept for audit (TA-2.4, URS 2.3: "reschedule history retained"). */
export type TrainingEvent = {
  at: string
  by: string
  action: 'Created' | 'Rescheduled' | 'Cancelled' | 'Trainer changed' | 'Invited'
  reason?: string
  detail?: string
}

export type AdminTraining = {
  id: string
  name: string
  /** Reference to a shared uploaded cover, stored once even for recurring sessions. */
  coverId?: string
  journeyId: string
  typeId: string
  /** Primary trainer, kept for compatibility with existing records. */
  trainerId: string
  /** All assigned trainers; includes trainerId when set. */
  trainerIds?: string[]
  date: string
  startTime: string
  endTime: string
  location: string
  /** True for every session that belongs to a series. */
  recurring: boolean
  /** Sessions generated from one repeat rule share a series id. */
  seriesId?: string
  recurrence?: Recurrence
  categoryId?: string
  subcategoryId?: string
  level?: TrainingLevel
  description?: string
  delivery?: 'Online' | 'Physical'
  /** Shareable link for participants (URS 2.3 "copy and share the invite link"). */
  inviteLink?: string
  history?: TrainingEvent[]
  status: TrainingStatus
  participantIds: string[]
  preAssessmentId?: string
  postAssessmentId?: string
  feedbackFormId?: string
  teamsMeeting?: TeamsMeeting
  attendance?: AttendanceSync
  /** Self-service check-ins recorded from the learner portal (TE-5.1). */
  checkins?: Checkin[]
  checkinSession?: CheckinSession
  /** Certificates issued for this session (X02, X06). */
  certificates?: IssuedCertificate[]
  /** When automatic issuing last ran; unset = not yet triggered (X06). */
  certificatesRunAt?: string
  /** participantId -> moduleId -> percent complete */
  progress: Record<string, Record<string, number>>
}

/** A certificate issued to one participant (X02): automatic on eligibility, or manual with a reason. */
export type IssuedCertificate = {
  personId: string
  issuedAt: string
  issuedBy: string
  method: 'auto' | 'manual'
  templateId: string
  reason?: string
  reissuedAt?: string
}

export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

export type RequestParticipant = { name: string; email: string }
export type RequestAttachment = { name: string; size: number; type: string }
export type RequestEvent = { at: string; by: string; label: string; detail?: string }

/** Training request (RQ-1.1–1.6, URS 2.2). */
export type TrainingRequest = {
  id: string
  requesterId: string
  /** Requester's team at the time of the request; used for duplicate checks and link sharing. */
  team: string
  topic: string
  trainingTypeId: string
  categories: string[]
  /** Sub-category names chosen under the selected categories. */
  subcategories?: string[]
  otherCategory: string
  targetGroupIds: string[]
  audienceNote: string
  delivery: 'Online' | 'Physical'
  location: string
  preferredDate: string
  preferredTime: string
  participants: RequestParticipant[]
  objectives: string
  description: string
  attachments: RequestAttachment[]
  status: RequestStatus
  createdAt: string
  submittedAt?: string
  /** Drafts are discarded after 24 hours (RQ-1.2). */
  draftExpiresAt?: string
  trainerId?: string
  trainerIds?: string[]
  trainingId?: string
  joinLink?: string
  rejection?: { reason: string; comment: string }
  history: RequestEvent[]
}

export type AssessmentKind = 'PRE' | 'POST'

/** Question types (TA-4.3): multiple choice, free text or a file upload. */
export type QuestionType = 'mcq' | 'descriptive' | 'upload'

export type AssessmentQuestion = {
  id: string
  type: QuestionType
  question: string
  options?: string[]
  /** MCQ: index of the correct option. Descriptive: model answer. */
  answer?: number | string
  /** Share of the total score (Q04). */
  weight: number
}

export type Assessment = {
  id: string
  title: string
  kind: AssessmentKind
  passMark: number
  /** Whether participants must pass to complete the training. */
  mandatory?: boolean
  /** ISO date after which the assessment locks (when lockAfterDeadline). */
  deadline?: string
  timeLimitMinutes?: number
  /** Whether the countdown runs per test or per question. */
  timerScope?: 'test' | 'question'
  maxAttempts?: number
  shuffle: boolean
  lockAfterDeadline: boolean
  /** How results are reported (Q04). */
  grading: 'score' | 'passfail'
  /** Topic the assessment belongs to, used in failure reports (Q09). */
  topic?: string
  /** Set on clones so results can be traced back to the template (Q06). */
  templateOf?: string
  questions: AssessmentQuestion[]
}

/** Reusable question bank (Q05), categorised by product. */
export type QuestionBankItem = {
  id: string
  category: string
  type: QuestionType
  question: string
  options?: string[]
  answer?: number | string
  weight: number
}

/** One participant's attempt at an assessment (Q03, Q08). */
export type AssessmentSubmission = {
  id: string
  assessmentId: string
  trainingId: string
  personId: string
  attempt: number
  /** questionId -> option index (mcq) or text (descriptive/upload). */
  answers: Record<string, number | string>
  score?: number
  status: 'graded' | 'needs-grading'
  comment?: string
  startedAt: string
  submittedAt: string
}

/** Feedback question types (F03): 5-point Likert, Yes/No or open comment. */
export type FeedbackQuestionType = 'likert' | 'yesno' | 'open'

export type FeedbackForm = {
  id: string
  title: string
  questions: string[]
  /** Type per question, same order as `questions`; missing = likert. */
  questionTypes?: FeedbackQuestionType[]
  /** Training types this form is the template for (F03). */
  trainingTypeIds?: string[]
}

/** Reusable feedback questions (F03). */
export type FeedbackBankItem = { id: string; category: string; question: string; type: FeedbackQuestionType }

export type FeedbackResponse = {
  id: string
  formId: string
  trainingId: string
  participantId: string
  /** Likert 1–5, Yes/No as 1/0, open questions 0 (their text is in `texts`). */
  ratings: number[]
  /** Answers to open questions, by question index. */
  texts?: Record<number, string>
  comment: string
  submittedAt: string
}

export type CertificateTemplate = {
  id: string
  name: string
  accent: 'green' | 'red' | 'dark'
  title: string
  isDefault: boolean
  /** Certificate layout (see components/CertificateDesign). */
  layout?: 'sweep' | 'border' | 'tiles'
  /** Imported fillable PDF template, base64-encoded for local storage. */
  pdfTemplateData?: string
  pdfFileName?: string
  pdfFileSize?: number
  /** Training types that use this template (X03); otherwise the default applies. */
  assignedTypeIds?: string[]
}

/** Content / training categories with sub-categories (TA-3.7, URS 2.4). */
export type Category = {
  id: string
  name: string
  description: string
  subcategories: { id: string; name: string; description: string }[]
}

export type TrainingType = {
  id: string
  name: string
  category: 'Internal' | 'Partner' | 'Customer'
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  description: string
}

export type AuditLog = {
  id: string
  actor: string
  action: string
  target: string
  at: string // ISO datetime
  /** Affected record metadata; older entries are resolved from their action and target when displayed. */
  entityId?: string
  entityType?: string
  remarks?: string
  /** Field-level before/after values (Y02). */
  changes?: AuditChange[]
}

export type AuditChange = { field: string; from: string; to: string }

/** Raised on low feedback (F04) or low attendance (T06); email delivery is simulated. */
export type AdminAlert = {
  id: string
  kind: 'low-feedback' | 'low-attendance'
  trainingId: string
  message: string
  at: string
  read: boolean
  emailedTo: string
}

export type AlertRules = {
  /** Alert when a feedback response averages below this (1–5). */
  feedbackBelow: number
  /** Alert when a group's attendance for a session falls below this %. */
  attendanceBelow: number
}

export type AdminData = {
  materials: Material[]
  journeys: Journey[]
  people: Person[]
  groups: Group[]
  trainings: AdminTraining[]
  /** Uploaded training cover images keyed by coverId (data URLs optimized for browser storage). */
  trainingCovers?: Record<string, string>
  requests: TrainingRequest[]
  assessments: Assessment[]
  questionBank: QuestionBankItem[]
  submissions: AssessmentSubmission[]
  feedbackForms: FeedbackForm[]
  feedbackResponses: FeedbackResponse[]
  templates: CertificateTemplate[]
  trainingTypes: TrainingType[]
  categories: Category[]
  auditLogs: AuditLog[]
  attendanceRules: AttendanceRules
  feedbackBank: FeedbackBankItem[]
  alerts: AdminAlert[]
  alertRules: AlertRules
  /** Learner views / downloads per material (C10, D04). */
  contentStats: Record<string, { views: number; downloads: number }>
  /** Appreciation emails sent to top trainees from Reports (simulated delivery). */
  appreciations?: { personId: string; at: string; by: string; subject: string }[]
  /** Gamification: per-person point events and earned badges. */
  gamification?: GamificationData
}

// ─── Gamification ────────────────────────────────────────────────────────────

export type BadgeId =
  | 'first-login'
  | 'first-complete'
  | 'perfect-score'
  | 'hat-trick'       // 3 trainings completed
  | 'speedster'       // Completed assessment under 5 min
  | 'top-learner'     // Ranked #1 on leaderboard at end of month
  | 'streak-7'        // 7-day learning streak
  | 'quiz-master'     // 5 perfect MCQ assessments
  | 'early-bird'      // Submitted assessment >1 day before deadline
  | 'team-player'     // Attended 3+ group trainings

export type Badge = {
  id: BadgeId
  label: string
  description: string
  icon: string        // emoji
  color: string       // tailwind bg class
  points: number      // bonus points awarded when earned
}

export const ALL_BADGES: Badge[] = [
  { id: 'first-login',   label: 'First Steps',       description: 'Logged in for the first time.',             icon: '🚀', color: 'bg-sky-500',     points: 50  },
  { id: 'first-complete',label: 'Completionist',      description: 'Completed your first training.',            icon: '🎯', color: 'bg-green-500',   points: 100 },
  { id: 'perfect-score', label: 'Perfect Score',      description: 'Scored 100% on an assessment.',            icon: '⭐', color: 'bg-yellow-500',  points: 150 },
  { id: 'hat-trick',     label: 'Hat-Trick',          description: 'Completed 3 trainings.',                    icon: '🎩', color: 'bg-purple-500',  points: 200 },
  { id: 'speedster',     label: 'Speedster',          description: 'Finished an assessment in under 5 minutes.',icon: '⚡', color: 'bg-orange-500',  points: 75  },
  { id: 'top-learner',   label: 'Top Learner',        description: 'Ranked #1 on the monthly leaderboard.',    icon: '🏆', color: 'bg-brand-500',   points: 500 },
  { id: 'streak-7',      label: '7-Day Streak',       description: '7 days of consecutive learning activity.',  icon: '🔥', color: 'bg-red-500',     points: 250 },
  { id: 'quiz-master',   label: 'Quiz Master',        description: 'Aced 5 assessments with a perfect score.',  icon: '🧠', color: 'bg-indigo-500',  points: 300 },
  { id: 'early-bird',    label: 'Early Bird',         description: 'Submitted an assessment 1+ day before due.', icon: '🐦', color: 'bg-teal-500',    points: 100 },
  { id: 'team-player',   label: 'Team Player',        description: 'Attended 3 or more group training sessions.',icon: '🤝', color: 'bg-pink-500',    points: 150 },
]

export type PointEventKind =
  | 'training-completed'
  | 'assessment-passed'
  | 'assessment-perfect'
  | 'badge-earned'
  | 'attendance-present'
  | 'attendance-early'
  | 'feedback-submitted'
  | 'streak-bonus'
  | 'material-completed'

export type PointEvent = {
  id: string
  personId: string
  kind: PointEventKind
  points: number
  at: string            // ISO datetime
  label: string         // human-readable description
  refId?: string        // trainingId / assessmentId / materialId
}

export type EarnedBadge = {
  badgeId: BadgeId
  earnedAt: string
}

export type PersonGamification = {
  personId: string
  points: number
  events: PointEvent[]
  badges: EarnedBadge[]
  /** ISO date of last activity, for streak calculation. */
  lastActivityAt?: string
  currentStreak?: number
}

export type GamificationData = {
  people: Record<string, PersonGamification>  // keyed by personId
}
