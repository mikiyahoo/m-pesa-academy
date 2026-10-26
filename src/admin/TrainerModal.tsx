import { Check, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { cn, todayISO } from '../lib/utils'
import { uid, useAdmin } from './store'
import type { Person } from './types'
import { useAuth } from '../store/Auth'
import { useFeedback } from '../components/Feedback'
import { Avatar, Button, Field, Input, Modal, SearchInput, Tabs } from './ui'

export const ADD_TRAINER_OPTION = '__add_new_trainer__'

export function AddTrainerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (trainerId: string) => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const { confirm } = useFeedback()
  const existingStaff = data.people.filter((person) => person.role === 'Participant' && person.status === 'Active')
  const [mode, setMode] = useState<'existing' | 'new'>(existingStaff.length ? 'existing' : 'new')
  const [staffSearch, setStaffSearch] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [designation, setDesignation] = useState('')
  const [phone, setPhone] = useState('')

  const normalizedEmail = email.trim().toLowerCase()
  const emailTaken = data.people.some((person) => person.email.toLowerCase() === normalizedEmail)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  const valid = mode === 'existing' ? !!existingStaff.find((person) => person.id === selectedStaffId) : !!name.trim() && !!department.trim() && emailValid && !emailTaken
  const visibleStaff = existingStaff.filter((person) => `${person.name} ${person.email} ${person.department}`.toLowerCase().includes(staffSearch.trim().toLowerCase()))

  const assignExistingStaff = async () => {
    const person = existingStaff.find((item) => item.id === selectedStaffId)
    if (!person) return
    if (!(await confirm({
      title: `Assign ${person.name} as a trainer?`,
      message: `This changes ${person.name}’s portal role from Participant to Trainer. Their existing training records will be kept.`,
      confirmLabel: 'Assign as trainer',
    }))) return

    update(
      (d) => ({ ...d, people: d.people.map((item) => item.id === person.id ? { ...item, role: 'Trainer' } : item) }),
      { action: 'Assigned staff member as trainer', target: person.name, changes: [{ field: 'Role', from: person.role, to: 'Trainer' }] },
    )
    onCreated(person.id)
    onClose()
  }

  const save = () => {
    if (!valid) return
    const trainer: Person = {
      id: uid('u'),
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      role: 'Trainer',
      status: 'Active',
      department: department.trim(),
      designation: designation.trim() || undefined,
      groupIds: [],
      createdAt: todayISO(),
      createdBy: user.name,
    }
    update((d) => ({ ...d, people: [trainer, ...d.people] }), { action: 'Added trainer', target: trainer.name })
    onCreated(trainer.id)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add trainer"
      description="Select an existing staff account or create a new trainer profile."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={mode === 'existing' ? () => void assignExistingStaff() : save}>
            <UserPlus className="size-4" /> {mode === 'existing' ? 'Assign trainer' : 'Add trainer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs value={mode} onChange={setMode} items={[{ value: 'existing', label: 'Staff email list' }, { value: 'new', label: 'New trainer' }]} label="Trainer source" />
        {mode === 'existing' ? (
          <div className="space-y-3">
            <SearchInput value={staffSearch} onChange={setStaffSearch} placeholder="Search staff by name, email or department" className="w-full" />
            <div className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200">
              {visibleStaff.map((person) => {
                const selected = selectedStaffId === person.id
                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedStaffId(person.id)}
                    className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition', selected ? 'bg-brand-50/70' : 'hover:bg-zinc-50')}
                  >
                    <Avatar name={person.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{person.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{person.email}{person.department ? ` · ${person.department}` : ''}</span>
                    </span>
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300 text-transparent')}>
                      <Check className="size-3" />
                    </span>
                  </button>
                )
              })}
              {!visibleStaff.length && <p className="px-3 py-6 text-center text-sm text-zinc-500">No active staff accounts match that search.</p>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Trainer name" />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
              {email.trim() && !emailValid && <span className="mt-1 block text-xs text-brand-600">Enter a valid email address.</span>}
              {emailTaken && <span className="mt-1 block text-xs text-brand-600">A user with this email already exists.</span>}
            </Field>
            <Field label="Department">
              <Input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Learning & Development" />
            </Field>
            <Field label="Designation (optional)">
              <Input value={designation} onChange={(event) => setDesignation(event.target.value)} placeholder="e.g. Training Specialist" />
            </Field>
            <Field label="Phone (optional)">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XXXXXXXX" />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
