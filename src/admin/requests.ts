import type { Person, RequestParticipant, TrainingRequest } from './types'

/** Default categories listed in URS 2.4; the live list is managed on the Categories page (TA-3.7). */
export const REQUEST_CATEGORIES = ['Consumer', 'Enterprise', 'Saving & Credit', 'Agent / Merchant', 'IMT'] as const

export const REJECTION_REASONS = [
  'Duplicate of an existing request',
  'Training already scheduled for this team',
  'Insufficient business justification',
  'Trainer not available on the preferred dates',
  'Request details are incomplete',
  'Other',
] as const

/** Upload size limits per file type (RQ-1.1: "data size restrictions need to be configured"). */
export const ATTACHMENT_LIMITS: { label: string; ext: string[]; maxMb: number }[] = [
  { label: 'Spreadsheets (CSV, XLSX)', ext: ['csv', 'xlsx', 'xls'], maxMb: 5 },
  { label: 'Documents (PDF, DOCX, PPTX)', ext: ['pdf', 'docx', 'doc', 'pptx', 'ppt'], maxMb: 10 },
  { label: 'Images (PNG, JPG)', ext: ['png', 'jpg', 'jpeg'], maxMb: 5 },
]

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

/** Permanent access is limited to company domains (URS 2.1); anyone else is a temporary user. */
export const INTERNAL_DOMAINS = ['safaricom.et', 'mpesa.et']
export const isInternalEmail = (email: string) => INTERNAL_DOMAINS.some((d) => email.trim().toLowerCase().endsWith(`@${d}`))

export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export const isDraftExpired = (r: TrainingRequest, now = Date.now()) => r.status === 'DRAFT' && !!r.draftExpiresAt && new Date(r.draftExpiresAt).getTime() <= now

export function draftTimeLeft(r: TrainingRequest, now = Date.now()) {
  const ms = new Date(r.draftExpiresAt ?? 0).getTime() - now
  if (ms <= 0) return 'expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h ? `${h} h ${m} min left` : `${m} min left`
}

/**
 * Requests from the same team for the same training type on the same preferred date
 * (RQ-1.6, URS 3.1). Drafts and rejected requests don't count.
 */
export function findDuplicates(req: Pick<TrainingRequest, 'id' | 'team' | 'trainingTypeId' | 'preferredDate'>, all: TrainingRequest[]) {
  return all.filter(
    (r) =>
      r.id !== req.id &&
      (r.status === 'PENDING' || r.status === 'APPROVED') &&
      r.team.toLowerCase() === req.team.toLowerCase() &&
      r.trainingTypeId === req.trainingTypeId &&
      r.preferredDate === req.preferredDate,
  )
}

/**
 * Parses a pasted or uploaded trainee list. Accepts CSV/TSV with an optional header
 * ("name,email" in either order) or one entry per line ("Name <email>" or just an email).
 */
export function parseParticipants(text: string): { rows: RequestParticipant[]; errors: string[] } {
  const rows: RequestParticipant[] = []
  const errors: string[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let nameCol = 0
  let emailCol = 1
  lines.forEach((line, i) => {
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    if (i === 0 && cells.some((c) => /^e-?mail$/i.test(c))) {
      emailCol = cells.findIndex((c) => /^e-?mail$/i.test(c))
      nameCol = cells.findIndex((c) => /name/i.test(c))
      return
    }
    const angle = line.match(/^(.*)<([^>]+)>$/)
    let name = ''
    let email = ''
    if (angle) {
      name = angle[1].trim().replace(/^"|"$/g, '')
      email = angle[2].trim()
    } else if (cells.length === 1) {
      email = cells[0]
    } else {
      email = cells[emailCol] ?? ''
      name = nameCol >= 0 ? (cells[nameCol] ?? '') : ''
      // Tolerate "email,name" files without a header.
      if (!EMAIL_RE.test(email) && EMAIL_RE.test(cells[0] ?? '')) {
        email = cells[0]
        name = cells[1] ?? ''
      }
    }
    if (!EMAIL_RE.test(email)) errors.push(`Line ${i + 1}: “${line.slice(0, 60)}” has no valid email`)
    else rows.push({ name, email: email.toLowerCase() })
  })
  return { rows, errors }
}

/** Adds participants, skipping emails already in the list. */
export function mergeParticipants(current: RequestParticipant[], incoming: RequestParticipant[]) {
  const seen = new Map(current.map((p) => [p.email, p]))
  incoming.forEach((p) => {
    const existing = seen.get(p.email)
    if (!existing) seen.set(p.email, p)
    else if (!existing.name && p.name) seen.set(p.email, { ...existing, name: p.name })
  })
  return [...seen.values()]
}

export const makeJoinLink = (requestId: string) =>
  `${window.location.origin}/join/${requestId}-${Math.random().toString(36).slice(2, 10)}`

export const personByEmail = (people: Person[], email: string) => people.find((p) => p.email.toLowerCase() === email.toLowerCase())
