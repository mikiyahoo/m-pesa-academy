import type { AdminData } from './types'

/**
 * What each role may open in the admin area. Admins always have everything; department admins and
 * trainers get the areas switched on under Settings → Roles & access.
 */
export type Area = 'trainings' | 'requests' | 'content' | 'assessments' | 'feedback' | 'discussions' | 'certificates' | 'people' | 'reports' | 'settings'
export type LimitedRole = 'department' | 'trainer'
export type RolePermissions = Record<LimitedRole, Record<Area, boolean>>

export const AREAS: { id: Area; label: string; detail: string }[] = [
  { id: 'trainings', label: 'Trainings', detail: 'Schedule, edit and run trainings, calendar and visibility' },
  { id: 'requests', label: 'Training requests', detail: 'Review and approve requests (trainers also need “Can manage requests”)' },
  { id: 'content', label: 'Content', detail: 'Journeys, materials and assignments' },
  { id: 'assessments', label: 'Assessments', detail: 'Pre- and post-assessments, question bank and submissions' },
  { id: 'feedback', label: 'Feedback', detail: 'Feedback forms and responses' },
  { id: 'discussions', label: 'Discussions', detail: 'Moderate course Q&A' },
  { id: 'certificates', label: 'Certificates', detail: 'Issue and manage certificates' },
  { id: 'people', label: 'People', detail: 'Users, groups and temporary access' },
  { id: 'reports', label: 'Reports', detail: 'Reports and leaderboard' },
  { id: 'settings', label: 'Settings', detail: 'Categories, training types, venues, templates and audit log' },
]

export const DEFAULT_PERMISSIONS: RolePermissions = {
  department: { trainings: true, requests: true, content: true, assessments: true, feedback: true, discussions: true, certificates: true, people: true, reports: true, settings: false },
  trainer: { trainings: true, requests: true, content: true, assessments: true, feedback: true, discussions: true, certificates: true, people: true, reports: true, settings: true },
}

export const permissionsOf = (data: AdminData): RolePermissions => ({
  department: { ...DEFAULT_PERMISSIONS.department, ...data.rolePermissions?.department },
  trainer: { ...DEFAULT_PERMISSIONS.trainer, ...data.rolePermissions?.trainer },
})

const AREA_BY_PATH: [string, Area][] = [
  ['/admin/trainings', 'trainings'],
  ['/admin/calendar', 'trainings'],
  ['/admin/visibility', 'trainings'],
  ['/admin/requests', 'requests'],
  ['/admin/journeys', 'content'],
  ['/admin/materials', 'content'],
  ['/admin/assignments', 'content'],
  ['/admin/assessments', 'assessments'],
  ['/admin/submissions', 'assessments'],
  ['/admin/feedback', 'feedback'],
  ['/admin/discussions', 'discussions'],
  ['/admin/certificates', 'certificates'],
  ['/admin/certificate-templates', 'settings'],
  ['/admin/users', 'people'],
  ['/admin/groups', 'people'],
  ['/admin/temporary-access', 'people'],
  ['/admin/departments', 'people'],
  ['/admin/reports', 'reports'],
  ['/admin/leaderboard', 'reports'],
  ['/admin/settings', 'settings'],
  ['/admin/training-types', 'settings'],
  ['/admin/categories', 'settings'],
  ['/admin/venues', 'settings'],
  ['/admin/audit-logs', 'settings'],
]

/** The area a page belongs to; the dashboard belongs to none and is always open. */
export function areaOf(path: string): Area | null {
  const hit = AREA_BY_PATH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))
  return hit ? hit[1] : null
}

export function canOpen(data: AdminData, role: 'admin' | LimitedRole, path: string) {
  if (role === 'admin') return true
  const area = areaOf(path)
  return !area || permissionsOf(data)[role][area]
}
