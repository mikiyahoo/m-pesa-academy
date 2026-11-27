import type { AdminData } from './types'

/** Individual admin services that can be enabled for limited roles. */
export type Service =
  | 'trainings' | 'attendance' | 'visibility' | 'requests'
  | 'journeys' | 'materials' | 'assignments'
  | 'assessmentsPre' | 'assessmentsPost' | 'submissions'
  | 'feedbackForms' | 'feedbackResponses' | 'discussions'
  | 'certificates' | 'certificateTemplates'
  | 'users' | 'groups' | 'temporaryAccess' | 'departments'
  | 'reports' | 'leaderboard'
  | 'trainingTypes' | 'categories' | 'venues' | 'auditLogs'

export type LimitedRole = 'department' | 'trainer'
export type LegacyArea = 'trainings' | 'requests' | 'content' | 'assessments' | 'feedback' | 'discussions' | 'certificates' | 'people' | 'reports' | 'settings'

/** Stored permissions accept old broad keys so settings from earlier app versions can be upgraded. */
export type RolePermissions = Record<LimitedRole, Partial<Record<Service | LegacyArea, boolean>>>
export type EffectiveRolePermissions = Record<LimitedRole, Record<Service, boolean>>

export const SERVICES: { id: Service; group: string; label: string; detail: string }[] = [
  { id: 'trainings', group: 'Training delivery', label: 'Trainings', detail: 'Create, schedule and edit training sessions' },
  { id: 'attendance', group: 'Training delivery', label: 'Attendance & check-in', detail: 'View attendance lists and manage check-in' },
  { id: 'visibility', group: 'Training delivery', label: 'Training visibility', detail: 'Manage public, invite-only and department access' },
  { id: 'requests', group: 'Training delivery', label: 'Training requests', detail: 'Review, approve and schedule requests' },
  { id: 'journeys', group: 'Learning content', label: 'Learning paths', detail: 'Create and edit journeys and learning paths' },
  { id: 'materials', group: 'Learning content', label: 'Materials', detail: 'Upload, edit and organize learning materials' },
  { id: 'assignments', group: 'Learning content', label: 'Assignments', detail: 'Assign reading, track completion and send reminders' },
  { id: 'assessmentsPre', group: 'Assessment & feedback', label: 'Pre-assessments', detail: 'Manage pre-training assessments and questions' },
  { id: 'assessmentsPost', group: 'Assessment & feedback', label: 'Post-assessments', detail: 'Manage post-training assessments and questions' },
  { id: 'submissions', group: 'Assessment & feedback', label: 'Assessment submissions', detail: 'Review learner submissions and results' },
  { id: 'feedbackForms', group: 'Assessment & feedback', label: 'Feedback forms', detail: 'Create and edit feedback forms' },
  { id: 'feedbackResponses', group: 'Assessment & feedback', label: 'Feedback responses', detail: 'View learner feedback and response reports' },
  { id: 'discussions', group: 'Assessment & feedback', label: 'Discussions', detail: 'Moderate course questions and answers' },
  { id: 'certificates', group: 'Certificates', label: 'Certificate records', detail: 'View and issue learner certificates' },
  { id: 'certificateTemplates', group: 'Certificates', label: 'Certificate templates', detail: 'Create and edit certificate designs' },
  { id: 'users', group: 'People & access', label: 'Users', detail: 'View and manage user accounts and roles' },
  { id: 'groups', group: 'People & access', label: 'Groups', detail: 'Manage user groups and membership' },
  { id: 'temporaryAccess', group: 'People & access', label: 'Temporary access', detail: 'Invite guests and manage temporary accounts' },
  { id: 'departments', group: 'People & access', label: 'Departments', detail: 'Manage department profiles and access' },
  { id: 'reports', group: 'Insights', label: 'Reports', detail: 'View training and learner reports' },
  { id: 'leaderboard', group: 'Insights', label: 'Leaderboard', detail: 'View learner points and rankings' },
  { id: 'trainingTypes', group: 'Configuration & audit', label: 'Training types', detail: 'Configure training types and audiences' },
  { id: 'categories', group: 'Configuration & audit', label: 'Categories', detail: 'Configure training categories' },
  { id: 'venues', group: 'Configuration & audit', label: 'Venues', detail: 'Configure training venues and locations' },
  { id: 'auditLogs', group: 'Configuration & audit', label: 'Audit log', detail: 'Review administrative changes and access history' },
]

/** Services each limited portal can actually route to. Departments are always main-admin only. */
export const SERVICE_ROLE_SUPPORT: Record<LimitedRole, ReadonlySet<Service>> = {
  department: new Set(SERVICES.map(({ id }) => id).filter((id) => id !== 'departments')),
  trainer: new Set([
    'trainings', 'attendance', 'requests', 'journeys', 'materials', 'assignments',
    'assessmentsPre', 'assessmentsPost', 'submissions', 'feedbackForms', 'feedbackResponses',
    'discussions', 'certificates', 'users', 'groups', 'reports', 'leaderboard', 'trainingTypes',
  ]),
}

