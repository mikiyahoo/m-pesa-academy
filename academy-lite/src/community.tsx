import { Bell, Globe2, Image as ImageIcon, MessageCircle, MoreHorizontal, Plus, Search, Share2, ThumbsUp, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CLASSMATES, ME, type Post } from './data'
import { useLite } from './store'
import { Avatar, Sheet, cn, useToast } from './ui'

const STORIES = [
  { id: 's1', person: CLASSMATES[0], emoji: '🎓', text: 'Finished “Spot the Scam”!', bg: 'from-[#d03c3b] to-[#6e1717]' },
  { id: 's2', person: CLASSMATES[2], emoji: '🔥', text: '7 days in a row. Who’s next?', bg: 'from-[#f59e0b] to-[#9a3412]' },
  { id: 's3', person: CLASSMATES[1], emoji: '💯', text: 'Got every quiz right in Fayda ID', bg: 'from-[#39b54a] to-[#0f4d1f]' },
  { id: 's4', person: CLASSMATES[3], emoji: '🏪', text: 'Set up my first merchant till today', bg: 'from-[#0ea5e9] to-[#1e1b4b]' },
  { id: 's5', person: CLASSMATES[4], emoji: '📚', text: 'Started Customer Care Excellence', bg: 'from-[#a855f7] to-[#3b0764]' },
]

/** Social learning: classmates’ stories, a composer and posts with reactions, comments and shares. */
export function Community() {
  const { s, toggle } = useLite()
  const toast = useToast()
  const [composing, setComposing] = useState(false)
  const [story, setStory] = useState<number | null>(null)

  return (
    <div className="flex h-full flex-col bg-[#f0f2f5] text-zinc-900">
      <div className="flex shrink-0 items-center justify-between bg-white px-4 py-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#d03c3b]">community</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => toast('Demo: search people and posts')} aria-label="Search" className="grid size-9 place-items-center rounded-full bg-zinc-100">
            <Search className="size-[18px]" />
          </button>
          <button type="button" onClick={() => toast('You’re all caught up 🎉')} aria-label="Notifications" className="relative grid size-9 place-items-center rounded-full bg-zinc-100">
            <Bell className="size-[18px]" />
            <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-[#d03c3b] text-[9px] font-bold text-white">3</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
        {/* Composer */}
        <div className="flex items-center gap-3 bg-white px-4 py-3">
          <Avatar src={ME.avatar} name={ME.name} size={40} />
          <button type="button" onClick={() => setComposing(true)} className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-500 hover:bg-zinc-50">
            What did you learn today?
          </button>
          <button type="button" onClick={() => setComposing(true)} aria-label="Add photo" className="grid size-9 place-items-center rounded-full text-mpesa-600 hover:bg-zinc-100">
            <ImageIcon className="size-5" />
          </button>
        </div>

        {/* Stories */}
        <div className="scrollbar-none flex gap-2 overflow-x-auto bg-white px-4 py-3">
          <button type="button" onClick={() => setComposing(true)} className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white text-left">
            <img src={ME.avatar} alt="" className="h-28 w-full object-cover" />
            <span className="absolute top-[100px] left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-[#d03c3b] text-white">
              <Plus className="size-4" strokeWidth={3} />
            </span>
            <span className="absolute inset-x-0 bottom-2 text-center text-xs font-semibold">Share a win</span>
          </button>
          {STORIES.map((st, i) => (
            <button key={st.id} type="button" onClick={() => setStory(i)} className={cn('relative h-44 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br text-left text-white', st.bg)}>
              <span className="absolute top-2 left-2 z-10"><Avatar src={st.person.avatar} name={st.person.name} size={36} ring="ring-[3px] ring-[#d03c3b] ring-offset-2" /></span>
              <span className="absolute inset-0 grid place-items-center text-5xl">{st.emoji}</span>
              <span className="absolute inset-x-2 bottom-2 text-xs leading-tight font-semibold">{st.person.name}</span>
            </button>
          ))}
        </div>

        {s.posts.map((p) => (
          <PostCard key={p.id} post={p} reacted={s.reacted.includes(p.id)} onReact={() => toggle('reacted', p.id)} />
        ))}
      </div>

      {composing && <Composer onClose={() => setComposing(false)} />}
      {story !== null && <StoryViewer index={story} onIndex={setStory} onClose={() => setStory(null)} />}
    </div>
  )
}

