import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { COURSES, POSTS, seedMessages, type Comment, type Msg, type Post } from './data'

/** Everything the learner does, kept in this browser so it survives a refresh. */
export type LiteState = {
  liked: string[]
  saved: string[]
  viewed: string[]
  quiz: Record<string, number>
  xp: number
  following: string[]
  comments: Record<string, Comment[]>
  chats: Record<string, Msg[]>
  lastRead: Record<string, number>
  posts: Post[]
  reacted: string[]
  enrolled: string[]
  certified: string[]
  reminders: string[]
  streak: { days: number; last: string }
  muted: boolean
  /** Your star rating per trainer. */
  ratings: Record<string, number>
  /** Profile status shown in the bubble next to your photo. */
  status: string
  notifications: boolean
  lang: string
}

const KEY = 'academy-lite:v1'
const day = (d = new Date()) => d.toISOString().slice(0, 10)
const yesterday = () => day(new Date(Date.now() - 86_400_000))

function initial(): LiteState {
  const now = Date.now()
  const chats = seedMessages(now)
  return {
    liked: [],
    saved: [],
    viewed: [],
    quiz: {},
    xp: 120,
    following: ['t1'],
    comments: {},
    chats,
    // Everything is read except the newest few, so the inbox shows unread badges.
    lastRead: { dereje: now, mariamawit: now, hana: now, bereket: now, selamawit: now, 'bole-team': now, 'sp-start': now, 'sp-guides': now, 'sp-recordings': now, 'sp-merch-news': now, 'sp-merch-ask': now, 'sp-merch-chat': now, 'sp-scam-ask': now, 'sp-ask': now - 6 * 60 * 60_000, 'sp-general': now - 4 * 60 * 60_000, 'sp-wins': now - 60 * 60_000, 'sp-announce': now - 2 * 60 * 60_000, 'sp-events': now - 3 * 60 * 60_000, 'sp-scam-news': now - 2 * 60 * 60_000, 'sp-scam-chat': now - 60 * 60_000, announce: now - 60 * 60_000, 'fraud-group': now - 60 * 60_000 },
    posts: POSTS,
    reacted: [],
    enrolled: ['basics', 'fraud'],
    certified: [],
    reminders: [],
    streak: { days: 3, last: yesterday() },
    muted: true,
    ratings: {},
    status: '📚 Learning Spot the Scam',
    notifications: true,
    lang: 'English',
  }
}

function load(): LiteState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const fresh = initial()
      const saved = JSON.parse(raw) as Partial<LiteState>
      // New chats (e.g. a new trainer) appear for returning learners too.
      return { ...fresh, ...saved, chats: { ...fresh.chats, ...saved.chats }, lastRead: { ...fresh.lastRead, ...saved.lastRead }, posts: POSTS, muted: true }
    }
  } catch {
    // Fall back to a fresh start.
  }
  return initial()
}

type Ctx = {
  s: LiteState
  set: (fn: (s: LiteState) => LiteState) => void
  toggle: (key: 'liked' | 'saved' | 'following' | 'reacted' | 'reminders' | 'enrolled', id: string) => void
  markViewed: (itemId: string) => void
  answer: (itemId: string, choice: number, correct: boolean) => void
  progress: (courseId: string) => { done: number; total: number; pct: number }
  reset: () => void
}
const LiteContext = createContext<Ctx | null>(null)

export function LiteProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<LiteState>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage full or blocked: keep going in memory.
    }
  }, [s])

  const set = useCallback((fn: (s: LiteState) => LiteState) => setS(fn), [])
  const toggle = useCallback<Ctx['toggle']>((key, id) => setS((x) => ({ ...x, [key]: x[key].includes(id) ? x[key].filter((v) => v !== id) : [...x[key], id] })), [])

  // Watching anything counts toward the daily streak.
  const bumpStreak = (x: LiteState): LiteState['streak'] => {
    const today = day()
    if (x.streak.last === today) return x.streak
    return { days: x.streak.last === yesterday() ? x.streak.days + 1 : 1, last: today }
  }
  const markViewed = useCallback((itemId: string) => setS((x) => (x.viewed.includes(itemId) ? x : { ...x, viewed: [...x.viewed, itemId], xp: x.xp + 2, streak: bumpStreak(x) })), [])
  const answer = useCallback<Ctx['answer']>(
    (itemId, choice, correct) =>
      setS((x) => (itemId in x.quiz ? x : { ...x, quiz: { ...x.quiz, [itemId]: choice }, viewed: x.viewed.includes(itemId) ? x.viewed : [...x.viewed, itemId], xp: x.xp + (correct ? 10 : 2), streak: bumpStreak(x) })),
    [],
  )
  const progress = useCallback<Ctx['progress']>(
    (courseId) => {
      const c = COURSES.find((x) => x.id === courseId)
      const total = c?.items.length ?? 0
      const done = c ? c.items.filter((i) => s.viewed.includes(i.id)).length : 0
      return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
    },
    [s.viewed],
  )
  const reset = useCallback(() => setS(initial()), [])

  const value = useMemo(() => ({ s, set, toggle, markViewed, answer, progress, reset }), [s, set, toggle, markViewed, answer, progress, reset])
  return <LiteContext.Provider value={value}>{children}</LiteContext.Provider>
}

export function useLite() {
  const ctx = useContext(LiteContext)
  if (!ctx) throw new Error('useLite must be used inside LiteProvider')
  return ctx
}

/** Unread messages in a chat (messages from others after the last time it was opened). */
/** When the first tap turned the sound on, so that same tap doesn't also pause a video. */
export const soundUnlock = { at: 0 }

export const unreadIn = (s: LiteState, chatId: string) => (s.chats[chatId] ?? []).filter((m) => m.from !== 'me' && m.at > (s.lastRead[chatId] ?? 0)).length
