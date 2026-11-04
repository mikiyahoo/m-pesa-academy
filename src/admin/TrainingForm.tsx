import {
  AlertTriangle,
  Award,
  BarChart3,
  Clock,
  Play,
  Star,
  Trophy,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Save,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { read, utils, writeFile } from 'xlsx'
import { FullPageDialog } from './Wizard'
import { useFeedback } from '../components/Feedback'
import { cn, localISO, parseDate, todayISO } from '../lib/utils'
import { shortDate, time12 } from './helpers'
import { describeRecurrence, findConflicts, LEVELS, makeInviteLink, MAX_OCCURRENCES, occurrenceDates, WEEKDAYS } from './scheduling'
import { uid, useAdmin } from './store'
import { useScope } from './scope'
import { demoMeeting } from './teams/attendance'
import { searchVenues, venueLabel, venuesOf } from './venues'
import type { AdminTraining, Journey, Venue, Recurrence, RecurrenceFreq, TrainingLevel } from './types'
import { ADD_TRAINER_OPTION, AddTrainerModal } from './TrainerModal'
import { Avatar, Badge, Button, Card, Field, Input, Modal, Select, Textarea } from './ui'
import { CertificatePreview } from './pages/Settings'
import { UserAvatar } from '../components/UserAvatar'

/** Accepts Microsoft Teams join links (work and personal Teams). */
const TEAMS_URL_RE = /^https:\/\/teams\.(microsoft|live)\.com\/\S+$/

export type TrainingPreset = {
  name?: string
  journeyId?: string
  journeyIds?: string[]
  typeId?: string
  trainerId?: string
  trainerIds?: string[]
  date?: string
  startTime?: string
  location?: string
  participantIds?: string[]
  /** When scheduling an approved request, the request is linked to the new training. */
  requestId?: string
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const x = new Date(y, m - 1, d + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

const PARTICIPANT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A spreadsheet row that didn't contain a usable email; row numbers match what Excel shows. */
type InvalidEmailRow = { row: number; value: string }

async function parseParticipantEmailSheet(file: File) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an Excel or CSV file.')
  const workbook = read(await file.arrayBuffer(), { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!firstSheet) throw new Error('The spreadsheet has no worksheets.')
  const rows = utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '', blankrows: true })
  if (!rows.length) throw new Error('The first worksheet is empty.')

  const headerIndex = (rows[0] ?? []).findIndex((cell) => ['email', 'emailaddress', 'participantemail', 'participantemails', 'useremail', 'emailid'].includes(String(cell).toLowerCase().replace(/[^a-z]/g, '')))
  // With an "Email" heading only that column is read; otherwise every cell in the row.
  const firstDataRow = headerIndex >= 0 ? 1 : 0
  const emails = new Set<string>()
  const invalid: InvalidEmailRow[] = []
  let duplicates = 0
  rows.slice(firstDataRow).forEach((row, i) => {
    const cells = (headerIndex >= 0 ? [row[headerIndex]] : row).map((c) => String(c ?? '').trim()).filter(Boolean)
    if (!cells.length) return
    const found = cells
      .flatMap((text) => text.match(/[\w.+%'-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [])
      .map((e) => e.toLowerCase())
      .filter((e) => PARTICIPANT_EMAIL_RE.test(e))
    if (!found.length) {
      invalid.push({ row: firstDataRow + i + 1, value: cells.join(' ').slice(0, 40) })
      return
    }
    found.forEach((email) => (emails.has(email) ? (duplicates += 1) : emails.add(email)))
  })
  if (!emails.size) {
    const where = invalid.length ? ` Check ${invalid.slice(0, 3).map((x) => `row ${x.row}`).join(', ')}${invalid.length > 3 ? '…' : ''}.` : ''
    throw new Error(`No valid email addresses were found.${where} Use the template: one email per row under an “Email” heading.`)
  }
  return { emails: [...emails], invalid, duplicates }
}

/** A ready-to-fill participant list: an Email column (required) and a Name column (optional). */
function downloadParticipantTemplate() {
  const sheet = utils.aoa_to_sheet([
    ['Email', 'Name (optional)'],
    ['firstname.lastname@safaricom.et', 'Firstname Lastname'],
    ['partner.name@example.com', 'Partner Name'],
  ])
  sheet['!cols'] = [{ wch: 36 }, { wch: 24 }]
  const book = utils.book_new()
  utils.book_append_sheet(book, sheet, 'Participants')
  writeFile(book, 'participants-template.xlsx')
}

export async function prepareTrainingCover(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.')

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()

    let scale = Math.min(1, 1440 / image.naturalWidth, 900 / image.naturalHeight)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image preview is unavailable in this browser.')

    for (let attempt = 0; attempt < 4; attempt += 1) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const cover = canvas.toDataURL('image/jpeg', Math.max(0.55, 0.82 - attempt * 0.09))
      if (cover.length <= 250_000) return cover
      scale *= 0.8
    }
    throw new Error('This image could not be compressed enough. Choose a smaller image.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

type StepId = 1 | 2 | 3 | 4
const STEPS = [
  { id: 1 as StepId, label: 'Basics', desc: 'Details & learning path' },
  { id: 2 as StepId, label: 'Schedule & audience', desc: 'Date, venue, trainers & learners' },
  { id: 4 as StepId, label: 'Review & publish', desc: 'Tests & confirmation' },
]

/** Schedule a session or a recurring series (TA-2.2, TA-2.3, TR-2.2, URS 2.3). */
/** Create a journey without leaving the schedule form; add its modules later on the Journeys page. */
function QuickJourneyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { update } = useAdmin()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const save = () => {
    const j: Journey = { id: uid('j'), name: name.trim(), description: description.trim(), modules: [] }
    update((d) => ({ ...d, journeys: [...d.journeys, j] }), { action: 'Created journey', target: j.name })
    onCreated(j.id)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Create new journey"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            Create & select
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Journey name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KYC & Customer Registration" autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Summary of what this journey covers" />
        </Field>
      </div>
    </Modal>
  )
}

/** Dropdown with a checkbox per journey; ticked ones can be moved up or down; new journeys can be created here. */
function JourneyMultiSelect({ journeys, selected, onChange, invalid, onCreateNew }: { journeys: Journey[]; selected: string[]; onChange: (ids: string[]) => void; invalid?: boolean; onCreateNew?: () => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc, true)
    }
  }, [open])
  const shown = journeys.filter((j) => j.name.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const move = (id: string, by: -1 | 1) => {
    const i = selected.indexOf(id)
    const j = i + by
    if (i < 0 || j < 0 || j >= selected.length) return
    const next = [...selected]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const label = !selected.length ? 'Choose journeys…' : selected.length === 1 ? journeys.find((j) => j.id === selected[0])?.name ?? '1 journey selected' : `${selected.length} journeys selected`
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2 text-left text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          invalid ? 'border-brand-500 ring-1 ring-brand-500' : 'border-zinc-200',
        )}
      >
        <span className={cn('truncate', selected.length ? 'text-zinc-900' : 'text-zinc-400')}>{label}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-lg">
          {journeys.length > 6 && (
            <div className="border-b border-zinc-100 p-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search journeys…" autoFocus />
            </div>
          )}
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {shown.map((j) => {
              const checked = selected.includes(j.id)
              return (
                <li key={j.id}>
                  <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition', checked ? 'bg-brand-50/60' : 'hover:bg-zinc-50')}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(j.id)} className="size-4 shrink-0 accent-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900">{j.name}</span>
                      <span className="block text-xs text-zinc-500">
                        {j.modules.length} module{j.modules.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    {checked && (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => (e.preventDefault(), e.stopPropagation(), move(j.id, -1))}
                          disabled={selected.indexOf(j.id) === 0}
                          aria-label={`Move ${j.name} up`}
                          className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-white hover:text-zinc-900 disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => (e.preventDefault(), e.stopPropagation(), move(j.id, 1))}
                          disabled={selected.indexOf(j.id) === selected.length - 1}
                          aria-label={`Move ${j.name} down`}
                          className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-white hover:text-zinc-900 disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <span className="ml-1 w-6 text-right text-[11px] font-semibold text-brand-700 tabular-nums">#{selected.indexOf(j.id) + 1}</span>
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
            {!shown.length && <li className="px-2.5 py-3 text-sm text-zinc-500">No journeys match “{q}”.</li>}
          </ul>
          {onCreateNew && (
            <button
              type="button"
              onClick={() => (setOpen(false), onCreateNew())}
              className="flex w-full items-center gap-2 border-t border-zinc-100 px-3.5 py-2.5 text-left text-sm font-semibold text-brand-600 hover:bg-brand-50/60"
            >
              <Plus className="size-4" /> Create new journey
            </button>
          )}
          <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 text-xs">
            <span className="text-zinc-500">{selected.length} selected</span>
            <span className="flex gap-3">
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="font-semibold text-zinc-600 hover:text-zinc-900">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="font-semibold text-brand-600 hover:text-brand-700">
                Done
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Location field that suggests the closest admin-managed venues as you type; free text still works. */
function VenueInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const { data } = useAdmin()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const matches = searchVenues(venuesOf(data), value)
  const exact = matches.some((v) => venueLabel(v).toLowerCase() === value.trim().toLowerCase())
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const pick = (v: Venue) => {
    onChange(venueLabel(v))
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative">
      <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
      <Input
        value={value}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        onChange={(e) => (onChange(e.target.value), setOpen(true), setActive(0))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !matches.length) return
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, matches.length - 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
          else if (e.key === 'Enter') (e.preventDefault(), pick(matches[active]))
          else if (e.key === 'Escape') (e.stopPropagation(), setOpen(false))
        }}
        placeholder="Start typing a hall, room or site…"
        className={cn('pl-9', invalid && 'border-brand-500 ring-1 ring-brand-500')}
      />
      {open && matches.length > 0 && !exact && (
        <ul role="listbox" className="absolute inset-x-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-surface p-1 shadow-lg scrollbar-thin">
          {matches.map((v, i) => (
            <li key={v.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(v)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition', i === active ? 'bg-brand-50/70' : 'hover:bg-zinc-50')}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">{v.name}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {v.site}
                    {v.floor ? ` · ${v.floor}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-zinc-500">
                  <span className="block font-semibold text-zinc-700">{v.type}</span>
                  {v.capacity ? `${v.capacity} seats` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Emails as removable chips: type one and press Enter (or comma / space) to add it; pasting a list
 * adds them all. Stored as a comma-separated string so the rest of the form reads it as before.
 */
function EmailChipsInput({ value, onChange, known }: { value: string; onChange: (v: string) => void; known: (email: string) => string | undefined }) {
  const emails = [...new Set(value.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const commit = (text: string) => {
    const parts = text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (!parts.length) return
    const bad = parts.filter((e) => !PARTICIPANT_EMAIL_RE.test(e))
    const good = parts.filter((e) => PARTICIPANT_EMAIL_RE.test(e))
    if (good.length) onChange([...new Set([...emails, ...good])].join(', '))
    setDraft(bad.join(' '))
    setError(bad.length ? `Not a valid email: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}` : '')
  }
  const remove = (email: string) => onChange(emails.filter((e) => e !== email).join(', '))
  return (
    <div>
      <div
        className={cn('flex min-h-[3.25rem] flex-wrap items-center gap-1.5 rounded-xl border bg-surface p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100', error ? 'border-brand-500' : 'border-zinc-200')}
        onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
      >
        {emails.map((email) => {
          const name = known(email)
          return (
            <span key={email} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 text-xs font-medium', name ? 'bg-mpesa-500/10 text-mpesa-800' : 'bg-zinc-100 text-zinc-700')} title={name ? `${name} · in the directory` : 'Not in the directory yet'}>
              <span className="truncate">{name ? `${name} · ${email}` : email}</span>
              <button type="button" onClick={() => remove(email)} aria-label={`Remove ${email}`} className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-black/10">
                <X className="size-3.5" />
              </button>
            </span>
          )
        })}
        <input
          value={draft}
          onChange={(e) => (setDraft(e.target.value), setError(''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';' || (e.key === ' ' && draft.trim())) {
              e.preventDefault()
              commit(draft)
            } else if (e.key === 'Backspace' && !draft && emails.length) remove(emails[emails.length - 1])
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (/[\s,;]/.test(text.trim())) (e.preventDefault(), commit(draft + ' ' + text))
          }}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={emails.length ? 'Add another email…' : 'Type an email and press Enter'}
          aria-label="Participant email"
          className="min-w-40 flex-1 bg-transparent px-1.5 py-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className={error ? 'text-brand-600' : 'text-zinc-500'}>{error || (emails.length ? `${emails.length} email${emails.length === 1 ? '' : 's'} added` : 'Press Enter after each email, or paste a list.')}</span>
        {emails.length > 0 && (
          <button type="button" onClick={() => (onChange(''), setDraft(''), setError(''))} className="font-semibold text-zinc-600 hover:text-brand-600">
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

/** Label, hint and a switch on the right. */
function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-brand-600' : 'bg-zinc-300')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  )
}

const DRAFT_KEY = 'mpesa-learning:training-draft'
type TrainingDraft<F> = { f: F; step: StepId; savedAt: string }
function readDraft<F>(): TrainingDraft<F> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as TrainingDraft<F>) : null
  } catch {
    return null
  }
}

export function NewTrainingModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: TrainingPreset }) {
  const { data, update } = useAdmin()
  const scope = useScope()
  const [newJourneyOpen, setNewJourneyOpen] = useState(false)
  const [previewingTemplate, setPreviewingTemplate] = useState(false)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())
  const toggleModule = (id: string) =>
    setOpenModules((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const navigate = useNavigate()
  const [step, setStep] = useState<StepId>(1)
  const [triedSteps, setTriedSteps] = useState<Record<number, boolean>>({})
  const [addingTrainer, setAddingTrainer] = useState(false)
  const [choosingTrainer, setChoosingTrainer] = useState(false)
  const [candidateTrainerId, setCandidateTrainerId] = useState('')
  const [emailImportError, setEmailImportError] = useState('')
  const [emailImportSummary, setEmailImportSummary] = useState('')
  const [invalidEmailRows, setInvalidEmailRows] = useState<InvalidEmailRow[]>([])
  const [readingEmailFile, setReadingEmailFile] = useState(false)
  const emailFileRef = useRef<HTMLInputElement>(null)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const [coverPending, setCoverPending] = useState(false)
  const [coverError, setCoverError] = useState('')
  const trainers = data.people.filter((p) => p.role === 'Trainer' && p.status === 'Active')
  const startDate = preset?.date && preset.date >= todayISO() ? preset.date : todayISO()
  const presetOnline = preset?.location === 'ONLINE'

  const [f, setF] = useState(() => ({
    name: preset?.name ?? '',
    categoryId: data.categories[0]?.id ?? '',
    subcategoryId: '',
    cover: '',
    description: '',
    typeId: preset?.typeId ?? data.trainingTypes[0]?.id ?? '',
    level: 'Beginner' as TrainingLevel,
    /** Ordered: learners take the journeys in this order. */
    journeyIds: preset?.journeyIds?.length ? preset.journeyIds : [preset?.journeyId ?? data.journeys[0]?.id ?? ''].filter(Boolean),
    trainerIds: [...new Set(preset?.trainerIds?.length ? preset.trainerIds : [preset?.trainerId ?? scope.trainerId ?? trainers[0]?.id ?? ''].filter(Boolean))],
    preAssessmentId: '',
    postAssessmentId: '',
    delivery: (presetOnline ? 'Online' : preset?.location ? 'Physical' : 'Online') as 'Online' | 'Physical',
    isPublic: false,
    /** Empty = the training type's form / template. */
    feedbackFormId: '',
    certificateTemplateId: '',
    autoIssue: true,
    /** Library materials added to this training on top of its journeys. */
    extraMaterialIds: [] as string[],
    /** Optional existing Teams meeting; left empty, one is created for the session. */
    teamsUrl: '',
    location: presetOnline ? '' : (preset?.location ?? ''),
    date: startDate,
    startTime: preset?.startTime || '09:00',
    endTime: '17:00',
    repeat: false,
    freq: 'weekly' as RecurrenceFreq,
    interval: 1,
    weekdays: [weekdayOf(startDate)],
    until: addDays(startDate, 28),
    /** How the series ends: never (capped), on a date, or after a number of sessions. */
    endMode: 'date' as 'never' | 'date' | 'count',
    count: 6,
    groupIds: [] as string[],
    emails: '',
    /** Learner engagement settings shown in the course player. */
    engagement: { celebrate: true, progress: true, reminders: true },
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const { toast } = useFeedback()
  // A saved draft is offered when starting a new training (not when scheduling a request).
  const [draft, setDraft] = useState(() => (preset ? null : readDraft<typeof f>()))
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const saveDraft = () => {
    const savedAt = new Date().toISOString()
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, step, savedAt }))
      setDraftSavedAt(savedAt)
      setDraft(null)
      toast('Draft saved — continue it later from New training')
    } catch {
      // A large cover can exceed browser storage; save the rest without it.
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ f: { ...f, cover: '' }, step, savedAt }))
        setDraftSavedAt(savedAt)
        toast('Draft saved (without the cover image)')
      } catch {
        toast('The draft could not be saved in this browser.', { tone: 'error' })
      }
    }
  }
  const resumeDraft = () => {
    if (!draft) return
    setF((x) => ({ ...x, ...draft.f, engagement: { ...x.engagement, ...(draft.f.engagement ?? {}) } }))
    setStep(draft.step === 3 ? 2 : draft.step)
    setDraft(null)
  }
  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setDraft(null)
  }

  const chooseCover = async (file?: File) => {
    if (!file) return
    setCoverPending(true)
    setCoverError('')
    try {
      set('cover', await prepareTrainingCover(file))
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'The image could not be uploaded.')
    } finally {
      setCoverPending(false)
      if (coverFileRef.current) coverFileRef.current.value = ''
    }
  }

  const importParticipantEmails = async (file?: File) => {
    if (!file) return
    setReadingEmailFile(true)
    setEmailImportError('')
    setEmailImportSummary('')
    setInvalidEmailRows([])
    try {
      const imported = await parseParticipantEmailSheet(file)
      const current = f.emails.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean)
      const merged = [...new Set([...current, ...imported.emails])]
      set('emails', merged.join(', '))
      const added = merged.length - current.length
      const skipped = imported.duplicates + imported.emails.length - added
      setEmailImportSummary(`${added} email${added === 1 ? '' : 's'} imported${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}`)
      setInvalidEmailRows(imported.invalid)
    } catch (error) {
      setEmailImportError(error instanceof Error ? error.message : 'The spreadsheet could not be read.')
    } finally {
      setReadingEmailFile(false)
      if (emailFileRef.current) emailFileRef.current.value = ''
    }
  }

  const category = data.categories.find((c) => c.id === f.categoryId)
  const chosenJourneys = f.journeyIds.map((id) => data.journeys.find((j) => j.id === id)).filter((j): j is Journey => !!j)
  // Materials already in the chosen journeys aren't offered again as extras.
  const journeyMaterialIds = new Set(chosenJourneys.flatMap((j) => j.modules.flatMap((m) => m.materialIds)))
  const extraMaterials = f.extraMaterialIds.map((id) => data.materials.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  // Defaults that follow the training type, shown as the first option of each picker.
  const typeFeedbackForm = data.feedbackForms.find((ff) => ff.trainingTypeIds?.includes(f.typeId)) ?? data.feedbackForms[0]
  const typeTemplate = data.templates.find((tp) => tp.assignedTypeIds?.includes(f.typeId)) ?? data.templates.find((tp) => tp.isDefault) ?? data.templates[0]
  const chosenTemplate = data.templates.find((tp) => tp.id === f.certificateTemplateId) ?? typeTemplate
  const otherMaterials = data.materials.filter((m) => !f.extraMaterialIds.includes(m.id) && !journeyMaterialIds.has(m.id))
  const moveJourney = (i: number, by: -1 | 1) => {
    const next = [...f.journeyIds]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    set('journeyIds', next)
  }
  const trainingType = data.trainingTypes.find((t) => t.id === f.typeId)
  // Learner preview: every module across the chosen journeys, total time and three milestones.
  const pathModules = chosenJourneys.flatMap((j) => j.modules)
  const pathMinutes = [...new Set([...pathModules.flatMap((m) => m.materialIds), ...f.extraMaterialIds])].reduce((s, id) => s + (data.materials.find((x) => x.id === id)?.minutes ?? 0), 0)
  const milestones = [
    { label: 'Start your journey', sub: pathModules[0]?.title ?? 'Welcome' },
    { label: 'Skill builder', sub: pathModules.length > 1 ? `${pathModules.length - 1} more module${pathModules.length === 2 ? '' : 's'} · practice` : 'Practice' },
    { label: 'Achievement unlocked', sub: f.autoIssue ? 'Quiz & certificate' : 'Quiz & wrap-up' },
  ]
  const assignedTrainers = f.trainerIds.map((id) => data.people.find((p) => p.id === id)).filter((person): person is NonNullable<typeof person> => !!person)
  // "Never" and "after N sessions" generate far ahead, then stop at the cap or the count.
  const searchUntil = f.endMode === 'date' ? f.until : addDays(f.date, 365 * 3)
  const baseRule: Recurrence = { freq: f.freq, interval: Math.max(1, f.interval), weekdays: f.freq === 'weekly' ? f.weekdays : [], until: searchUntil }
  const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  // Short series headline: "Every weekday", "Every 2 weeks on Mon, Wed" — the full sentence gets long.
  const dayList = f.weekdays.map((i) => WEEKDAYS[i]).join(', ')
  const everyN = (unit: string) => (f.interval > 1 ? `Every ${f.interval} ${unit}s` : `Every ${unit}`)
  const seriesTitle =
    f.freq === 'daily'
      ? everyN('day')
      : f.freq === 'monthly'
        ? describeRecurrence(baseRule, f.date).replace(/ until .*$/, '')
        : f.weekdays.length === 7
          ? f.interval > 1 ? `${everyN('week')}, every day` : 'Every day'
          : f.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => f.weekdays.includes(d))
            ? f.interval > 1 ? `${everyN('week')} on weekdays` : 'Every weekday'
            : f.interval === 1
              ? `Every ${f.weekdays.length <= 2 ? f.weekdays.map((i) => FULL_DAYS[i]).join(' & ') : dayList || '…'}`
              : `${everyN('week')} on ${dayList || '…'}`
  const dates = useMemo(() => {
    if (!f.repeat) return [f.date]
    const all = occurrenceDates(f.date, baseRule)
    return f.endMode === 'count' ? all.slice(0, Math.max(1, f.count)) : all
  }, [f.repeat, f.date, f.freq, f.interval, f.weekdays, f.until, f.endMode, f.count]) // eslint-disable-line react-hooks/exhaustive-deps
  // The saved rule ends on the last generated session.
  const rule: Recurrence = { ...baseRule, until: f.endMode === 'date' ? f.until : (dates.at(-1) ?? f.date) }

  // Participants: preset (approved request) + chosen groups + pasted emails matched to the directory.
  const entries = [...new Set(f.emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
  // Anything that isn't an email is flagged and left out of the participants.
  const pasted = entries.filter((e) => PARTICIPANT_EMAIL_RE.test(e))
  const notEmails = entries.filter((e) => !PARTICIPANT_EMAIL_RE.test(e))
  const matched = pasted.map((e) => data.people.find((p) => p.email.toLowerCase() === e)).filter((p) => !!p)
  const unknown = pasted.filter((e) => !data.people.some((p) => p.email.toLowerCase() === e))
  const participantIds = [
    ...new Set([
      ...(preset?.participantIds ?? []),
      ...data.people.filter((p) => p.status === 'Active' && p.groupIds.some((g) => f.groupIds.includes(g))).map((p) => p.id),
      ...matched.map((p) => p!.id),
    ]),
  ]

  const participantKey = participantIds.join(',')
  const trainerKey = f.trainerIds.join(',')
  const conflicts = useMemo(
    () =>
      dates
        .map((date) => ({ date, list: findConflicts({ date, startTime: f.startTime, endTime: f.endTime, trainerId: f.trainerIds[0] ?? '', trainerIds: f.trainerIds, participantIds }, data.trainings, data.people) }))
        .filter((x) => x.list.length),
    [dates, f.startTime, f.endTime, trainerKey, participantKey, data.trainings, data.people], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Validation rules by step
  const step1Errors: Record<string, string> = {}
  if (!f.name.trim()) step1Errors.name = 'Enter a training title.'
  if (!f.categoryId) step1Errors.categoryId = 'Choose a category.'
  if (!f.journeyIds.length) step1Errors.journeyId = 'Choose at least one journey.'

  const step2Errors: Record<string, string> = {}
  if (f.delivery === 'Physical' && !f.location.trim()) step2Errors.location = 'Physical sessions need a location.'
  if (f.delivery === 'Online' && f.teamsUrl.trim() && !TEAMS_URL_RE.test(f.teamsUrl.trim())) step2Errors.teamsUrl = 'Paste a Microsoft Teams meeting link (https://teams.microsoft.com/…), or leave it empty.'
  if (!f.date) step2Errors.date = 'Choose a date.'
  else if (f.date < todayISO()) step2Errors.date = 'The date can’t be in the past.'
  if (f.startTime >= f.endTime) step2Errors.endTime = 'End time must be after the start time.'
  if (f.repeat && f.endMode === 'date' && f.until <= f.date) step2Errors.until = 'Choose an end date after the first session.'
  if (f.repeat && f.endMode === 'count' && !(f.count >= 1)) step2Errors.until = 'Enter how many sessions.'
  if (f.repeat && f.freq === 'weekly' && !f.weekdays.length) step2Errors.weekdays = 'Pick at least one day.'

  const step3Errors: Record<string, string> = {}
  if (!f.trainerIds.length) step3Errors.trainerIds = 'Choose at least one trainer.'

  const err1 = (k: string) => (triedSteps[1] ? step1Errors[k] : undefined)
  const err2 = (k: string) => (triedSteps[2] ? step2Errors[k] : undefined)
  const err3 = (k: string) => (triedSteps[3] ? step3Errors[k] : undefined)

  const canNavigateTo = (target: StepId) => {
    if (target <= step) return true
    if (target > 1 && Object.keys(step1Errors).length) return false
    if (target > 2 && Object.keys(step2Errors).length) return false
    if (target > 3 && Object.keys(step3Errors).length) return false
    return true
  }

  const handleNext = () => {
    if (step === 1) {
      if (Object.keys(step1Errors).length) {
        setTriedSteps((x) => ({ ...x, 1: true }))
        return
      }
      setStep(2)
    } else if (step === 2 || step === 3) {
      if (Object.keys(step2Errors).length || Object.keys(step3Errors).length) {
        setTriedSteps((x) => ({ ...x, 2: true, 3: true }))
        return
      }
      setStep(4)
    }
  }

  const create = () => {
    // Check all steps
    if (Object.keys(step1Errors).length) {
      setTriedSteps((x) => ({ ...x, 1: true }))
      setStep(1)
      return
    }
    if (Object.keys(step2Errors).length) {
      setTriedSteps((x) => ({ ...x, 2: true }))
      setStep(2)
      return
    }
    if (Object.keys(step3Errors).length) {
      setTriedSteps((x) => ({ ...x, 3: true }))
      setStep(2)
      return
    }

    const at = localISO()
    const seriesId = f.repeat && dates.length > 1 ? uid('ser') : undefined
    const coverId = f.cover ? uid('cover') : undefined
    const sessions: AdminTraining[] = dates.map((date) => {
      const id = uid('t')
      return {
        id,
        coverId,
        name: f.name.trim(),
        journeyId: f.journeyIds[0],
        journeyIds: f.journeyIds.length > 1 ? f.journeyIds : undefined,
        extraMaterialIds: f.extraMaterialIds.length ? f.extraMaterialIds : undefined,
        typeId: f.typeId,
        trainerId: f.trainerIds[0],
        trainerIds: f.trainerIds,
        date,
        startTime: f.startTime,
        endTime: f.endTime,
        location: f.delivery === 'Online' ? 'ONLINE' : f.location.trim(),
        delivery: f.delivery,
        recurring: !!seriesId,
        seriesId,
        recurrence: seriesId ? rule : undefined,
        categoryId: f.categoryId,
        subcategoryId: f.subcategoryId || undefined,
        level: f.level,
        description: f.description.trim() || undefined,
        status: 'SCHEDULED',
        participantIds,
        preAssessmentId: f.preAssessmentId || undefined,
        postAssessmentId: f.postAssessmentId || undefined,
        feedbackFormId: f.feedbackFormId || typeFeedbackForm?.id,
        certificateTemplateId: f.certificateTemplateId || undefined,
        autoIssueCertificates: f.autoIssue ? undefined : false,
        // A pasted Teams link is used as is (same link for every session in a series); otherwise one is created.
        teamsMeeting: f.delivery === 'Online' ? (f.teamsUrl.trim() ? { joinUrl: f.teamsUrl.trim(), meetingId: '' } : demoMeeting(id)) : undefined,
        isPublic: f.isPublic || undefined,
        engagement: f.engagement,
        inviteLink: makeInviteLink(id),
        createdById: scope.trainerId,
        department: scope.department || undefined,
        history: [{ at, by: scope.trainerId ? (data.people.find((p) => p.id === scope.trainerId)?.name ?? 'Trainer') : 'Training team', action: 'Created', detail: seriesId ? describeRecurrence(rule, f.date) : undefined }],
        progress: {},
      }
    })
    update(
      (d) => ({
        ...d,
        ...(coverId ? { trainingCovers: { ...d.trainingCovers, [coverId]: f.cover } } : {}),
        trainings: [...sessions, ...d.trainings],
        requests: preset?.requestId
          ? d.requests.map((r) => (r.id === preset.requestId ? { ...r, trainingId: sessions[0].id, history: [...r.history, { at, by: 'Training team', label: 'Scheduled', detail: sessions[0].name }] } : r))
          : d.requests,
      }),
      { action: seriesId ? `Created a series of ${sessions.length} sessions` : 'Created training', target: sessions[0].name },
    )
    if (!preset) localStorage.removeItem(DRAFT_KEY)
    onClose()
    navigate(`/admin/trainings/${sessions[0].id}`)
  }

  const conflictCount = conflicts.reduce((n, c) => n + c.list.length, 0)
  const stepIndex = Math.max(0, STEPS.findIndex((x) => x.id === (step === 3 ? 2 : step)))

  if (!open) return null
  const stepper = (
    <nav aria-label="Steps" className="border-b border-zinc-200/70 bg-surface px-4 sm:px-6">
      <ol className="mx-auto flex max-w-4xl items-center">
        {STEPS.map((s, i) => {
          const current = step === 3 ? 2 : step
          const isPast = current > s.id
          const isCurrent = current === s.id
          const accessible = canNavigateTo(s.id)
          return (
            <li key={s.id} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!accessible && !isPast}
                onClick={() => (s.id < step || accessible) && setStep(s.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn('relative flex items-center gap-2.5 py-3.5 pr-2 transition disabled:cursor-not-allowed', isCurrent ? 'text-zinc-900' : isPast ? 'text-zinc-700 hover:text-zinc-900' : 'text-zinc-500')}
              >
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', isPast ? 'bg-mpesa-600 text-white' : isCurrent ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'border border-zinc-300 bg-surface text-zinc-500')}>
                  {isPast ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('hidden text-sm whitespace-nowrap sm:inline', isCurrent ? 'font-bold' : 'font-medium')}>{s.label}</span>
                {isCurrent && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" aria-hidden />}
              </button>
              {i < STEPS.length - 1 && <span className={cn('mx-2 h-px flex-1', isPast ? 'bg-mpesa-500/60' : 'bg-zinc-200')} aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )

  return (
    <FullPageDialog
      onClose={onClose}
      title={preset?.requestId ? 'Schedule approved request' : 'Schedule a training'}
      subtitle={`Step ${stepIndex + 1} of ${STEPS.length}`}
      top={stepper}
      bare
      footer={
        <>
          <div className="mr-auto hidden sm:flex items-center gap-2 text-xs text-zinc-500">
            <span>{dates.length} session{dates.length === 1 ? '' : 's'}</span>
            <span>·</span>
            <span>{participantIds.length} participant{participantIds.length === 1 ? '' : 's'}</span>
          </div>
          {draftSavedAt && <span className="hidden text-xs text-mpesa-700 sm:inline">Draft saved {time12(new Date(draftSavedAt).toTimeString().slice(0, 5))}</span>}
          {!preset && (
            <Button onClick={saveDraft}>
              <Save className="size-4" /> Save draft
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          {stepIndex > 0 && (
            <Button onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          )}
          {stepIndex < STEPS.length - 1 ? (
            <Button variant="primary" onClick={handleNext} disabled={coverPending}>
              {coverPending ? 'Optimizing…' : `Continue to ${STEPS[stepIndex + 1].label.toLowerCase()}`} <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button variant="primary" onClick={create}>
              {conflictCount ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
              {conflictCount ? 'Create anyway' : dates.length > 1 ? `Create ${dates.length} sessions` : 'Create training'}
            </Button>
          )}
        </>
      }
    >
      {draft && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold text-zinc-900">You have an unfinished training draft</span>
            <span className="block text-xs text-zinc-600">
              “{draft.f.name || 'Untitled training'}” · saved {shortDate(draft.savedAt.slice(0, 10))} at {time12(new Date(draft.savedAt).toTimeString().slice(0, 5))}
            </span>
          </span>
          <Button size="sm" onClick={discardDraft}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={resumeDraft}>
            Resume draft
          </Button>
        </div>
      )}
      <div className={cn('space-y-6', step === 4 && 'rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-7')}>
        {/* STEP 1: BASICS */}
        {step === 1 && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-5">
              {/* Training details */}
              <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
                <h2 className="text-lg font-bold text-zinc-900">Training details</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <Field label={<>Training title <span className="text-brand-600">*</span></>}>
                      <Input
                        value={f.name}
                        onChange={(e) => set('name', e.target.value)}
                        placeholder="e.g. M-PESA Call Center Training-Batch 60"
                        autoFocus
                        className={cn(err1('name') && 'border-brand-500 ring-1 ring-brand-500')}
                      />
                    </Field>
                    {err1('name') && <p className="mt-1 text-xs text-brand-600">{err1('name')}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Field label={<>Category <span className="text-brand-600">*</span></>}>
                        <Select value={f.categoryId} onChange={(e) => setF((x) => ({ ...x, categoryId: e.target.value, subcategoryId: '' }))}>
                          {data.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {err1('categoryId') && <p className="mt-1 text-xs text-brand-600">{err1('categoryId')}</p>}
                    </div>
                    <Field label={<>Sub-category <span className="font-normal text-zinc-400">(optional)</span></>}>
                      <Select value={f.subcategoryId} onChange={(e) => set('subcategoryId', e.target.value)} disabled={!category?.subcategories.length}>
                        <option value="">{category?.subcategories.length ? 'None' : 'No sub-categories'}</option>
                        {category?.subcategories.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Training type">
                      <Select value={f.typeId} onChange={(e) => set('typeId', e.target.value)}>
                        {data.trainingTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Level">
                      <Select value={f.level} onChange={(e) => set('level', e.target.value as TrainingLevel)}>
                        {LEVELS.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div>
                    <input ref={coverFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload training cover image" onChange={(event) => void chooseCover(event.currentTarget.files?.[0])} />
                    <p className="mb-1.5 text-sm font-medium text-zinc-700">
                      Training cover image <span className="font-normal text-zinc-400">(optional)</span>
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      {f.cover && (
                        <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                          <img src={f.cover} alt="Training cover preview" className="h-32 w-full object-cover" />
                          <button type="button" onClick={() => { set('cover', ''); setCoverError('') }} disabled={coverPending} aria-label="Remove cover image" className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                            <X className="size-4" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => coverFileRef.current?.click()}
                        disabled={coverPending}
                        className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 px-4 text-center transition hover:border-brand-300 hover:bg-brand-50/30 disabled:cursor-wait disabled:opacity-70"
                      >
                        <Upload className="size-5 text-zinc-500" />
                        <span className="text-sm font-semibold text-zinc-800">{coverPending ? 'Optimizing image…' : f.cover ? 'Replace image' : 'Upload image'}</span>
                        <span className="text-xs text-zinc-500">JPG, PNG or WebP · up to 8 MB</span>
                      </button>
                    </div>
                    {coverError && <p className="mt-1.5 text-xs text-brand-600">{coverError}</p>}
                  </div>

                  <div>
                    <Field label="Training goal">
                      <Textarea rows={3} maxLength={500} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What will learners be able to do after this training?" />
                    </Field>
                    <p className="mt-1 text-right text-[11px] text-zinc-400 tabular-nums">{f.description.length} / 500</p>
                  </div>
                </div>
              </section>

              {/* Learning path builder */}
              <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-zinc-900">Learning path builder</h2>
                  <button type="button" onClick={() => setNewJourneyOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500 px-3.5 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
                    <Plus className="size-4" /> New journey
                  </button>
                </div>
                <div className="mt-4">
                  <JourneyMultiSelect journeys={data.journeys} selected={f.journeyIds} onChange={(ids) => set('journeyIds', ids)} invalid={!!err1('journeyId')} onCreateNew={() => setNewJourneyOpen(true)} />
                  {err1('journeyId') && <p className="mt-1 text-xs text-brand-600">{err1('journeyId')}</p>}
                </div>
                <div className="mt-4 space-y-4">
                  {chosenJourneys.map((j, ji) => (
                    <div key={j.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                          {chosenJourneys.length > 1 ? `Journey ${ji + 1} · ` : ''}
                          {j.name}
                        </p>
                        {chosenJourneys.length > 1 && (
                          <>
                            <button type="button" onClick={() => moveJourney(ji, -1)} disabled={ji === 0} aria-label={`Move ${j.name} up`} className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => moveJourney(ji, 1)} disabled={ji === chosenJourneys.length - 1} aria-label={`Move ${j.name} down`} className="grid size-7 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30">
                              <ArrowDown className="size-3.5" />
                            </button>
                          </>
                        )}
                        {/* Edit the journey in a new tab; changes show up here when saved. */}
                        <a href={`/admin/journeys/${j.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Edit ${j.name} in a new tab`} title="Edit journey (opens in a new tab)" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                          <Pencil className="size-3.5" /> Edit
                        </a>
                        <button type="button" onClick={() => set('journeyIds', f.journeyIds.filter((x) => x !== j.id))} aria-label={`Remove ${j.name}`} className="grid size-7 place-items-center rounded-lg text-zinc-400 hover:bg-brand-50 hover:text-brand-600">
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {j.modules.length ? (
                        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80">
                          {j.modules.map((m, mi) => {
                            const mats = m.materialIds.map((id) => data.materials.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x)
                            const minutes = mats.reduce((s, x) => s + (x.minutes ?? 0), 0)
                            const open = openModules.has(m.id)
                            return (
                              <li key={m.id}>
                                <button type="button" onClick={() => toggleModule(m.id)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50/70">
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-zinc-900">
                                      {mi + 1}. {m.title}
                                    </span>
                                    <span className="block truncate text-xs text-zinc-500">{mats[0]?.title ?? 'No materials yet'}</span>
                                  </span>
                                  <span className="hidden shrink-0 text-xs text-zinc-600 tabular-nums sm:block">{minutes} min</span>
                                  <span className="hidden w-20 shrink-0 text-xs text-zinc-600 sm:block">
                                    {mats.length} lesson{mats.length === 1 ? '' : 's'}
                                  </span>
                                  <Badge tone={m.assessmentId ? 'amber' : m.skippable ? 'zinc' : 'green'} className="shrink-0">
                                    {m.assessmentId ? 'Milestone' : m.skippable ? 'Optional' : 'Required'}
                                  </Badge>
                                  <ChevronDown className={cn('size-4 shrink-0 text-zinc-400 transition', open && 'rotate-180')} />
                                </button>
                                {open && (
                                  <ul className="space-y-1 bg-zinc-50/70 px-4 pb-3">
                                    {mats.map((x) => (
                                      <li key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-xs">
                                        <span className="min-w-0 truncate font-medium text-zinc-800">{x.title}</span>
                                        <span className="shrink-0 text-zinc-500">
                                          {x.type.toLowerCase()} · {x.minutes} min
                                        </span>
                                      </li>
                                    ))}
                                    {!mats.length && <li className="px-1 py-2 text-xs text-zinc-500">Add materials to this module on the journey page.</li>}
                                  </ul>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-3 text-xs text-zinc-500">This journey has no modules yet.</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <span className="mb-1.5 block text-sm font-medium text-zinc-900">
                    Additional materials <span className="font-normal text-zinc-400">(optional)</span>
                  </span>
                  {extraMaterials.length > 0 && (
                    <ul className="mb-2 flex flex-wrap gap-2">
                      {extraMaterials.map((m) => (
                        <li key={m.id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-surface py-1 pr-1 pl-3 text-sm">
                          <span className="truncate font-medium text-zinc-800">{m.title}</span>
                          <span className="shrink-0 text-[11px] text-zinc-500">{m.type.toLowerCase()}</span>
                          <button type="button" onClick={() => set('extraMaterialIds', f.extraMaterialIds.filter((x) => x !== m.id))} aria-label={`Remove ${m.title}`} className="grid size-6 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-brand-50 hover:text-brand-600">
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {otherMaterials.length > 0 ? (
                    <Select value="" onChange={(e) => e.target.value && set('extraMaterialIds', [...f.extraMaterialIds, e.target.value])}>
                      <option value="">+ Add a material from the library…</option>
                      {otherMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} · {m.type.toLowerCase()}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-xs text-zinc-500">All library materials are already part of this training.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="min-w-0 space-y-5 lg:sticky lg:top-0">
              {/* What learners will see */}
              <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
                <h2 className="text-lg font-bold text-zinc-900">Learner experience preview</h2>
                <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-brand-50/40 to-surface">
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    <UserAvatar name="Learner preview" className="size-16 shrink-0 ring-4 ring-brand-100" />
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-zinc-900">Your learning journey</span>
                      <span className="block text-xs leading-relaxed text-zinc-500">Build skills, earn recognition.</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-brand-700">{f.name.trim() || 'Training title'}</span>
                    </span>
                  </div>

                  {/* Milestones: start, practice, achievement */}
                  <ol className="grid grid-cols-3 px-2 pb-5 text-center">
                    {milestones.map((ms, i) => {
                      const Icon = [Play, BarChart3, Trophy][i]
                      return (
                        <li key={i} className="relative">
                          {i < milestones.length - 1 && <span className="absolute top-5 left-1/2 h-0.5 w-full bg-brand-100" aria-hidden />}
                          <span className={cn('relative mx-auto grid size-10 place-items-center rounded-full text-white shadow-md shadow-brand-600/25', i === 2 ? 'bg-brand-600 ring-4 ring-brand-100' : 'bg-brand-600')}>
                            <Icon className={cn('size-5', i === 0 && 'ml-0.5 fill-current')} />
                          </span>
                          <span className="mt-2.5 block px-1 text-xs leading-tight font-bold text-zinc-900 sm:text-sm">{ms.label}</span>
                          <span className="mt-0.5 line-clamp-2 block px-1 text-[11px] leading-snug text-zinc-500" title={ms.sub}>
                            {ms.sub}
                          </span>
                        </li>
                      )
                    })}
                  </ol>

                  {f.engagement.progress && (
                    <div className="border-t border-zinc-200/70 bg-surface px-4 py-3.5 sm:px-5">
                      <div className="grid grid-cols-3 gap-1.5" aria-hidden>
                        {milestones.map((_, i) => (
                          <span key={i} className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                            {i === 0 && <span className="block h-full w-1/3 rounded-full bg-brand-600" />}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-zinc-800">0 of {milestones.length} milestones completed</span>
                        <span className="inline-flex items-center gap-1.5 text-zinc-600 tabular-nums">
                          <Clock className="size-3.5 text-brand-600" /> Estimated time: {pathMinutes} min
                        </span>
                      </div>
                    </div>
                  )}

                  {(f.engagement.celebrate || (f.autoIssue && chosenTemplate)) && (
                    <div className={cn("grid gap-2 border-t border-zinc-200/70 bg-surface p-3", f.engagement.celebrate && f.autoIssue && chosenTemplate && "grid-cols-2")}>
                      {f.engagement.celebrate && (
                        <p className="flex items-center gap-2.5 rounded-xl bg-brand-50 px-3 py-3 text-xs leading-snug font-semibold text-brand-700">
                          <Star className="size-5 shrink-0 fill-amber-400 text-amber-400" /> Every lesson counts — keep going!
                        </p>
                      )}
                      {f.autoIssue && chosenTemplate && (
                        <p className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 px-3 py-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-white shadow-sm ring-2 ring-amber-200">
                            <Award className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm leading-tight font-bold text-zinc-900">{trainingType ? `${trainingType.name.replace(/ (onboarding|upskilling|enablement)$/i, '')} Ready` : 'Certified'}</span>
                            <span className="block truncate text-[11px] text-amber-800">{chosenTemplate.name}</span>
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Feedback & certificate */}
              <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
                <h2 className="text-lg font-bold text-zinc-900">Feedback &amp; certificate</h2>
                <div className="mt-4 space-y-4">
                  <Field label="Feedback form">
                    <div className="flex gap-2">
                    <Select value={f.feedbackFormId} onChange={(e) => set('feedbackFormId', e.target.value)} className="min-w-0 flex-1">
                      <option value="">{typeFeedbackForm ? `${typeFeedbackForm.title} (type default)` : 'No feedback form'}</option>
                      {data.feedbackForms
                        .filter((ff) => ff.id !== typeFeedbackForm?.id)
                        .map((ff) => (
                          <option key={ff.id} value={ff.id}>
                            {ff.title}
                          </option>
                        ))}
                    </Select>
                    {/* New form in a new tab; it appears in this list once saved. */}
                    <a href="/admin/feedback/forms?new=1" target="_blank" rel="noopener noreferrer" aria-label="Create a new feedback form in a new tab" title="New feedback form (opens in a new tab)" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-surface px-4 py-2 text-zinc-800 shadow-xs transition hover:border-zinc-300 hover:bg-zinc-50">
                      <Plus className="size-4" />
                    </a>
                    </div>
                  </Field>
                  <Field label="Certificate template">
                    <div className="flex gap-2">
                      <Select value={f.certificateTemplateId} onChange={(e) => set('certificateTemplateId', e.target.value)} className="min-w-0 flex-1">
                        <option value="">{typeTemplate ? `${typeTemplate.name} (type default)` : 'Default template'}</option>
                        {data.templates
                          .filter((tp) => tp.id !== typeTemplate?.id)
                          .map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.name}
                            </option>
                          ))}
                      </Select>
                      <Button type="button" onClick={() => setPreviewingTemplate(true)} disabled={!chosenTemplate} aria-label="Preview certificate template" title="Preview certificate" className="shrink-0 px-2.5">
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  </Field>
                  <ToggleRow label="Issue certificates automatically" hint="When a learner meets every requirement." on={f.autoIssue} onChange={(v) => set('autoIssue', v)} />
                </div>
              </section>

              {/* Keep learners motivated */}
              <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
                <h2 className="text-lg font-bold text-zinc-900">Keep learners motivated</h2>
                <div className="mt-3 divide-y divide-zinc-100">
                  <ToggleRow label="Celebrate module completion" hint="Show a success message when a module is completed." on={f.engagement.celebrate} onChange={(v) => set('engagement', { ...f.engagement, celebrate: v })} />
                  <ToggleRow label="Show progress and milestones" hint="Let learners track their progress." on={f.engagement.progress} onChange={(v) => set('engagement', { ...f.engagement, progress: v })} />
                  <ToggleRow label="Send gentle learning reminders" hint="Remind learners about unfinished training." on={f.engagement.reminders} onChange={(v) => set('engagement', { ...f.engagement, reminders: v })} />
                </div>
              </section>
            </div>
          </div>
        )}

        {(step === 2 || step === 3) && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* STEP 2 (left): SCHEDULE & DELIVERY */}
          <section className="space-y-6 rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-bold text-zinc-900">Schedule</h2>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-zinc-900">Delivery mode</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery method">
                {(
                  [
                    ['Online', Video],
                    ['Physical', MapPin],
                  ] as const
                ).map(([v, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={f.delivery === v}
                    onClick={() => set('delivery', v)}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                      f.delivery === v ? 'border-brand-600 bg-brand-50/40 ring-2 ring-brand-500/20' : 'border-zinc-200 hover:bg-zinc-50/80',
                    )}
                  >
                    <Icon className={cn('mt-0.5 size-5 shrink-0', f.delivery === v ? 'text-brand-600' : 'text-zinc-500')} />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{v}</span>
                    </span>
                  </button>
                ))}
              </div>

              {f.delivery === 'Online' && (
                <div className="mt-3">
                  <Field label="Teams meeting link (optional)">
                    <Input
                      value={f.teamsUrl}
                      onChange={(e) => set('teamsUrl', e.target.value)}
                      placeholder="https://teams.microsoft.com/l/meetup-join/…"
                      className={cn(err2('teamsUrl') && 'border-brand-500 ring-1 ring-brand-500')}
                    />
                  </Field>
                  {err2('teamsUrl') ? (
                    <p className="mt-1 text-xs text-brand-600">{err2('teamsUrl')}</p>
                  ) : (
                    f.teamsUrl.trim() && TEAMS_URL_RE.test(f.teamsUrl.trim()) && <p className="mt-1 text-xs font-medium text-mpesa-700">✓ Teams link accepted — participants join with this link.</p>
                  )}
                </div>
              )}

              {f.delivery === 'Physical' && (
                <div className="mt-3">
                  <Field label="Venue / Location">
                    <VenueInput value={f.location} onChange={(v) => set('location', v)} invalid={!!err2('location')} />
                  </Field>
                  {err2('location') && <p className="mt-1 text-xs text-brand-600">{err2('location')}</p>}
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200/90 p-4 transition hover:bg-zinc-50/80">
              <input type="checkbox" checked={f.isPublic} onChange={(e) => set('isPublic', e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
              <span>
                <span className="block text-sm font-semibold text-zinc-900">Public training</span>
              </span>
            </label>

            <div className="rounded-2xl border border-zinc-200/90 bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-lg font-bold text-zinc-900">Session frequency</h4>
                <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="radiogroup" aria-label="Once or recurring">
                  {(
                    [
                      [false, 'One-time session'],
                      [true, 'Recurring series'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={f.repeat === v}
                      onClick={() => set('repeat', v)}
                      className={cn('rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', f.repeat === v ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'text-zinc-600 hover:text-zinc-900')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-5 mb-3 text-sm font-bold text-zinc-900">{f.repeat ? 'First session' : 'Session'}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <Field label={f.repeat ? 'Start date' : 'Date'}>
                    <Input
                      type="date"
                      min={todayISO()}
                      value={f.date}
                      onChange={(e) => setF((x) => ({ ...x, date: e.target.value, weekdays: x.weekdays.length > 1 ? x.weekdays : [weekdayOf(e.target.value)] }))}
                      className={cn(err2('date') && 'border-brand-500')}
                    />
                  </Field>
                  {err2('date') && <p className="mt-1 text-xs text-brand-600">{err2('date')}</p>}
                </div>
                <Field label="Start time">
                  <Input type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} />
                </Field>
                <div>
                  <Field label="End time">
                    <Input type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} className={cn(err2('endTime') && 'border-brand-500')} />
                  </Field>
                  {err2('endTime') && <p className="mt-1 text-xs text-brand-600">{err2('endTime')}</p>}
                </div>
              </div>

              {f.repeat && (
                <>
                  <div className="mt-5 border-t border-zinc-100 pt-5">
                    <p className="mb-3 text-sm font-bold text-zinc-900">Repeat schedule</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Repeats">
                        <Select value={f.freq} onChange={(e) => set('freq', e.target.value as RecurrenceFreq)}>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </Select>
                      </Field>
                      <Field label="Every">
                        <Select value={String(f.interval)} onChange={(e) => set('interval', Number(e.target.value))}>
                          {Array.from({ length: 12 }, (_, n) => n + 1).map((n) => {
                            const unit = f.freq === 'daily' ? 'day' : f.freq === 'weekly' ? 'week' : 'month'
                            return (
                              <option key={n} value={n}>
                                {n} {unit}
                                {n > 1 ? 's' : ''}
                              </option>
                            )
                          })}
                        </Select>
                      </Field>
                    </div>

                    {f.freq === 'weekly' ? (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-zinc-700">Repeat on</p>
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label="Days of the week">
                          {WEEKDAYS.map((d, i) => {
                            const on = f.weekdays.includes(i)
                            return (
                              <button
                                key={d}
                                type="button"
                                aria-pressed={on}
                                onClick={() => set('weekdays', on ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i].sort())}
                                className={cn(
                                  'min-w-0 rounded-xl py-2.5 text-sm font-bold transition sm:text-base',
                                  on ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70',
                                )}
                              >
                                <span className="sm:hidden">{d.slice(0, 1)}</span>
                                <span className="hidden sm:inline">{d}</span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          {(
                            [
                              ['Weekdays', [1, 2, 3, 4, 5]],
                              ['Every day', [0, 1, 2, 3, 4, 5, 6]],
                              ['Clear', []],
                            ] as const
                          ).map(([label, days]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => set('weekdays', [...days])}
                              disabled={label === 'Clear' && !f.weekdays.length}
                              className={cn(
                                'rounded-xl border py-2.5 text-sm font-semibold whitespace-nowrap transition disabled:opacity-40',
                                label === 'Clear' ? 'border-zinc-200 text-zinc-600 hover:bg-zinc-50' : 'border-brand-200 bg-brand-50/50 text-brand-700 hover:bg-brand-50',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {err2('weekdays') && <p className="mt-1 text-xs text-brand-600">{err2('weekdays')}</p>}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">{f.freq === 'daily' ? 'Repeats every day from the start date.' : 'Repeats on the same date each month.'}</p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-zinc-100 pt-5">
                    <p className="mb-3 text-sm font-bold text-zinc-900">Ends</p>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3" role="radiogroup" aria-label="When the series ends">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                        <input type="radio" name="series-end" checked={f.endMode === 'never'} onChange={() => set('endMode', 'never')} className="size-4 accent-brand-600" />
                        Never <span className="text-xs text-zinc-400">(up to {MAX_OCCURRENCES})</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                        <input type="radio" name="series-end" checked={f.endMode === 'date'} onChange={() => set('endMode', 'date')} className="size-4 accent-brand-600" />
                        On
                        <Input
                          type="date"
                          min={f.date}
                          value={f.until}
                          disabled={f.endMode !== 'date'}
                          onFocus={() => set('endMode', 'date')}
                          onChange={(e) => set('until', e.target.value)}
                          className={cn('w-40 py-1.5', err2('until') && f.endMode === 'date' && 'border-brand-500')}
                          aria-label="Series end date"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                        <input type="radio" name="series-end" checked={f.endMode === 'count'} onChange={() => set('endMode', 'count')} className="size-4 accent-brand-600" />
                        After
                        <Input
                          type="number"
                          min={1}
                          max={MAX_OCCURRENCES}
                          value={f.count}
                          disabled={f.endMode !== 'count'}
                          onChange={(e) => set('count', Math.min(MAX_OCCURRENCES, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-20 py-1.5 text-center"
                          aria-label="Number of sessions"
                        />
                        sessions
                      </label>
                    </div>
                    {err2('until') && <p className="mt-1.5 text-xs text-brand-600">{err2('until')}</p>}
                  </div>

                  {/* Series summary: how many sessions, the pattern and time, and the dates. */}
                  <div className="mt-5 flex items-stretch gap-4 rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
                    <span className="grid size-12 shrink-0 place-items-center self-center rounded-xl bg-brand-600 text-white">
                      <CalendarCheck2 className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1 border-l border-brand-200 pl-4">
                      <p className="text-2xl leading-tight font-extrabold text-brand-600 tabular-nums">
                        {dates.length} session{dates.length === 1 ? '' : 's'}
                        {dates.length >= MAX_OCCURRENCES && <span className="ml-2 text-xs font-semibold text-brand-700">(maximum)</span>}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                        {seriesTitle} · {time12(f.startTime)} – {time12(f.endTime)}
                      </p>
                      {dates.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-600">
                          {shortDate(dates[0])} – {shortDate(dates.at(-1)!)}
                          <span className="mx-1.5 text-zinc-400">·</span>
                          {dates
                            .slice(0, 5)
                            .map((d) => parseDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
                            .join(' · ')}
                          {dates.length > 5 ? ' …' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

        {/* STEP 2 (right): AUDIENCE & TRAINERS */}
          <section className="space-y-5 rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-bold text-zinc-900">Audience</h2>
            <div>
              <Field label="Assigned trainers">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {assignedTrainers.map((trainer) => (
                    <div key={trainer.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2">
                      <Avatar name={trainer.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900">{trainer.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{trainer.department || 'Training'}</span>
                      </span>
                      <button type="button" onClick={() => set('trainerIds', f.trainerIds.filter((id) => id !== trainer.id))} aria-label={`Remove ${trainer.name}`} title="Remove trainer" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition hover:bg-brand-100">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {choosingTrainer ? (
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <Select
                        className="min-w-0 flex-1"
                        value={candidateTrainerId}
                        onChange={(event) => {
                          if (event.target.value === ADD_TRAINER_OPTION) {
                            setChoosingTrainer(false)
                            setAddingTrainer(true)
                          } else setCandidateTrainerId(event.target.value)
                        }}
                        autoFocus
                      >
                        <option value="">Choose a trainer…</option>
                        {trainers.filter((trainer) => !f.trainerIds.includes(trainer.id)).map((trainer) => (
                          <option key={trainer.id} value={trainer.id}>{trainer.name} ({trainer.department || 'Training'})</option>
                        ))}
                        <option value={ADD_TRAINER_OPTION}>+ Add new trainer…</option>
                      </Select>
                      <Button size="sm" variant="primary" disabled={!candidateTrainerId || candidateTrainerId === ADD_TRAINER_OPTION} onClick={() => { set('trainerIds', [...new Set([...f.trainerIds, candidateTrainerId])]); setChoosingTrainer(false); setCandidateTrainerId('') }}>
                        <Plus className="size-3.5" /> Add
                      </Button>
                      <Button size="sm" onClick={() => setChoosingTrainer(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => { setCandidateTrainerId(trainers.find((trainer) => !f.trainerIds.includes(trainer.id))?.id ?? ''); setChoosingTrainer(true) }}>
                      <Plus className="size-3.5" /> Add trainer
                    </Button>
                  )}
                </div>
              </Field>
              {err3('trainerIds') && <p className="mt-1 text-xs text-brand-600">{err3('trainerIds')}</p>}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-zinc-900">Target learner groups</label>
              {(preset?.participantIds?.length ?? 0) > 0 && (
                <p className="text-xs text-mpesa-700 bg-mpesa-500/10 border border-mpesa-500/30 rounded-xl px-3 py-1.5 font-medium">
                  ✓ {preset!.participantIds!.length} participants from the approved request are already included.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {data.groups.map((g) => {
                  const on = f.groupIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('groupIds', on ? f.groupIds.filter((x) => x !== g.id) : [...f.groupIds, g.id])}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                        on ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold shadow-xs' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100',
                      )}
                    >
                      {on && '✓ '}
                      {g.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Field label="Direct participant emails (optional)">
                <EmailChipsInput
                  value={f.emails}
                  onChange={(v) => {
                    set('emails', v)
                    setEmailImportSummary('')
                    setEmailImportError('')
                    setInvalidEmailRows([])
                  }}
                  known={(email) => data.people.find((p) => p.email.toLowerCase() === email)?.name}
                />
              </Field>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input ref={emailFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void importParticipantEmails(event.target.files?.[0])} />
                <Button size="sm" disabled={readingEmailFile} onClick={() => emailFileRef.current?.click()}>
                  <FileSpreadsheet className="size-3.5" /> {readingEmailFile ? 'Reading file…' : 'Import from Excel'}
                </Button>
                <Button size="sm" variant="ghost" onClick={downloadParticipantTemplate}>
                  <Download className="size-3.5" /> Download template
                </Button>
                {emailImportSummary && <span className="text-xs text-mpesa-700">{emailImportSummary}</span>}
                {emailImportError && <span role="alert" className="text-xs text-brand-600">{emailImportError}</span>}
              </div>
              {invalidEmailRows.length > 0 && (
                <div role="alert" className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900">
                  <p className="flex items-center justify-between gap-2 font-semibold">
                    {invalidEmailRows.length} row{invalidEmailRows.length === 1 ? '' : 's'} skipped — not a valid email
                    <button type="button" onClick={() => setInvalidEmailRows([])} aria-label="Dismiss" className="rounded-full p-0.5 text-amber-700 hover:bg-amber-500/15">
                      <X className="size-3.5" />
                    </button>
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {invalidEmailRows.slice(0, 6).map((x) => (
                      <li key={x.row}>
                        <b>Row {x.row}</b>: “{x.value}”
                      </li>
                    ))}
                  </ul>
                  {invalidEmailRows.length > 6 && <p className="mt-0.5">+{invalidEmailRows.length - 6} more rows</p>}
                  <p className="mt-1 text-amber-800">Fix these in the file and import again. The valid emails were added.</p>
                </div>
              )}
              {notEmails.length > 0 && (
                <p className="mt-1 text-xs text-brand-600">
                  Not valid emails, left out: {notEmails.slice(0, 4).map((e) => `“${e}”`).join(', ')}
                  {notEmails.length > 4 ? ` +${notEmails.length - 4} more` : ''}.
                </p>
              )}
              {matched.length > 0 && (
                <p className="mt-1 text-xs text-mpesa-700">
                  {matched.length} directory contact{matched.length === 1 ? '' : 's'} recognized and added.
                </p>
              )}
              {unknown.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  External or unlisted emails: {unknown.slice(0, 3).join(', ')}
                  {unknown.length > 3 ? ` +${unknown.length - 3} more` : ''} (add them as Temporary Users to grant immediate access).
                </p>
              )}
            </div>
          </section>
        </div>
        )}

        {/* STEP 4: ASSESSMENTS & REVIEW */}
        {step === 4 && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={
                  <span className="flex items-center justify-between gap-2">
                    Pre-assessment <span className="font-normal text-zinc-400">(optional)</span>
                    <a href="/admin/assessments/pre?new=1" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                      <Plus className="size-3" /> Create new <ExternalLink className="size-3" />
                    </a>
                  </span>
                }
              >
                <Select value={f.preAssessmentId} onChange={(e) => set('preAssessmentId', e.target.value)}>
                  <option value="">None (skip baseline test)</option>
                  {data.assessments.filter((a) => a.kind === 'PRE').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={
                  <span className="flex items-center justify-between gap-2">
                    Post-assessment <span className="font-normal text-zinc-400">(optional)</span>
                    <a href="/admin/assessments/post?new=1" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                      <Plus className="size-3" /> Create new <ExternalLink className="size-3" />
                    </a>
                  </span>
                }
              >
                <Select value={f.postAssessmentId} onChange={(e) => set('postAssessmentId', e.target.value)}>
                  <option value="">None (completion only)</option>
                  {data.assessments.filter((a) => a.kind === 'POST').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Summary card */}
            <Card className="bg-zinc-50/70 border-zinc-200/90 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 mb-1">
                    <Sparkles className="size-3.5" /> Training Summary
                  </span>
                  <h3 className="text-base font-bold text-zinc-900">{f.name || 'Untitled Training'}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {category?.name}{f.subcategoryId ? ` › ${category?.subcategories.find(s => s.id === f.subcategoryId)?.name}` : ''} · {trainingType?.name}
                  </p>
                </div>
                <Badge tone="blue">{f.level}</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-zinc-200/70 pt-3">
                <div>
                  <span className="block text-zinc-400 font-medium">Delivery</span>
                  <span className="font-semibold text-zinc-900 flex items-center gap-1 mt-0.5">
                    {f.delivery === 'Online' ? <Video className="size-3 text-brand-600" /> : <MapPin className="size-3 text-brand-600" />}
                    {f.delivery === 'Online' ? (f.teamsUrl.trim() ? 'Teams · your link' : 'Teams · auto link') : f.location}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 font-medium">Date & Time</span>
                  <span className="font-semibold text-zinc-900 block mt-0.5">
                    {shortDate(f.date)} · {time12(f.startTime)}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 font-medium">Trainer</span>
                  <span className="font-semibold text-zinc-900 block mt-0.5 truncate">
                    {assignedTrainers.map((trainer) => trainer.name).join(', ') || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 font-medium">Total Audience</span>
                  <span className="font-semibold text-zinc-900 flex items-center gap-1 mt-0.5">
                    <Users className="size-3 text-brand-600" />
                    {participantIds.length} enrolled
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-zinc-600 border-t border-zinc-200/70 pt-3">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Layers className="size-3 text-zinc-400" /> {chosenJourneys.length > 1 ? 'Journeys' : 'Journey'}: {chosenJourneys.map((j) => j.name).join(' → ') || 'None'}
                </span>
                {extraMaterials.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <FileText className="size-3 text-zinc-400" /> +{extraMaterials.length} additional material{extraMaterials.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <Repeat className="size-3 text-zinc-400" /> {dates.length} scheduled session{dates.length === 1 ? '' : 's'}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3 text-zinc-400" /> Pre: {f.preAssessmentId ? 'Attached' : 'None'} · Post: {f.postAssessmentId ? 'Attached' : 'None'}
                </span>
              </div>
            </Card>

            {/* Conflicts Warning */}
            {conflicts.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="size-4 shrink-0" /> {conflictCount} scheduling conflict{conflictCount === 1 ? '' : 's'}
                </h4>
                <ul className="space-y-1.5 text-xs text-amber-900">
                  {conflicts.slice(0, 4).flatMap(({ date, list }) =>
                    list.map((c, i) => (
                      <li key={`${date}-${i}`}>
                        <span className="font-medium">{shortDate(date)}:</span>{' '}
                        {c.kind === 'trainer'
                          ? `${assignedTrainers.map((trainer) => trainer.name).join(', ')} is already running “${c.training.name}” (${time12(c.training.startTime)}–${time12(c.training.endTime)}).`
                          : `${c.people.length} trainee${c.people.length === 1 ? ' is' : 's are'} also booked in “${c.training.name}”.`}
                      </li>
                    )),
                  )}
                </ul>
                <p className="text-[11px] text-amber-800">You can still create the session if other bookings are tentative.</p>
              </div>
            )}
          </section>
        )}
      </div>

      {previewingTemplate && chosenTemplate && (
        <Modal open wide onClose={() => setPreviewingTemplate(false)} title={chosenTemplate.name} footer={<Button onClick={() => setPreviewingTemplate(false)}>Close</Button>}>
          <CertificatePreview template={chosenTemplate} course={f.name.trim() || 'Training title'} trainer={f.trainerIds.map((id) => data.people.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'Trainer Name'} />
        </Modal>
      )}
      {newJourneyOpen && <QuickJourneyModal onClose={() => setNewJourneyOpen(false)} onCreated={(id) => set('journeyIds', [...f.journeyIds, id])} />}
      {addingTrainer && <AddTrainerModal onClose={() => setAddingTrainer(false)} onCreated={(id) => set('trainerIds', [...new Set([...f.trainerIds, id])])} />}
    </FullPageDialog>
  )
}
