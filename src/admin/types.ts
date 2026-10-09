export type MaterialType = 'DOCUMENT' | 'VIDEO' | 'PRESENTATION' | 'LINK'

export type Material = {
  id: string
  title: string
  type: MaterialType
  minutes: number
  description: string
  updatedAt: string
}

export type JourneyModule = {
  id: string
  title: string
  materialIds: string[]
}

export type Journey = {
  id: string
  name: string
  description: string
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
}

export type Group = {
  id: string
  name: string
  description: string
}

export type TrainingStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

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

export type AdminTraining = {
  id: string
  name: string
  journeyId: string
  typeId: string
  trainerId: string
  date: string
  startTime: string
  endTime: string
  location: string
  recurring: boolean
  status: TrainingStatus
  participantIds: string[]
  preAssessmentId?: string
  postAssessmentId?: string
  feedbackFormId?: string
  teamsMeeting?: TeamsMeeting
  attendance?: AttendanceSync
  /** participantId -> moduleId -> percent complete */
  progress: Record<string, Record<string, number>>
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type TrainingRequest = {
  id: string
  requesterId: string
  topic: string
  journeyId?: string
  participants: number
  preferredDate: string
  reason: string
  status: RequestStatus
  createdAt: string
}

export type AssessmentKind = 'PRE' | 'POST'

export type Assessment = {
  id: string
  title: string
  kind: AssessmentKind
  passMark: number
  questions: { id: string; question: string; options: string[]; answer: number }[]
}

export type FeedbackForm = {
  id: string
  title: string
  questions: string[]
}

export type FeedbackResponse = {
  id: string
  formId: string
  trainingId: string
  participantId: string
  ratings: number[]
  comment: string
  submittedAt: string
}

export type CertificateTemplate = {
  id: string
  name: string
  accent: 'green' | 'red' | 'dark'
  title: string
  isDefault: boolean
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
}

export type AdminData = {
  materials: Material[]
  journeys: Journey[]
  people: Person[]
  groups: Group[]
  trainings: AdminTraining[]
  requests: TrainingRequest[]
  assessments: Assessment[]
  feedbackForms: FeedbackForm[]
  feedbackResponses: FeedbackResponse[]
  templates: CertificateTemplate[]
  trainingTypes: TrainingType[]
  auditLogs: AuditLog[]
  attendanceRules: AttendanceRules
}
