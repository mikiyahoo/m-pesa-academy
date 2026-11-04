import { CheckCircle2, EyeOff, Flag, Lock, LockOpen, MessageSquare, MessagesSquare, Pin, PinOff, RotateCcw, Send, ShieldCheck, Trash2, Eye } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { RowMenu, type RowMenuItem } from '../../components/RowMenu'
import { UserAvatar } from '../../components/UserAvatar'
import { trainings as learnerTrainings } from '../../data/trainings'
import { ADMIN_TRAINING_PREFIX } from '../../lib/adminBridge'
import {
  addReply,
  deleteReply,
  deleteThread,
  flagCount,
  isUnanswered,
  loadThreads,
  onThreadsChange,
  updateReply,
  updateThread,
  type ForumComment,
  type ForumThread,
} from '../../lib/discussions'
import { cn } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import { Badge, Button, Empty, PageHeader, SearchInput, Select, StatCard, TabBar, Tabs } from '../ui'

type View = 'unanswered' | 'reported' | 'all' | 'hidden'

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Every discussion this person may moderate, with the training it belongs to. */
export function useScopedThreads() {
  const { data } = useAdmin()
  const scope = useScope()
  const [all, setAll] = useState<ForumThread[]>(() => loadThreads())
  useEffect(() => onThreadsChange(() => setAll(loadThreads())), [])
  // Demo: when no course in scope has a forum yet, open the sample forums of a few of them.
  useEffect(() => {
    const keys = data.trainings.filter((t) => t.participantIds.length).map((t) => `${ADMIN_TRAINING_PREFIX}${t.id}`)
    if (!keys.length || loadThreads().some((t) => keys.includes(t.trainingId))) return
    keys.slice(0, 2).forEach((k) => loadThreads(k))
  }, [data.trainings])

  return useMemo(() => {
    // data.trainings is already limited to the trainer's or department's own trainings.
    const titles = new Map<string, string>(data.trainings.map((t) => [`${ADMIN_TRAINING_PREFIX}${t.id}`, t.name]))
    // Sample learner courses aren't owned by anyone, so only full admins see them.
    if (scope.role === 'admin') learnerTrainings.forEach((t) => !titles.has(t.id) && titles.set(t.id, t.title))
    const threads = all.filter((t) => titles.has(t.trainingId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { threads, titles }
  }, [all, data.trainings, scope.role])
}

export function AdminDiscussions() {
  const { threads, titles } = useScopedThreads()
  const { update } = useAdmin()
  const { user } = useAuth()
  const { toast, confirm } = useFeedback()
  const [params, setParams] = useSearchParams()
  const training = params.get('training') ?? 'ALL'
  const [view, setView] = useState<View>('unanswered')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const inTraining = training === 'ALL' ? threads : threads.filter((t) => t.trainingId === training)
  const counts = {
    unanswered: inTraining.filter((t) => !t.hidden && isUnanswered(t)).length,
    reported: inTraining.filter((t) => flagCount(t) > 0).length,
    all: inTraining.length,
    hidden: inTraining.filter((t) => t.hidden || t.replies.some((r) => r.hidden)).length,
  }
  const shown = inTraining.filter((t) => {
    if (view === 'unanswered' && (t.hidden || !isUnanswered(t))) return false
    if (view === 'reported' && !flagCount(t)) return false
    if (view === 'hidden' && !(t.hidden || t.replies.some((r) => r.hidden))) return false
    const needle = q.trim().toLowerCase()
    return !needle || [t.title, t.content, t.authorName, ...t.replies.map((r) => r.content)].some((x) => x.toLowerCase().includes(needle))
  })
  // Keep the question you're working on open even after answering it moves it out of this filter.
  const open = inTraining.find((t) => t.id === openId) ?? shown[0]
  if (open && !shown.includes(open)) shown.unshift(open)

  // Moderation goes into the audit log; the change itself lives in the discussion store.
  const log = (action: string, target: string) => update((d) => d, { action, target, silent: true, entityType: 'Discussion' })
  const act = (action: string, t: ForumThread, fn: () => void, message: string) => {
    fn()
    log(action, t.title)
    toast(message)
  }

  const postReply = (t: ForumThread) => {
    const text = reply.trim()
    if (!text) return
    addReply(t.id, { authorId: user.email || 'staff', authorName: user.name, authorRole: user.role || 'Trainer', isTrainer: true, content: text })
    setReply('')
    log('Answered discussion', t.title)
    toast('Reply posted — the learner is notified')
  }

  const threadMenu = (t: ForumThread): RowMenuItem[] => [
    t.resolved
      ? { label: 'Reopen question', icon: RotateCcw, onClick: () => act('Reopened discussion', t, () => updateThread(t.id, { resolved: false }), 'Question reopened') }
      : { label: 'Mark answered', icon: CheckCircle2, onClick: () => act('Marked discussion answered', t, () => updateThread(t.id, { resolved: true }), 'Marked as answered') },
    t.locked
      ? { label: 'Unlock replies', icon: LockOpen, onClick: () => act('Unlocked discussion', t, () => updateThread(t.id, { locked: false }), 'Replies are open again') }
      : { label: 'Lock replies', icon: Lock, onClick: () => act('Locked discussion', t, () => updateThread(t.id, { locked: true }), 'Discussion locked') },
    t.hidden
      ? { label: 'Show to learners', icon: Eye, onClick: () => act('Unhid discussion', t, () => updateThread(t.id, { hidden: false }), 'Visible to learners again') }
      : { label: 'Hide from learners', icon: EyeOff, onClick: () => act('Hid discussion', t, () => updateThread(t.id, { hidden: true }), 'Hidden from learners') },
    ...(flagCount(t)
      ? [{ label: 'Clear reports', icon: ShieldCheck, onClick: () => act('Cleared discussion reports', t, () => updateThread(t.id, { flaggedBy: [], replies: t.replies.map((r) => ({ ...r, flaggedBy: [] })) }), 'Reports cleared') }]
      : []),
    {
      label: 'Delete question',
      icon: Trash2,
      danger: true,
      onClick: async () => {
        if (!(await confirm({ title: `Delete “${t.title}”?`, message: 'The question and all its replies are removed for everyone.', confirmLabel: 'Delete' }))) return
        act('Deleted discussion', t, () => deleteThread(t.id), 'Question deleted')
      },
    },
  ]

  const replyMenu = (t: ForumThread, r: ForumComment): RowMenuItem[] => [
    t.pinnedReplyId === r.id
      ? { label: 'Unpin answer', icon: PinOff, onClick: () => act('Unpinned answer', t, () => updateThread(t.id, { pinnedReplyId: undefined }), 'Answer unpinned') }
      : { label: 'Pin as best answer', icon: Pin, onClick: () => act('Pinned best answer', t, () => updateThread(t.id, { pinnedReplyId: r.id, resolved: true }), 'Pinned as the best answer') },
    r.hidden
      ? { label: 'Show to learners', icon: Eye, onClick: () => act('Unhid reply', t, () => updateReply(t.id, r.id, { hidden: false }), 'Reply visible again') }
      : { label: 'Hide from learners', icon: EyeOff, onClick: () => act('Hid reply', t, () => updateReply(t.id, r.id, { hidden: true }), 'Reply hidden') },
    ...(r.flaggedBy?.length ? [{ label: 'Clear reports', icon: ShieldCheck, onClick: () => act('Cleared reply reports', t, () => updateReply(t.id, r.id, { flaggedBy: [] }), 'Reports cleared') }] : []),
    {
      label: 'Delete reply',
      icon: Trash2,
      danger: true,
      onClick: async () => {
        if (!(await confirm({ title: 'Delete this reply?', message: `By ${r.authorName}. It is removed for everyone.`, confirmLabel: 'Delete' }))) return
        act('Deleted reply', t, () => deleteReply(t.id, r.id), 'Reply deleted')
      },
    },
  ]

  const trainingOptions = [...titles.entries()].filter(([id]) => threads.some((t) => t.trainingId === id))

  return (
    <>
      <PageHeader title="Discussions" description="Answer learners' questions and keep course forums on topic." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Waiting for an answer" value={counts.unanswered} tone={counts.unanswered ? 'amber' : 'zinc'} />
        <StatCard icon={Flag} label="Reported" value={counts.reported} tone={counts.reported ? 'red' : 'zinc'} />
        <StatCard icon={CheckCircle2} label="Answered" value={inTraining.filter((t) => !isUnanswered(t)).length} tone="green" />
        <StatCard icon={MessagesSquare} label="All questions" value={counts.all} />
      </div>

      <TabBar>
        <Tabs
          value={view}
          onChange={(v) => {
            setView(v)
            setOpenId(null)
          }}
          label="Discussion filter"
          items={[
            { value: 'unanswered', label: 'Unanswered', count: counts.unanswered },
            { value: 'reported', label: 'Reported', count: counts.reported },
            { value: 'hidden', label: 'Hidden', count: counts.hidden },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-60">
            <Select
              value={training}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value === 'ALL') next.delete('training')
                else next.set('training', e.target.value)
                setParams(next, { replace: true })
                setOpenId(null)
              }}
              aria-label="Training"
            >
              <option value="ALL">All trainings</option>
              {trainingOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Search questions" className="w-56" />
        </div>
      </TabBar>

      {!shown.length ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          <Empty
            icon={MessagesSquare}
            title={view === 'unanswered' ? 'Every question has an answer' : view === 'reported' ? 'Nothing reported' : 'No discussions here'}
            text={threads.length ? 'Try another filter or training.' : 'Questions learners ask in their courses appear here.'}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* Question list */}
          <ul className="scrollbar-thin space-y-2 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pr-1">
            {shown.map((t) => {
              const flags = flagCount(t)
              const active = open?.id === t.id
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(t.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn('w-full rounded-2xl border bg-surface p-4 text-left transition', active ? 'border-brand-300 ring-2 ring-brand-100' : 'border-zinc-200/80 hover:border-zinc-300')}
                  >
                    <p className="truncate text-[11px] font-semibold tracking-wide text-brand-600 uppercase">{titles.get(t.trainingId)}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold text-zinc-900">{t.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span>{t.authorName}</span>
                      <span className="text-zinc-300">•</span>
                      <span>{when(t.createdAt)}</span>
                      <span className="text-zinc-300">•</span>
                      <span>
                        {t.replies.length} {t.replies.length === 1 ? 'reply' : 'replies'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {isUnanswered(t) ? <Badge tone="amber">Unanswered</Badge> : <Badge tone="green">Answered</Badge>}
                      {flags > 0 && (
                        <Badge tone="red">
                          {flags} report{flags === 1 ? '' : 's'}
                        </Badge>
                      )}
                      {t.locked && <Badge>Locked</Badge>}
                      {t.hidden && <Badge>Hidden</Badge>}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Selected thread */}
          {open && (
            <section className="self-start rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6" aria-label="Discussion">
              <div className="flex items-start gap-3">
                <UserAvatar name={open.authorName} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900">
                    {open.authorName} <span className="font-normal text-zinc-500">· {open.authorRole}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {when(open.createdAt)}
                    {open.moduleTitle ? ` · ${open.moduleTitle}` : ''} ·{' '}
                    <Link to={open.trainingId.startsWith(ADMIN_TRAINING_PREFIX) ? `/admin/trainings/${open.trainingId.slice(ADMIN_TRAINING_PREFIX.length)}` : '#'} className="font-medium text-brand-600 hover:underline">
                      {titles.get(open.trainingId)}
                    </Link>
                  </p>
                </div>
                <RowMenu label={`Actions for ${open.title}`} items={threadMenu(open)} />
              </div>
              <h2 className="mt-4 text-lg leading-snug font-bold text-zinc-900">{open.title}</h2>
              {open.content && <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{open.content}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {open.upvotes > 0 && <Badge>▲ {open.upvotes} upvotes</Badge>}
                {(open.flaggedBy?.length ?? 0) > 0 && <Badge tone="red">Reported by {open.flaggedBy!.length}</Badge>}
                {open.hidden && <Badge tone="amber">Hidden from learners</Badge>}
                {open.locked && <Badge>Replies locked</Badge>}
              </div>

              <div className="mt-5 space-y-2.5 border-t border-zinc-100 pt-5">
                <p className="text-sm font-bold text-zinc-900">Replies ({open.replies.length})</p>
                {!open.replies.length && <p className="text-sm text-zinc-500">No replies yet. Be the first to answer.</p>}
                {[...open.replies]
                  .sort((a, b) => Number(b.id === open.pinnedReplyId) - Number(a.id === open.pinnedReplyId))
                  .map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        'rounded-xl border p-3.5',
                        r.hidden ? 'border-dashed border-zinc-300 opacity-70' : r.id === open.pinnedReplyId ? 'border-brand-200 bg-brand-50/40' : r.isTrainer ? 'border-mpesa-500/25 bg-mpesa-500/5' : 'border-zinc-200/80',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900">{r.authorName}</span>
                        {r.isTrainer && <Badge tone="green">Trainer</Badge>}
                        {r.id === open.pinnedReplyId && <Badge tone="red">Best answer</Badge>}
                        {r.hidden && <Badge tone="amber">Hidden</Badge>}
                        {(r.flaggedBy?.length ?? 0) > 0 && <Badge tone="red">Reported by {r.flaggedBy!.length}</Badge>}
                        <span className="ml-auto text-xs text-zinc-400">{when(r.createdAt)}</span>
                        <RowMenu label={`Actions for reply by ${r.authorName}`} items={replyMenu(open, r)} />
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{r.content}</p>
                    </div>
                  ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  postReply(open)
                }}
                className="mt-4 flex gap-2"
              >
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={open.locked ? 'Replies are locked — you can still answer as staff' : 'Write an answer as trainer…'}
                  aria-label="Your answer"
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <Button type="submit" variant="primary" disabled={!reply.trim()}>
                  <Send className="size-4" /> Reply
                </Button>
              </form>
            </section>
          )}
        </div>
      )}
    </>
  )
}

/** Questions that need someone: unanswered (and visible) or reported. Used for the sidebar count. */
export function useDiscussionAttention() {
  const { threads } = useScopedThreads()
  return threads.filter((t) => (!t.hidden && isUnanswered(t)) || flagCount(t) > 0).length
}

/** Small card on a training's page: open questions with a link to the full Discussions page. */
export function TrainingDiscussionsCard({ trainingId }: { trainingId: string }) {
  const key = `${ADMIN_TRAINING_PREFIX}${trainingId}`
  const [threads, setThreads] = useState<ForumThread[]>(() => loadThreads().filter((t) => t.trainingId === key))
  useEffect(() => onThreadsChange(() => setThreads(loadThreads().filter((t) => t.trainingId === key))), [key])
  const waiting = threads.filter((t) => !t.hidden && isUnanswered(t))
  const reported = threads.filter((t) => flagCount(t) > 0).length
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-zinc-900">Discussions</h2>
        <Link to={`/admin/discussions?training=${key}`} className="text-xs font-semibold text-brand-600 hover:underline">
          Open all
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {threads.length} question{threads.length === 1 ? '' : 's'} · {waiting.length} waiting for an answer{reported ? ` · ${reported} reported` : ''}
      </p>
      {waiting.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {waiting.slice(0, 3).map((t) => (
            <li key={t.id}>
              <Link to={`/admin/discussions?training=${key}`} className="block rounded-xl bg-zinc-50 px-3 py-2.5 transition hover:bg-zinc-100">
                <span className="line-clamp-1 text-sm font-semibold text-zinc-900">{t.title}</span>
                <span className="text-xs text-zinc-500">
                  {t.authorName} · {when(t.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500">{threads.length ? 'All questions have an answer.' : 'No questions yet.'}</p>
      )}
    </div>
  )
}
