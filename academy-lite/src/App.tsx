import { House, MessageCircle, Play, UserRound, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Community } from './community'
import { CHATS, COURSES, allChannels, chatOfTrainer, findItem } from './data'
import { Feed, type FeedTab } from './feed'
import { Inbox } from './inbox'
import { Profile } from './profile'
import { Discover, LiveSheet } from './sheets'
import { TrainerProfile } from './trainer'
import { LiteProvider, unreadIn, useLite } from './store'
import { ToastProvider, cn, useToast } from './ui'

type Screen = 'home' | 'community' | 'inbox' | 'profile'

export default function App() {
  return (
    <LiteProvider>
      <div className="flex h-full items-center justify-center gap-16 bg-[radial-gradient(ellipse_at_top,#2a0f0f_0%,#0e0e10_55%)]">
        <Intro />
        {/* The phone: full screen on a phone, a device-sized frame on a computer. */}
        <div className="relative h-full w-full overflow-hidden bg-black sm:h-[min(calc(100dvh-32px),880px)] sm:w-[400px] sm:rounded-[2.6rem] sm:border-[10px] sm:border-zinc-900 sm:shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </div>
      </div>
    </LiteProvider>
  )
}

function Shell() {
  const { s, toggle } = useLite()
  const toast = useToast()
  const [screen, setScreen] = useState<Screen>('home')
  const [feedTab, setFeedTab] = useState<FeedTab>('foryou')
  const [jumpTo, setJumpTo] = useState<string | null>(null)
  const [discover, setDiscover] = useState(false)
  const [live, setLive] = useState(false)
  const [trainer, setTrainer] = useState<string | null>(null)
  const [chatTarget, setChatTarget] = useState<{ chatId: string; draft?: string } | null>(null)

  // From a trainer profile: open (or start) the chat with them, optionally with a question typed in.
  const openChat = useCallback((trainerId: string, draft?: string) => {
    setTrainer(null)
    setScreen('inbox')
    setChatTarget({ chatId: chatOfTrainer(trainerId).id, draft })
  }, [])
  const clearChatTarget = useCallback(() => setChatTarget(null), [])

  // A shared link (?post=…) opens that post.
  useEffect(() => {
    const post = new URLSearchParams(location.search).get('post')
    if (post && findItem(post)) setJumpTo(post)
  }, [])

  const openItem = useCallback((itemId: string) => {
    setTrainer(null)
    setDiscover(false)
    setScreen('home')
    setFeedTab('foryou')
    setJumpTo(itemId)
  }, [])

  const openCourse = useCallback(
    (courseId: string) => {
      const c = COURSES.find((x) => x.id === courseId)
      if (!c) return
      setTrainer(null)
      if (!s.enrolled.includes(courseId)) {
        toggle('enrolled', courseId)
        toast(`Added “${c.title}” to My learning`)
      }
      setDiscover(false)
      setScreen('home')
      setFeedTab('mine')
      setJumpTo((c.items.find((i) => !s.viewed.includes(i.id)) ?? c.items[0]).id)
    },
    [s.enrolled, s.viewed, toggle, toast],
  )

  // The big middle button: carry on where you left off.
  const resume = () => {
    const next = COURSES.filter((c) => s.enrolled.includes(c.id))
      .flatMap((c) => c.items)
      .find((i) => !s.viewed.includes(i.id))
    setScreen('home')
    setFeedTab('mine')
    if (next) setJumpTo(next.id)
    else toast('All caught up 🎉 Find a new course in search')
  }

  const unread = CHATS.reduce((n, c) => n + unreadIn(s, c.id), 0)
  const communityUnread = allChannels().reduce((n, { channel }) => n + unreadIn(s, channel.id), 0)
  const dark = screen === 'home'

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {screen === 'home' && <Feed tab={feedTab} onTab={setFeedTab} jumpTo={jumpTo} onJumped={() => setJumpTo(null)} onDiscover={() => setDiscover(true)} onLive={() => setLive(true)} onTrainer={setTrainer} />}
        {screen === 'community' && <Community onTrainer={setTrainer} />}
        {screen === 'inbox' && <Inbox target={chatTarget} onTargetUsed={clearChatTarget} onTrainer={setTrainer} />}
        {screen === 'profile' && <Profile onOpenCourse={openCourse} onOpenItem={openItem} />}
        {discover && <Discover onClose={() => setDiscover(false)} onOpenItem={openItem} onOpenCourse={openCourse} />}
        {live && <LiveSheet onClose={() => setLive(false)} />}
        {trainer && <TrainerProfile trainerId={trainer} onClose={() => setTrainer(null)} onChat={openChat} onOpenCourse={openCourse} />}
      </div>

      {/* Home keeps a solid black bar; the other screens get a floating, rounded bar. */}
      <div className={cn('shrink-0 pb-[env(safe-area-inset-bottom)]', dark ? 'bg-black' : screen === 'community' ? 'bg-[#f0f2f5] px-3 pt-1.5 pb-2.5' : 'bg-white px-3 pt-1.5 pb-2.5')}>
      <nav className={cn('flex items-center justify-around', dark ? 'h-14 border-t border-white/10 text-white' : 'h-[62px] rounded-full border border-zinc-200/80 bg-white px-1 text-zinc-900 shadow-[0_6px_24px_rgba(0,0,0,0.12)]')} aria-label="Main">
        <NavBtn label="Home" active={screen === 'home'} onClick={() => setScreen('home')} dark={dark}>
          <House className={cn('size-6', screen === 'home' && 'fill-current')} />
        </NavBtn>
        <NavBtn label="Community" active={screen === 'community'} onClick={() => setScreen('community')} dark={dark} badge={communityUnread}>
          <UsersRound className={cn('size-6', screen === 'community' && 'fill-current')} />
        </NavBtn>
        <button type="button" onClick={resume} aria-label="Continue learning" className="relative -mt-1 flex h-9 w-14 items-center justify-center rounded-xl bg-gradient-to-r from-[#39b54a] to-[#d03c3b] p-[3px] shadow-lg transition active:scale-95">
          <span className={cn('grid size-full place-items-center rounded-[9px]', dark ? 'bg-white text-black' : 'bg-white text-zinc-900')}>
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </button>
        <NavBtn label="Inbox" active={screen === 'inbox'} onClick={() => setScreen('inbox')} dark={dark} badge={unread}>
          <MessageCircle className={cn('size-6', screen === 'inbox' && 'fill-current')} />
        </NavBtn>
        <NavBtn label="Profile" active={screen === 'profile'} onClick={() => setScreen('profile')} dark={dark}>
          <UserRound className={cn('size-6', screen === 'profile' && 'fill-current')} />
        </NavBtn>
      </nav>
      </div>
    </div>
  )
}

