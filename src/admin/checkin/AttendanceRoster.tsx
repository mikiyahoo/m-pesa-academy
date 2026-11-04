import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, FileSpreadsheet, Hand, HelpCircle, Link2, type LucideIcon, Minus, QrCode, Save, Search, Trash2, Upload, UserPlus, Users, X, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { read, utils } from 'xlsx'
import { useFeedback } from '../../components/Feedback'
import { cn, localISO } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { EMAIL_RE, parseParticipants } from '../requests'
import { useScope } from '../scope'
import { uid, useAdmin } from '../store'
import type { AdminTraining, Checkin, CheckinMethod, CheckinStatus, Person } from '../types'
import { Avatar, Button, Empty, Field, Input, Modal, Select, Textarea } from '../ui'
import { FullPageDialog } from '../Wizard'
import { addCheckin, statusFor } from './checkin'

type Mark = CheckinStatus | 'Absent'

const methodLabel: Record<CheckinMethod, string> = { qr: 'QR scan', link: 'Check-in link', manual: 'Manual', offline: 'Bulk upload' }
const methodIcon: Record<CheckinMethod, LucideIcon> = { qr: QrCode, link: Link2, manual: Hand, offline: Upload }
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

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
        <div key={label} className="rounded-xl border border-zinc-200 bg-white p-3">
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
  const [participantView, setParticipantView] = useState<'all' | 'Present' | 'Late' | 'Absent' | 'not-marked'>('all')
  const [tablePage, setTablePage] = useState(0)
  const [visitor, setVisitor] = useState(false)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const byPerson = useMemo(() => new Map((training.checkins ?? []).map((c) => [c.personId, c])), [training.checkins])
  const people = training.participantIds.map((id) => data.people.find((p) => p.id === id)).filter((p): p is Person => !!p)
  const initial = (id: string): Mark | undefined => byPerson.get(id)?.status ?? (training.absentIds?.includes(id) ? 'Absent' : undefined)
  const [draft, setDraft] = useState<Record<string, Mark | undefined>>({})
  const markOf = (id: string) => (id in draft ? draft[id] : initial(id))
  const changed = Object.entries(draft).filter(([id, m]) => m !== initial(id))
  const shown = people.filter((p) => {
    const matchesQuery = `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase())
    const mark = markOf(p.id)
    const matchesView = participantView === 'all' || (participantView === 'not-marked' ? mark === undefined : mark === participantView)
    return matchesQuery && matchesView
  })
  const tablePageSize = 10
  const tablePageCount = Math.max(1, Math.ceil(shown.length / tablePageSize))
  const currentTablePage = Math.min(tablePage, tablePageCount - 1)
  const visiblePeople = shown.slice(currentTablePage * tablePageSize, (currentTablePage + 1) * tablePageSize)
  const count = (m: Mark | undefined) => people.filter((p) => markOf(p.id) === m).length
  const pct = (n: number) => (people.length ? Math.round((n / people.length) * 100) : 0)

  const setMany = (ids: string[], m: Mark | undefined) => setDraft((d) => ({ ...d, ...Object.fromEntries(ids.map((id) => [id, m])) }))
  const allShownSelected = visiblePeople.length > 0 && visiblePeople.every((p) => selected.has(p.id))
  const toggleAll = () => setSelected((current) => {
    const next = new Set(current)
    if (allShownSelected) visiblePeople.forEach((p) => next.delete(p.id))
    else visiblePeople.forEach((p) => next.add(p.id))
    return next
  })
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = () => {
    const at = localISO()
    update(
      (d) => ({
        ...d,
        trainings: d.trainings.map((t) => {
          if (t.id !== training.id) return t
          let list = t.checkins ?? []
          let absent = new Set(t.absentIds ?? [])
          for (const [pid, m] of changed) {
            list = list.filter((c) => c.personId !== pid)
            absent.delete(pid)
            if (m === 'Absent') absent.add(pid)
            else if (m) {
              const prev = byPerson.get(pid)
              // Keep a self check-in's time and source when only the status changes.
              const entry: Checkin = prev
                ? { ...prev, status: m }
                : { personId: pid, at, method: 'manual', status: m, comment: note.trim() || undefined, verified: scope.role === 'admin', by: user.name }
              list = addCheckin(list, entry)
            }
          }
          absent = new Set([...absent].filter((id) => t.participantIds.includes(id)))
          return { ...t, checkins: list, absentIds: absent.size ? [...absent] : undefined }
        }),
      }),
      { action: `Updated attendance for ${changed.length} participant${changed.length === 1 ? '' : 's'}`, target: training.name, remarks: note.trim() || undefined },
    )
    toast('Attendance saved')
    setDraft({})
  }

  const stats: { mark: Mark | undefined; label: string; icon: LucideIcon; tile: string; pill: string }[] = [
    { mark: 'Present', label: 'Present', icon: Users, tile: 'bg-mpesa-500/15 text-mpesa-700', pill: 'bg-mpesa-500/15 text-mpesa-700' },
    { mark: 'Late', label: 'Late', icon: Clock, tile: 'bg-amber-500/15 text-amber-700', pill: 'bg-amber-500/15 text-amber-700' },
    { mark: 'Absent', label: 'Absent', icon: XCircle, tile: 'bg-brand-100 text-brand-600', pill: 'bg-brand-100 text-brand-700' },
    { mark: undefined, label: 'Not marked', icon: HelpCircle, tile: 'bg-zinc-200/70 text-zinc-700', pill: 'bg-zinc-200/70 text-zinc-700' },
  ]

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
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Session attendance</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setVisitor(true)}>
            <UserPlus className="size-4" /> Add visitor
          </Button>
          <Button onClick={onCopyLink}>
            <Link2 className="size-4" /> Copy check-in link
          </Button>
          <Button onClick={onExport}>
            <Download className="size-4" /> Export
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const n = count(s.mark)
          return (
            <div key={s.label} className="flex items-center gap-3.5 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-card transition-shadow hover:shadow-md">
              <span className={cn('grid size-12 shrink-0 place-items-center rounded-full', s.tile)}>
                <s.icon className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-700">{s.label}</span>
                <span className="block text-2xl leading-tight font-bold text-zinc-900 tabular-nums">{n}</span>
              </span>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', s.pill)}>{pct(n)}%</span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setTablePage(0) }} placeholder="Search participants…" className="h-10 rounded-full pl-10" />
        </label>
        {selected.size > 0 ? (
          <BulkActions count={selected.size} onApply={(m) => (setMany([...selected], m), setSelected(new Set()))} onClear={() => setSelected(new Set())} />
        ) : (
          <Select value={participantView} onChange={(e) => { setParticipantView(e.target.value as typeof participantView); setTablePage(0) }} aria-label="View participants" className="h-10 w-auto rounded-full py-1.5 text-xs">
            <option value="all">All participants</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="not-marked">Not marked</option>
          </Select>
        )}
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
          <span className="mr-1 whitespace-nowrap">{shown.length ? `${currentTablePage * tablePageSize + 1}–${Math.min((currentTablePage + 1) * tablePageSize, shown.length)} of ${shown.length}` : '0 participants'}</span>
          <Button size="sm" aria-label="Previous participant page" disabled={currentTablePage === 0} onClick={() => setTablePage(currentTablePage - 1)} className="h-10 w-10 p-0">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="sm" aria-label="Next participant page" disabled={currentTablePage >= tablePageCount - 1} onClick={() => setTablePage(currentTablePage + 1)} className="h-10 w-10 p-0">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-surface scrollbar-thin">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
            <tr>
              <th className="w-12 px-4 py-3">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all shown" className="size-4 accent-brand-600" />
              </th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Check-in</th>
              <th className="px-3 py-3">Manual mark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {visiblePeople.map((p) => {
              const c = byPerson.get(p.id)
              const mark = markOf(p.id)
              const dirty = p.id in draft && draft[p.id] !== initial(p.id)
              const on = selected.has(p.id)
              const MethodIcon = c ? methodIcon[c.method] : null
              return (
                <tr key={p.id} className={cn('transition', on ? 'bg-brand-50/50' : dirty ? 'bg-amber-500/5' : 'hover:bg-zinc-50/70')}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={on} onChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} className="size-4 accent-brand-600" />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <span className="truncate font-semibold text-zinc-900">{p.name}</span>
                    </span>
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2.5 text-zinc-600">{p.email}</td>
                  <td className="px-3 py-2.5 text-xs text-zinc-600">
                    {c && MethodIcon ? (
                      <span className="inline-flex items-center gap-2">
                        <MethodIcon className="size-4 text-zinc-500" /> {time(c.at)} · {methodLabel[c.method]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <MarkMenu value={mark} name={p.name} onChange={(m) => setDraft((d) => ({ ...d, [p.id]: m }))} />
                  </td>
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td colSpan={5}>
                  <Empty compact icon={Users} title={people.length ? `No one matches “${q}”` : 'No participants yet'} text={people.length ? undefined : 'Add a visitor or invite people first.'} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <Field label="Note for new manual marks (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for manual attendance changes…" />
        </Field>
      </div>

      {visitor && <AddVisitorModal training={training} onClose={() => setVisitor(false)} onAdd={(id) => setDraft((d) => ({ ...d, [id]: 'Present' }))} />}
    </FullPageDialog>
  )
}

const markOptions: { value: Mark | undefined; label: string; icon: LucideIcon; tone: string }[] = [
  { value: 'Present', label: 'Present', icon: Check, tone: 'bg-mpesa-500/15 text-mpesa-700' },
  { value: 'Late', label: 'Late', icon: Clock, tone: 'bg-amber-500/15 text-amber-700' },
  { value: 'Absent', label: 'Absent', icon: X, tone: 'bg-brand-100 text-brand-600' },
  { value: undefined, label: 'Not marked', icon: Minus, tone: 'bg-zinc-100 text-zinc-600' },
]

/** Fixed-position popover under a button, so it isn't clipped by the scrolling table. */
function usePopover() {
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const open = () => {
    const r = anchor.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 270), minWidth: r.width })
  }
  useEffect(() => {
    if (!pos) return
    const close = (e: Event) => {
      if (e.type === 'mousedown' && (panel.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node))) return
      setPos(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setPos(null))
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [pos])
  return { pos, open, close: () => setPos(null), anchor, panel }
}

/** One person's mark as a coloured pill that opens Present / Late / Absent / Not marked. */
function MarkMenu({ value, name, onChange }: { value: Mark | undefined; name: string; onChange: (m: Mark | undefined) => void }) {
  const pop = usePopover()
  const selected = markOptions.find((option) => option.value === value) ?? markOptions[3]
  const valueStyle = value === 'Present'
    ? { field: 'border-mpesa-600/25 bg-mpesa-500/10 hover:bg-mpesa-500/15', icon: 'text-mpesa-700', label: 'text-mpesa-800' }
    : value === 'Late'
      ? { field: 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15', icon: 'text-amber-700', label: 'text-amber-800' }
      : value === 'Absent'
        ? { field: 'border-brand-200 bg-brand-50 hover:bg-brand-100', icon: 'text-brand-600', label: 'text-brand-700' }
        : { field: 'border-zinc-200 bg-surface hover:bg-zinc-50', icon: 'text-zinc-500', label: 'text-zinc-700' }
  return (
    <>
      <button
        ref={pop.anchor}
        type="button"
        onClick={() => (pop.pos ? pop.close() : pop.open())}
        aria-haspopup="listbox"
        aria-expanded={!!pop.pos}
        aria-label={`Attendance for ${name}: ${value ?? 'Not marked'}`}
        className={cn('inline-flex h-10 w-36 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-medium shadow-xs outline-none transition focus:ring-2 focus:ring-brand-100', valueStyle.field, pop.pos && 'ring-2 ring-brand-100')}
      >
        <span className="min-w-0 flex-1">
          <span className={cn('truncate', valueStyle.label)}>{selected.label}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition', pop.pos && 'rotate-180 text-brand-600')} />
      </button>
      {pop.pos && (
        <div ref={pop.panel} role="listbox" style={{ position: 'fixed', top: pop.pos.top, left: Math.min(pop.pos.left, window.innerWidth - Math.max(pop.pos.minWidth, 220) - 8), minWidth: Math.max(pop.pos.minWidth, 220) }} className="z-[90] max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-surface p-1 shadow-xl scrollbar-thin">
          {markOptions.map((o) => (
            <button
              key={o.label}
              type="button"
              role="option"
              aria-selected={value === o.value}
              onClick={() => (onChange(o.value), pop.close())}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition', value === o.value ? 'bg-brand-50/70 font-semibold text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50')}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', o.tone)}>
                <o.icon className="size-3.5" strokeWidth={2.5} />
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** Bulk actions for the ticked rows: pick a mark, then Apply. */
function BulkActions({ count, onApply, onClear }: { count: number; onApply: (m: Mark | undefined) => void; onClear: () => void }) {
  const pop = usePopover()
  const [choice, setChoice] = useState<Mark | undefined | 'none'>('none')
  return (
    <>
      <button
        ref={pop.anchor}
        type="button"
        disabled={!count}
        onClick={() => (pop.pos ? pop.close() : (setChoice('none'), pop.open()))}
        aria-expanded={!!pop.pos}
        title={count ? undefined : 'Tick people in the table first'}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-charcoal px-4 text-sm font-semibold text-white transition hover:bg-charcoal-light disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Check className="size-4" /> Bulk actions{count ? ` (${count})` : ''} <ChevronDown className={cn('size-4 transition', pop.pos && 'rotate-180')} />
      </button>
      {pop.pos && (
        <div ref={pop.panel} style={{ position: 'fixed', top: pop.pos.top, left: Math.max(8, pop.pos.left + pop.pos.minWidth - 260) }} className="z-[90] w-[260px] rounded-2xl border border-zinc-200 bg-surface p-3 shadow-xl">
          <p className="px-1 text-sm font-bold text-zinc-900">Apply to selected ({count})</p>
          <div className="mt-2 space-y-1">
            {markOptions.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setChoice(o.value)}
                aria-pressed={choice === o.value}
                className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition', choice === o.value ? 'bg-brand-50 text-zinc-900 ring-1 ring-brand-200' : 'text-zinc-700 hover:bg-zinc-50')}
              >
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', o.tone)}>
                  <o.icon className="size-4" strokeWidth={2.5} />
                </span>
                Mark as {o.label === 'Not marked' ? 'Not marked' : o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (onClear(), pop.close())}
            className="mt-2 flex w-full items-center gap-2.5 border-t border-zinc-100 px-2.5 pt-3 pb-1 text-left text-sm font-medium text-zinc-600 hover:text-brand-600"
          >
            <Trash2 className="size-4" /> Clear selection
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
            <Button size="sm" onClick={pop.close}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={choice === 'none'} onClick={() => (onApply(choice === 'none' ? undefined : choice), pop.close())}>
              <Check className="size-4" /> Apply
            </Button>
          </div>
        </div>
      )}
    </>
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
          <label className="flex h-10 cursor-pointer items-center gap-2.5 self-end rounded-xl border border-zinc-200 px-3 text-sm">
            <input type="checkbox" checked={addMissing} onChange={(e) => setAddMissing(e.target.checked)} className="size-4 shrink-0 accent-brand-600" />
            <span>
              <span className="block font-medium text-zinc-900">Add people who aren’t on the list</span>
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
