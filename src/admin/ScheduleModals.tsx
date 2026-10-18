import { AlertTriangle, Ban, CalendarClock, Mail, UserCog, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { cn, localISO, todayISO } from '../lib/utils'
import { dateTime, shortDate, time12 } from './helpers'
import { CHANGE_REASONS, findConflicts, type Conflict } from './scheduling'
import { useAdmin } from './store'
import type { AdminData, AdminTraining, TrainingEvent } from './types'
import { Avatar, Button, Card, CardTitle, Field, Input, Modal, SearchInput, Select, Textarea } from './ui'

/** Reason dropdown with a custom box for "Other" (URS 2.3: "selected from dropdown or custom"). */
function useReason() {
  const [choice, setChoice] = useState('')
  const [custom, setCustom] = useState('')
  const reason = choice === 'Other' ? custom.trim() : choice
  const ui = (
    <div className="space-y-2">
      <Field label="Reason">
        <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose a reason…</option>
          {CHANGE_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      {choice === 'Other' && <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Describe the reason" autoFocus aria-label="Custom reason" />}
    </div>
  )
  return { reason, ui }
}

/** Sessions in the same series from this one onwards (for "this and following" changes). */
const seriesFrom = (data: AdminData, t: AdminTraining) =>
  t.seriesId ? data.trainings.filter((x) => x.seriesId === t.seriesId && x.date >= t.date && x.status !== 'CANCELLED') : [t]

function ScopePicker({ training, value, onChange, count }: { training: AdminTraining; value: 'one' | 'series'; onChange: (v: 'one' | 'series') => void; count: number }) {
  if (!training.seriesId || count < 2) return null
  return (
    <fieldset className="space-y-2 rounded-xl border border-zinc-200 p-3">
      <legend className="px-1 text-xs font-medium text-zinc-500">This session is part of a series</legend>
      {(
        [
          ['one', 'Only this session'],
          ['series', `This and the following ${count - 1} session${count === 2 ? '' : 's'}`],
        ] as const
      ).map(([v, label]) => (
        <label key={v} className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="radio" name="scope" checked={value === v} onChange={() => onChange(v)} className="accent-brand-600" /> {label}
        </label>
      ))}
    </fieldset>
  )
}

export function ConflictList({ conflicts, data, trainerId }: { conflicts: Conflict[]; data: AdminData; trainerId: string }) {
  if (!conflicts.length) return null
  return (
    <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" /> {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'} at this time
      </p>
      <ul className="space-y-1 pl-6">
        {conflicts.map((c, i) => (
          <li key={i} className="list-disc">
            {c.kind === 'trainer'
              ? `${data.people.find((p) => p.id === trainerId)?.name ?? 'The trainer'} is running “${c.training.name}” (${time12(c.training.startTime)}–${time12(c.training.endTime)}).`
              : `${c.people.length} trainee${c.people.length === 1 ? ' is' : 's are'} also in “${c.training.name}”: ${c.people.slice(0, 3).map((p) => p.name).join(', ')}${c.people.length > 3 ? '…' : ''}.`}
          </li>
        ))}
      </ul>
    </div>
  )
}

const notifyCount = (t: AdminTraining) => t.participantIds.length + (t.trainerId ? 1 : 0)

export function RescheduleModal({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const { reason, ui } = useReason()
  const following = seriesFrom(data, training)
  const [scope, setScope] = useState<'one' | 'series'>('one')
  const [f, setF] = useState({ date: training.date, startTime: training.startTime, endTime: training.endTime, location: training.location })
  const online = training.location === 'ONLINE'
  const dateShift = Math.round((new Date(`${f.date}T00:00`).getTime() - new Date(`${training.date}T00:00`).getTime()) / 86_400_000)
  const conflicts = findConflicts({ id: training.id, date: f.date, startTime: f.startTime, endTime: f.endTime, trainerId: training.trainerId, participantIds: training.participantIds }, data.trainings, data.people)
  const changed = f.date !== training.date || f.startTime !== training.startTime || f.endTime !== training.endTime || f.location !== training.location
  const errors = [
    !changed && 'Change the date, time or location.',
    f.date < todayISO() && 'The new date can’t be in the past.',
    f.startTime >= f.endTime && 'End time must be after the start time.',
    !online && !f.location.trim() && 'Enter a location.',
    !reason && 'Choose a reason.',
  ].filter(Boolean) as string[]

  const save = () => {
    const targets = scope === 'series' ? following : [training]
    const at = localISO()
    const shift = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number)
      const x = new Date(y, m - 1, d + dateShift)
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    const ids = new Set(targets.map((t) => t.id))
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) => {
          if (!ids.has(t.id)) return t
          const next = { ...t, date: t.id === training.id ? f.date : shift(t.date), startTime: f.startTime, endTime: f.endTime, location: online ? t.location : f.location.trim() }
          const ev: TrainingEvent = { at, by: 'Training team', action: 'Rescheduled', reason, detail: `${shortDate(t.date)} ${time12(t.startTime)} → ${shortDate(next.date)} ${time12(next.startTime)}` }
          return { ...next, history: [...(t.history ?? []), ev] }
        }),
      }),
      {
        action: `Rescheduled ${targets.length > 1 ? `${targets.length} sessions` : 'session'} (${reason})`,
        target: training.name,
        silent: true,
        changes: [
          { field: 'Date', from: training.date, to: f.date },
          { field: 'Time', from: `${training.startTime}–${training.endTime}`, to: `${f.startTime}–${f.endTime}` },
          { field: 'Location', from: training.location, to: online ? training.location : f.location.trim() },
        ],
      },
    )
    toast(`Rescheduled — ${notifyCount(training)} people will be notified`, { action: undefined })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule"
      description="Trainer and participants are notified of the new time. The change is kept in the schedule history."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={errors.length > 0} onClick={save} title={errors[0]}>
            <CalendarClock className="size-4" /> {conflicts.length ? 'Reschedule anyway' : 'Reschedule'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ScopePicker training={training} value={scope} onChange={setScope} count={following.length} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="New date">
            <Input type="date" min={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Start">
            <Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
          </Field>
          <Field label="End">
            <Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
          </Field>
        </div>
        {!online && (
          <Field label="Location">
            <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
        )}
        {scope === 'series' && dateShift !== 0 && <p className="text-xs text-zinc-500">Following sessions move by {dateShift > 0 ? '+' : ''}{dateShift} day{Math.abs(dateShift) === 1 ? '' : 's'} as well.</p>}
        {ui}
        <ConflictList conflicts={conflicts} data={data} trainerId={training.trainerId} />
        {errors.length > 0 && errors[0] !== 'Choose a reason.' && changed && <p className="text-xs text-brand-600">{errors[0]}</p>}
      </div>
    </Modal>
  )
}

