import {
  ArrowRight,
  Award,
  Bell,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Briefcase,
  ClipboardList,
  FileClock,
  FileQuestion,
  KeyRound,
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
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../store/Auth'
import { CommandPalette } from './CommandPalette'
import { TrainerScope, useAdmin } from './store'
import { ScopeContext } from './scope'
import { dateTime } from './helpers'
import { UserAvatar } from '../components/UserAvatar'

type NavItem = { label: string; icon: LucideIcon; to?: string; end?: boolean; children?: { label: string; to: string }[] }

const nav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin', end: true },
  { label: 'Trainings', icon: GraduationCap, to: '/admin/trainings' },
  { label: 'Calendar', icon: CalendarDays, to: '/admin/calendar' },
  { label: 'Training Requests', icon: FileQuestion, to: '/admin/requests' },
  {
    label: 'Training Content',
    icon: GraduationCap,
    children: [
      { label: 'Journeys', to: '/admin/journeys' },
      { label: 'Materials', to: '/admin/materials' },
      { label: 'Assignments', to: '/admin/assignments' },
      { label: 'Categories', to: '/admin/categories' },
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
      { label: 'Submissions', to: '/admin/submissions' },
    ],
  },
  { label: 'Certificates', icon: BadgeCheck, to: '/admin/certificates' },
  { label: 'Certificate Templates', icon: Award, to: '/admin/certificate-templates' },
  { label: 'Users', icon: Users, to: '/admin/users' },
  { label: 'Temporary access', icon: KeyRound, to: '/admin/temporary-access' },
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

/** Trainer portal (D04, S10): only what a trainer needs for the sessions they conduct. */
const trainerNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin', end: true },
  { label: 'My sessions', icon: GraduationCap, to: '/admin/trainings' },
  { label: 'Calendar', icon: CalendarDays, to: '/admin/calendar' },
  { label: 'Materials', icon: ClipboardList, to: '/admin/materials' },
  { label: 'Grading', icon: MessageSquare, to: '/admin/submissions' },
  { label: 'Certificates', icon: BadgeCheck, to: '/admin/certificates' },
  { label: 'Reports', icon: BarChart3, to: '/admin/reports' },
]

const itemCls = (active: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all',
    active ? 'bg-white/15 text-white ring-1 ring-white/20' : 'text-white/90 hover:bg-white/10 hover:text-white',
  )

