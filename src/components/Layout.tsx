import { ArrowRight, Award, BookOpen, Briefcase, ChartNoAxesColumn, ChevronDown, ChevronLeft, CircleHelp, ClipboardList, FilePlus2, Home, LogOut, Menu, RotateCcw, Search, type LucideIcon, UserRound, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { cn, progressStatus } from '../lib/utils'
import { useStore } from '../store/AppStore'
import { useAuth } from '../store/Auth'
import { useFeedback } from './Feedback'
import { ClimbIcon } from './ClimbIcon'
import { NotificationBell } from './NotificationBell'
import { UserAvatar } from './UserAvatar'

export type LayoutVariant = 'learner' | 'requester'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; section?: string }

const learnerNav: NavItem[] = [
    { to: '/trainings', label: 'Home', icon: Home, end: true },
    { to: '/learning', label: 'Trainings', icon: BookOpen },
    { to: '/certificates', label: 'Certificates', icon: Award },
    { to: '/report', label: 'Report', icon: ChartNoAxesColumn },
    { to: '/help', label: 'Help & Support', icon: CircleHelp },
  ];

const navs: Record<LayoutVariant, NavItem[]> = {
  learner: learnerNav,
  // A requester is also a trainee: the full learner portal, plus their requests.
  requester: [...learnerNav, { to: '/requests', label: 'My requests', icon: ClipboardList, end: true, section: 'Requests' },
    { to: '/requests/new', label: 'New request', icon: FilePlus2 },
    { to: '/requests/reports', label: 'Team reports', icon: ChartNoAxesColumn }],
}

const home: Record<LayoutVariant, string> = { learner: '/trainings', requester: '/trainings' }

export function Logo({ compact = false, to = '/trainings' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3">
      <img src="/favicon white.svg" alt="" className="size-10 shrink-0 rounded-xl" />
      {!compact && (
        <span className="leading-none font-bold tracking-tight text-white">
          <span className="block text-base leading-[1.05]">M-PESA</span>
          <span className="block text-sm leading-[1.05] font-semibold text-white/85">Academy</span>
        </span>
      )}
    </Link>
  )
}

/** Greeting at the top left of the learner header. */
function HeaderWelcome() {
  const { user } = useAuth()
  return <p className="hidden shrink-0 text-sm font-semibold whitespace-nowrap text-zinc-800 md:block">Welcome back, {user.name.split(' ')[0]} 👋</p>
}

function HeaderSearch() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')

  useEffect(() => {
    setValue(params.get('q') ?? '')
  }, [params])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(value.trim() ? `/learning?q=${encodeURIComponent(value.trim())}` : '/learning')
  }

  return (
    <form onSubmit={submit} role="search" className="relative min-w-0 flex-1 md:w-64 md:flex-none lg:w-80">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search courses, modules…"
        aria-label="Search trainings"
        className="w-full rounded-full border border-transparent bg-zinc-100 py-2.5 pr-4 pl-10 text-sm outline-none placeholder:text-zinc-500 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
    </form>
  )
}

