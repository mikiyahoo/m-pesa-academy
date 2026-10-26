import { Activity, Award, Briefcase, Building2, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Eye, FilePlus2, FileSpreadsheet, Flame, History, Key, KeyRound, Lock, LogIn, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, PlusCircle, Search, Shield, Sparkles, Trophy, Upload, UserCheck, UserPlus, UserRoundPlus, Users, Users as UsersIcon, X, XCircle, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { read, utils, writeFile } from 'xlsx'
import { cn, localISO, todayISO } from '../../lib/utils'
import { DateRangePicker } from '../../components/DateRangePicker'
import { shortDate } from '../helpers'
import { isInternalEmail } from '../requests'
import { uid, useAdmin } from '../store'
import type { AdminUserRole, Group, Person } from '../types'
import { ALL_BADGES } from '../types'
import { deriveGamification } from '../gamification'
import { makeInviteToken } from '../temporary'
import { useAuth } from '../../store/Auth'
import { Avatar, Badge, Button, Card, downloadCsv, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, TabBar, Tabs, Textarea } from '../ui'
import { isInRange } from '../reports/filters'
import { UserAvatar } from '../../components/UserAvatar'
import { SegmentTabs } from '../../components/SegmentTabs'
import { StatStrip } from '../../components/CalendarParts'

/* ----------------------------------- Users ----------------------------------- */

type UserSortKey = 'name' | 'role' | 'status' | 'createdAt'

type UserFilterMenuProps = {
  label: string
  options: readonly string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

function UserFilterMenu({ label, options, selected, onChange }: UserFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (option: string) => {
    const next = new Set(selected)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-surface px-3 text-xs font-semibold text-zinc-700 transition hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
      >
        <PlusCircle className="size-3.5 text-brand-600" />
        {label}
        {selected.size > 0 && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">{selected.size}</span>}
        <ChevronDown className={cn('size-3.5 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="dialog" aria-label={`${label} filter`} className="absolute left-0 z-40 mt-2 w-64 rounded-xl border border-zinc-200 bg-surface p-2 shadow-xl">
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} aria-label={`Search ${label.toLowerCase()}`} className="w-full rounded-lg border border-zinc-200 bg-surface py-1.5 pr-2 pl-8 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {visibleOptions.length ? visibleOptions.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
                <input type="checkbox" checked={selected.has(option)} onChange={() => toggle(option)} className="size-3.5 accent-brand-600" />
                <span className="truncate">{option}</span>
              </label>
            )) : <p className="px-2 py-3 text-xs text-zinc-500">No matches</p>}
          </div>
          {selected.size > 0 && <button type="button" onClick={() => onChange(new Set())} className="mt-1 w-full border-t border-zinc-100 px-2 pt-2 text-left text-xs font-semibold text-brand-700 hover:text-brand-800">Clear {label.toLowerCase()} filters</button>}
        </div>
      )}
    </div>
  )
}

