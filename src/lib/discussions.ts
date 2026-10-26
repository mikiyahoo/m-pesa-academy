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
]

export function loadThreads(trainingId?: string): ForumThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let list: ForumThread[] = raw ? JSON.parse(raw) : SEED_THREADS
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_THREADS))
    }
    if (trainingId) {
      // Return threads for this training, or fallback sample threads if empty
      const matches = list.filter((t) => t.trainingId === trainingId)
      if (matches.length > 0) return matches
      // Adapt seed threads so every training has an active forum demo
      return SEED_THREADS.map((t) => ({ ...t, trainingId }))
    }
    return list
  } catch {
    return SEED_THREADS
  }
}

export function saveThreads(threads: ForumThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
  } catch {
    // Storage quota or privacy mode
  }
}

export function addThread(newThread: Omit<ForumThread, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy' | 'replies'>): ForumThread {
  const current = loadThreads()
  const thread: ForumThread = {
    ...newThread,
    id: `th-${Date.now()}`,
    createdAt: new Date().toISOString(),
    upvotes: 0,
    upvotedBy: [],
    replies: [],
  }
  const updated = [thread, ...current]
  saveThreads(updated)
  return thread
}

export function addReply(threadId: string, reply: Omit<ForumComment, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy'>): ForumComment {
  const current = loadThreads()
  const comment: ForumComment = {
    ...reply,
    id: `rep-${Date.now()}`,
    createdAt: new Date().toISOString(),
    upvotes: 0,
    upvotedBy: [],
  }
  const updated = current.map((t) => {
    if (t.id === threadId) {
      return { ...t, replies: [...t.replies, comment] }
    }
    return t
  })
  saveThreads(updated)
  return comment
}

export function toggleThreadUpvote(threadId: string, userId: string): number {
  const current = loadThreads()
  let newUpvotes = 0
  const updated = current.map((t) => {
    if (t.id === threadId) {
      const has = t.upvotedBy.includes(userId)
      const nextUpvotedBy = has ? t.upvotedBy.filter((id) => id !== userId) : [...t.upvotedBy, userId]
      newUpvotes = nextUpvotedBy.length
      return { ...t, upvotes: newUpvotes, upvotedBy: nextUpvotedBy }
    }
    return t
  })
  saveThreads(updated)
  return newUpvotes
}

export function toggleReplyUpvote(threadId: string, replyId: string, userId: string): number {
  const current = loadThreads()
  let newUpvotes = 0
  const updated = current.map((t) => {
    if (t.id === threadId) {
      const nextReplies = t.replies.map((r) => {
        if (r.id === replyId) {
          const has = r.upvotedBy.includes(userId)
          const nextUpvotedBy = has ? r.upvotedBy.filter((id) => id !== userId) : [...r.upvotedBy, userId]
          newUpvotes = nextUpvotedBy.length
          return { ...r, upvotes: newUpvotes, upvotedBy: nextUpvotedBy }
        }
        return r
      })
      return { ...t, replies: nextReplies }
    }
    return t
  })
  saveThreads(updated)
  return newUpvotes
}
