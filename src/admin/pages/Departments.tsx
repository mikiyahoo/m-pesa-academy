import { ArrowLeft, Award, Building2, CalendarDays, GraduationCap, PauseCircle, PlayCircle, UserCheck, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { UserAvatar } from '../../components/UserAvatar'
import { DEMO_PASSWORD } from '../../data/trainings'
import { shortDate } from '../helpers'
import { attended, attendanceMap } from '../insights'
import { combinedJourney } from '../journeys'
import { isInternalEmail } from '../requests'
import { useScope } from '../scope'
import { participantProgress, uid, useAdmin } from '../store'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, StatCard, Table, trainingStatusTone } from '../ui'

const NEW_DEPT = '__new__'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Create a department admin account (or promote someone already in the system, matched by email).
 * Each department has one department admin: adding one where there is already one replaces them
 * (the old one goes back to participant). They sign in with their work email and manage only their department.
 */
export function AddDepartmentAdminModal({ departments, initialDepartment, onClose }: { departments: string[]; initialDepartment?: string; onClose: () => void }) {
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
              <td className="px-4 py-3 font-semibold text-zinc-900">
                <Link to={`/admin/departments/${encodeURIComponent(r.name)}`} className="hover:text-brand-600 hover:underline">
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  {r.leads.map((p) => (
                    <Link key={p.id} to={`/admin/departments/${encodeURIComponent(r.name)}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-700 hover:text-brand-600 hover:underline">
                      <Avatar name={p.name} size="sm" /> {p.name}
                    </Link>
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
                <Link to={`/admin/departments/${encodeURIComponent(r.name)}`} className="mr-1.5 inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50">
                  Details
                </Link>
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

/**
 * One department at a glance: its department admin's full profile, the trainings run under them,
 * the trainees and trainers in the department, and the headline numbers.
 */
export function AdminDepartmentDetail() {
  const { name: raw = '' } = useParams()
  const name = decodeURIComponent(raw)
  const { data, update } = useAdmin()
  const { confirm } = useFeedback()
  const scope = useScope()
  const [changing, setChanging] = useState(false)

  // Main admins only, like the Departments list.
  if (scope.role !== 'admin') return <Navigate to="/admin" replace />

  const suspended = (data.suspendedDepartments ?? []).includes(name)
  const admin = data.people.find((p) => p.role === 'Department Admin' && p.department === name)
  const known = data.people.some((p) => p.department === name) || data.trainings.some((t) => t.department === name)
  if (!known) return <Navigate to="/admin/departments" replace />

  const trainings = data.trainings.filter((t) => t.department === name || (!!admin && t.createdById === admin.id)).sort((a, b) => b.date.localeCompare(a.date))
  const live = trainings.filter((t) => t.status !== 'CANCELLED')
  const moduleIds = new Map(trainings.map((t) => [t.id, combinedJourney(data, t)?.modules.map((m) => m.id) ?? []]))
  const attendanceOf = (t: (typeof trainings)[number]) => {
    const marks = attendanceMap(data, t)
    return t.participantIds.length ? Math.round((t.participantIds.filter((pid) => attended(marks.get(pid))).length / t.participantIds.length) * 100) : null
  }
  const ran = live.filter((t) => t.status === 'COMPLETED' || t.status === 'ONGOING')
  const attendanceRates = ran.map(attendanceOf).filter((x): x is number => x !== null)
  const avgAttendance = attendanceRates.length ? Math.round(attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length) : null
  const certificates = trainings.reduce((n, t) => n + (t.certificates?.length ?? 0), 0)

  const enrolled = new Set(trainings.flatMap((t) => t.participantIds))
  const trainees = data.people.filter((p) => p.role === 'Participant' && (p.department === name || enrolled.has(p.id)))
  const trainers = data.people.filter((p) => p.role === 'Trainer' && p.department === name)
  const progressOf = (pid: string) => {
    const mine = trainings.filter((t) => t.participantIds.includes(pid) && t.status !== 'CANCELLED')
    return mine.length ? Math.round(mine.reduce((sum, t) => sum + participantProgress(t, pid, moduleIds.get(t.id) ?? []), 0) / mine.length) : null
  }
  const byStatus = (st: string) => trainings.filter((t) => t.status === st).length

  const toggleAccess = async () => {
    const on = !suspended
    if (on && !(await confirm({ title: `Suspend ${name}?`, message: 'Its department admin can’t sign in or manage trainings until you restore access.', confirmLabel: 'Suspend access', danger: true }))) return
    update((d) => ({ ...d, suspendedDepartments: on ? [...(d.suspendedDepartments ?? []), name] : (d.suspendedDepartments ?? []).filter((x) => x !== name) }), {
      action: on ? 'Suspended department access' : 'Restored department access',
      target: name,
      changes: [{ field: 'Department access', from: on ? 'Active' : 'Suspended', to: on ? 'Suspended' : 'Active' }],
    })
  }

  const profile: [string, string][] = admin
    ? [
        ['Email', admin.email],
        ['Phone', admin.phone || '—'],
        ['Job title', admin.designation || '—'],
        ['Organization', admin.organization || '—'],
        ['Region', admin.region || '—'],
        ['Department', admin.department],
        ['Account', admin.status],
        ['Added', `${admin.createdAt ? shortDate(admin.createdAt) : '—'}${admin.createdBy ? ` by ${admin.createdBy}` : ''}`],
      ]
    : []

  return (
    <>
      <Link to="/admin/departments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-800">
        <ArrowLeft className="size-4" /> Departments
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <UserAvatar name={admin?.name ?? name} className="size-16 shrink-0 ring-4 ring-brand-50" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl leading-tight font-bold tracking-tight text-zinc-900">{admin ? admin.name : name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            {admin ? `Department admin · ${name}` : `${name} · no department admin yet`}
            {suspended ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setChanging(true)}>
            <UserPlus className="size-4" /> {admin ? 'Change admin' : 'Add department admin'}
          </Button>
          <Button variant={suspended ? 'primary' : 'outline'} onClick={() => void toggleAccess()}>
            {suspended ? (
              <>
                <PlayCircle className="size-4" /> Restore access
              </>
            ) : (
              <>
                <PauseCircle className="size-4" /> Suspend access
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={GraduationCap} label="Trainings" value={trainings.length} hint={`${byStatus('SCHEDULED')} scheduled · ${byStatus('ONGOING')} ongoing · ${byStatus('COMPLETED')} done`} tone="red" />
        <StatCard icon={Users} label="Trainees" value={trainees.length} hint="Enrolled or in the department" tone="zinc" />
        <StatCard icon={UserCheck} label="Trainers" value={trainers.length} hint="In this department" tone="zinc" />
        <StatCard icon={CalendarDays} label="Avg. attendance" value={avgAttendance === null ? '—' : `${avgAttendance}%`} hint={`${ran.length} session${ran.length === 1 ? '' : 's'} held`} tone="green" />
        <StatCard icon={Award} label="Certificates" value={certificates} hint="Issued in its trainings" tone="amber" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-bold text-zinc-900">Profile</h2>
            {admin ? (
              <dl className="mt-4 divide-y divide-zinc-100 text-sm">
                {profile.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="shrink-0 text-zinc-500">{k}</dt>
                    <dd className="min-w-0 text-right font-medium break-words text-zinc-900">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Empty compact icon={UserPlus} title="No department admin yet" text="Add one so this department can run its own trainings." action={<Button size="sm" variant="primary" onClick={() => setChanging(true)}>Add department admin</Button>} />
            )}
          </Card>
          <Card>
            <h2 className="text-base font-bold text-zinc-900">Trainers ({trainers.length})</h2>
            {trainers.length ? (
              <ul className="mt-3 space-y-2.5">
                {trainers.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Avatar name={p.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">{p.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No trainers in this department yet. The department admin can give trainer access to people from Users.</p>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden p-0">
            <h2 className="px-5 pt-5 text-base font-bold text-zinc-900">Trainings ({trainings.length})</h2>
            {trainings.length ? (
              <div className="mt-3">
                <Table head={['Training', 'Date', 'Status', 'Trainees', 'Attendance']} minWidth={560}>
                  {trainings.map((t) => {
                    const rate = t.status === 'COMPLETED' || t.status === 'ONGOING' ? attendanceOf(t) : null
                    return (
                      <tr key={t.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <Link to={`/admin/trainings/${t.id}`} className="font-medium text-zinc-900 hover:text-brand-600">
                            {t.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(t.date)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={trainingStatusTone[t.status]}>{t.status[0] + t.status.slice(1).toLowerCase()}</Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 tabular-nums">{t.participantIds.length}</td>
                        <td className="px-4 py-3 text-zinc-700 tabular-nums">{rate === null ? '—' : `${rate}%`}</td>
                      </tr>
                    )
                  })}
                </Table>
              </div>
            ) : (
              <p className="px-5 pt-2 pb-5 text-sm text-zinc-500">No trainings have been created under this department yet.</p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <h2 className="px-5 pt-5 text-base font-bold text-zinc-900">Trainees ({trainees.length})</h2>
            {trainees.length ? (
              <div className="mt-3 max-h-[420px] overflow-y-auto">
                <Table head={['Trainee', 'Trainings', 'Avg. progress']} minWidth={480}>
                  {trainees.map((p) => {
                    const mine = trainings.filter((t) => t.participantIds.includes(p.id)).length
                    const progress = progressOf(p.id)
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3">
                            <Avatar name={p.name} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-zinc-900">{p.name}</span>
                              <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 tabular-nums">{mine}</td>
                        <td className="px-4 py-3 text-zinc-700 tabular-nums">{progress === null ? '—' : `${progress}%`}</td>
                      </tr>
                    )
                  })}
                </Table>
              </div>
            ) : (
              <p className="px-5 pt-2 pb-5 text-sm text-zinc-500">No trainees yet.</p>
            )}
          </Card>
        </div>
      </div>
      {changing && <AddDepartmentAdminModal departments={[...new Set(data.people.map((x) => x.department).filter((d): d is string => !!d && d !== 'Visitor'))].sort()} initialDepartment={name} onClose={() => setChanging(false)} />}
    </>
  )
}
