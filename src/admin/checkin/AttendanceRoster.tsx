import { AlertCircle, Check, Download, FileSpreadsheet, Link2, Save, Search, Upload, UserPlus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { useFeedback } from '../../components/Feedback'
import { cn, localISO } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { EMAIL_RE, parseParticipants } from '../requests'
import { useScope } from '../scope'
import { uid, useAdmin } from '../store'
import type { AdminTraining, Checkin, CheckinMethod, CheckinStatus, Person } from '../types'
import { Avatar, Button, Field, Input, Modal, Select, Textarea } from '../ui'
import { FullPageDialog } from '../Wizard'
import { addCheckin, statusFor } from './checkin'

type Mark = CheckinStatus | 'Absent'

const methodLabel: Record<CheckinMethod, string> = { qr: 'QR scan', link: 'Check-in link', manual: 'Manual', offline: 'Bulk upload' }
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

const markStyle: Record<Mark, { on: string; off: string }> = {
  Present: { on: 'bg-mpesa-600 text-white ring-mpesa-600', off: 'text-mpesa-700 ring-mpesa-500/40 hover:bg-mpesa-500/10' },
  Late: { on: 'bg-amber-500 text-white ring-amber-500', off: 'text-amber-700 ring-amber-500/40 hover:bg-amber-500/10' },
  Absent: { on: 'bg-brand-600 text-white ring-brand-600', off: 'text-brand-700 ring-brand-500/40 hover:bg-brand-50' },
}

/** Totals across every way attendance is recorded, so the trainer sees one number for the session. */
export function AttendanceTotals({ training, peopleCount }: { training: AdminTraining; peopleCount: number }) {
  const checkins = training.checkins ?? []
  const by = (m: CheckinMethod[]) => checkins.filter((c) => m.includes(c.method)).length
  const cells: [string, number | string, string?][] = [
    ['Total attended', `${checkins.length}/${peopleCount}`, peopleCount ? `${Math.round((checkins.length / peopleCount) * 100)}%` : undefined],
    ['Self check-in', by(['qr', 'link']), 'QR or link'],
    ['Manual', by(['manual']), 'Marked by trainer'],
    ['Bulk upload', by(['offline']), 'From a list'],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cells.map(([label, value, hint]) => (
        <div key={label} className="rounded-xl border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-0.5 text-xl font-bold text-zinc-900 tabular-nums">{value}</p>
          {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
        </div>
      ))}
    </div>
  )
}

/** Add someone who wasn't on the list but attended; they're added to the training and marked present. */
function AddVisitorModal({ training, onAdd, onClose }: { training: AdminTraining; onAdd: (personId: string) => void; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const known = data.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase())
  const already = !!known && training.participantIds.includes(known.id)
  const valid = EMAIL_RE.test(email.trim()) && (known || name.trim().split(/\s+/).length >= 2) && !already
  const save = () => {
    const person: Person = known ?? {
      id: uid('u'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: '',
      role: 'Participant',
      status: 'Active',
      department: 'Visitor',
      groupIds: [],
      createdAt: localISO().slice(0, 10),
      createdBy: user.name,
    }
    update(
      (d) => ({
        ...d,
        people: known ? d.people : [...d.people, person],
        trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, participantIds: [...new Set([...t.participantIds, person.id])] } : t)),
      }),
      { action: 'Added visitor to training', target: `${person.name} → ${training.name}`, silent: true },
    )
    onAdd(person.id)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Add visitor"
      description="Someone who attended but wasn’t on the participant list."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            <UserPlus className="size-4" /> Add and mark present
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />
          {known && <span className={cn('mt-1 block text-xs', already ? 'text-brand-600' : 'text-mpesa-700')}>{already ? `${known.name} is already on the list.` : `Found: ${known.name}`}</span>}
        </Field>
        {!known && (
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Firstname Lastname" />
          </Field>
        )}
      </div>
    </Modal>
  )
}

