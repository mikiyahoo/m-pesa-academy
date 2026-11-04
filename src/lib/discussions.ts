/**
 * Discussion Forums / Q&A system per Course and per Module.
 * Allows learners to post questions, upvote helpful answers, and get trainer responses.
 */

export type ForumComment = {
  id: string
  authorId: string
  authorName: string
  authorRole: string
  isTrainer?: boolean
  createdAt: string
  content: string
  upvotes: number
  upvotedBy: string[]
  /** Hidden by a moderator: only the author still sees it. */
  hidden?: boolean
  /** People who reported it to the admins. */
  flaggedBy?: string[]
  editedAt?: string
}

export type ForumThread = {
  id: string
  trainingId: string
  moduleId?: string
  moduleTitle?: string
  authorId: string
  authorName: string
  authorRole: string
  isTrainer?: boolean
  createdAt: string
  title: string
  content: string
  upvotes: number
  upvotedBy: string[]
  replies: ForumComment[]
  /** Marked answered by a trainer or admin. */
  resolved?: boolean
  /** Reply shown first as the best answer. */
  pinnedReplyId?: string
  /** No new replies. */
  locked?: boolean
  hidden?: boolean
  flaggedBy?: string[]
  editedAt?: string
}

const STORAGE_KEY = 'mpesa-learning:discussions:v2'

const SEED_THREADS: ForumThread[] = [
  {
    id: 'th-1',
    trainingId: '1',
    moduleId: '1-1',
    moduleTitle: 'Core Merchant Journeys',
    authorId: 'u-samuel',
    authorName: 'Samuel Kiptoo',
    authorRole: 'Customer Care Agent',
    createdAt: '2026-02-14T09:30:00Z',
    title: 'How should we handle merchant reversal requests when customer PIN is disputed?',
    content: 'When an agent escalates a reversal claiming the customer was defrauded, do we freeze the merchant wallet immediately before investigation or await supervisor clearance?',
    upvotes: 14,
    upvotedBy: ['user-1', 'user-2', 'user-3'],
    replies: [
      {
        id: 'rep-1',
        authorId: 'tr-john',
        authorName: 'John Kamau',
        authorRole: 'Lead Trainer',
        isTrainer: true,
        createdAt: '2026-02-14T11:15:00Z',
        content: 'Great question Samuel! Standard Operating Procedure: initiate a temporary flag under Category 4 within 15 minutes. The wallet freeze requires supervisor sign-off, but the dispute flag halts automated batch settlements.',
        upvotes: 22,
        upvotedBy: ['user-1', 'user-2', 'u-samuel'],
      },
      {
        id: 'rep-2',
        authorId: 'u-esther',
        authorName: 'Esther Mwangi',
        authorRole: 'Senior Support Specialist',
        createdAt: '2026-02-14T13:40:00Z',
        content: 'Also remember to attach the customer incident timestamp from the CDR logs — that speeds up the Fraud unit review by at least 24 hours.',
        upvotes: 9,
        upvotedBy: ['user-1'],
      },
    ],
  },
  {
    id: 'th-2',
    trainingId: '1',
    moduleId: '1-2',
    moduleTitle: 'Exception Handling & Refunds',
    authorId: 'u-grace',
    authorName: 'Grace Achieng',
    authorRole: 'Merchant Support',
    createdAt: '2026-02-18T14:10:00Z',
    title: 'Can we re-attempt the module assessment if our score is between 60% and 69%?',
    content: 'The pass mark is 70%. If someone scores 65% on the first try, is there a waiting period before the second attempt opens?',
    upvotes: 7,
    upvotedBy: ['user-2'],
    replies: [
      {
        id: 'rep-3',
        authorId: 'tr-mary',
        authorName: 'Mary Wanjiku',
        authorRole: 'Academy Trainer',
        isTrainer: true,
        createdAt: '2026-02-18T15:20:00Z',
        content: 'You can retake the quiz immediately up to your maximum allowed attempts (typically 3 attempts). We recommend reviewing the slide deck notes on section 2 before trying again!',
        upvotes: 11,
        upvotedBy: ['u-grace', 'user-1'],
      },
    ],
  },
  {
    id: 'th-3',
    trainingId: '2',
    moduleId: '2-1',
    moduleTitle: 'Compliance & AML Verification',
    authorId: 'u-peter',
    authorName: 'Peter Omondi',
    authorRole: 'Compliance Officer',
    createdAt: '2026-02-20T10:00:00Z',
    title: 'Valid acceptable identification documents for Fayda integration',
    content: 'Does the system accept the digital Fayda ID slip as primary identification, or is the physical national ID card mandatory for tier 3 accounts?',
    upvotes: 18,
    upvotedBy: ['user-1', 'user-3', 'user-4'],
    replies: [
      {
        id: 'rep-4',
        authorId: 'tr-john',
        authorName: 'John Kamau',
        authorRole: 'Lead Trainer',
        isTrainer: true,
        createdAt: '2026-02-20T11:45:00Z',
        content: 'Both are fully compliant under the updated 2026 CBK regulatory guidelines. Digital Fayda ID slips with verifiable QR barcodes carry the same legal weight as plastic cards.',
        upvotes: 19,
        upvotedBy: ['u-peter', 'user-1'],
      },
    ],
  },
  {
    id: 'th-4',
    trainingId: '2',
    authorId: 'u-abel',
    authorName: 'Abel Tesfaye',
    authorRole: 'Retail Shop Agent',
    createdAt: '2026-03-02T08:45:00Z',
    title: 'Is there a daily limit on how many customers one agent can register?',
    content: '',
    upvotes: 3,
    upvotedBy: ['user-2'],
    replies: [],
  },
]