function UserModal({ person, onClose }: { person?: Person; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: person?.name ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    role: person?.role ?? ('Participant' as AdminUserRole),
    department: person?.department ?? '',
    designation: person?.designation ?? '',
    organization: person?.organization ?? '',
    region: person?.region ?? '',
    groupIds: person?.groupIds ?? [],
  })
  const emailTaken = data.people.some((p) => p.email.toLowerCase() === form.email.trim().toLowerCase() && p.id !== person?.id)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const valid = form.name.trim() && emailValid && !emailTaken

  const save = () => {
    const next: Person = {
      ...person,
      id: person?.id ?? uid('u'),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      role: form.role,
      department: form.department.trim(),
      designation: form.designation.trim(),
      organization: form.organization.trim(),
      region: form.region.trim(),
      groupIds: form.groupIds,
      status: person?.status ?? 'Active',
      createdAt: person?.createdAt ?? new Date().toISOString().slice(0, 10),
      createdBy: person ? person.createdBy : user.name,
    }
    update((d) => ({ ...d, people: person ? d.people.map((p) => (p.id === person.id ? next : p)) : [next, ...d.people] }), {
      action: person ? 'Updated user' : 'Added user',
      target: next.name,
      changes: person
        ? [
            { field: 'Name', from: person.name, to: next.name },
            { field: 'Email', from: person.email, to: next.email },
            { field: 'Phone', from: person.phone, to: next.phone },
            { field: 'Role', from: person.role, to: next.role },
            { field: 'Department', from: person.department, to: next.department },
            { field: 'Designation', from: person.designation ?? '', to: next.designation ?? '' },
            { field: 'Organization', from: person.organization ?? '', to: next.organization ?? '' },
            { field: 'Location', from: person.region ?? '', to: next.region ?? '' },
            { field: 'Groups', from: String(person.groupIds.length), to: String(next.groupIds.length) },
          ]
        : undefined,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={person ? 'Edit user' : 'Add user'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {person ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@partner.safaricom.et" />
          {form.email && !emailValid && <span className="mt-1 block text-xs text-brand-600">Enter a valid email.</span>}
          {emailTaken && <span className="mt-1 block text-xs text-brand-600">This email is already in use.</span>}
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07XXXXXXXX" />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminUserRole })}>
            <option>Participant</option>
            <option>Trainer</option>
            <option>Admin</option>
          </Select>
        </Field>
        <Field label="Department">
          <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </Field>
        <Field label="Designation">
          <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </Field>
        <Field label="Organization">
          <Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Addis Ababa" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Groups</p>
          <div className="flex flex-wrap gap-2">
            {data.groups.map((g) => {
              const on = form.groupIds.includes(g.id)
              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setForm({ ...form, groupIds: on ? form.groupIds.filter((x) => x !== g.id) : [...form.groupIds, g.id] })}
                  className={cn('rounded-full border px-3 py-1 text-xs transition', on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100')}
                  aria-pressed={on}
                >
                  {g.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

type InviteMode = 'manual' | 'bulk'
type InviteGroupMode = 'none' | 'existing' | 'new'

function InviteUserModal({ onClose }: { onClose: () => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const [mode, setMode] = useState<InviteMode>('manual')
  const [groupMode, setGroupMode] = useState<InviteGroupMode>('none')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [designation, setDesignation] = useState('')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState<AdminUserRole>('Participant')
  const [existingGroupId, setExistingGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [permanent, setPermanent] = useState(true)
  const [accessEnd, setAccessEnd] = useState('')
  const [sheet, setSheet] = useState<EmployeeSheet | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [readingSheet, setReadingSheet] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = todayISO()

  const invitees: ImportedEmployee[] = mode === 'manual'
    ? [{ name: name.trim(), email: email.trim().toLowerCase(), designation: designation.trim(), department: department.trim() }]
    : sheet?.employees ?? []
  const knownEmails = new Set(data.people.map((person) => person.email.toLowerCase()))
  const newInvitees = invitees.filter((person) => !knownEmails.has(person.email))
  const existingInvitees = invitees.filter((person) => knownEmails.has(person.email))
  const duplicateGroupName = groupMode === 'new' && data.groups.some((group) => group.name.trim().toLowerCase() === newGroupName.trim().toLowerCase())
  const manualEmailExists = mode === 'manual' && knownEmails.has(email.trim().toLowerCase())
  const selectedGroupId = groupMode === 'existing' ? existingGroupId : ''
  const hasGroupTarget = groupMode === 'new' ? !!newGroupName.trim() : groupMode === 'existing' ? !!selectedGroupId : false
  const formValid = mode === 'manual' ? !!name.trim() && EMAIL_RE.test(email.trim()) : !!sheet?.employees.length
  const accessValid = permanent || (!!accessEnd && accessEnd >= today)
  const hasAction = newInvitees.length > 0 || (existingInvitees.length > 0 && hasGroupTarget)
  const valid = formValid && accessValid && hasAction && (groupMode !== 'new' || (!!newGroupName.trim() && !duplicateGroupName)) && (groupMode !== 'existing' || !!existingGroupId) && !readingSheet

  const readSheet = async (file?: File) => {
    if (!file) return
    setReadingSheet(true)
    setSheetError('')
    setSheet(null)
    try {
      const parsed = await parseEmployeeSheet(file)
      setSheet(parsed)
      setSheetName(file.name)
    } catch (error) {
      setSheetName('')
      setSheetError(error instanceof Error ? error.message : 'The spreadsheet could not be read.')
    } finally {
      setReadingSheet(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const invite = () => {
    if (!valid) return
    const at = localISO()
    const groupId = groupMode === 'new' ? uid('g') : selectedGroupId || undefined
    const profileOrganization = organization.trim() || data.groups.find((group) => group.id === selectedGroupId)?.organization || ''
    const newGroup: Group | undefined = groupMode === 'new'
      ? { id: groupId!, name: newGroupName.trim(), description: '', organization: organization.trim() || undefined }
      : undefined
    const created: Person[] = newInvitees.map((invitee) => {
      const isExternal = !isInternalEmail(invitee.email)
      const end = permanent ? undefined : accessEnd
      const displayName = invitee.name.trim() || employeeNameFromEmail(invitee.email)
      return {
        id: uid('u'),
        name: displayName,
        email: invitee.email,
        phone: mode === 'manual' ? phone.trim() : '',
        role,
        status: 'Active',
        department: invitee.department,
        designation: invitee.designation || undefined,
        organization: profileOrganization || undefined,
        groupIds: groupId ? [groupId] : [],
        createdAt: at.slice(0, 10),
        createdBy: user.name,
        ...(end ? { accessStart: today, accessEnd: end } : {}),
        ...(isExternal ? { inviteToken: makeInviteToken(), invitedAt: at, invitedBy: user.name } : {}),
        accessHistory: [{ at, by: user.name, change: end ? `Invited · access through ${shortDate(end)}` : 'Invited · permanent access' }],
      }
    })
    const newEmailSet = new Set(newInvitees.map((person) => person.email))
    const existingEmailSet = new Set(existingInvitees.map((person) => person.email))
    const action = created.length
      ? `Invited ${created.length} user${created.length === 1 ? '' : 's'}`
      : `Added ${existingInvitees.length} existing user${existingInvitees.length === 1 ? '' : 's'} to a group`
    const target = newGroup?.name ?? data.groups.find((group) => group.id === groupId)?.name ?? created[0]?.name ?? 'Users'

    update((d) => ({
      ...d,
      groups: newGroup ? [...d.groups, newGroup] : d.groups,
      people: [
        ...created,
        ...d.people.map((person) => {
          if (!groupId || !existingEmailSet.has(person.email.toLowerCase())) return person
          return { ...person, groupIds: person.groupIds.includes(groupId) ? person.groupIds : [...person.groupIds, groupId] }
        }).filter((person) => !newEmailSet.has(person.email.toLowerCase())),
      ],
    }), { action, target, remarks: `${created.length} new invite${created.length === 1 ? '' : 's'}${existingInvitees.length ? `; ${existingInvitees.length} existing user${existingInvitees.length === 1 ? '' : 's'} assigned` : ''}` })
    onClose()
  }

  const modeItems = [{ value: 'manual' as const, label: 'Manual' }, { value: 'bulk' as const, label: 'Bulk' }]
  const groupOptions: { value: InviteGroupMode; label: string }[] = [
    { value: 'none', label: "Don't assign to group" },
    { value: 'existing', label: 'Existing group' },
    { value: 'new', label: 'New group' },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite User"
      description="Invite one user or import a list, then set group and access validity."
      wide
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">
            {mode === 'bulk' && sheet ? `${newInvitees.length} new · ${existingInvitees.length} already in Users` : !permanent && !accessEnd ? 'Choose an access end date.' : ''}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={invite}>
            <UserRoundPlus className="size-4" /> Invite {mode === 'manual' ? 'user' : `${newInvitees.length || invitees.length} users`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TabBar className="mb-0 w-full">
          <Tabs value={mode} onChange={setMode} items={modeItems} label="Invite method" />
        </TabBar>

        {mode === 'manual' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Employee name" />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
              {email.trim() && !EMAIL_RE.test(email.trim()) && <span className="mt-1 block text-xs text-brand-600">Enter a valid email address.</span>}
              {manualEmailExists && <span className="mt-1 block text-xs text-zinc-500">This user already exists. Choose a group to add them without creating a duplicate.</span>}
            </Field>
            <Field label="Phone (optional)">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XXXXXXXX" />
            </Field>
            <Field label="Organization (optional)">
              <Input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization name" />
            </Field>
            <Field label="Department (optional)">
              <Input value={department} onChange={(event) => setDepartment(event.target.value)} />
            </Field>
            <Field label="Designation (optional)">
              <Input value={designation} onChange={(event) => setDesignation(event.target.value)} />
            </Field>
          </div>
        ) : (
          <section className="space-y-3">
            <Field label="Import users from Excel">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void readSheet(event.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={readingSheet} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-surface text-sm font-semibold text-zinc-700 transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60">
                <Upload className="size-4" /> {readingSheet ? 'Reading file…' : sheetName || 'Upload Excel File'}
              </button>
              <span className="mt-1 block text-xs text-zinc-500">Excel or CSV columns: Name, Email, Designation, Department. Email is required.</span>
            </Field>
            {sheetError && <p role="alert" className="text-xs text-brand-600">{sheetError}</p>}
            {sheet && <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-600">
              <p className="font-semibold text-zinc-800">{sheet.employees.length} valid email{sheet.employees.length === 1 ? '' : 's'} found</p>
              <p>{newInvitees.length} new user{newInvitees.length === 1 ? '' : 's'} · {existingInvitees.length} already in Users{sheet.invalidRows ? ` · ${sheet.invalidRows} invalid row${sheet.invalidRows === 1 ? '' : 's'} skipped` : ''}{sheet.duplicateRows ? ` · ${sheet.duplicateRows} duplicate row${sheet.duplicateRows === 1 ? '' : 's'} skipped` : ''}</p>
            </div>}
          </section>
        )}

        <section className="space-y-3 border-t border-zinc-100 pt-4">
          <Field label={mode === 'bulk' ? 'Role for all users' : 'Role'}>
            <Select value={role} onChange={(event) => setRole(event.target.value as AdminUserRole)}>
              <option value="Participant">Participant</option>
              <option value="Trainer">Trainer</option>
              <option value="Admin">Admin</option>
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-sm font-semibold text-zinc-800">Group assignment</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {groupOptions.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                <input type="radio" name="invite-group-mode" checked={groupMode === option.value} onChange={() => setGroupMode(option.value)} className="size-4 accent-brand-600" />
                {option.label}
              </label>)}
            </div>
            {groupMode === 'existing' && <div className="mt-3"><Field label="Choose group">
              <Select value={existingGroupId} onChange={(event) => setExistingGroupId(event.target.value)}>
                <option value="">Select a group</option>
                {data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </Select>
            </Field></div>}
            {groupMode === 'new' && <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Group name">
                <Input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Training group name" />
                {duplicateGroupName && <span className="mt-1 block text-xs text-brand-600">A group with this name already exists.</span>}
              </Field>
              <Field label="Organization (optional)"><Input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization name" /></Field>
            </div>}
          </div>
        </section>

        <section className="space-y-3 border-t border-zinc-100 pt-4">
          <p className="text-sm font-semibold text-zinc-800">Validity period</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={permanent} onChange={(event) => setPermanent(event.target.checked)} className="size-4 accent-brand-600" />
            Permanent access
          </label>
          {!permanent && <Field label="Access until">
            <Input type="date" min={today} value={accessEnd} onChange={(event) => setAccessEnd(event.target.value)} />
          </Field>}
        </section>
      </div>
    </Modal>
  )
}

type ProfilePageTab = 'account' | 'access' | 'activity' | 'gamification'

function ProfileRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700">
        <Icon className="size-4" />
      </span>
      <dt className="w-24 shrink-0 text-xs text-zinc-500">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{value || '—'}</dd>
    </div>
  )
}

/** Standalone page: admin view of a user's profile, mirroring the learner Profile page layout. */
export function AdminUserView() {
  const { data, update } = useAdmin()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<ProfilePageTab>('account')
  const [editing, setEditing] = useState(false)

  const person = data.people.find((p) => p.id === id)

  if (!person) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          <ChevronLeft className="size-4" /> Back to Users
        </button>
        <p className="text-zinc-500">User not found.</p>
      </div>
    )
  }

  const groupNames = person.groupIds.map((id) => data.groups.find((g) => g.id === id)?.name).filter((n): n is string => !!n)
  const accessHistory = person.accessHistory ?? []
  const accessType = person.accessStart || person.accessEnd ? 'Temporary access' : 'Permanent access'
  const isInternal = isInternalEmail(person.email)

  const gamification = useMemo(() => deriveGamification(data), [data])
  const personGame = gamification.people[person.id]
  const userPoints = personGame?.points ?? 0
  const earnedBadges = personGame?.badges ?? []
  const pointEvents = personGame?.events ?? []
  const completedTrainingsCount = pointEvents.filter((e) => e.kind === 'training-completed').length
  const assessmentsPassedCount = pointEvents.filter((e) => e.kind === 'assessment-passed').length

  const toggleStatus = () => {
    const status = person.status === 'Active' ? 'Inactive' : 'Active'
    update((d) => ({ ...d, people: d.people.map((x) => (x.id === person.id ? { ...x, status } : x)) }), {
      action: status === 'Active' ? 'Activated user' : 'Deactivated user',
      target: person.name,
      changes: [{ field: 'Status', from: person.status, to: status }],
    })
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        onClick={() => navigate('/admin/users')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        <ChevronLeft className="size-4" /> Back to Users
      </button>

      <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">User Profile</h1>

      {/* Hero card — mirrors learner Profile */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
        <UserAvatar name={person.name} className="size-20 ring-4 ring-brand-50 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold text-zinc-900">{person.name}</p>
            <Badge tone={person.role === 'Admin' ? 'red' : person.role === 'Trainer' ? 'blue' : 'zinc'}>{person.role}</Badge>
            <Badge tone={person.status === 'Active' ? 'green' : 'zinc'}>{person.status}</Badge>
            {person.isRequester && <Badge tone="amber">Requester</Badge>}
            <Badge tone={isInternal ? 'zinc' : 'blue'}>{isInternal ? 'Internal' : 'External'}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{person.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
            {person.designation && <span>{person.designation}</span>}
            {person.department && <span>• {person.department}</span>}
            {person.organization && <span>• {person.organization}</span>}
            {person.region && <span>• {person.region}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit profile
          </Button>
          <Button onClick={toggleStatus} variant={person.status === 'Active' ? 'ghost' : 'primary'}>
            {person.status === 'Active' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </section>

      {/* Stat strip */}
      <StatStrip
        items={[
          { icon: Users, label: 'Groups', value: `${groupNames.length} Assigned`, tone: 'zinc' },
          { icon: Key, label: 'Access Type', value: person.accessStart || person.accessEnd ? 'Temporary' : 'Permanent', tone: person.accessStart || person.accessEnd ? 'amber' : 'green' },
          { icon: Shield, label: 'System Role', value: person.role, tone: person.role === 'Admin' ? 'red' : person.role === 'Trainer' ? 'blue' : 'zinc' },
          { icon: Trophy, label: 'Gamification', value: `${userPoints} pts · ${earnedBadges.length} Badges`, tone: 'amber' },
        ]}
      />

      {/* Tab selector */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-2.5">
        <SegmentTabs<ProfilePageTab>
          label="User profile sections"
          items={[
            { value: 'account', label: 'Account details' },
            { value: 'access', label: 'Role & permissions' },
            { value: 'activity', label: 'Activity & history', badge: accessHistory.length || undefined },
            { value: 'gamification', label: 'Badges & Points', badge: userPoints ? `${userPoints} pts` : undefined },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Tab 1: Account details */}
      {tab === 'account' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900">Personal & Contact</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Contact information and location details.</p>
            <dl className="mt-4 divide-y divide-zinc-100">
              <ProfileRow icon={Mail} label="Email" value={person.email} />
              <ProfileRow icon={Phone} label="Phone" value={person.phone} />
              <ProfileRow icon={MapPin} label="Location" value={person.region} />
            </dl>
          </section>
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900">Organization</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Department, designation and employer group.</p>
            <dl className="mt-4 divide-y divide-zinc-100">
              <ProfileRow icon={Building2} label="Organization" value={person.organization} />
              <ProfileRow icon={Briefcase} label="Department" value={person.department} />
              <ProfileRow icon={Award} label="Designation" value={person.designation} />
            </dl>
          </section>
        </div>
      )}

      {/* Tab 2: Role & permissions */}
      {tab === 'access' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900">Role & Access Period</h2>
            <p className="mt-0.5 text-xs text-zinc-500">System credentials and authorization window.</p>
            <dl className="mt-4 divide-y divide-zinc-100">
              <ProfileRow
                icon={Shield}
                label="System role"
                value={<Badge tone={person.role === 'Admin' ? 'red' : person.role === 'Trainer' ? 'blue' : 'zinc'}>{person.role}</Badge>}
              />
              <ProfileRow
                icon={Activity}
                label="Status"
                value={<Badge tone={person.status === 'Active' ? 'green' : 'zinc'}>{person.status}</Badge>}
              />
              <ProfileRow icon={Key} label="Access type" value={accessType} />
              <ProfileRow
                icon={Calendar}
                label="Access window"
                value={person.accessStart || person.accessEnd ? `${shortDate(person.accessStart)} – ${shortDate(person.accessEnd)}` : 'Indefinite / Permanent'}
              />
            </dl>
          </section>
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900">Permissions & Groups</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Requester rights and group assignments.</p>
            <dl className="mt-4 divide-y divide-zinc-100">
              <ProfileRow icon={FilePlus2} label="Requester" value={person.isRequester ? 'Enabled' : 'No'} />
              <ProfileRow icon={CheckCircle2} label="Can approve" value={person.canApprove ? 'Yes' : 'No'} />
              <ProfileRow icon={UserCheck} label="User type" value={isInternal ? 'Internal employee' : 'External partner'} />
              <div className="flex items-start gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700">
                  <Users className="size-4" />
                </span>
                <dt className="w-24 shrink-0 pt-1 text-xs text-zinc-500">Groups</dt>
                <dd className="min-w-0 flex-1">
                  {groupNames.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {groupNames.map((name) => (<Badge key={name}>{name}</Badge>))}
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-400">No groups assigned</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {/* Tab 3: Activity & history */}
      {tab === 'activity' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-900">Account Milestones</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Creation, invitation and sign-in timeline.</p>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-y-0">
              <ProfileRow icon={UserPlus} label="Created by" value={`${person.createdBy ?? person.invitedBy ?? 'System'}${person.createdAt ? ` (${shortDate(person.createdAt)})` : ''}`} />
              <ProfileRow icon={Mail} label="Invited by" value={person.invitedBy ? `${person.invitedBy}${person.invitedAt ? ` (${shortDate(person.invitedAt)})` : ''}` : 'Direct addition'} />
              <ProfileRow icon={CheckCircle2} label="Accepted at" value={shortDate(person.acceptedAt)} />
              <ProfileRow icon={LogIn} label="Last sign-in" value={shortDate(person.lastSignInAt)} />
              {person.revokedAt && <ProfileRow icon={XCircle} label="Revoked at" value={shortDate(person.revokedAt)} />}
            </dl>
          </section>

          {!!accessHistory.length && (
            <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
                <History className="size-4 text-brand-600" /> Access Audit History
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">Record of changes to this account's access and roles.</p>
              <div className="mt-4 divide-y divide-zinc-100">
                {accessHistory.slice().reverse().map((item, index) => (
                  <div key={`${item.at}-${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 first:pt-0">
                    <span className="text-sm font-medium text-zinc-800">{item.change}</span>
                    <span className="text-xs text-zinc-500">{shortDate(item.at)} · {item.by}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Tab 4: Gamification, Badges & Points */}
      {tab === 'gamification' && (
        <div className="space-y-6">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-orange-50/30 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
                <Trophy className="size-4" /> Total Points
              </div>
              <p className="mt-2 text-2xl font-black text-amber-900">{userPoints.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] text-amber-700/80">Earned across all activities</p>
            </div>
            <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/50 to-emerald-50/30 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                <Award className="size-4" /> Badges Earned
              </div>
              <p className="mt-2 text-2xl font-black text-brand-900">
                {earnedBadges.length} <span className="text-sm font-normal text-zinc-500">/ {ALL_BADGES.length}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-brand-700/80">Achievement milestones unlocked</p>
            </div>
            <div className="rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50/50 to-blue-50/30 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700">
                <Sparkles className="size-4" /> Completed Sessions
              </div>
              <p className="mt-2 text-2xl font-black text-sky-900">{completedTrainingsCount}</p>
              <p className="mt-0.5 text-[11px] text-sky-700/80">100% module progress</p>
            </div>
            <div className="rounded-2xl border border-purple-200/60 bg-gradient-to-br from-purple-50/50 to-indigo-50/30 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-700">
                <CheckCircle2 className="size-4" /> Quizzes Passed
              </div>
              <p className="mt-2 text-2xl font-black text-purple-900">{assessmentsPassedCount}</p>
              <p className="mt-0.5 text-[11px] text-purple-700/80">Score met or exceeded pass mark</p>
            </div>
          </div>

          {/* Badges Showcase */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Award className="size-5 text-amber-500" /> Earned & Available Badges
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Badges reflect learning achievements, attendance milestones, and assessment mastery.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/admin/leaderboard')}>
                <Trophy className="size-3.5 text-amber-500" /> View Leaderboard
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_BADGES.map((b) => {
                const earned = earnedBadges.find((eb) => eb.badgeId === b.id)
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'relative flex items-start gap-3 rounded-xl border p-3.5 transition-all',
                      earned
                        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-amber-50/20 shadow-xs ring-1 ring-emerald-500/10'
                        : 'border-zinc-200/70 bg-zinc-50/50 opacity-60'
                    )}
                  >
                    <div
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-xl text-xl shadow-xs',
                        earned ? b.color + ' text-white ring-2 ring-white' : 'bg-zinc-200 text-zinc-400'
                      )}
                    >
                      {earned ? b.icon : <Lock className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-sm font-semibold truncate', earned ? 'text-zinc-900' : 'text-zinc-500')}>
                          {b.label}
                        </p>
                        <span className="text-[11px] font-bold text-amber-600 shrink-0">+{b.points} pts</span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500 leading-snug line-clamp-2">{b.description}</p>
                      {earned ? (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <Check className="size-3" /> Unlocked {shortDate(earned.earnedAt)}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-zinc-400">Not yet earned</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Point Activity Ledger */}
          <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <Flame className="size-4 text-orange-500" /> Point Activity Ledger
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Full chronological log of points awarded to this participant.</p>

            {pointEvents.length === 0 ? (
              <p className="mt-4 text-xs text-zinc-400">No activity points earned yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-zinc-100 max-h-96 overflow-y-auto pr-1">
                {pointEvents
                  .slice()
                  .reverse()
                  .map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between py-2.5 first:pt-0">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-medium text-zinc-800">{ev.label}</p>
                        <p className="text-xs text-zinc-400">{shortDate(ev.at)}</p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200 shrink-0">
                        +{ev.points} pts
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}

      {editing && <UserModal person={person} onClose={() => setEditing(false)} />}
    </div>
  )
}

export function AdminUsers() {
  const { data, update } = useAdmin()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [userTypes, setUserTypes] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Set<string>>(new Set())
  const [roles, setRoles] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [accessTypes, setAccessTypes] = useState<Set<string>>(new Set())
  const [createdRange, setCreatedRange] = useState({ from: '', to: '' })
  const [sortBy, setSortBy] = useState<UserSortKey>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [pageSizeOption, setPageSizeOption] = useState<number | 'fit'>('fit')
  const [fitPageSize, setFitPageSize] = useState(10)
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const paginationRef = useRef<HTMLDivElement>(null)

  const groupName = (p: Person) => p.groupIds.map((id) => data.groups.find((group) => group.id === id)?.name).filter(Boolean).join(', ')
  const filtered = useMemo(() => {
    const matches = (p: Person) => {
      const query = `${p.name} ${p.email} ${p.department} ${p.designation ?? ''} ${p.organization ?? ''} ${p.region ?? ''} ${p.createdBy ?? p.invitedBy ?? ''} ${groupName(p)}`.toLowerCase()
      const userType = isInternalEmail(p.email) ? 'Internal' : 'External'
      const accessType = p.accessStart || p.accessEnd ? 'Temporary' : 'Permanent'
      return (!q || query.includes(q.trim().toLowerCase())) &&
        (!userTypes.size || userTypes.has(userType)) &&
        (!groups.size || p.groupIds.some((id) => {
          const group = data.groups.find((item) => item.id === id)
          return !!group && groups.has(group.name)
        })) &&
        (!roles.size || roles.has(p.role) || (roles.has('Requester') && !!p.isRequester)) &&
        (!statuses.size || statuses.has(p.status)) &&
        (!accessTypes.size || accessTypes.has(accessType)) &&
        isInRange(p.createdAt, createdRange)
    }

    return data.people.filter(matches).sort((a, b) => {
      const value = (person: Person) => {
        switch (sortBy) {
          case 'name': return person.name
          case 'role': return person.role
          case 'status': return person.status
          case 'createdAt': return person.createdAt
        }
      }
      const comparison = value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data.people, data.groups, q, userTypes, groups, roles, statuses, accessTypes, createdRange, sortBy, sortDirection, groupName])
  const pageSize = pageSizeOption === 'fit' ? fitPageSize : pageSizeOption
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * pageSize, current * pageSize + pageSize)
  const activeFilterCount = userTypes.size + groups.size + roles.size + statuses.size + accessTypes.size + Number(!!createdRange.from || !!createdRange.to)
  const hasFilters = !!q || activeFilterCount > 0
  const resetPage = () => setPage(0)
  const requesterDisabledReason = (person: Person) => {
    if (person.isRequester) return undefined
    if (!isInternalEmail(person.email)) return 'Temporary users cannot request'
    if (person.status !== 'Active') return 'Only active users can be made requesters'
    return undefined
  }

  const hasRows = rows.length > 0
  useEffect(() => {
    const table = tableRef.current
    const pagination = paginationRef.current
    if (!table || !pagination) return

    const measureFit = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) return
      const firstRow = table.querySelector('tbody tr')
      const rowHeight = firstRow?.getBoundingClientRect().height ?? 0
      const headerHeight = table.querySelector('thead')?.getBoundingClientRect().height ?? 0
      if (!rowHeight || !headerHeight) return

      const scroller = table.closest('main')?.parentElement
      const scrollerRect = scroller?.getBoundingClientRect()
      const availableHeight = (scroller?.clientHeight ?? window.innerHeight) - 32
      const top = scroller && scrollerRect
        ? table.getBoundingClientRect().top - scrollerRect.top + scroller.scrollTop
        : table.getBoundingClientRect().top
      const pagerHeight = pagination.getBoundingClientRect().height
      const pagerGap = Number.parseFloat(getComputedStyle(pagination).marginTop) || 0
      const nextFit = Math.max(1, Math.min(50, Math.floor((availableHeight - top - headerHeight - pagerHeight - pagerGap) / rowHeight)))
      setFitPageSize((currentFit) => currentFit === nextFit ? currentFit : nextFit)
    }

    const observer = new ResizeObserver(measureFit)
    observer.observe(table)
    observer.observe(pagination)
    if (filtersRef.current) observer.observe(filtersRef.current)
    window.addEventListener('resize', measureFit)
    const frame = window.requestAnimationFrame(measureFit)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measureFit)
      observer.disconnect()
    }
  }, [hasRows])
  const clearFilters = () => {
    setQ('')
    setUserTypes(new Set())
    setGroups(new Set())
    setRoles(new Set())
    setStatuses(new Set())
    setAccessTypes(new Set())
    setCreatedRange({ from: '', to: '' })
    resetPage()
  }
  const updateSort = (key: UserSortKey) => {
    if (key === sortBy) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else {
      setSortBy(key)
      setSortDirection(key === 'createdAt' ? 'desc' : 'asc')
    }
  }
  // TA-1.7: only admins grant requester rights, and only to internal (permanent) users.
  const toggleRequester = (p: Person) => {
    if (requesterDisabledReason(p)) return
    const on = !p.isRequester
    update((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, isRequester: on } : x)) }), {
      action: on ? 'Granted requester rights' : 'Removed requester rights',
      target: p.name,
    })
    setMenu(null)
  }

  // URS 2.3: admins can let trainers approve training requests.
  const toggleApprover = (p: Person) => {
    const on = !p.canApprove
    update((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, canApprove: on } : x)) }), {
      action: on ? 'Allowed trainer to approve requests' : 'Removed approval rights',
      target: p.name,
    })
    setMenu(null)
  }

  const toggleStatus = (p: Person) => {
    const status = p.status === 'Active' ? 'Inactive' : 'Active'
    update((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, status } : x)) }), {
      action: status === 'Active' ? 'Activated user' : 'Deactivated user',
      target: p.name,
      changes: [{ field: 'Status', from: p.status, to: status }],
    })
    setMenu(null)
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can take or deliver trainings."
        actions={
          <>
            <Button onClick={() => downloadCsv('users.csv', ['Name', 'Email', 'Phone', 'Department', 'Designation', 'Organization', 'Location', 'Groups', 'Role', 'Status', 'Created By', 'Created At'], filtered.map((p) => [p.name, p.email, p.phone, p.department, p.designation ?? '', p.organization ?? '', p.region ?? '', groupName(p), p.role, p.status, p.createdBy ?? p.invitedBy ?? '', p.createdAt]))}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => navigate('/admin/temporary-access')}>
              <KeyRound className="size-4" /> Grant temporary access
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Invite user
            </Button>
          </>
        }
      />
      <div ref={filtersRef} className="mb-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-zinc-200/80 bg-surface p-2.5">
        <UserFilterMenu label="User Type" options={['Internal', 'External']} selected={userTypes} onChange={(value) => { setUserTypes(value); resetPage() }} />
        <UserFilterMenu label="Group" options={data.groups.map((group) => group.name)} selected={groups} onChange={(value) => { setGroups(value); resetPage() }} />
        <UserFilterMenu label="Role" options={['Admin', 'Trainer', 'Participant', 'Requester']} selected={roles} onChange={(value) => { setRoles(value); resetPage() }} />
        <UserFilterMenu label="Status" options={['Active', 'Inactive']} selected={statuses} onChange={(value) => { setStatuses(value); resetPage() }} />
        <UserFilterMenu label="Permanent" options={['Permanent', 'Temporary']} selected={accessTypes} onChange={(value) => { setAccessTypes(value); resetPage() }} />
        <DateRangePicker value={createdRange} onChange={(value) => { setCreatedRange(value); resetPage() }} emptyLabel="Created At" />
        {hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}><X className="size-3.5" /> Clear filters</Button>}
        <SearchInput value={q} onChange={(value) => { setQ(value); resetPage() }} placeholder="Search by name/email…" className="w-full sm:ml-auto sm:w-[280px]" />
      </div>
      {rows.length ? (
        <>
          {/* Mobile cards (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {rows.map((p) => (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0">
                      <span className="block font-semibold text-zinc-900 truncate">{p.name}</span>
                      <span className="block text-xs text-zinc-500 truncate">{p.email}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex items-center gap-1 text-xs text-zinc-700">
                      <span className={cn('size-1.5 rounded-full', p.status === 'Active' ? 'bg-mpesa-500' : 'bg-zinc-400')} />
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={p.role === 'Admin' ? 'red' : p.role === 'Trainer' ? 'blue' : 'zinc'}>{p.role.toUpperCase()}</Badge>
                  {p.isRequester && <Badge tone="amber">REQUESTER</Badge>}
                  {p.canApprove && <Badge tone="green">APPROVER</Badge>}
                  {!isInternalEmail(p.email) && <Badge>TEMPORARY</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 pt-2 border-t border-zinc-100">
                  <span className="truncate">Department: {p.department || '—'}</span>
                  <span className="truncate">Designation: {p.designation || '—'}</span>
                  <span className="truncate">Organization: {p.organization || '—'}</span>
                  <span className="truncate">Location: {p.region || '—'}</span>
                  <span className="truncate">Created: {shortDate(p.createdAt)}</span>
                  <span className="truncate">By: {p.createdBy ?? p.invitedBy ?? '—'}</span>
                  <span className="col-span-2 truncate">Groups: {groupName(p) || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-100">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/users/${p.id}`)}><Eye className="size-3.5" /> View details</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p) }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(p)}>{p.status === 'Active' ? 'Deactivate' : 'Activate'}</Button>
                  {isInternalEmail(p.email) && (
                  <span title={requesterDisabledReason(p)}>
                    <Button size="sm" variant="ghost" disabled={!!requesterDisabledReason(p)} onClick={() => toggleRequester(p)}>{p.isRequester ? 'Remove requester' : 'Make requester'}</Button>
                  </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table (≥ md) */}
          <div ref={tableRef} className="hidden rounded-2xl border border-zinc-200/80 bg-surface md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="w-[34%] px-1.5 py-3 sm:px-2 xl:w-[24%]" scope="col"><button type="button" onClick={() => updateSort('name')} className="inline-flex items-center gap-1 text-left hover:text-zinc-900">User<ChevronsUpDown className={cn('size-3.5 shrink-0', sortBy === 'name' ? 'text-brand-600' : 'text-zinc-400')} /></button></th>
                  <th className="w-[19%] px-1.5 py-3 sm:px-2 xl:w-[11%]" scope="col"><span className="xl:hidden">Dept.</span><span className="hidden xl:inline">Department</span></th>
                  <th className="hidden px-1.5 py-3 sm:px-2 xl:table-cell xl:w-[10%]" scope="col">Designation</th>
                  <th className="hidden px-1.5 py-3 sm:px-2 xl:table-cell xl:w-[12%]" scope="col">Organization</th>
                  <th className="hidden px-1.5 py-3 sm:px-2 xl:table-cell xl:w-[8%]" scope="col" title="Location">Loc.</th>
                  <th className="w-[21%] px-1.5 py-3 sm:px-2 xl:w-[12%]" scope="col">Groups</th>
                  <th className="w-[12%] px-1.5 py-3 sm:px-2 xl:w-[8%]" scope="col"><button type="button" onClick={() => updateSort('role')} className="inline-flex items-center gap-1 text-left hover:text-zinc-900">Role<ChevronsUpDown className={cn('size-3.5 shrink-0', sortBy === 'role' ? 'text-brand-600' : 'text-zinc-400')} /></button></th>
                  <th className="w-[9%] px-1 py-3 sm:px-1 xl:w-[7%]" scope="col"><button type="button" onClick={() => updateSort('status')} className="inline-flex items-center gap-0.5 text-left hover:text-zinc-900">Status<ChevronsUpDown className={cn('size-3.5 shrink-0', sortBy === 'status' ? 'text-brand-600' : 'text-zinc-400')} /></button></th>
                  <th className="hidden px-0.5 py-3 xl:table-cell xl:w-[5%]" scope="col" title="Created At">Date</th>
                  <th className="w-[5%] px-0 py-3 text-center xl:w-[3%]" scope="col" title="Actions"><span className="sr-only">Actions</span><MoreHorizontal className="mx-auto size-4" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/90 text-zinc-800">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="min-w-0 px-1.5 py-2 sm:px-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate font-medium text-zinc-900">{p.name}</span>
                        <span className="block truncate text-xs text-zinc-500" title={p.email}>{p.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-sm text-zinc-600 sm:px-2"><span className="block truncate" title={p.department}>{p.department || '—'}</span></td>
                  <td className="hidden px-1.5 py-2 text-sm text-zinc-600 sm:px-2 xl:table-cell"><span className="block truncate" title={p.designation}>{p.designation || '—'}</span></td>
                  <td className="hidden px-1.5 py-2 text-sm text-zinc-600 sm:px-2 xl:table-cell"><span className="block truncate" title={p.organization}>{p.organization || '—'}</span></td>
                  <td className="hidden px-1.5 py-2 text-sm text-zinc-600 sm:px-2 xl:table-cell"><span className="block truncate" title={p.region}>{p.region || '—'}</span></td>
                  <td className="px-1.5 py-2 text-sm text-zinc-600 sm:px-2"><span className="block truncate" title={groupName(p)}>{groupName(p) || '—'}</span></td>
                  <td className="px-1 py-2 sm:px-1"><Badge className="max-w-full truncate px-1.5" tone={p.role === 'Admin' ? 'red' : p.role === 'Trainer' ? 'blue' : 'zinc'}>{p.role.toUpperCase()}</Badge></td>
                  <td className="px-1 py-2 sm:px-1"><Badge className="max-w-full truncate px-1.5" tone={p.status === 'Active' ? 'green' : 'zinc'}>{p.status.toUpperCase()}</Badge></td>
                  <td className="hidden px-0.5 py-2 text-sm text-zinc-600 xl:table-cell" title={shortDate(p.createdAt)}><span className="block truncate">{new Date(`${p.createdAt}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></td>
                  <td className="relative px-0 py-2 text-center">
                    <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Actions for ${p.name}`}>
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menu === p.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                        <div className="absolute right-4 z-20 mt-1 w-56 rounded-xl border border-zinc-200 bg-surface p-1 text-left text-sm shadow-lg">
                          <button
                            onClick={() => {
                              navigate(`/admin/users/${p.id}`)
                              setMenu(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100"
                          >
                            <Eye className="size-4 text-zinc-500" /> View details
                          </button>
                          <button
                            onClick={() => {
                              setEditing(p)
                              setMenu(null)
                            }}
                            className="w-full rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100"
                          >
                            Edit
                          </button>
                          <div title={requesterDisabledReason(p)}>
                            <button
                              onClick={() => toggleRequester(p)}
                              disabled={!!requesterDisabledReason(p)}
                              aria-description={requesterDisabledReason(p)}
                              className="w-full rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {p.isRequester ? 'Remove requester rights' : 'Make requester'}
                            </button>
                          </div>
                          {p.role === 'Trainer' && (
                            <button onClick={() => toggleApprover(p)} className="w-full rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100">
                              {p.canApprove ? 'Stop approving requests' : 'Allow approving requests'}
                            </button>
                          )}
                          <button onClick={() => toggleStatus(p)} className="w-full rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100">
                            {p.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Card>
          <Empty icon={UsersIcon} title="No users match" text={hasFilters ? 'Try changing or clearing the filters.' : 'Add a user or invite temporary users to get started.'} action={hasFilters && <Button size="sm" onClick={clearFilters}><X className="size-3.5" /> Clear filters</Button>} />
        </Card>
      )}

      {!!filtered.length && (
        <div ref={paginationRef} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Showing {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length} users</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2">Rows per page<Select value={String(pageSizeOption)} onChange={(event) => { const value = event.target.value; setPageSizeOption(value === 'fit' ? 'fit' : Number(value)); resetPage() }} className="w-auto! py-1.5! text-xs!"><option value="fit">Fit page ({fitPageSize})</option><option value="10">10</option><option value="25">25</option><option value="50">50</option></Select></label>
            <span className="px-1">Page {current + 1} of {pages}</span>
            <Button size="sm" aria-label="First page" disabled={current === 0} onClick={() => setPage(0)}><ChevronLeft className="size-3.5" /><ChevronLeft className="-ml-2 size-3.5" /></Button>
            <Button size="sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft className="size-3.5" /></Button>
            <Button size="sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight className="size-3.5" /></Button>
            <Button size="sm" aria-label="Last page" disabled={current >= pages - 1} onClick={() => setPage(pages - 1)}><ChevronRight className="size-3.5" /><ChevronRight className="-ml-2 size-3.5" /></Button>
          </div>
        </div>
      )}

      {editing === 'new' && <InviteUserModal onClose={() => setEditing(null)} />}
      {editing && editing !== 'new' && <UserModal person={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/* ----------------------------------- Groups ---------------------------------- */

type ImportedEmployee = { name: string; email: string; designation: string; department: string }
type EmployeeSheet = { employees: ImportedEmployee[]; invalidRows: number; duplicateRows: number }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function parseEmployeeSheet(file: File): Promise<EmployeeSheet> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an .xlsx, .xls or .csv file.')
  const workbook = read(await file.arrayBuffer(), { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error('The spreadsheet has no worksheets.')
  const rows = utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
  if (!rows.length) throw new Error('The first worksheet is empty.')

  const headerKey = (row: Record<string, unknown>, aliases: string[]) => {
    const wanted = new Set(aliases)
    return Object.keys(row).find((key) => wanted.has(key.toLowerCase().replace(/[^a-z]/g, '')))
  }
  const emailKey = headerKey(rows[0], ['email', 'emailaddress'])
  if (!emailKey) throw new Error('Add an Email column header, then upload the file again.')
  const nameKey = headerKey(rows[0], ['name', 'fullname', 'employeename'])
  const designationKey = headerKey(rows[0], ['designation', 'jobtitle', 'title'])
  const departmentKey = headerKey(rows[0], ['department', 'team'])
  const unique = new Map<string, ImportedEmployee>()
  let invalidRows = 0
  let duplicateRows = 0

  for (const row of rows) {
    const email = String(row[emailKey] ?? '').trim().toLowerCase()
    const name = nameKey ? String(row[nameKey] ?? '').trim() : ''
    const designation = designationKey ? String(row[designationKey] ?? '').trim() : ''
    const department = departmentKey ? String(row[departmentKey] ?? '').trim() : ''
    if (!email && !name && !designation && !department) continue
    if (!EMAIL_RE.test(email)) {
      invalidRows += 1
      continue
    }
    if (unique.has(email)) {
      duplicateRows += 1
      continue
    }
    unique.set(email, { name, email, designation, department })
  }
  if (!unique.size) throw new Error('No valid email addresses were found. Check the Email column and try again.')
  return { employees: [...unique.values()], invalidRows, duplicateRows }
}

function employeeNameFromEmail(email: string) {
  return email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function downloadEmployeeTemplate() {
  const sheet = utils.aoa_to_sheet([
    ['Name', 'Email', 'Designation', 'Department'],
    ['Example employee', 'employee@example.com', 'Customer Care Agent', 'Customer Support'],
  ])
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, 'Employees')
  writeFile(workbook, 'group-employees-template.xlsx')
}

function GroupModal({ group, onClose }: { group?: Group; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const [name, setName] = useState(group?.name ?? '')
  const [organization, setOrganization] = useState(group?.organization ?? '')
  const [mode, setMode] = useState<'manual' | 'import'>('manual')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())
  const [sheet, setSheet] = useState<EmployeeSheet | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [sheetError, setSheetError] = useState('')
  const [readingSheet, setReadingSheet] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const employees = data.people.filter((person) => person.role === 'Participant' && person.status === 'Active' && (!employeeSearch || `${person.name} ${person.email} ${person.department} ${person.organization ?? ''}`.toLowerCase().includes(employeeSearch.toLowerCase())))
  const duplicateName = data.groups.some((item) => item.id !== group?.id && item.name.trim().toLowerCase() === name.trim().toLowerCase())
  const existingImportedCount = sheet?.employees.filter((employee) => data.people.some((person) => person.email.toLowerCase() === employee.email)).length ?? 0
  const newImportedCount = (sheet?.employees.length ?? 0) - existingImportedCount
  const memberCount = group ? 0 : mode === 'manual' ? selectedEmployeeIds.size : sheet?.employees.length ?? 0
  const valid = !!name.trim() && !!organization.trim() && !duplicateName && (!!group || memberCount > 0)
  const formHint = duplicateName
    ? 'A group with this name already exists.'
    : !name.trim()
      ? 'Enter a group name to continue.'
      : !organization.trim()
        ? 'Enter the organization name to continue.'
        : !group && memberCount === 0
          ? mode === 'manual' ? 'Select at least one employee.' : 'Upload a spreadsheet with valid email addresses.'
          : ''

  const readSheet = async (file?: File) => {
    if (!file) return
    setReadingSheet(true)
    setSheetError('')
    setSheet(null)
    try {
      const parsed = await parseEmployeeSheet(file)
      setSheet(parsed)
      setSheetName(file.name)
    } catch (error) {
      setSheetName('')
      setSheetError(error instanceof Error ? error.message : 'The spreadsheet could not be read.')
    } finally {
      setReadingSheet(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = () => {
    const next: Group = {
      id: group?.id ?? uid('g'),
      name: name.trim(),
      organization: organization.trim(),
      description: group?.description ?? '',
      createdAt: group ? group.createdAt : todayISO(),
      createdBy: group ? group.createdBy : user.name,
    }
    const imported = !group && mode === 'import' ? sheet?.employees ?? [] : []
    const selectedIds = !group && mode === 'manual' ? selectedEmployeeIds : new Set<string>()
    const importedByEmail = new Map(imported.map((employee) => [employee.email, employee]))
    const additions = mode === 'import' ? imported.length : selectedIds.size
    update((d) => {
      const existingEmails = new Set(d.people.map((person) => person.email.toLowerCase()))
      const newPeople: Person[] = imported
        .filter((employee) => !existingEmails.has(employee.email))
        .map((employee) => ({
          id: uid('u'),
          name: employee.name || employeeNameFromEmail(employee.email),
          email: employee.email,
          phone: '',
          role: 'Participant',
          status: 'Active',
          department: employee.department,
          designation: employee.designation || undefined,
          organization: next.organization,
          groupIds: [next.id],
          createdAt: todayISO(),
          createdBy: user.name,
        }))
      const people = d.people.map((person) => {
        const employee = importedByEmail.get(person.email.toLowerCase())
        const shouldJoin = selectedIds.has(person.id) || !!employee
        if (!shouldJoin) return person
        return {
          ...person,
          groupIds: person.groupIds.includes(next.id) ? person.groupIds : [...person.groupIds, next.id],
          ...(selectedIds.has(person.id) ? { organization: person.organization || next.organization } : {}),
          ...(employee ? {
            department: person.department || employee.department,
            designation: person.designation || employee.designation || undefined,
            organization: person.organization || next.organization,
          } : {}),
        }
      })
      return {
        ...d,
        groups: group ? d.groups.map((item) => item.id === group.id ? next : item) : [...d.groups, next],
        people: [...newPeople, ...people],
      }
    }, {
      action: group ? 'Updated group' : 'Created group',
      target: next.name,
      ...(additions ? { remarks: `${additions} employee${additions === 1 ? '' : 's'} ${mode === 'import' ? `imported from ${sheetName}` : 'added manually'}` } : {}),
      ...(group ? { changes: [
        { field: 'Name', from: group.name, to: next.name },
        { field: 'Organization', from: group.organization ?? '', to: next.organization ?? '' },
      ] } : {}),
    })
    onClose()
  }

  const toggleEmployee = (id: string) => setSelectedEmployeeIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? 'Edit group' : 'Create Group'}
      description={group ? 'Update the group name and organization.' : 'Set up an organization group and add employees manually or from a spreadsheet.'}
      wide
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">{formHint}</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || readingSheet} onClick={save}>
            {group ? 'Save changes' : 'Create Group'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {!group && (
          <TabBar className="mb-0 w-full">
            <Tabs value={mode} onChange={setMode} items={[{ value: 'manual', label: 'Manual' }, { value: 'import', label: 'Import Excel' }]} label="Add group employees" />
          </TabBar>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Group name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Call Center — November" autoFocus />
            {duplicateName && <span className="mt-1 block text-xs text-brand-600">A group with this name already exists.</span>}
          </Field>
          <Field label="Organization name">
            <Input required value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. ISON Africa" />
          </Field>
        </div>

        {!group && (
          <>
            {mode === 'manual' ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Choose employees</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">Select active employees already in the training portal.</p>
                  </div>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{selectedEmployeeIds.size} selected</span>
                </div>
                <SearchInput value={employeeSearch} onChange={setEmployeeSearch} placeholder="Search employees by name, email or department" className="w-full" />
                <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
                  {employees.map((person) => (
                    <label key={person.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-zinc-50">
                      <input type="checkbox" checked={selectedEmployeeIds.has(person.id)} onChange={() => toggleEmployee(person.id)} className="size-4 accent-brand-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900">{person.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{person.email}{person.department ? ` · ${person.department}` : ''}</span>
                      </span>
                      {person.organization && <span className="hidden max-w-32 truncate text-xs text-zinc-500 sm:block">{person.organization}</span>}
                    </label>
                  ))}
                  {!employees.length && <Empty compact icon={Users} title="No employees found" text={employeeSearch ? 'Try a different search.' : 'Add employees in Users first.'} />}
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Import employees from Excel</h3>
                  </div>
                  <Button size="sm" onClick={downloadEmployeeTemplate}><Download className="size-3.5" /> Download template</Button>
                </div>

                <div>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => void readSheet(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={readingSheet} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60">
                      <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">{readingSheet ? <FileSpreadsheet className="size-4 animate-pulse" /> : <Upload className="size-4" />}</span>
                      <span className="text-sm font-semibold text-zinc-800">{readingSheet ? 'Reading spreadsheet…' : sheetName || 'Choose an Excel or CSV file'}</span>
                      <span className="text-xs text-zinc-500">.xlsx, .xls or .csv · first worksheet used</span>
                    </button>
                    {sheetError && <p role="alert" className="mt-2 text-xs font-medium text-brand-700">{sheetError}</p>}
                    {sheet && (
                      <div className="mt-3 rounded-xl border border-mpesa-500/25 bg-mpesa-500/5 p-3 text-xs">
                        <p className="flex items-center gap-1.5 font-semibold text-mpesa-700"><Check className="size-3.5" /> {sheet.employees.length} valid email{sheet.employees.length === 1 ? '' : 's'} found</p>
                        <p className="mt-1 text-zinc-600">{existingImportedCount} existing · {newImportedCount} new profile{newImportedCount === 1 ? '' : 's'} · {sheet.duplicateRows} duplicate{sheet.duplicateRows === 1 ? '' : 's'} skipped</p>
                        {!!sheet.invalidRows && <p className="mt-1 text-amber-700">{sheet.invalidRows} row{sheet.invalidRows === 1 ? '' : 's'} skipped because the email is missing or invalid.</p>}
                      </div>
                    )}
                </div>

                {sheet && (
                  <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between gap-2 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
                      <span>Import preview</span><span>{sheet.employees.length} employees</span>
                    </div>
                    <div className="max-h-40 divide-y divide-zinc-100 overflow-y-auto">
                      {sheet.employees.slice(0, 6).map((employee) => (
                        <div key={employee.email} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{employee.name || employeeNameFromEmail(employee.email)}</span>
                          <span className="min-w-0 flex-1 truncate text-zinc-500">{employee.email}</span>
                          <span className="hidden max-w-40 truncate text-zinc-500 md:block">{employee.department || employee.designation || '—'}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', data.people.some((person) => person.email.toLowerCase() === employee.email) ? 'bg-zinc-100 text-zinc-600' : 'bg-mpesa-500/10 text-mpesa-700')}>
                            {data.people.some((person) => person.email.toLowerCase() === employee.email) ? 'EXISTING' : 'NEW'}
                          </span>
                        </div>
                      ))}
                      {sheet.employees.length > 6 && <p className="px-3 py-2 text-[11px] text-zinc-500">And {sheet.employees.length - 6} more employees…</p>}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function GroupMembersModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const { data, update } = useAdmin()
  const [q, setQ] = useState('')
  const members = data.people.filter((p) => p.groupIds.includes(group.id))
  const createdLog = data.auditLogs.find((log) => log.action === 'Created group' && (log.entityId === group.id || log.target === group.name))
  const createdBy = group.createdBy ?? createdLog?.actor
  const createdAt = group.createdAt ?? createdLog?.at
  const others = data.people.filter((p) => !p.groupIds.includes(group.id) && p.role === 'Participant' && (!q || `${p.name} ${p.email} ${p.department}`.toLowerCase().includes(q.toLowerCase())))
  const [paste, setPaste] = useState('')
  const [pasteResult, setPasteResult] = useState<string | null>(null)

  const addMany = (list: Person[], label: string) => {
    if (!list.length) return
    const ids = new Set(list.map((p) => p.id))
    update(
      (d) => ({ ...d, people: d.people.map((x) => (ids.has(x.id) && !x.groupIds.includes(group.id) ? { ...x, groupIds: [...x.groupIds, group.id] } : x)) }),
      { action: `Added ${list.length} ${list.length === 1 ? 'person' : 'people'} to group (${label})`, target: group.name },
    )
  }

  const addPasted = () => {
    const emails = [...new Set(paste.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
    const found = emails.map((e) => data.people.find((p) => p.email.toLowerCase() === e)).filter((p): p is Person => !!p)
    const unknown = emails.filter((e) => !data.people.some((p) => p.email.toLowerCase() === e))
    addMany(found.filter((p) => !p.groupIds.includes(group.id)), 'pasted list')
    setPasteResult(`${found.length} matched${unknown.length ? ` · not found: ${unknown.slice(0, 3).join(', ')}${unknown.length > 3 ? ` +${unknown.length - 3} more` : ''}` : ''}`)
    if (!unknown.length) setPaste('')
  }

  const setMember = (p: Person, on: boolean) =>
    update(
      (d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, groupIds: on ? [...x.groupIds, group.id] : x.groupIds.filter((g) => g !== group.id) } : x)) }),
      { action: on ? `Added ${p.name} to group` : `Removed ${p.name} from group`, target: group.name },
    )

  return (
    <Modal open onClose={onClose} title={group.name} description={`${group.organization ? `${group.organization} · ` : ''}${members.length} members`} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-3">
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Created by</p><p className="mt-1 text-sm text-zinc-800">{createdBy || '—'}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Created at</p><p className="mt-1 text-sm text-zinc-800">{createdAt ? shortDate(createdAt) : '—'}</p></div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Members ({members.length})</p>
          <ul className="max-h-[min(60vh,520px)] divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
            {members.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900">{p.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                </span>
                <button onClick={() => setMember(p, false)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600" aria-label={`Remove ${p.name}`}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
            {!members.length && (
              <li>
                <Empty compact icon={Users} title="No members yet" />
              </li>
            )}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Add people ({others.length})</p>
          <div className="flex gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, email or department" className="flex-1" />
            <Button size="sm" disabled={!others.length} onClick={() => addMany(others, q ? `matching “${q}”` : 'all')}>
              Add all {others.length}
            </Button>
          </div>
          <ul className="mt-2 max-h-[min(50vh,440px)] divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-900">{p.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                </span>
                <Button size="sm" onClick={() => setMember(p, true)}>
                  Add
                </Button>
              </li>
            ))}
            {!others.length && (
              <li>
                <Empty compact icon={UserCheck} title="Everyone is already in" />
              </li>
            )}
          </ul>
          <div className="mt-4">
            <Field label="Or paste emails" hint="Separate with commas, spaces or new lines.">
              <Textarea rows={2} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="awet.gebrehiwet@partner.safaricom.et, …" />
            </Field>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">{pasteResult}</span>
              <Button size="sm" disabled={!paste.trim()} onClick={addPasted}>
                Add pasted
              </Button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Modal>
  )
}

export function AdminGroups() {
  const { data } = useAdmin()
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [managing, setManaging] = useState<Group | null>(null)

  return (
    <>
      <PageHeader
        title="Groups"
        description="Organise users so you can invite whole teams at once."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New group
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.groups.map((g) => {
          const members = data.people.filter((p) => p.groupIds.includes(g.id))
          const createdLog = data.auditLogs.find((log) => log.action === 'Created group' && (log.entityId === g.id || log.target === g.name))
          const createdBy = g.createdBy ?? createdLog?.actor
          const createdAt = g.createdAt ?? createdLog?.at
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <UserRoundPlus className="size-5" />
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                  Edit
                </Button>
              </div>
              <h3 className="mt-3 font-bold text-zinc-900">{g.name}</h3>
              <p className="mt-1 flex-1 text-sm font-medium text-zinc-700">{g.organization || 'Organization not set'}</p>
              {g.description && <p className="mt-1 text-xs text-zinc-500">{g.description}</p>}
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3">
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Created by</p><p className="mt-0.5 truncate text-xs text-zinc-700">{createdBy || '—'}</p></div>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Created at</p><p className="mt-0.5 truncate text-xs text-zinc-700">{createdAt ? shortDate(createdAt) : '—'}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((m) => (
                    <span key={m.id} className="rounded-full ring-2 ring-surface">
                      <Avatar name={m.name} size="sm" />
                    </span>
                  ))}
                  {members.length > 5 && <span className="grid size-7 place-items-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700 ring-2 ring-surface">+{members.length - 5}</span>}
                </div>
                <Button size="sm" onClick={() => setManaging(g)}>
                  {members.length} members
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
      {editing && <GroupModal group={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {managing && <GroupMembersModal group={data.groups.find((g) => g.id === managing.id) ?? managing} onClose={() => setManaging(null)} />}
    </>
  )
}
