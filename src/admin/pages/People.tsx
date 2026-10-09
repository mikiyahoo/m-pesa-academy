import { Download, MoreHorizontal, Plus, UserRoundPlus, Users as UsersIcon, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { shortDate } from '../helpers'
import { uid, useAdmin } from '../store'
import type { AdminUserRole, Group, Person } from '../types'
import { Avatar, Badge, Button, Card, downloadCsv, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Table, Tabs, Textarea } from '../ui'

/* ----------------------------------- Users ----------------------------------- */

type RoleFilter = 'ALL' | AdminUserRole
const PAGE_SIZE = 10

function UserModal({ person, onClose }: { person?: Person; onClose: () => void }) {
  const { data, update } = useAdmin()
  const [form, setForm] = useState({
    name: person?.name ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    role: person?.role ?? ('Participant' as AdminUserRole),
    department: person?.department ?? '',
    groupIds: person?.groupIds ?? [],
  })
  const emailTaken = data.people.some((p) => p.email.toLowerCase() === form.email.trim().toLowerCase() && p.id !== person?.id)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const valid = form.name.trim() && emailValid && !emailTaken

  const save = () => {
    const next: Person = {
      id: person?.id ?? uid('u'),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      role: form.role,
      department: form.department.trim(),
      groupIds: form.groupIds,
      status: person?.status ?? 'Active',
      createdAt: person?.createdAt ?? new Date().toISOString().slice(0, 10),
    }
    update((d) => ({ ...d, people: person ? d.people.map((p) => (p.id === person.id ? next : p)) : [next, ...d.people] }), {
      action: person ? 'Updated user' : 'Added user',
      target: next.name,
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

export function AdminUsers() {
  const { data, update } = useAdmin()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [menu, setMenu] = useState<string | null>(null)

  const filtered = data.people.filter(
    (p) => (role === 'ALL' || p.role === role) && (!q || `${p.name} ${p.email} ${p.department}`.toLowerCase().includes(q.toLowerCase())),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  const count = (r: RoleFilter) => (r === 'ALL' ? data.people.length : data.people.filter((p) => p.role === r).length)

  const toggleStatus = (p: Person) => {
    const status = p.status === 'Active' ? 'Inactive' : 'Active'
    update((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, status } : x)) }), {
      action: status === 'Active' ? 'Activated user' : 'Deactivated user',
      target: p.name,
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
            <Button onClick={() => downloadCsv('users.csv', ['Name', 'Email', 'Phone', 'Role', 'Department', 'Status'], filtered.map((p) => [p.name, p.email, p.phone, p.role, p.department, p.status]))}>
              <Download className="size-4" /> Export
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add user
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<RoleFilter>
          value={role}
          onChange={(r) => {
            setRole(r)
            setPage(0)
          }}
          items={(['ALL', 'Participant', 'Trainer', 'Admin'] as RoleFilter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : `${v}s`, count: count(v) }))}
        />
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(0)
          }}
          placeholder="Search name, email, department…"
          className="w-full sm:w-72"
        />
      </div>

      {rows.length ? (
        <Table head={['Name', 'Role', 'Department', 'Groups', 'Status', 'Joined', '']}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-900">{p.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={p.role === 'Admin' ? 'red' : p.role === 'Trainer' ? 'blue' : 'zinc'}>{p.role.toUpperCase()}</Badge>
              </td>
              <td className="px-4 py-3 text-zinc-600">{p.department || '—'}</td>
              <td className="px-4 py-3 text-xs text-zinc-600">{p.groupIds.map((g) => data.groups.find((x) => x.id === g)?.name).filter(Boolean).join(', ') || '—'}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5 text-xs text-zinc-700">
                  <span className={cn('size-1.5 rounded-full', p.status === 'Active' ? 'bg-mpesa-500' : 'bg-zinc-400')} />
                  {p.status}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(p.createdAt)}</td>
              <td className="relative px-4 py-3 text-right">
                <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Actions for ${p.name}`}>
                  <MoreHorizontal className="size-4" />
                </button>
                {menu === p.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                    <div className="absolute right-4 z-20 mt-1 w-40 rounded-xl border border-zinc-200 bg-surface p-1 text-left text-sm shadow-lg">
                      <button
                        onClick={() => {
                          setEditing(p)
                          setMenu(null)
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100"
                      >
                        Edit
                      </button>
                      <button onClick={() => toggleStatus(p)} className="w-full rounded-lg px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100">
                        {p.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Card>
          <Empty icon={UsersIcon} title="No users match" text="Try a different search or role." />
        </Card>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            Showing {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <Button size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {editing && <UserModal person={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/* ----------------------------------- Groups ---------------------------------- */

function GroupModal({ group, onClose }: { group?: Group; onClose: () => void }) {
  const { update } = useAdmin()
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const save = () => {
    const next = { id: group?.id ?? uid('g'), name: name.trim(), description: description.trim() }
    update((d) => ({ ...d, groups: group ? d.groups.map((g) => (g.id === group.id ? next : g)) : [...d.groups, next] }), {
      action: group ? 'Updated group' : 'Created group',
      target: next.name,
    })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={group ? 'Edit group' : 'New group'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function GroupMembersModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const { data, update } = useAdmin()
  const [q, setQ] = useState('')
  const members = data.people.filter((p) => p.groupIds.includes(group.id))
  const others = data.people.filter((p) => !p.groupIds.includes(group.id) && p.role === 'Participant' && (!q || p.name.toLowerCase().includes(q.toLowerCase())))

  const setMember = (p: Person, on: boolean) =>
    update(
      (d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, groupIds: on ? [...x.groupIds, group.id] : x.groupIds.filter((g) => g !== group.id) } : x)) }),
      { action: on ? `Added ${p.name} to group` : `Removed ${p.name} from group`, target: group.name },
    )

  return (
    <Modal open onClose={onClose} title={group.name} description={`${members.length} members`} wide>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Members</p>
          <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 scrollbar-thin">
            {members.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">{p.name}</span>
                <button onClick={() => setMember(p, false)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600" aria-label={`Remove ${p.name}`}>
                  <X className="size-4" />
                </button>
              </li>
            ))}
            {!members.length && <li className="p-6 text-center text-sm text-zinc-500">No members yet.</li>}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Add people</p>
          <SearchInput value={q} onChange={setQ} placeholder="Search participants" />
          <ul className="mt-2 max-h-[276px] divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 scrollbar-thin">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">{p.name}</span>
                <Button size="sm" onClick={() => setMember(p, true)}>
                  Add
                </Button>
              </li>
            ))}
            {!others.length && <li className="p-6 text-center text-sm text-zinc-500">No one else to add.</li>}
          </ul>
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
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <UserRoundPlus className="size-5" />
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                  Edit
                </Button>
              </div>
              <h3 className="mt-3 font-semibold text-zinc-900">{g.name}</h3>
              <p className="mt-1 flex-1 text-sm text-zinc-500">{g.description || 'No description.'}</p>
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