export function CancelModal({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const { reason, ui } = useReason()
  const following = seriesFrom(data, training)
  const [scope, setScope] = useState<'one' | 'series'>('one')

  const cancel = () => {
    const targets = scope === 'series' ? following : [training]
    const ids = new Set(targets.map((t) => t.id))
    const at = localISO()
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) => (ids.has(t.id) ? { ...t, status: 'CANCELLED', history: [...(t.history ?? []), { at, by: 'Training team', action: 'Cancelled', reason }] } : t)),
      }),
      { action: `Cancelled ${targets.length > 1 ? `${targets.length} sessions` : 'session'} (${reason})`, target: training.name, silent: true },
    )
    toast(`Cancelled — ${notifyCount(training)} people will be notified`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel training"
      description="Everyone invited is notified. The session stays on record as cancelled."
      footer={
        <>
          <Button onClick={onClose}>Keep it</Button>
          <Button variant="danger" disabled={!reason} onClick={cancel}>
            <Ban className="size-4" /> Cancel {scope === 'series' ? `${following.length} sessions` : 'session'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-700">
          <span className="font-semibold">{training.name}</span> · {shortDate(training.date)}, {time12(training.startTime)}
        </p>
        <ScopePicker training={training} value={scope} onChange={setScope} count={following.length} />
        {ui}
      </div>
    </Modal>
  )
}

/** Hand the session to another trainer with a reason (URS 2.3 delegation). */
export function ChangeTrainerModal({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const { reason, ui } = useReason()
  const trainers = data.people.filter((p) => p.role === 'Trainer' && p.status === 'Active' && p.id !== training.trainerId)
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? '')
  const following = seriesFrom(data, training)
  const [scope, setScope] = useState<'one' | 'series'>('one')
  const conflicts = trainerId ? findConflicts({ id: training.id, date: training.date, startTime: training.startTime, endTime: training.endTime, trainerId, participantIds: [] }, data.trainings, data.people) : []
  const from = data.people.find((p) => p.id === training.trainerId)?.name ?? 'Unassigned'
  const to = data.people.find((p) => p.id === trainerId)?.name ?? ''

  const save = () => {
    const ids = new Set((scope === 'series' ? following : [training]).map((t) => t.id))
    const at = localISO()
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) => (ids.has(t.id) ? { ...t, trainerId, history: [...(t.history ?? []), { at, by: 'Training team', action: 'Trainer changed', reason, detail: `${from} → ${to}` }] } : t)),
      }),
      { action: `Delegated to ${to} (${reason})`, target: training.name, silent: true, changes: [{ field: 'Trainer', from, to }] },
    )
    toast(`${to} now runs this training — both trainers are notified`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change trainer"
      description={`Currently ${from}.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!trainerId || !reason} onClick={save}>
            <UserCog className="size-4" /> Change trainer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ScopePicker training={training} value={scope} onChange={setScope} count={following.length} />
        <Field label="New trainer">
          <Select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.department}
              </option>
            ))}
          </Select>
        </Field>
        {ui}
        <ConflictList conflicts={conflicts} data={data} trainerId={trainerId} />
      </div>
    </Modal>
  )
}

/** Add people individually or by group; optionally email them the invite (TR-2.4, URS 2.3). */
export function InviteModal({ training, onClose, onInviteNew }: { training: AdminTraining; onClose: () => void; onInviteNew?: () => void }) {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState('')
  const candidates = data.people.filter((p) => p.role === 'Participant' && p.status === 'Active' && !training.participantIds.includes(p.id))
  const visible = candidates.filter((p) => !q || `${p.name} ${p.email} ${p.department}`.toLowerCase().includes(q.toLowerCase()))
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  // People already booked elsewhere at this time.
  const busy = new Map(
    findConflicts({ id: training.id, date: training.date, startTime: training.startTime, endTime: training.endTime, trainerId: '', participantIds: candidates.map((c) => c.id) }, data.trainings, data.people).flatMap((c) =>
      c.people.map((p) => [p.id, c.training.name] as const),
    ),
  )

  const invite = () => {
    const at = localISO()
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) =>
          t.id === training.id
            ? { ...t, participantIds: [...t.participantIds, ...selected], history: [...(t.history ?? []), { at, by: 'Training team', action: 'Invited', detail: `${selected.length} participant${selected.length === 1 ? '' : 's'}${notify ? ' · email sent' : ''}` }] }
            : t,
        ),
      }),
      { action: `Invited ${selected.length} participant${selected.length === 1 ? '' : 's'}`, target: training.name, silent: true },
    )
    toast(notify ? `Invited ${selected.length} · invitation emails queued` : `Added ${selected.length} without emailing`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite participants"
      description={`${training.participantIds.length} already invited`}
      footer={
        <>
          {onInviteNew && (
            <Button variant="ghost" className="mr-auto" onClick={onInviteNew}>
              Invite someone new…
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selected.length} onClick={invite}>
            <UserPlus className="size-4" /> Invite {selected.length || ''}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-zinc-500">Add a group:</span>
          {data.groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected((s) => [...new Set([...s, ...candidates.filter((p) => p.groupIds.includes(g.id)).map((p) => p.id)])])}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
            >
              + {g.name}
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, email or department" />
        <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 scrollbar-thin">
          {visible.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-brand-600" />
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">{p.name}</span>
                  <span className={cn('block truncate text-xs', busy.has(p.id) ? 'text-amber-700' : 'text-zinc-500')}>{busy.has(p.id) ? `Busy: ${busy.get(p.id)}` : p.email}</span>
                </span>
                <span className="text-xs text-zinc-500">{p.department}</span>
              </label>
            </li>
          ))}
          {!visible.length && <li className="p-6 text-center text-sm text-zinc-500">Everyone matching is already invited.</li>}
        </ul>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-brand-600" />
          <Mail className="size-4 text-zinc-500" /> Email the invitation (internal teams by group email, others individually)
        </label>
        {notify && <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional note to include in the email" aria-label="Invitation note" />}
      </div>
    </Modal>
  )
}

const actionTone: Record<TrainingEvent['action'], string> = {
  Created: 'bg-zinc-400',
  Rescheduled: 'bg-amber-500',
  Cancelled: 'bg-brand-600',
  'Trainer changed': 'bg-zinc-700',
  Invited: 'bg-mpesa-500',
}

/** Retained reschedule / cancellation / delegation history (URS 2.3). */
export function ScheduleHistory({ training }: { training: AdminTraining }) {
  const events = [...(training.history ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Card>
      <CardTitle>Schedule history</CardTitle>
      {events.length ? (
        <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span className={cn('absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-surface', actionTone[e.action])} />
              <p className="text-sm text-zinc-800">
                <span className="font-semibold">{e.action}</span>
                {e.detail && <span className="text-zinc-600"> · {e.detail}</span>}
              </p>
              {e.reason && <p className="text-xs text-zinc-600">Reason: {e.reason}</p>}
              <p className="text-xs text-zinc-400">
                {dateTime(e.at)} · {e.by}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-zinc-500">No changes recorded.</p>
      )}
    </Card>
  )
}