/** Session attendance: every participant with Present / Late / Absent, bulk marking and one Save. */
export function AttendanceRoster({ training, onClose, onCopyLink, onExport }: { training: AdminTraining; onClose: () => void; onCopyLink: () => void; onExport: () => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const scope = useScope()
  const { toast } = useFeedback()
  const [q, setQ] = useState('')
  const [visitor, setVisitor] = useState(false)
  const [note, setNote] = useState('')
  const byPerson = useMemo(() => new Map((training.checkins ?? []).map((c) => [c.personId, c])), [training.checkins])
  const people = training.participantIds.map((id) => data.people.find((p) => p.id === id)).filter((p): p is Person => !!p)
  const initial = (id: string): Mark | undefined => byPerson.get(id)?.status
  const [draft, setDraft] = useState<Record<string, Mark | undefined>>({})
  const markOf = (id: string) => (id in draft ? draft[id] : initial(id))
  const changed = Object.entries(draft).filter(([id, m]) => m !== initial(id))
  const shown = people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()))
  const count = (m: Mark) => people.filter((p) => markOf(p.id) === m).length
  const rate = people.length ? Math.round(((count('Present') + count('Late')) / people.length) * 100) : 0

  const setAll = (m: Mark) => setDraft((d) => ({ ...d, ...Object.fromEntries(shown.map((p) => [p.id, m])) }))

  const save = () => {
    const at = localISO()
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) => {
          if (t.id !== training.id) return t
          let list = t.checkins ?? []
          for (const [pid, m] of changed) {
            list = list.filter((c) => c.personId !== pid)
            if (m && m !== 'Absent') {
              const prev = byPerson.get(pid)
              // Keep a self check-in's time and source when only the status changes.
              const entry: Checkin = prev
                ? { ...prev, status: m }
                : { personId: pid, at, method: 'manual', status: m, comment: note.trim() || undefined, verified: scope.role === 'admin', by: user.name }
              list = addCheckin(list, entry)
            }
          }
          return { ...t, checkins: list }
        }),
      }),
      { action: `Updated attendance for ${changed.length} participant${changed.length === 1 ? '' : 's'}`, target: training.name, remarks: note.trim() || undefined },
    )
    toast('Attendance saved')
    setDraft({})
  }

  return (
    <FullPageDialog
      title="Session attendance"
      subtitle={training.name}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'No unsaved changes'}</span>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={!changed.length} onClick={save}>
            <Save className="size-4" /> Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Session attendance</h2>
          <p className={cn('mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', rate < 50 ? 'bg-brand-50 text-brand-700' : 'bg-mpesa-500/10 text-mpesa-700')}>
            {rate < 50 && <AlertCircle className="size-3.5" />}
            {rate < 50 ? 'Low attendance' : 'Attendance'}: {rate}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setVisitor(true)}>
            <UserPlus className="size-3.5" /> Add visitor
          </Button>
          <Button size="sm" onClick={onCopyLink}>
            <Link2 className="size-3.5" /> Copy check-in link
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download className="size-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {(['Present', 'Late', 'Absent'] as Mark[]).map((m) => (
          <div key={m} className="rounded-xl border border-zinc-200 p-3">
            <p className="text-xs text-zinc-500">{m}</p>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">{count(m)}</p>
          </div>
        ))}
        <div className="col-span-3 rounded-xl border border-zinc-200 p-3 sm:col-span-1">
          <p className="text-xs text-zinc-500">Not marked</p>
          <p className="text-xl font-bold text-zinc-900 tabular-nums">{people.length - count('Present') - count('Late') - count('Absent')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search participants…" className="pl-9" />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-200/80 scrollbar-thin">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
            <tr>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Check-in</th>
              <th className="px-3 py-3">
                <span className="flex flex-wrap items-center gap-1.5">
                  Mark all{q ? ' shown' : ''} as:
                  {(['Present', 'Late', 'Absent'] as Mark[]).map((m) => (
                    <button key={m} type="button" onClick={() => setAll(m)} className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition', markStyle[m].on)}>
                      {m}
                    </button>
                  ))}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {shown.map((p) => {
              const c = byPerson.get(p.id)
              const mark = markOf(p.id)
              const dirty = p.id in draft && draft[p.id] !== initial(p.id)
              return (
                <tr key={p.id} className={cn(dirty && 'bg-amber-500/5')}>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={p.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900">{p.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-500">{c ? `${time(c.at)} · ${methodLabel[c.method]}` : '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex gap-1.5" role="radiogroup" aria-label={`Attendance for ${p.name}`}>
                      {(['Present', 'Late', 'Absent'] as Mark[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={mark === m}
                          onClick={() => setDraft((d) => ({ ...d, [p.id]: m }))}
                          className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1 transition', mark === m ? markStyle[m].on : markStyle[m].off)}
                        >
                          {m}
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-zinc-500">
                  {people.length ? `No one matches “${q}”.` : 'No participants yet — add a visitor or invite people first.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 max-w-xl">
        <Field label="Note for new manual marks (optional)" hint="Saved with the attendance change, e.g. “QR code didn’t scan at the door”.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      {visitor && <AddVisitorModal training={training} onClose={() => setVisitor(false)} onAdd={(id) => setDraft((d) => ({ ...d, [id]: 'Present' }))} />}
    </FullPageDialog>
  )
}

type UploadRow = { line: number; name: string; email: string; person?: Person; state: 'new' | 'already' | 'not-listed' | 'unknown' }

/** Bulk attendance from a list (paste or CSV / Excel): shows what each row will do before importing. */
export function AttendanceUpload({ training, onClose }: { training: AdminTraining; onClose: () => void }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const { toast } = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'auto' | CheckinStatus>('auto')
  const [addMissing, setAddMissing] = useState(true)
  const checked = new Set((training.checkins ?? []).map((c) => c.personId))

  const { rows, errors } = useMemo(() => {
    if (!text.trim()) return { rows: [] as UploadRow[], errors: [] as string[] }
    const parsed = parseParticipants(text)
    const seen = new Set<string>()
    const out: UploadRow[] = []
    parsed.rows.forEach((r, i) => {
      const email = r.email.toLowerCase()
      if (seen.has(email)) return
      seen.add(email)
      const person = data.people.find((p) => p.email.toLowerCase() === email)
      const state: UploadRow['state'] = !person ? 'unknown' : !training.participantIds.includes(person.id) ? 'not-listed' : checked.has(person.id) ? 'already' : 'new'
      out.push({ line: i + 1, name: r.name || person?.name || '', email, person, state })
    })
    return { rows: out, errors: parsed.errors }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, data.people, training])

  const importable = rows.filter((r) => r.state === 'new' || (addMissing && (r.state === 'not-listed' || (r.state === 'unknown' && r.name.trim()))))
  const tally = (s: UploadRow['state']) => rows.filter((r) => r.state === s).length

  const onFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const wb = read(await file.arrayBuffer(), { type: 'array' })
      setText(utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]))
    } else setText(await file.text())
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['name,email\nAbebe Kebede,abebe.kebede@safaricom.et\n'], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'attendance-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const save = () => {
    const at = localISO()
    const fresh: Person[] = importable
      .filter((r) => !r.person)
      .map((r) => ({ id: uid('u'), name: r.name.trim(), email: r.email, phone: '', role: 'Participant', status: 'Active', department: 'Visitor', groupIds: [], createdAt: at.slice(0, 10), createdBy: user.name }))
    const idOf = (r: UploadRow) => r.person?.id ?? fresh.find((p) => p.email === r.email)!.id
    const ids = importable.map(idOf)
    const mark = status === 'auto' ? statusFor(training, at, data.attendanceRules.lateMinutes) : status
    const entries: Checkin[] = ids.map((personId) => ({ personId, at, method: 'offline', status: mark, verified: true, by: user.name }))
    update(
      (d) => ({
        ...d,
        people: [...d.people, ...fresh],
        trainings: d.trainings.map((t) =>
          t.id === training.id ? { ...t, participantIds: [...new Set([...t.participantIds, ...ids])], checkins: entries.reduce((list, e) => addCheckin(list, e), t.checkins ?? []) } : t,
        ),
      }),
      { action: `Uploaded attendance for ${entries.length}`, target: training.name, remarks: fileName || undefined },
    )
    toast(`Attendance uploaded for ${entries.length} participant${entries.length === 1 ? '' : 's'}`)
    onClose()
  }

  const stateLabel: Record<UploadRow['state'], [string, string]> = {
    new: ['Will be marked', 'text-mpesa-700'],
    already: ['Already checked in', 'text-zinc-500'],
    'not-listed': [addMissing ? 'Not on the list — will be added' : 'Not on the list — skipped', addMissing ? 'text-amber-700' : 'text-zinc-500'],
    unknown: [addMissing ? 'New person — will be added' : 'Not found — skipped', addMissing ? 'text-amber-700' : 'text-zinc-500'],
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Upload attendance"
      description="Paste a list or upload a CSV / Excel file with name and email. Each row is checked before anything is saved."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!importable.length} onClick={save}>
            <Check className="size-4" /> Mark {importable.length} attended
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload CSV / Excel
          </Button>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => (void onFile(e.target.files?.[0]), (e.target.value = ''))} />
          <Button size="sm" variant="ghost" onClick={downloadTemplate}>
            <FileSpreadsheet className="size-3.5" /> Download template
          </Button>
          {fileName && <span className="text-xs text-zinc-500">{fileName}</span>}
        </div>
        <Field label="Or paste the list">
          <Textarea rows={4} value={text} onChange={(e) => (setText(e.target.value), setFileName(''))} placeholder={'name,email\nAwet Gebrehiwet,awet.gebrehiwet@partner.safaricom.et'} className="font-mono text-xs" />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mark them as">
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="auto">Present or Late by the current time</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
            </Select>
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 self-end rounded-xl border border-zinc-200 p-3 text-sm">
            <input type="checkbox" checked={addMissing} onChange={(e) => setAddMissing(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="block font-medium text-zinc-900">Add people who aren’t on the list</span>
              <span className="block text-xs text-zinc-500">As visitors to this training (new people need a name).</span>
            </span>
          </label>
        </div>

        {(rows.length > 0 || errors.length > 0) && (
          <div>
            <div className="mb-2 flex flex-wrap gap-3 text-xs font-semibold">
              <span className="text-mpesa-700">{tally('new')} will be marked</span>
              {tally('already') > 0 && <span className="text-zinc-500">{tally('already')} already checked in</span>}
              {tally('not-listed') + tally('unknown') > 0 && <span className="text-amber-700">{tally('not-listed') + tally('unknown')} not on the list</span>}
              {errors.length > 0 && <span className="text-brand-600">{errors.length} invalid</span>}
            </div>
            <ul className="max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 text-sm scrollbar-thin">
              {rows.map((r) => (
                <li key={r.email} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-zinc-900">{r.person?.name ?? (r.name || '—')}</span>
                    <span className="block truncate text-xs text-zinc-500">{r.email}</span>
                  </span>
                  <span className={cn('shrink-0 text-xs font-medium', stateLabel[r.state][1])}>{r.state === 'unknown' && addMissing && !r.name.trim() ? 'Needs a name — skipped' : stateLabel[r.state][0]}</span>
                </li>
              ))}
              {errors.map((e) => (
                <li key={e} className="flex items-center gap-2 px-3 py-2 text-xs text-brand-600">
                  <AlertCircle className="size-3.5 shrink-0" /> {e.replace(/^Line/, 'Row')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
