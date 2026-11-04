import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, EyeOff, Flag, Lock, MessageSquare, Pencil, Pin, Plus, Search, Send, Sparkles, ThumbsUp, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { RowMenu, type RowMenuItem } from './RowMenu'
import { useFeedback } from './Feedback'
import { cn } from '../lib/utils'
import { useAuth } from '../store/Auth'
import { UserAvatar } from './UserAvatar'
import { addReply, addThread, deleteReply, deleteThread, loadThreads, onThreadsChange, toggleReplyFlag, toggleReplyUpvote, toggleThreadFlag, toggleThreadUpvote, updateReply, updateThread, type ForumComment, type ForumThread } from '../lib/discussions'

export function CourseDiscussion({
  trainingId,
  currentModuleId,
  currentModuleTitle,
  compact = false,
}: {
  trainingId: string
  currentModuleId?: string
  currentModuleTitle?: string
  compact?: boolean
}) {
  const { user, role } = useAuth()
  const { toast, confirm } = useFeedback()
  const me = user.email || 'guest'
  // Trainers and admins previewing the course answer as staff.
  const staff = role === 'trainer' || role === 'admin' || role === 'department'
  const [threads, setThreads] = useState<ForumThread[]>(() => loadThreads(trainingId))
  const [editing, setEditing] = useState<{ threadId: string; replyId?: string; title: string; content: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'trainer' | 'top'>('all')
  const [showAskModal, setShowAskModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  // Stay live: replies and moderation from trainers and admins show up straight away.
  useEffect(() => {
    setThreads(loadThreads(trainingId))
    return onThreadsChange(() => setThreads(loadThreads(trainingId)))
  }, [trainingId])

  const saveEdit = () => {
    if (!editing) return
    const at = new Date().toISOString()
    if (editing.replyId) {
      if (!editing.content.trim()) return
      updateReply(editing.threadId, editing.replyId, { content: editing.content.trim(), editedAt: at })
    } else {
      if (!editing.title.trim()) return
      updateThread(editing.threadId, { title: editing.title.trim(), content: editing.content.trim(), editedAt: at })
    }
    setEditing(null)
    toast('Changes saved')
  }
  const removeThread = async (t: ForumThread) => {
    if (!(await confirm({ title: 'Delete your question?', message: 'It is removed with all its replies.', confirmLabel: 'Delete question' }))) return
    deleteThread(t.id)
    toast('Question deleted')
  }
  const removeReply = async (t: ForumThread, r: ForumComment) => {
    if (!(await confirm({ title: 'Delete your reply?', message: 'This cannot be undone.', confirmLabel: 'Delete reply' }))) return
    deleteReply(t.id, r.id)
    toast('Reply deleted')
  }
  const threadMenu = (t: ForumThread): RowMenuItem[] =>
    t.authorId === me
      ? [
          { label: 'Edit', icon: Pencil, onClick: () => setEditing({ threadId: t.id, title: t.title, content: t.content }) },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => void removeThread(t) },
        ]
      : [
          {
            label: t.flaggedBy?.includes(me) ? 'Withdraw report' : 'Report to admins',
            icon: Flag,
            onClick: () => {
              toggleThreadFlag(t.id, me)
              toast(t.flaggedBy?.includes(me) ? 'Report withdrawn' : 'Reported — an admin will review it')
            },
          },
        ]
  const replyMenu = (t: ForumThread, r: ForumComment): RowMenuItem[] =>
    r.authorId === me
      ? [
          { label: 'Edit', icon: Pencil, onClick: () => setEditing({ threadId: t.id, replyId: r.id, title: '', content: r.content }) },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => void removeReply(t, r) },
        ]
      : [
          {
            label: r.flaggedBy?.includes(me) ? 'Withdraw report' : 'Report to admins',
            icon: Flag,
            onClick: () => {
              toggleReplyFlag(t.id, r.id, me)
              toast(r.flaggedBy?.includes(me) ? 'Report withdrawn' : 'Reported — an admin will review it')
            },
          },
        ]

  const handleUpvoteThread = (threadId: string) => {
    toggleThreadUpvote(threadId, me)
  }

  const handleUpvoteReply = (threadId: string, replyId: string) => {
    toggleReplyUpvote(threadId, replyId, me)
  }

  const handlePostThread = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    addThread({
      trainingId,
      moduleId: currentModuleId,
      moduleTitle: currentModuleTitle,
      authorId: me,
      authorName: user.name || 'Anonymous Learner',
      authorRole: user.role || 'Participant',
      isTrainer: staff,
      title: newTitle.trim(),
      content: newContent.trim(),
    })

    setNewTitle('')
    setNewContent('')
    setShowAskModal(false)
    toast('Your question was posted to the course forum!')
  }

  const handlePostReply = (threadId: string) => {
    if (!replyText.trim()) return

    addReply(threadId, {
      authorId: me,
      authorName: user.name || 'Anonymous Learner',
      authorRole: user.role || 'Participant',
      isTrainer: staff,
      content: replyText.trim(),
    })

    setReplyText('')
    toast('Reply posted!')
  }

  const filtered = useMemo(() => {
    return threads
      .filter((t) => !t.hidden || t.authorId === me)
      .filter((t) => {
        const matchesSearch =
          !search ||
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.content.toLowerCase().includes(search.toLowerCase()) ||
          t.replies.some((r) => r.content.toLowerCase().includes(search.toLowerCase()))

        if (!matchesSearch) return false

        if (filter === 'trainer') {
          return t.resolved || t.isTrainer || t.replies.some((r) => r.isTrainer)
        }
        return true
      })
      .sort((a, b) => {
        if (filter === 'top') return b.upvotes - a.upvotes
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [threads, search, filter, me])

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const filters = [
    ['all', 'All Discussions'],
    ['trainer', 'Trainer Replies'],
    ['top', 'Most Upvoted'],
  ] as const

  return (
    <div className="space-y-4 p-1">
      {/* Search */}
      <div className="relative">
        <Search className={cn('pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400', compact ? 'size-4' : 'size-5')} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search discussions…"
          className={cn('w-full rounded-2xl border border-zinc-200 bg-white pr-4 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100', compact ? 'py-2.5 pl-10 text-sm' : 'py-3.5 pl-12 text-base')}
        />
      </div>

      {/* Filters + Ask question */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setFilter(v)}
            aria-pressed={filter === v}
            className={cn(
              'rounded-xl font-semibold transition',
              compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
              filter === v ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70',
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAskModal(true)}
          className={cn('ml-auto inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 font-semibold text-brand-700 transition hover:bg-brand-100', compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm')}
        >
          <Plus className="size-4" /> Ask question
        </button>
      </div>

      {/* Ask question form */}
      {showAskModal && (
        <form onSubmit={handlePostThread} className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 shadow-sm">
          <h4 className="text-base font-bold text-zinc-900">Ask a question</h4>
          <p className="mt-0.5 text-xs text-zinc-500">
            {currentModuleTitle ? `Tied to module: ${currentModuleTitle}` : 'Ask trainers and fellow learners for clarification.'}
          </p>
          <div className="mt-3 space-y-2.5">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What is your question in one sentence?"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <textarea
              rows={3}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Add more context about what you need help with (optional)…"
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowAskModal(false)} className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
              Cancel
            </button>
            <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-brand-700">
              Post question
            </button>
          </div>
        </form>
      )}

      {/* Threads */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <MessageSquare className="size-6" />
          </span>
          <p className="mt-3 text-base font-bold text-zinc-900">{search ? 'No discussions match your search' : 'No questions yet'}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{search ? 'Try other words.' : 'Be the first to ask a question about this course.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((thread) => {
            const hasUpvoted = thread.upvotedBy.includes(me)
            const isExpanded = activeThreadId === thread.id
            const hasTrainerReply = thread.resolved || thread.replies.some((r) => r.isTrainer)
            // Hidden replies stay visible to their author only; the pinned answer comes first.
            const replies = thread.replies
              .filter((r) => !r.hidden || r.authorId === me)
              .sort((a, b) => Number(b.id === thread.pinnedReplyId) - Number(a.id === thread.pinnedReplyId))
            const count = replies.length
            const editingThis = editing?.threadId === thread.id && !editing.replyId

            return (
              <div key={thread.id} className={cn('overflow-hidden rounded-2xl border bg-white transition', isExpanded ? 'border-brand-200 shadow-sm' : 'border-zinc-200/80 hover:border-zinc-300')}>
                <div className={cn('flex', compact ? 'gap-3 p-3' : 'gap-4 p-4 sm:p-5')}>
                  {/* Votes */}
                  <div className={cn('flex shrink-0 flex-col items-center self-start rounded-2xl border border-zinc-200 py-1.5', compact ? 'w-11' : 'w-14')}>
                    <button
                      type="button"
                      onClick={() => !hasUpvoted && handleUpvoteThread(thread.id)}
                      aria-label="Upvote"
                      aria-pressed={hasUpvoted}
                      className={cn('grid size-8 place-items-center rounded-lg transition', hasUpvoted ? 'text-brand-600' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900')}
                    >
                      <ChevronUp className="size-5" strokeWidth={2.5} />
                    </button>
                    <span className={cn('font-extrabold text-brand-600 tabular-nums', compact ? 'text-base' : 'text-xl')}>{thread.upvotes}</span>
                    <button
                      type="button"
                      onClick={() => hasUpvoted && handleUpvoteThread(thread.id)}
                      disabled={!hasUpvoted}
                      aria-label="Remove my upvote"
                      title={hasUpvoted ? 'Remove my upvote' : undefined}
                      className="grid size-8 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="size-5" strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1 border-l border-zinc-100 pl-3 sm:pl-4">
                    {/* Author, date, tags */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <UserAvatar name={thread.authorName} className={compact ? 'size-7' : 'size-9'} />
                      <span className={cn('font-semibold text-zinc-900', compact ? 'text-xs' : 'text-sm')}>{thread.authorName}</span>
                      <span className="text-zinc-300">•</span>
                      <span className={cn('text-zinc-500', compact ? 'text-xs' : 'text-sm')}>{fmtDate(thread.createdAt)}</span>
                      <span className="ml-auto flex flex-wrap items-center gap-1.5">
                        {thread.moduleTitle && <span className="max-w-[14rem] truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{thread.moduleTitle}</span>}
                        {hasTrainerReply && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-mpesa-500/10 px-3 py-1 text-xs font-semibold text-mpesa-700">
                            <CheckCircle2 className="size-3.5" /> Trainer Answered
                          </span>
                        )}
                        {thread.locked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                            <Lock className="size-3.5" /> Locked
                          </span>
                        )}
                        <RowMenu label={`Actions for ${thread.title}`} items={threadMenu(thread)} />
                      </span>
                    </div>

                    {thread.hidden && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800">
                        <EyeOff className="size-3.5" /> Hidden by a moderator — only you can see it
                      </p>
                    )}
                    {editingThis ? (
                      <div className="mt-2 space-y-2">
                        <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Question" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                        <textarea rows={3} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder="Details (optional)" aria-label="Details" className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">Cancel</button>
                          <button type="button" onClick={saveEdit} disabled={!editing.title.trim()} className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-zinc-300">Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className={cn('mt-2 leading-snug font-bold text-zinc-900', compact ? 'text-sm' : 'text-lg')}>{thread.title}</h4>
                        {thread.content && <p className={cn('mt-1 leading-relaxed text-zinc-600', compact ? 'text-xs' : 'text-sm', !isExpanded && 'line-clamp-2')}>{thread.content}</p>}
                        {thread.editedAt && <p className="mt-1 text-[11px] text-zinc-400">Edited</p>}
                      </>
                    )}

                    {/* Replies count + open */}
                    <div className="mt-3 flex items-center gap-3 text-sm font-semibold text-brand-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquare className="size-4" />
                        {count} {count === 1 ? 'Reply' : 'Replies'}
                      </span>
                      <span className="ml-auto h-5 w-px bg-zinc-200" aria-hidden />
                      <button type="button" onClick={() => setActiveThreadId(isExpanded ? null : thread.id)} aria-expanded={isExpanded} className="inline-flex items-center gap-1 hover:text-brand-700">
                        {isExpanded ? 'Hide discussion' : 'View discussion'}
                        <ChevronRight className={cn('size-4 transition', isExpanded && 'rotate-90')} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies Accordion */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 sm:p-5 space-y-3">
                    <p className="text-xs font-bold text-zinc-700">
                      Replies & Solutions ({count})
                    </p>

                    {replies.map((reply) => {
                      const replyUpvoted = reply.upvotedBy.includes(me)
                      const pinned = reply.id === thread.pinnedReplyId
                      const editingReply = editing?.replyId === reply.id
                      return (
                        <div
                          key={reply.id}
                          className={cn(
                            'rounded-xl border p-3 text-xs transition',
                            pinned
                              ? 'border-brand-200 bg-brand-50/40 shadow-xs'
                              : reply.isTrainer
                              ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-white shadow-xs'
                              : 'border-zinc-200/80 bg-white',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900">{reply.authorName}</span>
                              {reply.isTrainer && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  <Sparkles className="size-2.5" /> Trainer
                                </span>
                              )}
                              {pinned && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  <Pin className="size-2.5" /> Best answer
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400">
                                {new Date(reply.createdAt).toLocaleDateString()}
                                {reply.editedAt ? ' · edited' : ''}
                              </span>
                            </div>
                            <span className="flex items-center gap-1">

                            <button
                              type="button"
                              onClick={() => handleUpvoteReply(thread.id, reply.id)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition',
                                replyUpvoted
                                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                                  : 'text-zinc-500 hover:bg-zinc-100',
                              )}
                            >
                              <ThumbsUp className="size-3" /> {reply.upvotes}
                            </button>
                            <RowMenu label={`Actions for reply by ${reply.authorName}`} items={replyMenu(thread, reply)} />
                            </span>
                          </div>

                          {reply.hidden && (
                            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                              <EyeOff className="size-3" /> Hidden by a moderator — only you can see it
                            </p>
                          )}
                          {editingReply ? (
                            <div className="mt-1.5 flex gap-2">
                              <input autoFocus value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} aria-label="Edit reply" className="flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
                              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-zinc-200 px-2.5 text-[11px] font-semibold text-zinc-600">Cancel</button>
                              <button type="button" onClick={saveEdit} className="rounded-lg bg-brand-600 px-2.5 text-[11px] font-semibold text-white">Save</button>
                            </div>
                          ) : (
                            <p className="mt-1.5 text-zinc-700 leading-relaxed">{reply.content}</p>
                          )}
                        </div>
                      )
                    })}

                    {/* Quick Reply Form */}
                    {thread.locked ? (
                      <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-zinc-500">
                        <Lock className="size-3.5" /> A moderator locked this discussion. No new replies.
                      </p>
                    ) : (
                    <div className="pt-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handlePostReply(thread.id)
                            }
                          }}
                          placeholder="Write an answer or helpful tip…"
                          className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />
                        <button
                          type="button"
                          onClick={() => handlePostReply(thread.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700"
                        >
                          <Send className="size-3" /> Reply
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