function KeepLearningCard({ onNavigate }: { onNavigate?: () => void }) {
  const { trainings, progress } = useStore()
  // The first training that's started but not finished, else the next one to start.
  const next =
    trainings.find((t) => progressStatus(t, progress[t.id]) === 'In Progress') ?? trainings.find((t) => progressStatus(t, progress[t.id]) === 'Not Started')
  if (!next) return <SidebarCard icon={Award} title="All caught up" text="Every training is complete. Your certificates are ready." to="/certificates" label="View certificates" onNavigate={onNavigate} />
  const done = next.modules.filter((m) => progress[next.id]?.completedModules.includes(m.id)).length
  const pct = Math.round((done / next.modules.length) * 100)
  return (
    <div className="relative isolate mt-auto overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#e05a59]/90 via-brand-600/90 to-[#962b2a]/90 p-5">
      <div className="pointer-events-none absolute -right-14 -bottom-16 -z-10 h-36 w-52 rotate-[-20deg] rounded-[50%] bg-gradient-to-tl from-brand-600/40 via-brand-700/25 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute -right-8 -bottom-12 -z-10 size-28 rounded-full border-[18px] border-white/[0.05]" aria-hidden />
      <ClimbIcon className="relative size-9 text-white" />
      <p className="relative mt-3 text-lg leading-tight font-bold text-white">You’re making progress!</p>
      <p className="relative mt-1.5 truncate text-xs text-white/90" title={next.title}>
        {done} of {next.modules.length} modules completed
      </p>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${next.title} progress`}>
        <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <Link
        to={`/trainings/${next.id}/learn`}
        onClick={onNavigate}
        title={next.title}
        className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-brand-50"
      >
        Keep Learning <ArrowRight className="size-4 text-brand-600" />
      </Link>
    </div>
  )
}

function SidebarCard({ icon: Icon, title, text, to, label, onNavigate }: { icon: LucideIcon; title: string; text: string; to?: string; label: string; onNavigate?: () => void }) {
  return (
    <div className="relative isolate mt-auto overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#e05a59]/90 via-brand-600/90 to-[#962b2a]/90 p-5">
      <div className="pointer-events-none absolute -right-14 -bottom-16 -z-10 h-36 w-52 rotate-[-20deg] rounded-[50%] bg-gradient-to-tl from-brand-600/40 via-brand-700/25 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute -right-8 -bottom-12 -z-10 size-28 rounded-full border-[18px] border-white/[0.05]" aria-hidden />
      <Icon className="relative size-9 text-white" />
      <p className="relative mt-3 text-lg font-bold text-white">{title}</p>
      <p className="relative mt-1 text-xs leading-relaxed text-white/90">{text}</p>
      {to && (
        <Link
          to={to}
          onClick={onNavigate}
          aria-label={label}
          className="relative mt-3 ml-auto grid size-9 place-items-center rounded-full bg-white text-brand-600 transition hover:bg-brand-50"
        >
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  )
}

function Sidebar({ collapsed, variant, onNavigate }: { collapsed: boolean; variant: LayoutVariant; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'px-2')}>
        <Logo compact={collapsed} to={home[variant]} />
      </div>
      <nav className="flex flex-col gap-1.5">
        {navs[variant].map(({ to, label, icon: Icon, end, section }) => (
          <Fragment key={to}>
          {section &&
            (collapsed ? (
              <span className="mx-auto my-2 h-px w-8 bg-white/20" aria-hidden />
            ) : (
              <span className="mt-4 mb-0.5 px-3.5 text-[11px] font-semibold tracking-wider text-white/75 uppercase">{section}</span>
            ))}
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive: navActive }) => {
              const isActive = navActive || (to === '/learning' && pathname.startsWith('/trainings/'))
              return cn(
                'flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-white/15 text-white ring-1 ring-white/20' : 'text-white/90 hover:bg-white/10 hover:text-white',
              )
            }}
          >
            <Icon className="size-5 shrink-0" />
            {!collapsed && label}
          </NavLink>
          </Fragment>
        ))}
      </nav>
      {!collapsed &&
        (variant === 'learner' ? (
          <KeepLearningCard onNavigate={onNavigate} />
        ) : (
          <SidebarCard
            icon={FilePlus2}
            title="Need a training?"
            text="Request a session for your team. Drafts are kept for 24 hours."
            to="/requests/new"
            label="New training request"
            onNavigate={onNavigate}
          />
        ))}
    </div>
  )
}

/** What "Reset demo data" does for this kind of account. */
export type DemoReset = { label: string; title: string; message: string; done: string; run: () => void }

function UserMenu({ reset }: { reset: DemoReset }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { logout, user } = useAuth()
  const { confirm, toast } = useFeedback()

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-zinc-100">
        <UserAvatar name={user.name} className="size-9 ring-1 ring-zinc-200" />
        <span className="hidden max-w-[12rem] truncate text-sm font-medium whitespace-nowrap lg:block">{user.name}</span>
        <ChevronDown className="size-4 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center gap-3 border-b border-zinc-100 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700">
              <Briefcase className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-900">{user.role}</span>
              <span className="block truncate text-xs text-zinc-500">{user.email}</span>
            </span>
          </div>
          <div className="p-1 text-sm">
            <Link to="/profile" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50">
              <UserRound className="size-4" /> Profile
            </Link>
            <button
              onClick={async () => {
                setOpen(false)
                if (await confirm({ title: reset.title, message: reset.message, confirmLabel: 'Reset', danger: true })) {
                  reset.run()
                  toast(reset.done)
                }
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-zinc-700 hover:bg-zinc-50"
            >
              <RotateCcw className="size-4" /> {reset.label}
            </button>
            <button onClick={() => logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-brand-700 hover:bg-brand-50">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Layout({ variant = 'learner', reset }: { variant?: LayoutVariant; reset?: DemoReset }) {
  const { resetProgress } = useStore()
  const demoReset: DemoReset = reset ?? {
    label: 'Reset demo progress',
    title: 'Reset your progress?',
    message: 'Module completions and quiz scores go back to the demo data.',
    done: 'Progress reset',
    run: resetProgress,
  }
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-full">
      <aside className={cn('sticky top-0 z-30 hidden h-screen shrink-0 bg-gradient-to-b from-brand-600 via-[#8e2118] to-[#5e1914] transition-all lg:block isolate before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-56 before:bg-gradient-to-b before:from-black/45 before:to-transparent', collapsed ? 'w-20' : 'w-64')}>
        <Sidebar collapsed={collapsed} variant={variant} />
        {/* Collapse / expand handle on the sidebar's edge. */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="absolute top-8 -right-3 z-30 grid size-6 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:text-brand-600"
        >
          <ChevronLeft className={cn('size-3.5 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto bg-gradient-to-b from-brand-600 via-[#8e2118] to-[#5e1914] shadow-xl isolate before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-56 before:bg-gradient-to-b before:from-black/45 before:to-transparent">
            <button onClick={() => setMobileOpen(false)} className="absolute top-6 right-3 rounded-full p-1 text-white/80 hover:bg-white/10" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar collapsed={false} variant={variant} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2.5 border-b border-zinc-200/70 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 lg:hidden" aria-label="Open menu">
            <Menu className="size-[18px]" />
          </button>
          <HeaderWelcome />
          <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:flex-none">
            <HeaderSearch />
            <NotificationBell />
            <UserMenu reset={demoReset} />
          </div>
        </header>
        <main className={cn('mx-auto w-full flex-1 p-4 sm:p-6', !/^\/trainings\/[^/]+$/.test(pathname) && 'max-w-[1400px]')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
