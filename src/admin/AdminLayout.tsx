import {
  Award,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  FileClock,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  PanelLeft,
  RotateCcw,
  Settings2,
  Sun,
  UserRoundPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn, initials } from '../lib/utils'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../store/Auth'
import { CommandPalette } from './CommandPalette'
import { useAdmin } from './store'

type NavItem = { label: string; icon: LucideIcon; to?: string; end?: boolean; children?: { label: string; to: string }[] }

const nav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin', end: true },
  { label: 'Trainings', icon: GraduationCap, to: '/admin/trainings' },
  { label: 'Training Requests', icon: FileQuestion, to: '/admin/requests' },
  {
    label: 'Training Content',
    icon: GraduationCap,
    children: [
      { label: 'Journeys', to: '/admin/journeys' },
      { label: 'Materials', to: '/admin/materials' },
    ],
  },
  {
    label: 'Feedback',
    icon: MessageSquare,
    children: [
      { label: 'Forms', to: '/admin/feedback/forms' },
      { label: 'Responses', to: '/admin/feedback/responses' },
    ],
  },
  {
    label: 'Assessments',
    icon: ClipboardList,
    children: [
      { label: 'Pre-Assessments', to: '/admin/assessments/pre' },
      { label: 'Post-Assessments', to: '/admin/assessments/post' },
    ],
  },
  { label: 'Certificate Templates', icon: Award, to: '/admin/certificate-templates' },
  { label: 'Users', icon: Users, to: '/admin/users' },
  { label: 'Groups', icon: UserRoundPlus, to: '/admin/groups' },
  {
    label: 'Training Type',
    icon: Settings2,
    children: [
      { label: 'All Types', to: '/admin/training-types' },
      { label: 'By Category', to: '/admin/training-types/categories' },
    ],
  },
  { label: 'Audit Logs', icon: FileClock, to: '/admin/audit-logs' },
  { label: 'Reports', icon: BarChart3, to: '/admin/reports' },
]

const itemCls = (active: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
    active ? 'bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-100' : 'text-zinc-700 hover:bg-zinc-200/50 dark:hover:bg-zinc-100',
  )

