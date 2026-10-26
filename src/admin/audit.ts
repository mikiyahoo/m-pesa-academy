import type { AdminData, AuditLog } from './types'

export const AUDIT_ACTION_CATEGORIES = ['Create', 'Update', 'Delete', 'Approve', 'Reject', 'Cancel', 'Reschedule', 'Status Change', 'Invite'] as const
export type AuditActionCategory = (typeof AUDIT_ACTION_CATEGORIES)[number]

export const AUDIT_ENTITY_TYPES = [
  'User',
  'Training Request',
  'Training Journey',
  'Group',
  'Category',
  'Feedback Template',
  'Feedback Question',
  'Assessment Template',
  'Assessment Question',
  'Material',
  'Training',
  'Certificate Template',
  'Certificate',
  'Assessment Submission',
  'Training Type',
  'Other',
] as const

export function auditActionCategory(action: string): AuditActionCategory {
  const value = action.toLowerCase()
  if (/\bapprove/.test(value)) return 'Approve'
  if (/\breject/.test(value)) return 'Reject'
  if (/\bcancel|cancelled|canceled/.test(value)) return 'Cancel'
  if (/\breschedul/.test(value)) return 'Reschedule'
  if (/\binvit|invite\b/.test(value)) return 'Invite'
  if (/\bdelete|\bremove/.test(value)) return 'Delete'
  if (/\bcreate|\badd|\bclone|\bupload/.test(value)) return 'Create'
  if (/\b(start|started|close|closed|complete|completed|status|grade|graded|issue|issued|reissue|reissued|link|linked|unlink|unlinked|trainer changed)\b/.test(value)) return 'Status Change'
  return 'Update'
}

export function inferAuditEntityType(action: string, target: string): string {
  const value = `${action} ${target}`.toLowerCase()
  if (/training request/.test(value)) return 'Training Request'
  if (/journey/.test(value)) return 'Training Journey'
  if (/group/.test(value)) return 'Group'
  if (/categor/.test(value)) return 'Category'
  if (/feedback.*(question|bank)|question.*feedback/.test(value)) return 'Feedback Question'
  if (/feedback|appreciation/.test(value)) return 'Feedback Template'
  if (/assessment.*(question|bank)|question.*assessment|question.*bank|bank question/.test(value)) return 'Assessment Question'
  if (/submission/.test(value)) return 'Assessment Submission'
  if (/assessment|grade/.test(value)) return 'Assessment Template'
  if (/certificate.*template/.test(value)) return 'Certificate Template'
  if (/certificate/.test(value)) return 'Certificate'
  if (/material|file|reading reminder/.test(value)) return 'Material'
  if (/training type/.test(value)) return 'Training Type'
  if (/user|person|participant|trainee|invite/.test(value)) return 'User'
  if (/attendance|teams meeting|training|session/.test(value)) return 'Training'
  return 'Other'
}

type EntityCollection = { type: string; records: unknown[]; fields: string[] }

function collections(data: AdminData): EntityCollection[] {
  return [
    { type: 'User', records: data.people, fields: ['id', 'name', 'email'] },
    { type: 'Training Request', records: data.requests, fields: ['id', 'topic'] },
    { type: 'Training', records: data.trainings, fields: ['id', 'name'] },
    { type: 'Material', records: data.materials, fields: ['id', 'title'] },
    { type: 'Training Journey', records: data.journeys, fields: ['id', 'name'] },
    { type: 'Group', records: data.groups, fields: ['id', 'name'] },
    { type: 'Category', records: data.categories, fields: ['id', 'name'] },
    { type: 'Feedback Template', records: data.feedbackForms, fields: ['id', 'title', 'name'] },
    { type: 'Feedback Question', records: data.feedbackBank, fields: ['id', 'question'] },
    { type: 'Assessment Template', records: data.assessments, fields: ['id', 'title'] },
    { type: 'Assessment Question', records: data.questionBank, fields: ['id', 'text', 'prompt'] },
    { type: 'Certificate Template', records: data.templates, fields: ['id', 'name'] },
    { type: 'Assessment Submission', records: data.submissions, fields: ['id'] },
    { type: 'Training Type', records: data.trainingTypes, fields: ['id', 'name'] },
  ]
}

/** Resolve a human-readable audit target to its record ID where possible. */
export function resolveAuditEntity(data: AdminData, action: string, target: string) {
  const expectedType = inferAuditEntityType(action, target)
  const targetParts = target.split(' · ').map((part) => part.trim().toLocaleLowerCase()).filter(Boolean)
  const available = collections(data).sort((a, b) => Number(b.type === expectedType) - Number(a.type === expectedType))

  for (const collection of available) {
    for (const record of collection.records as Record<string, unknown>[]) {
      for (const field of collection.fields) {
        const value = record[field]
        if (typeof value !== 'string') continue
        const normalized = value.trim().toLocaleLowerCase()
        if (targetParts.includes(normalized)) return { entityId: String(record.id), entityType: collection.type }
      }
    }
  }

  return { entityId: undefined, entityType: expectedType }
}

export function auditEntityType(log: AuditLog) {
  return log.entityType || inferAuditEntityType(log.action, log.target)
}
