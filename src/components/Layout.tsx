import { ArrowRight, Award, BookOpen, CalendarDays, ChevronDown, ChevronLeft, FileBarChart, GraduationCap, LogOut, PanelLeft, RotateCcw, Search, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { currentUser } from '../data/trainings'
import { cn, initials, progressStatus } from '../lib/utils'
import { useStore } from '../store/AppStore'
import { useAuth } from '../store/Auth'
import { useFeedback } from './Feedback'

const nav = [
  { to: '/trainings', label: 'Trainings', icon: BookOpen },
  { to: '/certificates', label: 'Certificates', icon: Award },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/report', label: 'Report', icon: FileBarChart },
]

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/trainings" className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-lg shadow-black/10">
        <svg viewBox="0 0 32 32" className="size-6">
          <path d="M7 21c3-7 6-9 9-9s6 2 9 9" fill="none" stroke="#e60a2a" strokeWidth={3} strokeLinecap="round" />
          <circle cx={16} cy={9} r={2.5} fill="#39B54A" />
        </svg>
      </span>
      {!compact && <span className="text-base font-bold tracking-tight text-white">M-PESA Learning</span>}
    </Link>
  )
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
    navigate(value.trim() ? `/trainings?q=${encodeURIComponent(value.trim())}` : '/trainings')
  }

  return (
    <form onSubmit={submit} role="search" className="relative w-full max-w-md">
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

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { trainings, progress } = useStore()
  // "Keep learning" jumps to the first training that's started but not finished.
  const next =
    trainings.find((t) => progressStatus(t, progress[t.id]) === 'In Progress') ?? trainings.find((t) => progressStatus(t, progress[t.id]) === 'Not Started')

  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'px-2')}>
        <Logo compact={collapsed} />
      </div>
      <nav className="flex flex-col gap-1.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-white text-brand-700 shadow-lg shadow-black/10' : 'text-white/85 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <div className="relative mt-auto overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-5">
          <div className="absolute -bottom-10 -left-10 size-24 rounded-full bg-white/10" />
          <GraduationCap className="relative size-9 text-white" />
          <p className="relative mt-3 text-lg font-bold text-white">Keep learning</p>
          <p className="relative mt-1 text-xs leading-relaxed text-white/80">Complete modules and pass the quiz to earn your certificate.</p>
          {next && (
            <Link
              to={`/trainings/${next.id}`}
              onClick={onNavigate}
              aria-label={`Continue ${next.title}`}
              className="relative mt-3 ml-auto grid size-9 place-items-center rounded-full bg-white text-brand-600 shadow-lg shadow-black/10 transition hover:bg-brand-50"
            >
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { resetProgress } = useStore()
  const { logout } = useAuth()
  const { confirm, toast } = useFeedback()

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-zinc-100">
        <span className="grid size-9 place-items-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800 ring-1 ring-zinc-200">
          {initials(currentUser.name)}
        </span>
        <span className="hidden text-sm font-medium sm:block">{currentUser.name}</span>
        <ChevronDown className="size-4 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 p-3">
            <p className="text-sm font-semibold">{currentUser.name}</p>
            <p className="text-xs text-zinc-500">{currentUser.email}</p>
            <p className="mt-1 text-xs text-zinc-500">{currentUser.role}</p>
          </div>
          <div className="p-1 text-sm">
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-50">
              <UserRound className="size-4" /> Profile
            </button>
            <button
              onClick={async () => {
                setOpen(false)
                if (await confirm({ title: 'Reset your progress?', message: 'Module completions and quiz scores go back to the demo data.', confirmLabel: 'Reset', danger: true })) {
                  resetProgress()
                  toast('Progress reset')
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-50"
            >
              <RotateCcw className="size-4" /> Reset demo progress
            </button>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const section = pathname.split('/')[1]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-full">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 bg-gradient-to-b from-brand-600 via-[#8e2118] to-[#5e1914] transition-all lg:block', collapsed ? 'w-20' : 'w-64')}>
        <Sidebar collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-gradient-to-b from-brand-600 via-[#8e2118] to-[#5e1914] shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-6 right-3 rounded-md p-1 text-white/80 hover:bg-white/10" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200/70 bg-white/90 px-4 backdrop-blur sm:px-6">
          {pathname.split('/').filter(Boolean).length > 1 && (
            <button
              onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(`/${section}`))}
              className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
              aria-label="Go back"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <button
            onClick={() => (window.innerWidth >= 1024 ? setCollapsed((c) => !c) : setMobileOpen(true))}
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </button>
          <HeaderSearch />
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