export const SETTINGS_SERVICES: Service[] = ['categories', 'trainingTypes', 'venues', 'certificateTemplates', 'auditLogs']

const LEGACY_AREA_FOR: Record<Service, LegacyArea> = {
  trainings: 'trainings', attendance: 'trainings', visibility: 'trainings', requests: 'requests',
  journeys: 'content', materials: 'content', assignments: 'content',
  assessmentsPre: 'assessments', assessmentsPost: 'assessments', submissions: 'assessments',
  feedbackForms: 'feedback', feedbackResponses: 'feedback', discussions: 'discussions',
  certificates: 'certificates', certificateTemplates: 'settings',
  users: 'people', groups: 'people', temporaryAccess: 'people', departments: 'people',
  reports: 'reports', leaderboard: 'reports',
  trainingTypes: 'settings', categories: 'settings', venues: 'settings', auditLogs: 'settings',
}

const LEGACY_DEFAULTS: Record<LimitedRole, Record<LegacyArea, boolean>> = {
  department: { trainings: true, requests: true, content: true, assessments: true, feedback: true, discussions: true, certificates: true, people: true, reports: true, settings: false },
  trainer: { trainings: true, requests: true, content: true, assessments: true, feedback: true, discussions: true, certificates: true, people: true, reports: true, settings: true },
}

const defaultFor = (role: LimitedRole): Record<Service, boolean> =>
  Object.fromEntries(SERVICES.map(({ id }) => [id, SERVICE_ROLE_SUPPORT[role].has(id) && LEGACY_DEFAULTS[role][LEGACY_AREA_FOR[id]]])) as Record<Service, boolean>

export const DEFAULT_PERMISSIONS: EffectiveRolePermissions = {
  department: defaultFor('department'),
  trainer: defaultFor('trainer'),
}

/** Expands legacy section-wide settings into service-level access, then applies granular overrides. */
export const permissionsOf = (data: AdminData): EffectiveRolePermissions => {
  const expand = (role: LimitedRole): Record<Service, boolean> => {
    const saved = data.rolePermissions?.[role] ?? {}
    return Object.fromEntries(SERVICES.map(({ id }) => {
      if (!SERVICE_ROLE_SUPPORT[role].has(id)) return [id, false]
      const granular = saved[id]
      const legacy = saved[LEGACY_AREA_FOR[id]]
      return [id, typeof granular === 'boolean' ? granular : typeof legacy === 'boolean' ? legacy : DEFAULT_PERMISSIONS[role][id]]
    })) as Record<Service, boolean>
  }
  return { department: expand('department'), trainer: expand('trainer') }
}

const SERVICE_BY_PATH: [string, Service][] = [
  ['/admin/trainings', 'trainings'],
  ['/admin/calendar', 'trainings'],
  ['/admin/visibility', 'visibility'],
  ['/admin/requests', 'requests'],
  ['/admin/journeys', 'journeys'],
  ['/admin/materials', 'materials'],
  ['/admin/assignments', 'assignments'],
  ['/admin/assessments/pre', 'assessmentsPre'],
  ['/admin/assessments/post', 'assessmentsPost'],
  ['/admin/submissions', 'submissions'],
  ['/admin/feedback/forms', 'feedbackForms'],
  ['/admin/feedback/responses', 'feedbackResponses'],
  ['/admin/feedback', 'feedbackForms'],
  ['/admin/discussions', 'discussions'],
  ['/admin/certificates', 'certificates'],
  ['/admin/certificate-templates', 'certificateTemplates'],
  ['/admin/settings/certificate-templates', 'certificateTemplates'],
  ['/admin/users', 'users'],
  ['/admin/groups', 'groups'],
  ['/admin/temporary-access', 'temporaryAccess'],
  ['/admin/departments', 'departments'],
  ['/admin/reports', 'reports'],
  ['/admin/leaderboard', 'leaderboard'],
  ['/admin/training-types', 'trainingTypes'],
  ['/admin/settings/training-types', 'trainingTypes'],
  ['/admin/settings/categories', 'categories'],
  ['/admin/categories', 'categories'],
  ['/admin/settings/venues', 'venues'],
  ['/admin/venues', 'venues'],
  ['/admin/settings/audit-logs', 'auditLogs'],
  ['/admin/audit-logs', 'auditLogs'],
]

/** Resolves the most specific service for a route, including pages nested under a service. */
export function serviceOf(path: string): Service | null {
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/'
  if (/^\/admin\/trainings\/[^/]+\/attendance$/.test(normalized)) return 'attendance'
  const hit = SERVICE_BY_PATH.find(([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}/`))
  return hit?.[1] ?? null
}

export function canOpen(data: AdminData, role: 'admin' | LimitedRole, path: string) {
  if (role === 'admin') return true
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/'
  if (normalized === '/admin/settings') {
    return role === 'department' && SETTINGS_SERVICES.some((service) => permissionsOf(data).department[service])
  }
  const service = serviceOf(path)
  return !service || permissionsOf(data)[role][service]
}
