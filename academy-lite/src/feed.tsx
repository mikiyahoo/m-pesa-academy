import { Bookmark, Check, ChevronRight, Heart, MessageCircle, Play, Plus, Radio, Search, Share2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { COURSES, compact, seedComments, seeded, trainerOf, type Course, type Item, type Slide } from './data'
import { CommentsSheet, CourseSheet, ShareSheet } from './sheets'
import { soundUnlock, useLite } from './store'
import { Avatar, Confetti, cn, useToast } from './ui'

export type FeedTab = 'mine' | 'foryou'
type Entry = { key: string; course: Course; item?: Item; index: number }

/** "For you": every course mixed together. "My learning": your courses in order, each ending with its certificate card. */
function buildEntries(tab: FeedTab, enrolled: string[]): Entry[] {
  if (tab === 'mine') {
    return COURSES.filter((c) => enrolled.includes(c.id)).flatMap((c) => [...c.items.map((item, index) => ({ key: item.id, course: c, item, index })), { key: `${c.id}-finish`, course: c, index: c.items.length }])
  }
  const longest = Math.max(...COURSES.map((c) => c.items.length))
  const out: Entry[] = []
  for (let i = 0; i < longest; i++) for (const c of COURSES) if (c.items[i]) out.push({ key: c.items[i].id, course: c, item: c.items[i], index: i })
  return out
}

export function Feed({ tab, onTab, jumpTo, onJumped, onDiscover, onLive, onTrainer }: { tab: FeedTab; onTab: (t: FeedTab) => void; jumpTo: string | null; onJumped: () => void; onDiscover: () => void; onLive: () => void; onTrainer: (trainerId: string) => void }) {
  const { s, markViewed } = useLite()
  const entries = useMemo(() => buildEntries(tab, s.enrolled), [tab, s.enrolled])
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [comments, setComments] = useState<Entry | null>(null)
  const [share, setShare] = useState<Entry | null>(null)
  const [playlist, setPlaylist] = useState<Course | null>(null)

  // Which post fills the screen right now.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (list) => {
        for (const e of list) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [entries])

  // A post you stay on for a moment counts as seen (quizzes count once answered).
  const current = entries[active]
  useEffect(() => {
    if (!current?.item || current.item.kind === 'quiz') return
    const id = current.item.id
    const t = window.setTimeout(() => markViewed(id), 1500)
    return () => window.clearTimeout(t)
  }, [current, markViewed])

  const scrollTo = useCallback((index: number, smooth = false) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Open a specific post (from Discover, the course list, or "Continue").
  useEffect(() => {
    if (!jumpTo) return
    const idx = entries.findIndex((e) => e.key === jumpTo)
    if (idx >= 0) requestAnimationFrame(() => scrollTo(idx))
    onJumped()
  }, [jumpTo, entries, scrollTo, onJumped])

  // Switching tabs starts from the top; My learning starts at the first post you haven't seen.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (jumpTo) return
    const next = tab === 'mine' ? entries.findIndex((e) => e.item && !s.viewed.includes(e.item.id)) : 0
    requestAnimationFrame(() => scrollTo(Math.max(0, next)))
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full bg-black text-white">
      {/* Top bar: live, the two feeds, search */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent px-3 pt-3 pb-6">
        <button type="button" onClick={onLive} className="pointer-events-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-extrabold tracking-wide" aria-label="Live sessions">
          <Radio className="size-4" /> LIVE
        </button>
        <div className="pointer-events-auto flex items-center gap-5" role="tablist" aria-label="Feeds">
          {(
            [
              ['mine', 'My learning'],
              ['foryou', 'For you'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => onTab(v)} className={cn('text-shadow relative pb-1.5 text-[15px] font-bold transition', tab === v ? 'text-white' : 'text-white/60')}>
              {label}
              {tab === v && <span className="absolute inset-x-2 -bottom-0.5 h-[3px] rounded-full bg-white" />}
            </button>
          ))}
        </div>
        <button type="button" onClick={onDiscover} className="pointer-events-auto grid size-9 place-items-center" aria-label="Search">
          <Search className="size-6" />
        </button>
      </div>

      {entries.length ? (
        <div ref={scroller} className="scrollbar-none h-full snap-y snap-mandatory overflow-y-scroll">
          {entries.map((e, i) => (
            <section key={e.key} data-index={i} className="relative h-full w-full snap-start snap-always overflow-hidden">
              {Math.abs(i - active) <= 2 ? (
                e.item ? (
                  <Post entry={e} active={i === active} onComments={() => setComments(e)} onShare={() => setShare(e)} onPlaylist={() => setPlaylist(e.course)} onTrainer={onTrainer} />
                ) : (
                  <FinishCard course={e.course} onNext={() => scrollTo(i + 1, true)} onPlaylist={() => setPlaylist(e.course)} />
                )
              ) : (
                <div className="size-full bg-zinc-950" />
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <p className="text-lg font-bold">Nothing here yet</p>
            <p className="mt-1 text-sm text-white/60">Tap the search icon to add a course to My learning.</p>
          </div>
        </div>
      )}

      {comments?.item && <CommentsSheet item={comments.item} course={comments.course} onClose={() => setComments(null)} />}
      {share?.item && <ShareSheet item={share.item} course={share.course} onClose={() => setShare(null)} />}
      {playlist && (
        <CourseSheet
          course={playlist}
          onClose={() => setPlaylist(null)}
          onOpen={(itemId) => {
            setPlaylist(null)
            const idx = entries.findIndex((x) => x.key === itemId)
            if (idx >= 0) scrollTo(idx)
            else onTab('mine')
          }}
        />
      )}
    </div>
  )
}

/* ----------------------------------- a post ----------------------------------- */

function Post({ entry, active, onComments, onShare, onPlaylist, onTrainer }: { entry: Entry; active: boolean; onComments: () => void; onShare: () => void; onPlaylist: () => void; onTrainer: (trainerId: string) => void }) {
  const { s, toggle } = useLite()
  const item = entry.item!
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; tilt: number }[]>([])
  const lastTap = useRef(0)
  const single = useRef<number | undefined>(undefined)
  const [paused, setPaused] = useState(false)
  const liked = s.liked.includes(item.id)

  useEffect(() => {
    if (!active) setPaused(false)
  }, [active])

  // Double tap anywhere likes the post (with a heart where you tapped); a single tap pauses a video.
  const onTap = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return
    const now = Date.now()
    const box = e.currentTarget.getBoundingClientRect()
    if (now - lastTap.current < 280) {
      window.clearTimeout(single.current)
      if (!liked) toggle('liked', item.id)
      const heart = { id: now, x: e.clientX - box.left, y: e.clientY - box.top, tilt: Math.round(Math.random() * 40 - 20) }
      setHearts((h) => [...h, heart])
      window.setTimeout(() => setHearts((h) => h.filter((x) => x.id !== heart.id)), 900)
      lastTap.current = 0
      return
    }
    lastTap.current = now
    // The tap that just turned the sound on doesn't also pause the video.
    if (item.kind === 'video' && now - soundUnlock.at > 500) single.current = window.setTimeout(() => setPaused((p) => !p), 280)
  }

  return (
    <div className="relative size-full select-none" onClick={onTap}>
      {item.kind === 'video' && <VideoBody src={item.src} active={active} paused={paused} cover={item.poster ?? entry.course.cover} />}
      {item.kind === 'slides' && <SlidesBody slides={item.slides} course={entry.course} />}
      {item.kind === 'tip' && <SlideFace slide={item.slide} course={entry.course} badge="💡 Tip" />}
      {item.kind === 'quiz' && <QuizBody item={item} />}

      {hearts.map((h) => (
        <Heart key={h.id} className="animate-heart pointer-events-none absolute z-30 size-24 fill-[#f43f5e] text-[#f43f5e] drop-shadow-lg" style={{ left: h.x, top: h.y, ['--tilt' as string]: `${h.tilt}deg` }} />
      ))}

      <ActionRail entry={entry} onComments={onComments} onShare={onShare} onTrainer={onTrainer} />
      <Caption entry={entry} onPlaylist={onPlaylist} onTrainer={onTrainer} />
    </div>
  )
}

/* ------------------------------- right-side rail ------------------------------ */

function ActionRail({ entry, onComments, onShare, onTrainer }: { entry: Entry; onComments: () => void; onShare: () => void; onTrainer: (trainerId: string) => void }) {
  const { s, toggle } = useLite()
  const toast = useToast()
  const item = entry.item!
  const t = trainerOf(entry.course.trainerId)
  const liked = s.liked.includes(item.id)
  const saved = s.saved.includes(item.id)
  const following = s.following.includes(t.id)
  const likes = seeded(item.id, 120, 9800) + (liked ? 1 : 0)
  const saves = seeded(item.id + 's', 20, 900) + (saved ? 1 : 0)
  const commentCount = seedComments(item.id, entry.course.trainerId).length + (s.comments[item.id]?.length ?? 0)
  const shares = seeded(item.id + 'h', 5, 400)

  const Btn = ({ label, count, onClick, children, pressed }: { label: string; count?: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="flex flex-col items-center gap-1 transition active:scale-90">
      <span className="grid size-9 place-items-center rounded-full bg-black/15">{children}</span>
      {count !== undefined && <span className="text-shadow text-[11px] leading-none font-semibold">{count}</span>}
    </button>
  )

  return (
    <div className="absolute right-2 bottom-24 z-20 flex flex-col items-center gap-3">
      <div className="relative mb-1.5">
        <button type="button" onClick={() => onTrainer(t.id)} aria-label={`Open ${t.name}’s profile`} className="block rounded-full transition active:scale-95">
          <Avatar src={t.avatar} name={t.name} size={40} ring="ring-2 ring-white" />
        </button>
        <button
          type="button"
          onClick={() => {
            toggle('following', t.id)
            toast(following ? `Unfollowed ${t.name}` : `Following ${t.name}`)
          }}
          aria-label={following ? `Unfollow ${t.name}` : `Follow ${t.name}`}
          className={cn('absolute -bottom-2 left-1/2 grid size-4 -translate-x-1/2 place-items-center rounded-full transition', following ? 'bg-white text-[#f43f5e]' : 'bg-[#f43f5e] text-white')}
        >
          {following ? <Check className="size-2.5" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
        </button>
      </div>
      <Btn label={liked ? 'Unlike' : 'Like'} count={compact(likes)} onClick={() => toggle('liked', item.id)} pressed={liked}>
        <Heart className={cn('size-6 drop-shadow transition', liked ? 'scale-110 fill-[#f43f5e] text-[#f43f5e]' : 'fill-white/90 text-white/90')} />
      </Btn>
      <Btn label="Comments" count={compact(commentCount)} onClick={onComments}>
        <MessageCircle className="size-6 fill-white/90 text-white/90 drop-shadow" />
      </Btn>
      <Btn
        label={saved ? 'Remove from saved' : 'Save'}
        count={compact(saves)}
        pressed={saved}
        onClick={() => {
          toggle('saved', item.id)
          toast(saved ? 'Removed from saved' : 'Saved to your profile')
        }}
      >
        <Bookmark className={cn('size-6 drop-shadow', saved ? 'fill-amber-400 text-amber-400' : 'fill-white/90 text-white/90')} />
      </Btn>
      <Btn label="Share" count={compact(shares)} onClick={onShare}>
        <Share2 className="size-[22px] text-white drop-shadow" />
      </Btn>
    </div>
  )
}

/* ------------------------------- caption & course ------------------------------- */

function Caption({ entry, onPlaylist, onTrainer }: { entry: Entry; onPlaylist: () => void; onTrainer: (trainerId: string) => void }) {
  const { progress } = useLite()
  const [more, setMore] = useState(false)
  const item = entry.item!
  const t = trainerOf(entry.course.trainerId)
  const p = progress(entry.course.id)
  return (
    <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t to-transparent pr-20 pb-4 pl-3', item.kind === 'video' ? 'from-black/75 via-black/30 pt-24' : 'from-black/40 pt-4')}>
      <button type="button" onClick={() => onTrainer(t.id)} className="text-shadow pointer-events-auto text-[15px] font-bold hover:underline">
        @{t.handle}
      </button>
      <button type="button" onClick={() => setMore((m) => !m)} className={cn('text-shadow pointer-events-auto mt-1 block text-left text-sm leading-snug', !more && 'line-clamp-2')}>
        {item.caption}
      </button>
      <p className="text-shadow mt-1 text-sm font-semibold">{item.tags.map((tg) => `#${tg}`).join(' ')}</p>
      <button type="button" onClick={onPlaylist} className="pointer-events-auto mt-2.5 flex max-w-full items-center gap-2 rounded-lg bg-white/15 py-1.5 pr-2 pl-2 text-xs font-semibold backdrop-blur">
        <span className="grid size-5 shrink-0 place-items-center rounded bg-[#d03c3b] text-[10px]">📘</span>
        <span className="truncate">{entry.course.title}</span>
        <span className="shrink-0 text-white/70">
          · {entry.index + 1}/{entry.course.items.length}
        </span>
        <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-white/25">
          <span className="block h-full rounded-full bg-mpesa-500" style={{ width: `${p.pct}%` }} />
        </span>
        <ChevronRight className="size-3.5 shrink-0" />
      </button>
    </div>
  )
}

/* ---------------------------------- post bodies --------------------------------- */

function VideoBody({ src, active, paused, cover }: { src: string; active: boolean; paused: boolean; cover: string }) {
  const { s } = useLite()
  const ref = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = s.muted
    // If the phone refuses to play with sound, fall back to silent until the next tap.
    if (active && !paused) void v.play().catch(() => ((v.muted = true), void v.play().catch(() => undefined)))
    else v.pause()
  }, [active, paused, s.muted])
  return (
    <>
      <video ref={ref} src={src} poster={cover} loop playsInline preload={active ? 'auto' : 'metadata'} muted={s.muted} className="absolute inset-0 size-full bg-black object-cover" onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)} />
      {paused && (
        <span className="animate-pop pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/30">
          <Play className="ml-1 size-10 fill-white/90 text-white/90" />
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/20">
        <div className="h-full bg-white/90" style={{ width: `${progress * 100}%` }} />
      </div>
    </>
  )
}

/**
 * A slide that reads like a presentation page: a clean white card with the course name on top,
 * a small icon, a clear title, short text or bullets, and the page number at the bottom.
 * It sits on a dark backdrop so the buttons on the right and the caption stay readable.
 */
function SlideFace({ slide, course, badge, page, onPage }: { slide: Slide; course: Course; badge?: string; page?: { at: number; total: number }; onPage?: (i: number) => void }) {
  return (
    <div className={cn('relative size-full bg-gradient-to-br', slide.bg)}>
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute top-16 right-[4.25rem] bottom-44 left-3 flex flex-col overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl">
        <div className={cn('h-1.5 shrink-0 bg-gradient-to-r', slide.bg)} />
        <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-3.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">
            <span className="size-1.5 shrink-0 rounded-full bg-[#d03c3b]" />
            <span className="truncate">{course.title}</span>
          </span>
          {badge && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{badge}</span>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center px-5">
          <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl shadow-sm', slide.bg)} aria-hidden>
            {slide.emoji}
          </span>
          <h2 className="mt-4 text-[1.35rem] leading-tight font-bold tracking-tight">{slide.title}</h2>
          <span className="mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-[#d03c3b]" />
          {slide.body && <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">{slide.body}</p>}
          {slide.points && (
            <ul className="mt-3 space-y-2">
              {slide.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-[15px] leading-snug text-zinc-700">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#d03c3b]" />
                  {pt}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-100 px-5 py-2.5 text-[11px] font-medium text-zinc-400">
          <span>M-PESA Academy</span>
          {page && page.total > 1 ? (
            <span className="flex items-center gap-2">
              <span className="flex gap-1">
                {Array.from({ length: page.total }, (_, i) => (
                  <button key={i} type="button" aria-label={`Slide ${i + 1}`} onClick={() => onPage?.(i)} className={cn('h-1.5 rounded-full transition-all', i === page.at ? 'w-4 bg-[#d03c3b]' : 'w-1.5 bg-zinc-300')} />
                ))}
              </span>
              <span className="tabular-nums">
                {page.at + 1} / {page.total}
              </span>
            </span>
          ) : (
            <span>Tip</span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Photo-mode style: slides swipe left and right inside the post; each page shows its number. */
function SlidesBody({ slides, course }: { slides: Slide[]; course: Course }) {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const goTo = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })
  return (
    <>
      <div ref={track} onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto">
        {slides.map((sl, i) => (
          <div key={sl.title} className="h-full w-full shrink-0 snap-center">
            <SlideFace slide={sl} course={course} page={{ at: i, total: slides.length }} onPage={goTo} />
          </div>
        ))}
      </div>
      {at === 0 && slides.length > 1 && <span className="animate-fade pointer-events-none absolute top-[calc(4rem+0.9rem)] right-[5.25rem] z-10 rounded-full bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">Swipe ›</span>}
    </>
  )
}

function QuizBody({ item }: { item: Extract<Item, { kind: 'quiz' }> }) {
  const { s, answer } = useLite()
  const chosen = s.quiz[item.id]
  const done = chosen !== undefined
  const right = chosen === item.answer
  const [burst, setBurst] = useState(0)
  // After answering, bring the explanation into view (short screens).
  const explain = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Scroll only the middle box, never the feed around it.
    const box = explain.current?.closest<HTMLElement>("[data-quiz-scroll]")
    if (done && box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" })
  }, [done])
  return (
    <div className="relative size-full bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#0b0a24]">
      <div data-quiz-scroll className="scrollbar-none absolute top-16 right-[4.25rem] bottom-40 left-4 flex flex-col overflow-y-auto overscroll-contain">
      <div className="my-auto">
      <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wide">
        <Sparkles className="size-3 text-amber-300" /> QUICK CHECK · +10 XP
      </span>
      <h2 className="text-lg leading-snug font-bold">{item.question}</h2>
      <div className="mt-4 space-y-2">
        {item.options.map((o, i) => {
          const isRight = i === item.answer
          const isChosen = i === chosen
          return (
            <button
              key={o}
              type="button"
              disabled={done}
              onClick={() => {
                answer(item.id, i, isRight)
                if (isRight) setBurst((b) => b + 1)
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm leading-snug font-medium transition active:scale-[0.98]',
                !done && 'border-white/25 bg-white/10 hover:bg-white/20',
                done && isRight && 'border-mpesa-500 bg-mpesa-500 text-white',
                done && isChosen && !isRight && 'border-[#f43f5e] bg-[#f43f5e]/90',
                done && !isRight && !isChosen && 'border-white/10 bg-white/5 text-white/50',
              )}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', done && (isRight || isChosen) ? 'bg-white/25' : 'bg-white/15')}>
                {done && isRight ? <Check className="size-3.5" strokeWidth={3} /> : String.fromCharCode(65 + i)}
              </span>
              {o}
            </button>
          )
        })}
      </div>
      {done && (
        <div ref={explain} className="animate-pop mt-3 rounded-xl bg-white/10 p-3 text-[13px] leading-relaxed">
          <p className="font-bold">{right ? '🎉 Correct! +10 XP' : '💡 Not quite. The right answer is highlighted.'}</p>
          <p className="mt-1 text-white/80">{item.explain}</p>
        </div>
      )}
      </div>
      </div>
      {burst > 0 && right && <Confetti key={burst} />}
    </div>
  )
}

/* ------------------------------ end of a course ------------------------------ */

function FinishCard({ course, onNext, onPlaylist }: { course: Course; onNext: () => void; onPlaylist: () => void }) {
  const { s, set, progress } = useLite()
  const toast = useToast()
  const p = progress(course.id)
  const complete = p.done === p.total
  const certified = s.certified.includes(course.id)
  const t = trainerOf(course.trainerId)
  return (
    <div className="relative flex size-full flex-col items-center justify-center bg-gradient-to-b from-[#111] via-[#1a0f0f] to-black px-7 text-center">
      {complete && !certified && <Confetti />}
      {complete ? (
        <>
          <div className="animate-pop w-full max-w-xs rounded-3xl border border-amber-300/50 bg-gradient-to-br from-[#fff7e6] to-[#ffe7b0] p-6 text-zinc-900 shadow-2xl">
            <p className="text-[11px] font-bold tracking-[0.2em] text-amber-700 uppercase">Certificate</p>
            <p className="mt-3 text-5xl">🎓</p>
            <p className="mt-3 text-lg leading-tight font-extrabold">{course.title}</p>
            <p className="mt-1 text-xs text-zinc-600">Awarded to you · signed by {t.name}</p>
          </div>
          {certified ? (
            <p className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-mpesa-500">
              <Check className="size-4" /> On your profile
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                set((x) => ({ ...x, certified: [...x.certified, course.id], xp: x.xp + 50 }))
                toast('🎓 Certificate added to your profile · +50 XP')
              }}
              className="mt-6 rounded-full bg-[#d03c3b] px-7 py-3 text-sm font-bold shadow-lg transition active:scale-95"
            >
              Claim certificate · +50 XP
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-5xl">🏁</p>
          <h2 className="mt-4 text-2xl font-extrabold">End of {course.title}</h2>
          <p className="mt-2 text-sm text-white/70">
            {p.done} of {p.total} done. Finish the rest to unlock your certificate.
          </p>
          <div className="mt-5 h-2 w-56 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-mpesa-500" style={{ width: `${p.pct}%` }} />
          </div>
          <button type="button" onClick={onPlaylist} className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-zinc-900">
            See what’s left
          </button>
        </>
      )}
      <button type="button" onClick={onNext} className="absolute bottom-6 text-xs font-semibold text-white/60">
        Swipe up for the next course ↑
      </button>
    </div>
  )
}