const SEEDED_KEY = 'mpesa-learning:discussions:seeded'
const CHANGE = 'mpesa-discussions-change'

function readAll(): ForumThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Fall back to the samples.
  }
  saveThreads(SEED_THREADS)
  return SEED_THREADS
}

function seededFor(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEDED_KEY) ?? '[]')
  } catch {
    return []
  }
}

/**
 * Threads of one training, or all of them. A training opened for the first time gets its own copy
 * of the sample threads (real records, so trainers and admins can answer and moderate them).
 */
export function loadThreads(trainingId?: string): ForumThread[] {
  const list = readAll()
  if (!trainingId) return list
  const matches = list.filter((t) => t.trainingId === trainingId)
  const seeded = seededFor()
  if (matches.length || seeded.includes(trainingId) || SEED_THREADS.some((t) => t.trainingId === trainingId)) return matches
  const copies = SEED_THREADS.map((t) => ({
    ...t,
    id: `${t.id}-${trainingId}`,
    trainingId,
    moduleId: undefined,
    replies: t.replies.map((r) => ({ ...r, id: `${r.id}-${trainingId}` })),
  }))
  try {
    localStorage.setItem(SEEDED_KEY, JSON.stringify([...seeded, trainingId]))
  } catch {
    // Seeding is a demo convenience.
  }
  saveThreads([...list, ...copies])
  return copies
}

export function saveThreads(threads: ForumThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
  } catch {
    // Storage quota or privacy mode
  }
  window.dispatchEvent(new Event(CHANGE))
}

/** Re-renders when any discussion changes, in this tab or another. */
export function onThreadsChange(fn: () => void) {
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && fn()
  window.addEventListener(CHANGE, fn)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE, fn)
    window.removeEventListener('storage', onStorage)
  }
}

const mutate = (fn: (list: ForumThread[]) => ForumThread[]) => saveThreads(fn(readAll()))

export function addThread(newThread: Omit<ForumThread, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy' | 'replies'>): ForumThread {
  const thread: ForumThread = { ...newThread, id: `th-${Date.now()}`, createdAt: new Date().toISOString(), upvotes: 0, upvotedBy: [], replies: [] }
  mutate((list) => [thread, ...list])
  return thread
}

export function addReply(threadId: string, reply: Omit<ForumComment, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy'>): ForumComment {
  const comment: ForumComment = { ...reply, id: `rep-${Date.now()}`, createdAt: new Date().toISOString(), upvotes: 0, upvotedBy: [] }
  // A trainer's answer marks the question answered.
  mutate((list) => list.map((t) => (t.id === threadId ? { ...t, replies: [...t.replies, comment], resolved: t.resolved || !!reply.isTrainer } : t)))
  return comment
}

export function updateThread(threadId: string, patch: Partial<ForumThread>) {
  mutate((list) => list.map((t) => (t.id === threadId ? { ...t, ...patch } : t)))
}

export function deleteThread(threadId: string) {
  mutate((list) => list.filter((t) => t.id !== threadId))
}

export function updateReply(threadId: string, replyId: string, patch: Partial<ForumComment>) {
  mutate((list) => list.map((t) => (t.id === threadId ? { ...t, replies: t.replies.map((r) => (r.id === replyId ? { ...r, ...patch } : r)) } : t)))
}

export function deleteReply(threadId: string, replyId: string) {
  mutate((list) =>
    list.map((t) => (t.id === threadId ? { ...t, replies: t.replies.filter((r) => r.id !== replyId), pinnedReplyId: t.pinnedReplyId === replyId ? undefined : t.pinnedReplyId } : t)),
  )
}

const toggle = (ids: string[] | undefined, id: string) => (ids?.includes(id) ? ids.filter((x) => x !== id) : [...(ids ?? []), id])

export function toggleThreadFlag(threadId: string, userId: string) {
  mutate((list) => list.map((t) => (t.id === threadId ? { ...t, flaggedBy: toggle(t.flaggedBy, userId) } : t)))
}

export function toggleReplyFlag(threadId: string, replyId: string, userId: string) {
  mutate((list) => list.map((t) => (t.id === threadId ? { ...t, replies: t.replies.map((r) => (r.id === replyId ? { ...r, flaggedBy: toggle(r.flaggedBy, userId) } : r)) } : t)))
}

export function toggleThreadUpvote(threadId: string, userId: string) {
  mutate((list) =>
    list.map((t) => {
      if (t.id !== threadId) return t
      const upvotedBy = toggle(t.upvotedBy, userId)
      return { ...t, upvotes: upvotedBy.length, upvotedBy }
    }),
  )
}

export function toggleReplyUpvote(threadId: string, replyId: string, userId: string) {
  mutate((list) =>
    list.map((t) =>
      t.id !== threadId
        ? t
        : {
            ...t,
            replies: t.replies.map((r) => {
              if (r.id !== replyId) return r
              const upvotedBy = toggle(r.upvotedBy, userId)
              return { ...r, upvotes: upvotedBy.length, upvotedBy }
            }),
          },
    ),
  )
}

/** Open reports on a thread or any of its replies. */
export const flagCount = (t: ForumThread) => (t.flaggedBy?.length ?? 0) + t.replies.reduce((n, r) => n + (r.flaggedBy?.length ?? 0), 0)
/** No trainer or admin has answered yet. */
export const isUnanswered = (t: ForumThread) => !t.resolved && !t.replies.some((r) => r.isTrainer)
