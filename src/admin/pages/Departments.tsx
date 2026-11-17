import { Building2, PauseCircle, PlayCircle, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { DEMO_PASSWORD } from '../../data/trainings'
import { isInternalEmail } from '../requests'
import { useScope } from '../scope'
import { uid, useAdmin } from '../store'
import { Avatar, Badge, Button, Empty, Field, Input, Modal, PageHeader, Select, Table } from '../ui'

const NEW_DEPT = '__new__'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Create a department admin account (or promote someone already in the system, matched by email).
 * Each department has one department admin: adding one where there is already one replaces them
 * (the old one goes back to participant). They sign in with their work email and manage only their department.
 */
function AddDepartmentAdminModal({ departments, initialDepartment, onClose }: { departments: string[]; initialDepartment?: string; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [dept, setDept] = useState(initialDepartment ?? departments[0] ?? NEW_DEPT)
  const [newDept, setNewDept] = useState('')
  const [tried, setTried] = useState(false)

  const cleanEmail = email.trim().toLowerCase()
  const existing = EMAIL_RE.test(cleanEmail) ? data.people.find((p) => p.email.toLowerCase() === cleanEmail) : undefined
  const department = dept === NEW_DEPT ? newDept.trim() : dept
  const current = data.people.find((p) => p.role === 'Department Admin' && p.department.toLowerCase() === department.toLowerCase() && p.email.toLowerCase() !== cleanEmail)
  const leadOf = (d: string) => data.people.find((p) => p.role === 'Department Admin' && p.department === d)
  const errors = {
    department: !department ? 'Choose or enter a department.' : '',
    email: !EMAIL_RE.test(cleanEmail) ? 'Enter a valid work email.' : existing?.role === 'Department Admin' && existing.department === department ? `Already a department admin for ${department}.` : '',
    name: !existing && !name.trim() ? 'Enter their full name.' : '',
    phone: !existing && phone && !/^[79]\d{8}$/.test(phone) ? 'Enter the 9 digits after +251, starting with 9 or 7.' : '',
  }
  const ok = !Object.values(errors).some(Boolean)

  // One department admin per department: the current one steps down to participant.
  const stepDown = <T extends { id: string; role: string }>(people: T[]): T[] => (current ? people.map((p) => (p.id === current.id ? { ...p, role: 'Participant' } : p)) : people)
  const replaced = current ? [{ field: 'Replaced', from: current.name, to: 'Participant' }] : []

  const save = () => {
    setTried(true)
    if (!ok) return
    if (existing) {
      update((d) => ({ ...d, people: stepDown(d.people).map((p) => (p.id === existing.id ? { ...p, role: 'Department Admin', department, status: 'Active', designation: title.trim() || p.designation } : p)) }), {
        action: 'Made department admin',
        target: existing.name,
        changes: [
          { field: 'Role', from: existing.role, to: 'Department Admin' },
          { field: 'Department', from: existing.department || '—', to: department },
          ...replaced,
        ],
      })
      toast(`${existing.name} is now a department admin for ${department}`)
    } else {
      const person = {
        id: uid('u'),
        name: name.trim(),
        email: cleanEmail,
        phone: phone ? `0${phone}` : '',
        role: 'Department Admin' as const,
        status: 'Active' as const,
        department,
        designation: title.trim() || undefined,
        organization: isInternalEmail(cleanEmail) ? 'Safaricom Ethiopia' : undefined,
        groupIds: [],
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: 'Admin',
      }
      update((d) => ({ ...d, people: [...stepDown(d.people), person] }), { action: 'Created department admin', target: person.name, changes: [{ field: 'Department', from: '—', to: department }, ...replaced] })
      toast(`Account created. ${person.name} signs in with ${cleanEmail} (demo password ${DEMO_PASSWORD})`)
    }
    onClose()
  }

  const err = (k: keyof typeof errors) => (tried && errors[k] ? <p className="mt-1 text-xs text-brand-600">{errors[k]}</p> : null)

  return (
    <Modal
      open
      onClose={onClose}
      title={current ? 'Change department admin' : 'Add department admin'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            <UserPlus className="size-4" /> {current ? 'Replace department admin' : existing ? 'Make department admin' : 'Create account'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Field label="Department *">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                  {leadOf(d) ? ` (admin: ${leadOf(d)!.name})` : ''}
                </option>
              ))}
              <option value={NEW_DEPT}>New department…</option>
            </Select>
          </Field>
          {dept === NEW_DEPT && <Input autoFocus value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Department name, e.g. Enterprise" aria-label="New department name" className="mt-2" />}
          {err('department')}
          {current && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Avatar name={current.name} size="sm" />
              <span>
                {department} already has a department admin: <b>{current.name}</b>. A department has one admin, so they’ll go back to participant.
              </span>
            </p>
          )}
        </div>
        <div>
          <Field label="Work email *">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@safaricom.et" aria-invalid={tried && !!errors.email} />
          </Field>
          {err('email')}
          {existing && !errors.email && (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-mpesa-500/10 px-3 py-2 text-sm text-mpesa-800">
              <Avatar name={existing.name} size="sm" /> {existing.name} already has an account ({existing.role}). They’ll be made department admin.
            </p>
          )}
        </div>
        {!existing && (
          <>
            <div>
              <Field label="Full name *">
                <Input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !!errors.name} />
              </Field>
              {err('name')}
            </div>
            <div>
              <Field label="Mobile number (optional)">
                <span className="relative block">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-zinc-200 pr-2.5 pl-3 text-sm font-semibold text-zinc-700">+251</span>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9))}
                    placeholder="9XX XXX XXX"
                    className="pl-[4.25rem] tracking-wide"
                  />
                </span>
              </Field>
              {err('phone')}
            </div>
          </>
        )}
        <Field label="Job title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Enterprise Training Lead" />
        </Field>
        <p className="text-xs text-zinc-500">They sign in with their work email and can only manage their own department’s trainings and people.</p>
      </div>
    </Modal>
  )
}

