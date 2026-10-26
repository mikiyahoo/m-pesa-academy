import { Award, Bell, BookOpenCheck, CalendarClock, CheckCheck, MessageSquare, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LATE_WINDOW_MINUTES } from '../data/trainings'
import { certificateChecks, cn, formatDate, parseDate, progressStatus, timeRange, todayISO } from '../lib/utils'
import { loadNotificationPrefs } from '../lib/notificationPrefs'
import { assignmentDone, myLearnerId, useLearnerAssignments } from '../lib/assignments'
import { scopedKey } from '../lib/learner'
import { useStore } from '../store/AppStore'

const READ_KEY = 'mpesa-learning:notifications-read'
const RAISED_KEY = 'mpesa-learning:notifications-raised'

/**
 * When each notification was first raised. Kept per person so a notification keeps its place and
 * read state even when its wording changes (e.g. "in 3 days" → "tomorrow").
 */
function raisedAt(ids: string[]): Record<string, string> {
  let map: Record<string, string> = {}
  try {
    map = JSON.parse(localStorage.getItem(scopedKey(RAISED_KEY)) ?? '{}')
  } catch {
    // Start fresh.
  }
  const now = new Date().toISOString()
  const fresh = ids.filter((id) => !map[id])
  if (fresh.length) {
    fresh.forEach((id) => (map[id] = now))
    try {
      localStorage.setItem(scopedKey(RAISED_KEY), JSON.stringify(map))
    } catch {
      // Ordering is a convenience only.
    }
  }
  return map
}

type Note = { id: string; icon: LucideIcon; tone: string; title: string; text: string; to: string; at: string }

function readIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(READ_KEY)) ?? '[]')
  } catch {
    return []
  }
}

const daysBetween = (from: string, to: string) => Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000)

/** Learner notifications, derived from trainings and progress; filtered by the profile preferences. */
export function NotificationBell() {
  const { trainings, progress } = useStore()
  const assigned = useLearnerAssignments()
  const [open, setOpen] = useState(false)
  const [read, setRead] = useState<string[]>(readIds)
  // Each person has their own read state.
  const learnerId = myLearnerId()
  useEffect(() => setRead(readIds()), [learnerId])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const notes = useMemo(() => {
    const prefs = loadNotificationPrefs()
    const today = todayISO()
    const list: Note[] = []
    for (const t of trainings) {
      const p = progress[t.id]
      const days = daysBetween(today, t.date)
      if (prefs.reminders && days >= 0 && days <= 7)
        list.push({
          id: `session-${t.id}`,
          icon: CalendarClock,
          tone: 'bg-zinc-100 text-zinc-800',
          title: days === 0 ? 'Session today' : days === 1 ? 'Session tomorrow' : `Session in ${days} days`,
          text: `${t.title} · ${formatDate(t.date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeRange(t)}`,
          to: `/trainings/${t.id}`,
          at: t.date,
        })
      if (prefs.certificates && certificateChecks(t, p, LATE_WINDOW_MINUTES).eligible)
        list.push({ id: `cert-${t.id}`, icon: Award, tone: 'bg-mpesa-500/10 text-mpesa-600', title: 'Certificate issued', text: t.title, to: `/certificates/${t.id}`, at: p?.completedAt ?? t.date })
      else if (prefs.feedback && progressStatus(t, p) !== 'Not Started' && p?.quizScore != null && !p.feedback)
        list.push({ id: `feedback-${t.id}`, icon: MessageSquare, tone: 'bg-brand-50 text-brand-600', title: 'Feedback requested', text: `Share how ${t.title} went to finish the training.`, to: `/trainings/${t.id}/learn/feedback`, at: t.date })
    }
    // Assigned reading that still needs opening or acknowledging.
    for (const m of assigned) {
      if (assignmentDone(m, myLearnerId())) continue
      const overdue = !!m.dueDate && m.dueDate < today
      list.push({
        id: `assignment-${m.id}`,
        icon: BookOpenCheck,
        tone: overdue ? 'bg-brand-50 text-brand-600' : 'bg-amber-500/10 text-amber-600',
        title: overdue ? 'Reading overdue' : m.requiresAck ? 'Reading to acknowledge' : 'Reading assigned',
        text: `${m.title}${m.dueDate ? ` · due ${formatDate(m.dueDate, { month: 'short', day: 'numeric' })}` : ''}`,
        to: '/learning?tab=Assigned',
        at: m.assignedAt?.slice(0, 10) ?? today,
      })
    }
    // Newest raised first; notes raised together keep their date order.
    const raised = raisedAt(list.map((n) => n.id))
    return list.sort((a, b) => raised[b.id].localeCompare(raised[a.id]) || b.at.localeCompare(a.at))
  }, [trainings, progress, open, assigned])

  const unread = notes.filter((n) => !read.includes(n.id)).length
  const save = (ids: string[]) => {
    setRead(ids)
    try {
      localStorage.setItem(scopedKey(READ_KEY), JSON.stringify(ids))
    } catch {
      // Read state is a convenience only.
    }
  }

  return (
    <div ref={ref} className="relative z-40">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-100"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:mt-0 max-sm:w-auto border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Notifications</p>
            {unread > 0 && (
              <button onClick={() => save(notes.map((n) => n.id))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto">
            {notes.map((n) => {
              const isUnread = !read.includes(n.id)
              return (
                <li key={n.id}>
                  <Link
                    to={n.to}
                    onClick={() => {
                      if (isUnread) save([...read, n.id])
                      setOpen(false)
                    }}
                    className={cn('flex gap-3 px-4 py-3 transition hover:bg-zinc-50', isUnread && 'bg-brand-50/40')}
                  >
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', n.tone)}>
                      <n.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                        {n.title}
                        {isUnread && <span className="size-1.5 rounded-full bg-brand-600" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">{n.text}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
            {!notes.length && <li className="px-4 py-10 text-center text-sm text-zinc-500">You’re all caught up.</li>}
          </ul>
          <Link to="/profile" onClick={() => setOpen(false)} className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
            Notification settings
          </Link>
        </div>
      )}
    </div>
  )
}