function PostCard({ post, reacted, onReact }: { post: Post; reacted: boolean; onReact: () => void }) {
  const toast = useToast()
  const [commenting, setCommenting] = useState(false)
  const [text, setText] = useState('')
  const [mine, setMine] = useState<string[]>([])
  return (
    <article className="bg-white pt-3">
      <header className="flex items-center gap-2.5 px-4">
        <Avatar src={post.avatar} name={post.author} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{post.author}</p>
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            {post.ago} · <Globe2 className="size-3" />
          </p>
        </div>
        <button type="button" onClick={() => toast('Demo: post options')} aria-label="More" className="grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100">
          <MoreHorizontal className="size-5" />
        </button>
      </header>
      <p className="mt-2 px-4 text-[15px] leading-snug whitespace-pre-line">{post.text}</p>
      {post.image && <img src={post.image} alt="" className="mt-3 max-h-72 w-full object-cover" />}
      {post.badge && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#fff7e6] to-[#ffe7b0] p-3">
          <span className="text-3xl">{post.badge.emoji}</span>
          <span className="text-sm font-bold text-amber-900">{post.badge.title}</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between px-4 text-sm text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="flex -space-x-1">
            <span className="grid size-5 place-items-center rounded-full bg-sky-500 text-[10px] ring-2 ring-white">👍</span>
            <span className="grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] ring-2 ring-white">❤️</span>
            <span className="grid size-5 place-items-center rounded-full bg-amber-400 text-[10px] ring-2 ring-white">🎉</span>
          </span>
          {post.reactions + (reacted ? 1 : 0)}
        </span>
        <span>
          {post.comments + mine.length} comments · {post.shares} shares
        </span>
      </div>
      <div className="mx-4 mt-2 grid grid-cols-3 border-t border-zinc-100 py-1 text-sm font-semibold text-zinc-600">
        <button type="button" onClick={onReact} aria-pressed={reacted} className={cn('flex items-center justify-center gap-1.5 rounded-lg py-2 hover:bg-zinc-50', reacted && 'text-sky-600')}>
          <ThumbsUp className={cn('size-[18px]', reacted && 'fill-sky-600')} /> Like
        </button>
        <button type="button" onClick={() => setCommenting((v) => !v)} className="flex items-center justify-center gap-1.5 rounded-lg py-2 hover:bg-zinc-50">
          <MessageCircle className="size-[18px]" /> Comment
        </button>
        <button type="button" onClick={() => toast('Shared with your team')} className="flex items-center justify-center gap-1.5 rounded-lg py-2 hover:bg-zinc-50">
          <Share2 className="size-[18px]" /> Share
        </button>
      </div>
      {(commenting || mine.length > 0) && (
        <div className="space-y-2 px-4 pb-3">
          {mine.map((c, i) => (
            <div key={i} className="flex gap-2">
              <Avatar src={ME.avatar} name={ME.name} size={30} />
              <span className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm">
                <span className="block text-xs font-semibold">{ME.name}</span>
                {c}
              </span>
            </div>
          ))}
          {commenting && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!text.trim()) return
                setMine((m) => [...m, text.trim()])
                setText('')
              }}
              className="flex items-center gap-2"
            >
              <Avatar src={ME.avatar} name={ME.name} size={30} />
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-full bg-zinc-100 px-4 py-2 text-sm outline-none" />
            </form>
          )}
        </div>
      )}
      {!commenting && mine.length === 0 && <div className="pb-1" />}
    </article>
  )
}

function Composer({ onClose }: { onClose: () => void }) {
  const { set, s } = useLite()
  const toast = useToast()
  const [text, setText] = useState('')
  const latest = s.certified.at(-1)
  return (
    <Sheet open onClose={onClose} title="Create post" height="60%">
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="flex items-center gap-2.5">
          <Avatar src={ME.avatar} name={ME.name} size={40} />
          <div>
            <p className="text-sm font-semibold">{ME.name}</p>
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Globe2 className="size-3" /> Everyone in the Academy
            </p>
          </div>
        </div>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you learn today? Share a tip or a win…" className="mt-3 min-h-0 flex-1 resize-none text-lg outline-none" />
        {latest && !text && (
          <button type="button" onClick={() => setText('Just earned my certificate 🎓 Thanks to the trainers!')} className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
            🎓 Share your latest certificate
          </button>
        )}
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => {
            set((x) => ({ ...x, posts: [{ id: `me-${Date.now()}`, author: ME.name, avatar: ME.avatar, ago: 'Just now', text: text.trim(), reactions: 0, comments: 0, shares: 0 }, ...x.posts] }))
            toast('Posted to the community')
            onClose()
          }}
          className="w-full rounded-xl bg-[#d03c3b] py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          Post
        </button>
      </div>
    </Sheet>
  )
}

/** Full-screen stories with progress bars that move on by themselves; tap left or right to skip. */
function StoryViewer({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const toast = useToast()
  const st = STORIES[index]
  useEffect(() => {
    const t = window.setTimeout(() => (index < STORIES.length - 1 ? onIndex(index + 1) : onClose()), 4000)
    return () => window.clearTimeout(t)
  }, [index, onIndex, onClose])
  return (
    <div className={cn('animate-fade absolute inset-0 z-[70] flex flex-col bg-gradient-to-br text-white', st.bg)}>
      <div className="flex gap-1 px-2 pt-3">
        {STORIES.map((x, i) => (
          <span key={x.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
            <span key={`${x.id}-${index}`} className={cn('block h-full bg-white', i < index && 'w-full', i > index && 'w-0', i === index && 'animate-story')} />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <Avatar src={st.person.avatar} name={st.person.name} size={34} />
        <span className="text-sm font-semibold">{st.person.name}</span>
        <span className="text-xs text-white/70">2h</span>
        <button type="button" onClick={onClose} aria-label="Close story" className="ml-auto grid size-9 place-items-center">
          <X className="size-6" />
        </button>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <button type="button" aria-label="Previous" onClick={() => index > 0 && onIndex(index - 1)} className="absolute inset-y-0 left-0 w-1/3" />
        <button type="button" aria-label="Next" onClick={() => (index < STORIES.length - 1 ? onIndex(index + 1) : onClose())} className="absolute inset-y-0 right-0 w-1/3" />
        <span className="animate-pop text-8xl">{st.emoji}</span>
        <p className="mt-6 text-2xl leading-tight font-extrabold">{st.text}</p>
      </div>
      <div className="flex gap-2 px-3 pb-4">
        <button type="button" onClick={() => (toast(`You cheered for ${st.person.name.split(' ')[0]} 👏`), onClose())} className="flex-1 rounded-full border border-white/50 py-2.5 text-sm font-semibold">
          Send a cheer 👏
        </button>
      </div>
    </div>
  )
}