function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const active = item.children!.some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = useState(active)
  useEffect(() => {
    if (active) setOpen(true)
  }, [active])
  const Icon = item.icon
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className={itemCls(false)}>
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown className="size-4 text-zinc-500" /> : <ChevronRight className="size-4 text-zinc-500" />}
      </button>
      {open && (
        <div className="mt-0.5 ml-[17px] space-y-0.5 border-l border-zinc-200 pl-3">
          {item.children!.map((c) => (
            <NavLink key={c.to} to={c.to} onClick={onNavigate} className={({ isActive }) => itemCls(isActive)}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function UserFooter({ dark, setDark }: { dark: boolean; setDark: (d: boolean) => void }) {
  const { user, logout } = useAuth()
  const { reset } = useAdmin()
  const { confirm, toast } = useFeedback()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full left-0 z-30 mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-surface p-1 text-sm shadow-lg">
          <button onClick={() => setDark(!dark)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />} {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={async () => {
              setOpen(false)
              if (await confirm({ title: 'Reset demo data?', message: 'All admin changes will be replaced with the original demo data.', confirmLabel: 'Reset', danger: true })) {
                reset()
                toast('Demo data restored')
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100"
          >
            <RotateCcw className="size-4" /> Reset demo data
          </button>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-brand-600 hover:bg-brand-50">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-zinc-200/50 dark:hover:bg-zinc-100">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-200 text-xs font-semibold text-zinc-700">{initials(user.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-zinc-900">{user.name}</span>
          <span className="block truncate text-[11px] text-zinc-500">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-4 text-zinc-500" />
      </button>
    </div>
  )
}

function Sidebar({ dark, setDark, onNavigate }: { dark: boolean; setDark: (d: boolean) => void; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col p-3">
      <Link to="/admin" onClick={onNavigate} className="mb-5 flex items-center gap-2 px-1 pt-1">
        <svg viewBox="0 0 36 20" className="h-5 w-9 text-brand-600" aria-hidden>
          <path d="M2 18c6-12 12-16 18-16 5 0 9 3 14 8-6-3-10-3-14 0S10 18 2 18z" fill="currentColor" />
        </svg>
        <span className="text-[15px] font-semibold text-zinc-900">Admin Dashboard</span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map((item) =>
          item.children ? (
            <NavGroup key={item.label} item={item} onNavigate={onNavigate} />
          ) : (
            <NavLink key={item.label} to={item.to!} end={item.end} onClick={onNavigate} className={({ isActive }) => itemCls(isActive)}>
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
      <UserFooter dark={dark} setDark={setDark} />
    </div>
  )
}

const crumbLabels: Record<string, string> = {
  trainings: 'Trainings',
  requests: 'Training Requests',
  journeys: 'Journeys',
  materials: 'Materials',
  feedback: 'Feedback',
  forms: 'Forms',
  responses: 'Responses',
  assessments: 'Assessments',
  pre: 'Pre-Assessments',
  post: 'Post-Assessments',
  'certificate-templates': 'Certificate Templates',
  users: 'Users',
  groups: 'Groups',
  'training-types': 'Training Type',
  categories: 'By Category',
  'audit-logs': 'Audit Logs',
  reports: 'Reports',
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const { data } = useAdmin()
  const parts = pathname.split('/').filter(Boolean).slice(1)
  const crumbs = [{ label: 'Dashboard', to: '/admin' }]
  parts.forEach((p, i) => {
    const to = `/admin/${parts.slice(0, i + 1).join('/')}`
    const named = data.trainings.find((t) => t.id === p)?.name ?? data.journeys.find((j) => j.id === p)?.name
    crumbs.push({ label: crumbLabels[p] ?? named ?? p, to })
  })

  return (
    <nav className="flex min-w-0 items-center gap-2 text-[13px]">
      {crumbs.map((c, i) => (
        <Fragment key={c.to}>
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-zinc-400" />}
          {i === crumbs.length - 1 ? (
            <span className="max-w-[180px] truncate font-medium text-zinc-900 sm:max-w-[240px]">{c.label}</span>
          ) : (
            <Link to={c.to} className={cn('shrink-0 text-zinc-500 hover:text-zinc-900', i > 0 && 'hidden sm:inline')}>
              {c.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

const THEME_KEY = 'mpesa-learning:admin-theme'

export function AdminLayout() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dark, setDarkState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark'
    } catch {
      return false
    }
  })
  const { pathname } = useLocation()
  const scroller = useRef<HTMLDivElement>(null)

  const setDark = (d: boolean) => {
    setDarkState(d)
    try {
      localStorage.setItem(THEME_KEY, d ? 'dark' : 'light')
    } catch {
      // Theme preference is best-effort.
    }
  }

  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={cn('flex h-screen bg-canvas text-zinc-900', dark && 'dark')}>
      <aside className={cn('hidden shrink-0 overflow-hidden transition-[width] lg:block', collapsed ? 'w-0' : 'w-[220px]')}>
        <div className="h-full w-[220px]">
          <Sidebar dark={dark} setDark={setDark} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-canvas shadow-xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 rounded-md p-1 text-zinc-500 hover:bg-zinc-200" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar dark={dark} setDark={setDark} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col p-0 lg:py-1.5 lg:pr-1.5">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-zinc-200 bg-surface lg:rounded-xl lg:border">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => (window.innerWidth >= 1024 ? setCollapsed((c) => !c) : setMobileOpen(true))}
                className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100"
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="size-4" />
              </button>
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-zinc-200 py-1.5 pr-1.5 pl-3 text-xs text-zinc-500 hover:bg-zinc-50 md:flex"
              >
                <Search className="size-3.5" /> Search…
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
              </button>
              <button onClick={() => setPaletteOpen(true)} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden" aria-label="Search">
                <Search className="size-4" />
              </button>
              <button onClick={() => setDark(!dark)} className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100" aria-label="Toggle theme">
                {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
              </button>
              <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">{initials(user.name)}</span>
            </div>
          </header>
          <div ref={scroller} className="flex-1 overflow-y-auto scrollbar-thin">
            <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
