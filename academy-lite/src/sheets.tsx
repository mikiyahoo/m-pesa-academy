import { ArrowLeft, Bell, BellRing, Check, CirclePlay, Copy, Flag, Heart, Layers, Link2, Plus, Search, Send, Sparkles, ThumbsDown, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CHATS, COURSES, LIVE, ME, compact, seedComments, seeded, trainerOf, type Course, type Item } from './data'
import { useLite } from './store'
import { Avatar, Sheet, cn, useToast } from './ui'

const itemLabel = (it: Item) => (it.kind === 'quiz' ? it.question : it.caption)
const KIND_ICON: Record<Item['kind'], string> = { video: '🎬', slides: '🗂️', quiz: '❓', tip: '💡' }

/* --------------------------------- comments --------------------------------- */

export function CommentsSheet({ item, course, onClose }: { item: Item; course: Course; onClose: () => void }) {
  const { s, set, toggle } = useLite()
  const [text, setText] = useState('')
  const mine = s.comments[item.id] ?? []
  const all = [...mine, ...seedComments(item.id, course.trainerId)]
  const send = (value = text) => {
    const v = value.trim()
    if (!v) return
    set((x) => ({ ...x, comments: { ...x.comments, [item.id]: [{ id: `me-${Date.now()}`, name: ME.name, avatar: ME.avatar, text: v, ago: 'now', likes: 0 }, ...(x.comments[item.id] ?? [])] } }))
    setText('')
  }
  return (
    <Sheet open onClose={onClose} title={`${compact(all.length)} comments`}>
      <div className="flex h-full flex-col">
        <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          {all.map((c) => {
            const liked = s.liked.includes(c.id)
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar src={c.avatar} name={c.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    {c.name}
                    {c.trainer && <span className="rounded bg-[#d03c3b] px-1.5 py-px text-[10px] font-bold text-white">Trainer</span>}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-zinc-900">{c.text}</p>
                  <p className="mt-1 flex gap-4 text-xs text-zinc-400">
                    <span>{c.ago}</span>
                    <button type="button" onClick={() => setText(`@${c.name.split(' ')[0]} `)} className="font-semibold hover:text-zinc-700">
                      Reply
                    </button>
                  </p>
                </div>
                <button type="button" onClick={() => toggle('liked', c.id)} aria-label={liked ? 'Unlike comment' : 'Like comment'} className="flex flex-col items-center gap-0.5 text-xs text-zinc-400">
                  <Heart className={cn('size-4', liked && 'fill-rose-500 text-rose-500')} />
                  {c.likes + (liked ? 1 : 0)}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="shrink-0 border-t border-zinc-100 bg-white px-3 pt-2 pb-3">
          <div className="mb-2 flex gap-3 px-1 text-xl">
            {['🙏', '👍', '🔥', '💡', '👏', '😂'].map((e) => (
              <button key={e} type="button" onClick={() => send(e)} aria-label={`Send ${e}`} className="transition active:scale-90">
                {e}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-center gap-2"
          >
            <Avatar src={ME.avatar} name={ME.name} size={32} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="min-w-0 flex-1 rounded-full bg-zinc-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-zinc-300" />
            <button type="submit" disabled={!text.trim()} aria-label="Post comment" className="grid size-9 place-items-center rounded-full bg-[#d03c3b] text-white disabled:opacity-30">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </Sheet>
  )
}

/* ----------------------------------- share ----------------------------------- */

export function ShareSheet({ item, course, onClose }: { item: Item; course: Course; onClose: () => void }) {
  const { s, set, toggle } = useLite()
  const toast = useToast()
  const saved = s.saved.includes(item.id)
  const sendTo = (chatId: string, name: string) => {
    set((x) => ({ ...x, chats: { ...x.chats, [chatId]: [...(x.chats[chatId] ?? []), { id: `share-${Date.now()}`, from: 'me', text: `📘 ${course.title}: ${itemLabel(item)}`, at: Date.now(), kind: 'share' }] } }))
    toast(`Sent to ${name}`)
    onClose()
  }
  const actions = [
    {
      label: 'Copy link',
      icon: Link2,
      tone: 'bg-sky-500',
      run: () => {
        void navigator.clipboard?.writeText(`${location.origin}/?post=${item.id}`).catch(() => undefined)
        toast('Link copied')
        onClose()
      },
    },
    {
      label: saved ? 'Unsave' : 'Save',
      icon: Copy,
      tone: 'bg-amber-500',
      run: () => {
        toggle('saved', item.id)
        toast(saved ? 'Removed from saved' : 'Saved to your profile')
        onClose()
      },
    },
    { label: 'Not interested', icon: ThumbsDown, tone: 'bg-zinc-500', run: () => (toast('We’ll show fewer posts like this'), onClose()) },
    { label: 'Report', icon: Flag, tone: 'bg-rose-500', run: () => (toast('Thanks, the training team will review it'), onClose()) },
  ]
  return (
    <Sheet open onClose={onClose} title="Share" height="auto">
      <div className="pb-6">
        <p className="px-4 text-xs font-semibold text-zinc-500">Send to</p>
        <div className="scrollbar-none mt-2 flex gap-4 overflow-x-auto px-4 pb-2">
          {CHATS.filter((c) => c.kind !== 'channel').map((c) => (
            <button key={c.id} type="button" onClick={() => sendTo(c.id, c.name)} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <Avatar src={c.avatar} name={c.name} size={52} />
              <span className="line-clamp-2 text-center text-[11px] leading-tight text-zinc-700">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="mx-4 my-3 h-px bg-zinc-100" />
        <div className="flex gap-4 px-4">
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={a.run} className="flex w-16 flex-col items-center gap-1.5">
              <span className={cn('grid size-12 place-items-center rounded-full text-white', a.tone)}>
                <a.icon className="size-5" />
              </span>
              <span className="text-center text-[11px] leading-tight text-zinc-700">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

/* ------------------------------- course playlist ------------------------------- */

export function CourseSheet({ course, onClose, onOpen }: { course: Course; onClose: () => void; onOpen: (itemId: string) => void }) {
  const { s, toggle, progress } = useLite()
  const toast = useToast()
  const p = progress(course.id)
  const t = trainerOf(course.trainerId)
  const enrolled = s.enrolled.includes(course.id)
  return (
    <Sheet open onClose={onClose} title={course.title} height="70%">
      <div className="px-4 pb-6">
        <div className="flex items-center gap-3">
          <img src={course.cover} alt="" className="size-14 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{course.blurb}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {t.name} · {course.items.length} posts · {compact(course.learners)} learners
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-mpesa-500" style={{ width: `${p.pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-zinc-600">{p.pct}%</span>
        </div>
        {!enrolled && (
          <button
            type="button"
            onClick={() => {
              toggle('enrolled', course.id)
              toast('Added to My learning')
            }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#d03c3b] py-2.5 text-sm font-bold text-white"
          >
            <Plus className="size-4" /> Add to My learning
          </button>
        )}
        <ol className="mt-4 space-y-1">
          {course.items.map((it, i) => {
            const seen = s.viewed.includes(it.id)
            return (
              <li key={it.id}>
                <button type="button" onClick={() => onOpen(it.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-zinc-50">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-sm', seen ? 'bg-mpesa-500 text-white' : 'bg-zinc-100')}>{seen ? <Check className="size-4" strokeWidth={3} /> : KIND_ICON[it.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">
                      {i + 1}. {itemLabel(it)}
                    </span>
                    <span className="text-xs text-zinc-500 capitalize">{it.kind === 'slides' ? `${it.slides.length} slides` : it.kind}</span>
                  </span>
                  <CirclePlay className="size-5 shrink-0 text-zinc-300" />
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </Sheet>
  )
}

/* ------------------------------------ live ----------------------------------- */

export function LiveSheet({ onClose }: { onClose: () => void }) {
  const { s, toggle } = useLite()
  const toast = useToast()
  return (
    <Sheet open onClose={onClose} title="Live sessions" height="auto" dark>
      <ul className="space-y-3 px-4 pb-7">
        {LIVE.map((l) => {
          const t = trainerOf(l.host)
          const on = s.reminders.includes(l.id)
          return (
            <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <span className="relative">
                <Avatar src={t.avatar} name={t.name} size={48} ring={l.live ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-zinc-900' : undefined} />
                {l.live && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-rose-500 px-1 text-[9px] font-extrabold">LIVE</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{l.title}</span>
                <span className="block text-xs text-white/60">
                  {t.name} · {l.when}
                  {l.live && l.viewers ? ` · ${l.viewers} watching` : ''}
                </span>
              </span>
              {l.live ? (
                <button type="button" onClick={() => toast('Demo: this would open the live session')} className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-bold">
                  Join
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toggle('reminders', l.id)
                    toast(on ? 'Reminder removed' : 'We’ll remind you 10 minutes before')
                  }}
                  aria-pressed={on}
                  className={cn('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold', on ? 'bg-white/15 text-white' : 'bg-white text-zinc-900')}
                >
                  {on ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />} {on ? 'Reminder on' : 'Remind me'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

/* ---------------------------------- discover ---------------------------------- */

/** A small square preview of a post: the cover for videos, the slide colours for slides and tips. */
export function ItemThumb({ item, course, className }: { item: Item; course: Course; className?: string }) {
  if (item.kind === 'video') return <img src={course.cover} alt="" className={cn('object-cover', className)} />
  const slide = item.kind === 'slides' ? item.slides[0] : item.kind === 'tip' ? item.slide : { emoji: '❓', bg: 'from-[#1e1b4b] via-[#312e81] to-[#0b0a24]' }
  return (
    <div className={cn('grid place-items-center bg-gradient-to-br', slide.bg, className)}>
      <span className="text-3xl">{slide.emoji}</span>
    </div>
  )
}

const TRENDING = ['Fraud', 'Fayda', 'KYC', 'Merchants', 'CustomerCare', 'Security', 'Quiz']

export function Discover({ onClose, onOpenItem, onOpenCourse }: { onClose: () => void; onOpenItem: (itemId: string) => void; onOpenCourse: (courseId: string) => void }) {
  const { s, progress } = useLite()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase().replace(/^#/, '')
  const posts = useMemo(() => COURSES.flatMap((c) => c.items.map((it) => ({ c, it }))), [])
  const hits = term ? posts.filter(({ c, it }) => `${c.title} ${itemLabel(it)} ${it.tags.join(' ')}`.toLowerCase().includes(term)) : []
  const courseHits = term ? COURSES.filter((c) => `${c.title} ${c.blurb} ${c.category}`.toLowerCase().includes(term)) : COURSES
  return (
    <div className="animate-fade absolute inset-0 z-50 flex flex-col bg-white text-zinc-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
        <button type="button" onClick={onClose} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-zinc-100">
          <ArrowLeft className="size-5" />
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-zinc-100 px-3.5 py-2">
          <Search className="size-4 shrink-0 text-zinc-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses, topics, #tags" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear">
              <X className="size-4 text-zinc-400" />
            </button>
          )}
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {!term && (
          <div className="px-4 pt-4">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Sparkles className="size-4 text-[#d03c3b]" /> Trending topics
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)} className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}

        {courseHits.length > 0 && (
          <div className="pt-5">
            <p className="flex items-center gap-1.5 px-4 text-sm font-bold">
              <Layers className="size-4 text-[#d03c3b]" /> {term ? 'Courses' : 'Courses for you'}
            </p>
            <div className="scrollbar-none mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
              {courseHits.map((c) => {
                const p = progress(c.id)
                const enrolled = s.enrolled.includes(c.id)
                return (
                  <button key={c.id} type="button" onClick={() => onOpenCourse(c.id)} className="w-44 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 text-left">
                    <div className="relative">
                      <img src={c.cover} alt="" className="h-24 w-full object-cover" />
                      <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">{c.category}</span>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-bold">{c.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {trainerOf(c.trainerId).name} · {c.items.length} posts
                      </p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-mpesa-500" style={{ width: `${p.pct}%` }} />
                      </div>
                      <p className={cn('mt-2 text-xs font-bold', enrolled ? 'text-mpesa-700' : 'text-[#d03c3b]')}>{enrolled ? (p.pct ? 'Continue' : 'Start') : '+ Add & start'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="px-4 pt-5">
          <p className="text-sm font-bold">{term ? `Posts (${hits.length})` : 'Trending posts'}</p>
          {(term ? hits : posts.slice().sort((a, b) => seeded(b.it.id, 0, 999) - seeded(a.it.id, 0, 999)).slice(0, 12)).length ? (
            <div className="mt-3 grid grid-cols-3 gap-1">
              {(term ? hits : posts.slice().sort((a, b) => seeded(b.it.id, 0, 999) - seeded(a.it.id, 0, 999)).slice(0, 12)).map(({ c, it }) => (
                <button key={it.id} type="button" onClick={() => onOpenItem(it.id)} className="relative aspect-[3/4] overflow-hidden rounded-md">
                  <ItemThumb item={it} course={c} className="size-full" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
                    <CirclePlay className="size-3" /> {compact(seeded(it.id + 'v', 800, 60000))}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Nothing matches “{q}”. Try a #tag above.</p>
          )}
        </div>
      </div>
    </div>
  )
}