function NavBtn({ label, active, onClick, children, dark, badge }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode; dark: boolean; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-w-14 flex-col items-center gap-0.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
        dark ? (active ? '' : 'text-white/60') : active ? 'bg-[#d03c3b]/10 text-[#d03c3b]' : 'text-zinc-500',
      )}
    >
      {children}
      {label}
      {!!badge && <span className="absolute -top-1 right-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#d03c3b] px-1 text-[9px] font-bold text-white">{badge}</span>}
    </button>
  )
}

/** Shown beside the phone on a computer. */
function Intro() {
  return (
    <aside className="hidden max-w-sm text-white lg:block">
      <div className="flex items-center gap-3">
        <img src="/favicon white.svg" alt="" className="size-12 rounded-2xl bg-[#d03c3b] p-2" />
        <div>
          <p className="text-xl leading-tight font-extrabold">M-PESA Academy</p>
          <p className="text-sm font-semibold text-[#39b54a]">Lite</p>
        </div>
      </div>
      <h1 className="mt-8 text-4xl leading-tight font-extrabold tracking-tight">
        Learn in a scroll.
        <br />
        <span className="text-white/60">Two minutes at a time.</span>
      </h1>
      <ul className="mt-6 space-y-3 text-sm text-white/80">
        <li>📲 Swipe up through short videos, slides and one-tap quizzes</li>
        <li>💬 Ask your trainer in chats, just like messaging a friend</li>
        <li>👥 Cheer on classmates and share your wins</li>
        <li>🎓 Finish a course, get the certificate on your profile</li>
      </ul>
      <p className="mt-8 text-xs text-white/40">Best on your phone. Open this page on a phone for full screen.</p>
    </aside>
  )
}