/** A collapsible group; the sidebar keeps only one group open at a time. */
function NavGroup({ item, open, onToggle, onNavigate }: { item: NavItem; open: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const active = item.children!.some((c) => pathname.startsWith(c.to))
  const Icon = item.icon
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} className={itemCls(active)}>
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown className="size-4 text-white/60" /> : <ChevronRight className="size-4 text-white/60" />}
      </button>
      {open && (
        <div className="mt-0.5 ml-[17px] space-y-0.5 border-l border-white/20 pl-3">
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

/** Profile menu in the header, matching the learner portal: role and email, theme, demo reset, sign out. */
function UserMenu({ dark, setDark, role }: { dark: boolean; setDark: (d: boolean) => void; role: string }) {
  const { user, logout } = useAuth()
  const { reset } = useAdmin()
  const { confirm, toast } = useFeedback()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition hover:bg-zinc-100">
        <UserAvatar name={user.name} className="size-9 ring-1 ring-zinc-200" />
        <span className="hidden max-w-[12rem] truncate text-sm font-medium whitespace-nowrap text-zinc-900 lg:block">{user.name}</span>
        <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-700 uppercase ring-1 ring-brand-200">{role}</span>
        <ChevronDown className="size-4 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-lg">
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
            <button onClick={() => logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Learner-parity promo card in the sidebar: what needs the admin's attention right now. */
function SidebarPromo({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useAdmin()
  const pending = data.requests.filter((r) => r.status === 'PENDING').length
  const ongoing = data.trainings.filter((t) => t.status === 'ONGOING').length
  const headline = pending ? `${pending} request${pending === 1 ? '' : 's'} to review` : ongoing ? `${ongoing} session${ongoing === 1 ? '' : 's'} running now` : 'All caught up'
  const text = pending ? 'Approve and schedule new trainings.' : ongoing ? 'Attendance and progress are live.' : 'Nothing needs your attention.'
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#e05a59]/90 via-brand-600/90 to-[#962b2a]/90 p-4">
      <span className="pointer-events-none absolute -right-8 -bottom-10 -z-10 size-24 rounded-full border-[14px] border-white/[0.07]" aria-hidden />
      <span className="pointer-events-none absolute -top-10 -left-6 -z-10 size-20 rounded-full bg-white/10" aria-hidden />
      <p className="text-[13px] leading-snug font-bold text-white">{headline}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/90">{text}</p>
      <Link
        to="/admin/requests"
        onClick={onNavigate}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        Review now <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}

function Sidebar({ onNavigate, items, promo }: { onNavigate?: () => void; items: NavItem[]; promo?: ReactNode }) {
  const { pathname } = useLocation()
  // Accordion: the group holding the current page opens; opening another closes it.
  const activeGroup = items.find((i) => i.children?.some((c) => pathname.startsWith(c.to)))?.label ?? ''
  const [openGroup, setOpenGroup] = useState(activeGroup)
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup)
  }, [activeGroup])
  return (
    <div className="flex h-full flex-col p-3">
      <Link to="/admin" onClick={onNavigate} className="mb-6 flex items-center gap-3 px-1.5 pt-2">
        <img src="/favicon white.svg" alt="" className="size-10 shrink-0 rounded-xl" />
        <span className="leading-none font-bold tracking-tight text-white">
          <span className="block text-base leading-[1.05]">M-PESA</span>
          <span className="block text-sm leading-[1.05] font-semibold text-white/85">Academy</span>
        </span>
      </Link>
      <nav className="scrollbar-none flex-1 space-y-0.5 overflow-y-auto">
        {items.map((item) =>
          item.children ? (
            <NavGroup key={item.label} item={item} open={openGroup === item.label} onToggle={() => setOpenGroup((g) => (g === item.label ? '' : item.label))} onNavigate={onNavigate} />
          ) : (
            <NavLink key={item.label} to={item.to!} end={item.end} onClick={onNavigate} className={({ isActive }) => itemCls(isActive)}>
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
      {promo && <div className="mt-3 shrink-0">{promo}</div>}
    </div>
  )
}

const crumbLabels: Record<string, string> = {
  trainings: 'Trainings',
  requests: 'Training Requests',
  calendar: 'Calendar',
  journeys: 'Journeys',
  materials: 'Materials',
  assignments: 'Assignments',
  feedback: 'Feedback',
  forms: 'Forms',
  responses: 'Responses',
  assessments: 'Assessments',
  pre: 'Pre-Assessments',
  post: 'Post-Assessments',
  submissions: 'Submissions',
  'certificate-templates': 'Certificate Templates',
  users: 'Users',
  'temporary-access': 'Temporary access',
  groups: 'Groups',
  'training-types': 'Training Type',
  categories: 'By Category',
  'audit-logs': 'Audit Logs',
  certificates: 'Certificates',
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
    // /admin/categories is its own page; /admin/training-types/categories is "By Category".
    const label = p === 'categories' && i === 0 ? 'Categories' : crumbLabels[p]
    crumbs.push({ label: label ?? named ?? p, to })
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

/** ⌘ on Apple platforms, Ctrl elsewhere — used for the search shortcut hint. */
const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

/** Bell with unread low-feedback / low-attendance alerts (F04, T06). */
function AlertsBell() {
  const { data, update } = useAdmin()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = data.alerts.filter((a) => !a.read).length
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  const alerts = [...data.alerts].sort((a, b) => b.at.localeCompare(a.at))
  const markRead = (id?: string) => update((d) => ({ ...d, alerts: d.alerts.map((x) => (!id || x.id === id ? { ...x, read: true } : x)) }))
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid size-10 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-100" aria-label={unread ? 'Alerts, ' + unread + ' unread' : 'Alerts'}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Alerts</p>
            {unread > 0 && (
              <button onClick={() => markRead()} className="text-xs font-medium text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto scrollbar-thin">
            {alerts.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">No alerts.</li>}
            {alerts.map((a) => (
              <li key={a.id} className={cn('px-4 py-3', !a.read && 'bg-brand-50/50')}>
                <Link
                  to={'/admin/trainings/' + a.trainingId}
                  onClick={() => {
                    setOpen(false)
                    markRead(a.id)
                  }}
                  className="block"
                >
                  <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                    <span className={cn('size-1.5 rounded-full', a.kind === 'low-feedback' ? 'bg-amber-500' : 'bg-brand-600')} />
                    <span className={a.kind === 'low-feedback' ? 'text-amber-700' : 'text-brand-700'}>{a.kind === 'low-feedback' ? 'Low feedback' : 'Low attendance'}</span>
                    <span className="font-normal text-zinc-400 normal-case">{dateTime(a.at)}</span>
                  </span>
                  <span className="mt-1 block text-sm text-zinc-800">{a.message}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">Email queued to {a.emailedTo}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-500">
            Alerts fire for feedback below {data.alertRules.feedbackBelow} / 5 and group attendance below {data.alertRules.attendanceBelow}%.
          </p>
        </div>
      )}
    </div>
  )
}

export function AdminLayout({ variant = 'admin', trainerId }: { variant?: 'admin' | 'trainer'; trainerId?: string }) {
  const { user } = useAuth()
  const items = variant === 'trainer' ? trainerNav : nav
  const title = variant === 'trainer' ? 'Trainer' : 'Admin'
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

  // The mobile drawer closes on Escape like every other overlay.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

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
    <ScopeContext.Provider value={{ role: variant, trainerId }}>
    <div className={cn('flex h-screen bg-canvas text-zinc-900 print:block print:h-auto print:bg-white', dark && 'dark')}>
      <aside className={cn('relative hidden shrink-0 overflow-hidden transition-[width] lg:block print:hidden bg-gradient-to-b from-brand-600 via-[#8e2118] to-[#5e1914] dark:from-[#a8302f] dark:via-[#6e1a15] dark:to-[#3d100d] isolate before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-56 before:bg-gradient-to-b before:from-black/45 before:to-transparent', collapsed ? 'w-0' : 'w-[236px]')}>
        <div className="h-full w-[236px]">
          <Sidebar items={items} promo={variant === 'admin' ? <SidebarPromo /> : undefined} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl bg-gradient-to-b from-brand-600 via-[#8e2118] to-[#5e1914] dark:from-[#a8302f] dark:via-[#6e1a15] dark:to-[#3d100d] isolate before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-56 before:bg-gradient-to-b before:from-black/45 before:to-transparent">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 z-10 rounded-md p-1 text-white/80 hover:bg-white/10" aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} items={items} promo={variant === 'admin' ? <SidebarPromo onNavigate={() => setMobileOpen(false)} /> : undefined} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col print:p-0">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden print:overflow-visible">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-200/70 bg-surface/90 px-4 backdrop-blur sm:px-6 print:hidden">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => (window.innerWidth >= 1024 ? setCollapsed((c) => !c) : setMobileOpen(true))}
                className="rounded-full p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="size-4" />
              </button>
              {/* Dashboard greets you like the learner portal; other pages show where you are. */}
              {pathname === '/admin' ? (
                <p className="hidden truncate text-sm font-semibold text-zinc-800 sm:block">Welcome back, {user.name.split(' ')[0]} 👋</p>
              ) : (
                <Breadcrumbs />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Search box styled like the learner header; opens the command palette. */}
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden w-64 items-center gap-2.5 rounded-full border border-transparent bg-zinc-100 py-2.5 pr-2 pl-3.5 text-sm text-zinc-500 transition hover:border-zinc-200 hover:bg-zinc-50 md:flex lg:w-80"
                aria-label={`Search (${MOD_KEY} K)`}
              >
                <Search className="size-4" /> <span className="flex-1 text-left">Search trainings, people…</span>
                <kbd className="rounded-md border border-zinc-200 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">{MOD_KEY} K</kbd>
              </button>
              <button onClick={() => setPaletteOpen(true)} className="rounded-full p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 md:hidden" aria-label="Search">
                <Search className="size-4" />
              </button>
              {variant === 'admin' && <AlertsBell />}
              <UserMenu dark={dark} setDark={setDark} role={title} />
            </div>
          </header>
          {/* Full-page editors (wizards) render here: under the header, beside the sidebar. */}
          <div id="admin-page-overlay" className="absolute inset-x-0 top-16 bottom-0 z-30 empty:hidden" />
          <div ref={scroller} className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible">
            <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 print:max-w-none print:p-0">
              {variant === 'trainer' && trainerId ? (
                <TrainerScope trainerId={trainerId}>
                  <Outlet />
                </TrainerScope>
              ) : (
                <Outlet />
              )}
            </main>
          </div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
    </ScopeContext.Provider>
  )
}