/**
 * Departments that run their own training (US44): who leads each one, how big it is, and an admin switch to
 * suspend or restore its access. Suspended department admins can't sign in until it's restored.
 */
export function AdminDepartments() {
  const { data, update } = useAdmin()
  const { confirm } = useFeedback()
  const scope = useScope()
  const [adding, setAdding] = useState<{ department?: string } | null>(null)
  const suspended = new Set(data.suspendedDepartments ?? [])
  const names = [...new Set(data.people.map((p) => p.department).filter((d): d is string => !!d && d !== 'Visitor'))].sort()
  const rows = names.map((name) => ({
    name,
    leads: data.people.filter((p) => p.role === 'Department Admin' && p.department === name),
    members: data.people.filter((p) => p.department === name).length,
    trainings: data.trainings.filter((t) => t.department === name).length,
  }))

  const toggle = async (name: string) => {
    const on = !suspended.has(name)
    if (on && !(await confirm({ title: `Suspend ${name}?`, message: 'Its department admins can’t sign in or manage trainings until you restore access. Their content and trainings stay as they are.', confirmLabel: 'Suspend access', danger: true }))) return
    update((d) => ({ ...d, suspendedDepartments: on ? [...(d.suspendedDepartments ?? []), name] : (d.suspendedDepartments ?? []).filter((x) => x !== name) }), {
      action: on ? 'Suspended department access' : 'Restored department access',
      target: name,
      changes: [{ field: 'Department access', from: on ? 'Active' : 'Suspended', to: on ? 'Suspended' : 'Active' }],
    })
  }

  // Main admins only.
  if (scope.role !== 'admin') return <Navigate to="/admin" replace />

  return (
    <>
      <PageHeader
        title="Departments"
        actions={
          <Button variant="primary" onClick={() => setAdding({})}>
            <UserPlus className="size-4" /> Add department admin
          </Button>
        }
      />
      {rows.length ? (
        <Table head={['Department', 'Department admin', 'People', 'Trainings', 'Access', '']} minWidth={760}>
          {rows.map((r) => (
            <tr key={r.name} className="transition hover:bg-zinc-50/80">
              <td className="px-4 py-3 font-semibold text-zinc-900">{r.name}</td>
              <td className="px-4 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  {r.leads.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
                      <Avatar name={p.name} size="sm" /> {p.name}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAdding({ department: r.name })}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                    aria-label={`${r.leads.length ? 'Change' : 'Add'} department admin for ${r.name}`}
                  >
                    <UserPlus className="size-3.5" /> {r.leads.length ? 'Change' : 'Add department admin'}
                  </button>
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-700 tabular-nums">{r.members}</td>
              <td className="px-4 py-3 text-zinc-700 tabular-nums">{r.trainings}</td>
              <td className="px-4 py-3">{suspended.has(r.name) ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}</td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant={suspended.has(r.name) ? 'primary' : 'outline'} onClick={() => void toggle(r.name)}>
                  {suspended.has(r.name) ? (
                    <>
                      <PlayCircle className="size-3.5" /> Restore
                    </>
                  ) : (
                    <>
                      <PauseCircle className="size-3.5" /> Suspend
                    </>
                  )}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          <Empty icon={Building2} title="No departments yet" text="Add a department admin to create the first one." />
        </div>
      )}
      {adding && <AddDepartmentAdminModal departments={names} initialDepartment={adding.department} onClose={() => setAdding(null)} />}
    </>
  )
}
