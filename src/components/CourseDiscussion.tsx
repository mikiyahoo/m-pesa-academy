import { CheckCircle2, ChevronUp, MessageSquare, Plus, Search, Send, Sparkles, ThumbsUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useFeedback } from './Feedback'
import { cn } from '../lib/utils'
import { useAuth } from '../store/Auth'
import { addReply, addThread, loadThreads, toggleReplyUpvote, toggleThreadUpvote, type ForumThread } from '../lib/discussions'

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
  const { user } = useAuth()
  const { toast } = useFeedback()
  const [threads, setThreads] = useState<ForumThread[]>(() => loadThreads(trainingId))
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'trainer' | 'top'>('all')
  const [showAskModal, setShowAskModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const reload = () => setThreads(loadThreads(trainingId))

  const handleUpvoteThread = (threadId: string) => {
    toggleThreadUpvote(threadId, user.email || 'guest')
    reload()
  }

  const handleUpvoteReply = (threadId: string, replyId: string) => {
    toggleReplyUpvote(threadId, replyId, user.email || 'guest')
    reload()
  }

  const handlePostThread = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return

    addThread({
      trainingId,
      moduleId: currentModuleId,
      moduleTitle: currentModuleTitle,
      authorId: user.email || 'guest',
      authorName: user.name || 'Anonymous Learner',
      authorRole: user.role || 'Participant',
      isTrainer: user.role === 'Trainer' || user.role === 'Admin',
      title: newTitle.trim(),
      content: newContent.trim(),
    })

    setNewTitle('')
    setNewContent('')
    setShowAskModal(false)
    reload()
    toast('Your question was posted to the course forum!')
  }

  const handlePostReply = (threadId: string) => {
    if (!replyText.trim()) return

    addReply(threadId, {
      authorId: user.email || 'guest',
      authorName: user.name || 'Anonymous Learner',
      authorRole: user.role || 'Participant',
      isTrainer: user.role === 'Trainer' || user.role === 'Admin',
      content: replyText.trim(),
    })

    setReplyText('')
    reload()
    toast('Reply posted!')
  }

  const filtered = useMemo(() => {
    return threads
      .filter((t) => {
        const matchesSearch =
          !search ||
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.content.toLowerCase().includes(search.toLowerCase()) ||
          t.replies.some((r) => r.content.toLowerCase().includes(search.toLowerCase()))

        if (!matchesSearch) return false

        if (filter === 'trainer') {
          return t.isTrainer || t.replies.some((r) => r.isTrainer)
        }
        return true
      })
      .sort((a, b) => {
        if (filter === 'top') return b.upvotes - a.upvotes
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [threads, search, filter])

  return (
    <div className={cn('space-y-4', compact ? 'p-3' : 'p-1')}>
      {/* Search & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or topics…"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pr-3 pl-9 text-xs outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-zinc-200 bg-white p-0.5 text-xs font-semibold text-zinc-600">
            <button
              onClick={() => setFilter('all')}
              className={cn('rounded-lg px-2.5 py-1 transition', filter === 'all' && 'bg-zinc-100 text-zinc-900')}
            >
              All
            </button>
            <button
              onClick={() => setFilter('trainer')}
              className={cn('rounded-lg px-2.5 py-1 transition', filter === 'trainer' && 'bg-zinc-100 text-zinc-900')}
            >
              Trainer Replies
            </button>
            <button
              onClick={() => setFilter('top')}
              className={cn('rounded-lg px-2.5 py-1 transition', filter === 'top' && 'bg-zinc-100 text-zinc-900')}
            >
              Most Upvoted
            </button>
          </div>

          <button
            onClick={() => setShowAskModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 transition"
          >
            <Plus className="size-3.5" /> Ask Question
          </button>
        </div>
      </div>

      {/* Ask Question Modal / Collapsible Form */}
      {showAskModal && (
        <form onSubmit={handlePostThread} className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 shadow-sm animate-in fade-in">
          <h4 className="text-sm font-bold text-zinc-900">Ask a Question</h4>
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
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <textarea
              required
              rows={3}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Provide more context or detail about what you need help with…"
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAskModal(false)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs"
            >
              Post to Forum
            </button>
          </div>
        </form>
      )}

      {/* Threads List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 text-center">
          <MessageSquare className="mx-auto size-8 text-zinc-300" />
          <p className="mt-2 text-sm font-bold text-zinc-900">No questions yet</p>
          <p className="mt-0.5 text-xs text-zinc-500">Be the first to ask a question about this course!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((thread) => {
            const hasUpvoted = thread.upvotedBy.includes(user.email || 'guest')
            const isExpanded = activeThreadId === thread.id
            const hasTrainerReply = thread.replies.some((r) => r.isTrainer)

            return (
              <div
                key={thread.id}
                className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white transition hover:border-zinc-300 shadow-xs"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {/* Upvote Button */}
                    <button
                      type="button"
                      onClick={() => handleUpvoteThread(thread.id)}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-xl border p-2 text-center transition shrink-0 min-w-[44px]',
                        hasUpvoted
                          ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-xs'
                          : 'border-zinc-200 bg-zinc-50/70 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100',
                      )}
                      title="Upvote this question"
                    >
                      <ChevronUp className="size-4" />
                      <span className="text-xs font-bold tabular-nums">{thread.upvotes}</span>
                    </button>

                    {/* Thread Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-900">{thread.authorName}</span>
                        <span className="text-[10px] text-zinc-400">•</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                          {thread.authorRole}
                        </span>
                        {thread.moduleTitle && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                            {thread.moduleTitle}
                          </span>
                        )}
                        {hasTrainerReply && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="size-2.5" /> Trainer Answered
                          </span>
                        )}
                      </div>

                      <h4 className="mt-1.5 text-sm font-bold text-zinc-900 leading-snug">
                        {thread.title}
                      </h4>
                      <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                        {thread.content}
                      </p>

                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                        <button
                          onClick={() => setActiveThreadId(isExpanded ? null : thread.id)}
                          className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:text-brand-700"
                        >
                          <MessageSquare className="size-3.5" />
                          {thread.replies.length} {thread.replies.length === 1 ? 'Reply' : 'Replies'}
                        </button>
                        <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Replies Accordion */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 sm:p-5 space-y-3">
                    <p className="text-xs font-bold text-zinc-700">
                      Replies & Solutions ({thread.replies.length})
                    </p>

                    {thread.replies.map((reply) => {
                      const replyUpvoted = reply.upvotedBy.includes(user.email || 'guest')
                      return (
                        <div
                          key={reply.id}
                          className={cn(
                            'rounded-xl border p-3 text-xs transition',
                            reply.isTrainer
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
                              <span className="text-[10px] text-zinc-400">
                                {new Date(reply.createdAt).toLocaleDateString()}
                              </span>
                            </div>

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
                          </div>

                          <p className="mt-1.5 text-zinc-700 leading-relaxed">{reply.content}</p>
                        </div>
                      )
                    })}

                    {/* Quick Reply Form */}
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
