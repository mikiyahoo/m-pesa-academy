import { CalendarDays, GraduationCap, MapPin, Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { todayISO } from '../../lib/utils'
import { shortDate, time12 } from '../helpers'
import { uid, useAdmin } from '../store'
import type { AdminTraining, TrainingStatus } from '../types'
import { Badge, Button, Empty, Field, Input, Modal, PageHeader, SearchInput, Select, Table, Tabs, trainingStatusTone } from '../ui'

type Filter = 'ALL' | TrainingStatus

export function NewTrainingModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { name?: string; journeyId?: string; date?: string } }) {
  const { data, update } = useAdmin()
  const navigate = useNavigate()
  const trainers = data.people.filter((p) => p.role === 'Trainer')
  const [form, setForm] = useState(() => ({
    name: preset?.name ?? '',
    journeyId: preset?.journeyId ?? data.journeys[0]?.id ?? '',
    typeId: data.trainingTypes[0]?.id ?? '',
    trainerId: trainers[0]?.id ?? '',
    date: preset?.date ?? todayISO(),
    startTime: '09:00',
    endTime: '17:00',
    location: '',
    recurring: false,
    groupId: '',
  }))
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const valid = form.name.trim() && form.journeyId && form.date && form.location.trim() && form.startTime < form.endTime

  const create = () => {
    const participantIds = form.groupId ? data.people.filter((p) => p.groupIds.includes(form.groupId) && p.status === 'Active').map((p) => p.id) : []
    const t: AdminTraining = {
      id: uid('t'),
      name: form.name.trim(),
      journeyId: form.journeyId,
      typeId: form.typeId,
      trainerId: form.trainerId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
      recurring: form.recurring,
      status: 'SCHEDULED',
      participantIds,
      feedbackFormId: data.feedbackForms[0]?.id,
      progress: {},
    }
    update((d) => ({ ...d, trainings: [t, ...d.trainings] }), { action: 'Created training', target: t.name })
    onClose()
    navigate(`/admin/trainings/${t.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New training"
      description="Schedule a training session from a journey."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={create}>
            Create training
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Training name">
            <Input value={form.name} onChange={set('name')} placeholder="e.g. M-PESA Call Center Training-Batch 60" autoFocus />
          </Field>
        </div>
        <Field label="Journey">
          <Select value={form.journeyId} onChange={set('journeyId')}>
            {data.journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Training type">
          <Select value={form.typeId} onChange={set('typeId')}>
            {data.trainingTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trainer">
          <Select value={form.trainerId} onChange={set('trainerId')}>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={set('date')} />
        </Field>
        <Field label="Start time">
          <Input type="time" value={form.startTime} onChange={set('startTime')} />
        </Field>
        <Field label="End time">
          <Input type="time" value={form.endTime} onChange={set('endTime')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Location">
            <Input value={form.location} onChange={set('location')} placeholder="e.g. ISON Office or ONLINE" />
          </Field>
        </div>
        <Field label="Invite group (optional)">
          <Select value={form.groupId} onChange={set('groupId')}>
            <option value="">No group</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700">
          <input type="checkbox" checked={form.recurring} onChange={set('recurring')} className="size-4 accent-brand-600" />
          Recurring training
        </label>
      </div>
      {form.startTime >= form.endTime && <p className="mt-3 text-xs text-brand-600">End time must be after start time.</p>}
    </Modal>
  )
}

export function AdminTrainings() {
  const { data } = useAdmin()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [creating, setCreating] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data.trainings.length }
    data.trainings.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1))
    return c
  }, [data.trainings])

  const rows = data.trainings
    .filter((t) => filter === 'ALL' || t.status === filter)
    .filter((t) => !q || `${t.name} ${t.location}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <PageHeader
        title="Trainings"
        description="Schedule, manage and track every training session."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New training
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={(['ALL', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as Filter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase(), count: counts[v] ?? 0 }))}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search trainings…" className="w-full sm:w-64" />
      </div>
      {rows.length ? (
        <Table head={['Training', 'Journey', 'Date', 'Location', 'Participants', 'Status']}>
          {rows.map((t) => (
            <tr key={t.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <Link to={`/admin/trainings/${t.id}`} className="font-medium text-zinc-900 hover:text-brand-600">
                  {t.name}
                </Link>
                <p className="text-xs text-zinc-500">{data.people.find((p) => p.id === t.trainerId)?.name}</p>
              </td>
              <td className="px-4 py-3 text-zinc-600">{data.journeys.find((j) => j.id === t.journeyId)?.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> {shortDate(t.date)}
                </span>
                <span className="text-xs text-zinc-500">
                  {time12(t.startTime)} – {time12(t.endTime)}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" /> {t.location}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> {t.participantIds.length}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge tone={trainingStatusTone[t.status]}>{t.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300">
          <Empty icon={GraduationCap} title="No trainings found" text="Try another filter or create a new training." />
        </div>
      )}
      {creating && <NewTrainingModal open onClose={() => setCreating(false)} />}
    </>
  )
}
