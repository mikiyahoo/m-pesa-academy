import { BadgeCheck, Building2, Check, GraduationCap, Lock, RotateCcw, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { Fragment } from 'react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { DEFAULT_PERMISSIONS, permissionsOf, SERVICES, SERVICE_ROLE_SUPPORT, type LimitedRole, type Service } from '../permissions'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import type { AdminUserRole, Person } from '../types'
import { Avatar, Badge, Button, Empty, Field, Modal, PageHeader, Select, StatCard, Table } from '../ui'

const ROLES: AdminUserRole[] = ['Admin', 'Department Admin', 'Trainer', 'Participant']

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-brand-600' : 'bg-zinc-300'}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/**
 * Roles & access (Settings): who has which role, and which parts of the admin area department
 * admins and trainers may open. Admins always have full access. Main admins only.
 */
export function AdminRoles() {
  const { data, update } = useAdmin()
  const { confirm, toast } = useFeedback()
  const scope = useScope()
  const [adding, setAdding] = useState(false)
  if (scope.role !== 'admin') return <Navigate to="/admin" replace />

  const perms = permissionsOf(data)
  const count = (r: AdminUserRole) => data.people.filter((p) => p.role === r && p.status === 'Active').length
  const managers = data.people.filter((p) => p.role === 'Admin' || p.role === 'Department Admin').sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))

  const setPerm = (role: LimitedRole, service: Service, on: boolean) => {
    const label = SERVICES.find((item) => item.id === service)!.label
    update((d) => ({ ...d, rolePermissions: { ...permissionsOf(d), [role]: { ...permissionsOf(d)[role], [service]: on } } }), {
      action: on ? 'Granted access' : 'Removed access',
      target: `${role === 'department' ? 'Department admins' : 'Trainers'} · ${label}`,
      changes: [{ field: label, from: on ? 'Off' : 'On', to: on ? 'On' : 'Off' }],
    })
  }

  const changeRole = async (p: Person, role: AdminUserRole) => {
    if (role === p.role) return
    if (p.role === 'Admin' && count('Admin') <= 1) return toast('Keep at least one admin.', { tone: 'error' })
    let stepDown: Person | undefined
    if (role === 'Department Admin') {
      if (!p.department) return toast(`Give ${p.name} a department first (Users → Edit).`, { tone: 'error' })
      stepDown = data.people.find((x) => x.id !== p.id && x.role === 'Department Admin' && x.department === p.department)
      if (stepDown && !(await confirm({ title: `Replace ${stepDown.name}?`, message: `${p.department} has one department admin. ${stepDown.name} goes back to participant.`, confirmLabel: 'Replace' }))) return
    }
    if (role === 'Admin' && !(await confirm({ title: `Make ${p.name} an admin?`, message: 'Admins can see and change everything, in every department.', confirmLabel: 'Make admin' }))) return
    update((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, role, status: 'Active' } : stepDown && x.id === stepDown.id ? { ...x, role: 'Participant' } : x)) }), {
      action: 'Changed role',
      target: p.name,
      changes: [{ field: 'Role', from: p.role, to: role }, ...(stepDown ? [{ field: 'Replaced', from: stepDown.name, to: 'Participant' }] : [])],
    })
    toast(`${p.name} is now ${role === 'Admin' ? 'an admin' : role === 'Participant' ? 'a participant' : `a ${role.toLowerCase()}`}`)
  }

  return (
    <>
      <PageHeader title="Roles & access" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={ShieldCheck} label="Admins" value={count('Admin')} hint="Full access" tone="red" />
        <StatCard icon={Building2} label="Department admins" value={count('Department Admin')} hint="One per department" tone="amber" />
        <StatCard icon={GraduationCap} label="Trainers" value={count('Trainer')} hint="Their own sessions" tone="zinc" />
        <StatCard icon={BadgeCheck} label="Requesters" value={data.people.filter((p) => p.isRequester).length} hint="Can request trainings" tone="zinc" />
        <StatCard icon={Users} label="Participants" value={count('Participant')} hint="Learners" tone="green" />
      </div>

      {/* Service-by-service access */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-zinc-200/80 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Service access</h3>
            <p className="text-xs text-zinc-500">Set access separately for each service. Department admins stay within their department; trainers stay within their assigned trainings.</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              update((d) => ({ ...d, rolePermissions: DEFAULT_PERMISSIONS }), { action: 'Reset role access to defaults', target: 'Roles & access' })
              toast('Back to the default access')
            }}
          >
            <RotateCcw className="size-3.5" /> Reset to defaults
          </Button>
        </div>
        <div className="mt-3">
          <Table head={['Service', 'Admin', 'Department admin', 'Trainer']} minWidth={720}>
            {SERVICES.map((service, index) => (
              <Fragment key={service.id}>
                {(index === 0 || SERVICES[index - 1].group !== service.group) && (
                  <tr className="bg-zinc-50/80">
                    <td colSpan={4} className="px-4 pt-3 pb-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">{service.group}</td>
                  </tr>
                )}
                <tr className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-zinc-900">{service.label}</p>
                    <p className="text-xs text-zinc-500">{service.detail}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-mpesa-700" title="Admins always have full access">
                      <Check className="size-4" strokeWidth={3} /> Always
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {SERVICE_ROLE_SUPPORT.department.has(service.id)
                      ? <Switch on={perms.department[service.id]} onChange={(v) => setPerm('department', service.id, v)} label={`Department admins: ${service.label}`} />
                      : <span className="text-xs text-zinc-400">Admin only</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {SERVICE_ROLE_SUPPORT.trainer.has(service.id)
                      ? <Switch on={perms.trainer[service.id]} onChange={(v) => setPerm('trainer', service.id, v)} label={`Trainers: ${service.label}`} />
                      : <span className="text-xs text-zinc-400">Unavailable</span>}
                  </td>
                </tr>
              </Fragment>
            ))}
          </Table>
        </div>
      </section>

      {/* Admins and department admins */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Admins & department admins ({managers.length})</h3>
            <p className="text-xs text-zinc-500">Change anyone’s role from Users too. Each department has one department admin.</p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" /> Add admin
          </Button>
        </div>
        {managers.length ? (
          <div className="mt-3">
            <Table head={['Person', 'Department', 'Status', 'Role']} minWidth={620}>
              {managers.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-zinc-900">{p.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{p.department || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === 'Active' ? 'green' : 'zinc'}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-48">
                      <Select aria-label={`Role for ${p.name}`} value={p.role} onChange={(e) => void changeRole(p, e.target.value as AdminUserRole)} className="py-1.5 text-xs">
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        ) : (
          <Empty icon={Lock} title="No admins yet" />
        )}
      </section>

      {adding && <AddAdminModal onClose={() => setAdding(false)} onPick={(p, r) => void changeRole(p, r).then(() => setAdding(false))} />}
    </>
  )
}

function AddAdminModal({ onClose, onPick }: { onClose: () => void; onPick: (p: Person, role: AdminUserRole) => void }) {
  const { data } = useAdmin()
  const candidates = data.people.filter((p) => p.role !== 'Admin' && p.status === 'Active').sort((a, b) => a.name.localeCompare(b.name))
  const [id, setId] = useState('')
  const [role, setRole] = useState<AdminUserRole>('Admin')
  const person = candidates.find((p) => p.id === id)
  return (
    <Modal
      open
      onClose={onClose}
      title="Add admin"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!person} onClick={() => person && onPick(person, role)}>
            <UserPlus className="size-4" /> Give access
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Person">
          <Select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Choose someone…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.role}
                {p.department ? ` · ${p.department}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Role" hint={role === 'Department Admin' ? 'Manages only their own department.' : 'Sees and changes everything.'}>
          <Select value={role} onChange={(e) => setRole(e.target.value as AdminUserRole)}>
            <option value="Admin">Admin</option>
            <option value="Department Admin">Department Admin</option>
          </Select>
        </Field>
        {person && (
          <p className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            <Avatar name={person.name} size="sm" /> {person.name} is a {person.role.toLowerCase()} today{person.department ? ` in ${person.department}` : ''}.
          </p>
        )}
      </div>
    </Modal>
  )
}

