import { Award, FileClock, MapPin, Settings2, ShieldCheck, Tags, type LucideIcon } from 'lucide-react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { canOpen } from '../permissions'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import { PageHeader, SectionHeaderProvider, TabBar } from '../ui'

const SECTIONS: { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { to: 'roles', label: 'Roles & access', icon: ShieldCheck, adminOnly: true },
  { to: 'categories', label: 'Categories', icon: Tags },
  { to: 'training-types', label: 'Training types', icon: Settings2 },
  { to: 'venues', label: 'Venues', icon: MapPin },
  { to: 'certificate-templates', label: 'Certificate templates', icon: Award },
  { to: 'audit-logs', label: 'Audit log', icon: FileClock },
]

/**
 * Everything that is set up once and rarely changed lives here, one horizontal tab each.
 * The page under the tabs keeps its own actions (New category, New venue…), with a smaller section title.
 */
export function AdminSettings() {
  const scope = useScope()
  const { data } = useAdmin()
  const sections = SECTIONS.filter((section) => (!section.adminOnly || scope.role === 'admin') && canOpen(data, scope.role, `/admin/settings/${section.to}`))
  return (
    <>
      <PageHeader title="Settings" />
      <TabBar>
        <nav aria-label="Settings sections" className="scrollbar-none flex min-w-0 max-w-full gap-1 overflow-x-auto">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-zinc-600 hover:bg-zinc-50',
                )
              }
            >
              <s.icon className="size-4" /> {s.label}
            </NavLink>
          ))}
        </nav>
      </TabBar>
      <SectionHeaderProvider>
        <Outlet />
      </SectionHeaderProvider>
    </>
  )
}

/** Sends limited roles to the first configuration service their admin enabled. */
export function SettingsDefaultRedirect() {
  const scope = useScope()
  const { data } = useAdmin()
  if (scope.role === 'admin') return <Navigate to="/admin/settings/roles" replace />
  const first = SECTIONS.find((section) => !section.adminOnly && canOpen(data, scope.role, `/admin/settings/${section.to}`))
  return <Navigate to={first ? `/admin/settings/${first.to}` : '/admin'} replace />
}
