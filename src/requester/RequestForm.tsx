import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Pencil, FileText, Loader2, MapPin, Paperclip, Plus, Save, Send, Upload, UserPlus, Users, Video, Target, X, type LucideIcon } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { DuplicateWarning } from '../admin/RequestParts'
import { shortDate } from '../admin/helpers'
import {
  ATTACHMENT_LIMITS,
  DRAFT_TTL_MS,
  EMAIL_RE,
  findDuplicates,
  isInternalEmail,
  mergeParticipants,
  parseParticipants,
} from '../admin/requests'
import { uid } from '../admin/store'
import type { RequestAttachment, TrainingRequest } from '../admin/types'
import { cn, localISO, todayISO } from '../lib/utils'
import { useRequester } from './useRequester'

type Form = Pick<
  TrainingRequest,
  | 'topic'
  | 'trainingTypeId'
  | 'categories'
  | 'subcategories'
  | 'otherCategory'
  | 'targetGroupIds'
  | 'audienceNote'
  | 'delivery'
  | 'location'
  | 'preferredDate'
  | 'preferredTime'
  | 'participants'
  | 'objectives'
  | 'description'
  | 'attachments'
>

const EMPTY: Form = {
  topic: '',
  trainingTypeId: '',
  categories: [],
  subcategories: [],
  otherCategory: '',
  targetGroupIds: [],
  audienceNote: '',
  delivery: 'Online',
  location: '',
  preferredDate: '',
  preferredTime: '',
  participants: [],
  objectives: '',
  description: '',
  attachments: [],
}

const inputCls =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function validate(f: Form, otherOn: boolean) {
  const e: Partial<Record<keyof Form | 'otherCategory', string>> = {}
  if (!f.topic.trim()) e.topic = 'Give the request a short title.'
  if (!f.trainingTypeId) e.trainingTypeId = 'Choose the training type.'
  if (!f.categories.length && !otherOn) e.categories = 'Pick at least one category.'
  if (otherOn && !f.otherCategory.trim()) e.otherCategory = 'Describe the other category.'
  if (!f.targetGroupIds.length && !f.audienceNote.trim()) e.targetGroupIds = 'Choose a group or describe the audience.'
  if (f.delivery === 'Physical' && !f.location.trim()) e.location = 'Physical sessions need a location.'
  if (!f.preferredDate) e.preferredDate = 'Choose a preferred date.'
  else if (f.preferredDate < todayISO()) e.preferredDate = 'The date can’t be in the past.'
  if (!f.preferredTime) e.preferredTime = 'Choose a preferred time.'
  if (!f.participants.length) e.participants = 'Add at least one participant.'
  else if (f.participants.some((p) => !isInternalEmail(p.email) && !p.name.trim()))
    e.participants = 'Temporary (external) trainees need a name as well as an email.'
  if (!f.objectives.trim()) e.objectives = 'Describe what the team should be able to do after the training.'
  return e
}

type StepId = 'about' | 'audience' | 'when' | 'goals' | 'review'

/** The request form as five steps; each lists the fields it validates. */
const STEPS: { id: StepId; title: string; fields: string[] }[] = [
  { id: 'about', title: 'About the training', fields: ['topic', 'trainingTypeId', 'categories', 'otherCategory'] },
  { id: 'audience', title: 'Audience & participants', fields: ['targetGroupIds', 'participants'] },
  { id: 'when', title: 'Delivery & timing', fields: ['delivery', 'location', 'preferredDate', 'preferredTime'] },
  { id: 'goals', title: 'Objectives & files', fields: ['objectives', 'description', 'attachments'] },
  { id: 'review', title: 'Review & submit', fields: [] },
]

function Section({ title, hint, icon: Icon, eyebrow, children }: { title: string; hint?: string; icon?: LucideIcon; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3.5 border-b border-zinc-100 pb-5">
        {Icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold tracking-wider text-brand-600 uppercase">{eyebrow}</p>}
          <h2 className="text-lg leading-tight font-bold text-zinc-900">{title}</h2>
          {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  )
}

function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-zinc-800">
      {children}
      {optional ? <span className="ml-1 font-normal text-zinc-400">(optional)</span> : <span className="ml-0.5 text-brand-600">*</span>}
    </label>
  )
}

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-700">
      <AlertCircle className="size-3.5 shrink-0" /> {msg}
    </p>
  )
}

/** "+ Add" chip that turns into a small input; Enter adds, Esc cancels. */
function AddChip({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const commit = () => {
    const v = value.trim()
    if (v) onAdd(v)
    setValue('')
    setEditing(false)
  }
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:border-brand-400 hover:text-brand-700"
      >
        <Plus className="size-3.5" /> {label}
      </button>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-400 bg-white py-0.5 pr-0.5 pl-3 ring-2 ring-brand-100">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            setValue('')
            setEditing(false)
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-40 bg-transparent py-1 text-sm outline-none placeholder:text-zinc-400"
      />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commit} className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700">
        Add
      </button>
    </span>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition',
        on ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  )
}

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

export function RequestForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const { data, update, me, team, mine } = useRequester()
  const existing = id ? mine.find((r) => r.id === id) : undefined

  const [form, setForm] = useState<Form>(() => {
    if (!existing) return EMPTY
    const { topic, trainingTypeId, categories, subcategories = [], otherCategory, targetGroupIds, audienceNote, delivery, location, preferredDate, preferredTime, participants, objectives, description, attachments } = existing
    return { topic, trainingTypeId, categories, subcategories, otherCategory, targetGroupIds, audienceNote, delivery, location, preferredDate, preferredTime, participants, objectives, description, attachments }
  })
  // Older drafts may carry a free-text "Other" category; new ones use "Add category" instead.
  const otherOn = !!existing?.otherCategory
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState<null | 'draft' | 'submit'>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [paste, setPaste] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: number; errors: string[] } | null>(null)
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const listInput = useRef<HTMLInputElement>(null)
  const attachInput = useRef<HTMLInputElement>(null)

  const errors = useMemo(() => validate(form, otherOn), [form, otherOn])
  const [step, setStep] = useState<StepId>('about')
  const [checked, setChecked] = useState<Set<StepId>>(new Set())
  const stepIndex = STEPS.findIndex((x) => x.id === step)
  const stepErrors = (id: StepId) => STEPS.find((x) => x.id === id)!.fields.filter((f) => errors[f as keyof typeof errors])
  // Errors show once a step has been checked (Next pressed) or after a submit attempt.
  const show = (k: keyof typeof errors) => (tried || STEPS.some((x) => checked.has(x.id) && x.fields.includes(k as string)) ? errors[k] : undefined)
  const errorCount = Object.keys(errors).length
  const goTo = (id: StepId) => {
    setStep(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const next = () => {
    setChecked((c) => new Set(c).add(step))
    if (stepErrors(step).length) {
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50)
      return
    }
    goTo(STEPS[stepIndex + 1].id)
  }
  const duplicates = useMemo(
    () => (form.trainingTypeId && form.preferredDate ? findDuplicates({ id: existing?.id ?? '', team, trainingTypeId: form.trainingTypeId, preferredDate: form.preferredDate }, data.requests) : []),
    [form.trainingTypeId, form.preferredDate, team, data.requests, existing?.id],
  )

  if (id && !existing) return <Navigate to="/requests" replace />
  if (existing && existing.status !== 'DRAFT') return <Navigate to={`/requests/${existing.id}`} replace />
  if (!me) return <Navigate to="/requests" replace />

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (k: 'categories' | 'subcategories' | 'targetGroupIds', v: string) =>
    setForm((f) => {
      const list = f[k] ?? []
      return { ...f, [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] }
    })

  const newIsExternal = EMAIL_RE.test(newEmail.trim()) && !isInternalEmail(newEmail.trim())
  const newKnown = data.people.find((p) => p.email.toLowerCase() === newEmail.trim().toLowerCase())
  const addOne = () => {
    const email = newEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      setImportMsg({ ok: 0, errors: [`“${newEmail}” isn’t a valid email address`] })
      return
    }
    // Company emails take the name from the directory (or the address); outside emails need a typed name.
    const known = data.people.find((p) => p.email.toLowerCase() === email)
    const internal = isInternalEmail(email)
    if (!internal && !newName.trim()) {
      setImportMsg({ ok: 0, errors: ['Add the full name for this outside (temporary) trainee'] })
      return
    }
    const fromAddress = email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ')
    set('participants', mergeParticipants(form.participants, [{ email, name: internal ? known?.name || fromAddress : newName.trim() }]))
    setNewEmail('')
    setNewName('')
    setImportMsg(null)
  }

  const importText = (text: string) => {
    const { rows, errors: errs } = parseParticipants(text)
    const named = rows.map((r) => ({ ...r, name: r.name || data.people.find((p) => p.email.toLowerCase() === r.email)?.name || '' }))
    set('participants', mergeParticipants(form.participants, named))
    setImportMsg({ ok: rows.length, errors: errs })
  }

  const onListFile = (file: File | undefined) => {
    if (!file) return
    if (!['csv', 'txt'].includes(ext(file.name))) {
      setImportMsg({ ok: 0, errors: ['Upload a .csv or .txt file. In Excel, use File → Save As → CSV.'] })
      return
    }
    if (file.size > 5 * 1_048_576) {
      setImportMsg({ ok: 0, errors: ['The list is larger than 5 MB.'] })
      return
    }
    const reader = new FileReader()
    reader.onload = () => importText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const onAttach = (files: FileList | null) => {
    if (!files) return
    const add: RequestAttachment[] = []
    const errs: string[] = []
    Array.from(files).forEach((f) => {
      const rule = ATTACHMENT_LIMITS.find((r) => r.ext.includes(ext(f.name)))
      if (!rule) errs.push(`${f.name}: this file type isn’t allowed`)
      else if (f.size > rule.maxMb * 1_048_576) errs.push(`${f.name}: larger than ${rule.maxMb} MB (limit for ${rule.label.split(' (')[0].toLowerCase()})`)
      else if (!form.attachments.some((a) => a.name === f.name)) add.push({ name: f.name, size: f.size, type: ext(f.name) })
    })
    set('attachments', [...form.attachments, ...add])
    setFileErrors(errs)
  }

  const payload = (): Form => ({ ...form, otherCategory: otherOn ? form.otherCategory.trim() : '', topic: form.topic.trim(), objectives: form.objectives.trim() })
  const stamp = () => localISO()

  const saveDraft = () => {
    setBusy('draft')
    const at = stamp()
    const draft: TrainingRequest = existing
      ? { ...existing, ...payload() }
      : {
          ...payload(),
          id: uid('r'),
          requesterId: me.id,
          team,
          status: 'DRAFT',
          createdAt: at,
          draftExpiresAt: localISO(Date.now() + DRAFT_TTL_MS),
          history: [],
        }
    update((d) => ({ ...d, requests: existing ? d.requests.map((r) => (r.id === draft.id ? draft : r)) : [draft, ...d.requests] }), { action: 'Saved draft request', target: draft.topic || 'Untitled request', silent: true })
    toast('Draft saved — it’s kept for 24 hours')
    navigate('/requests')
  }

  const submit = async () => {
    setTried(true)
    if (errorCount) {
      const first = STEPS.find((x) => stepErrors(x.id).length)
      toast(`Fix ${errorCount} field${errorCount === 1 ? '' : 's'} before submitting`, { tone: 'error' })
      if (first) goTo(first.id)
      return
    }
    // D13 default: warn about duplicates, let the requester decide.
    if (duplicates.length && !(await confirm({ title: 'Submit a possible duplicate?', message: `${team} already has a request for this training type on ${shortDate(form.preferredDate)}. Submit anyway?`, confirmLabel: 'Submit anyway' })))
      return
    setBusy('submit')
    const at = stamp()
    const req: TrainingRequest = {
      ...(existing ?? { id: uid('r'), requesterId: me.id, team, createdAt: at, history: [] }),
      ...payload(),
      status: 'PENDING',
      submittedAt: at,
      draftExpiresAt: undefined,
      history: [...(existing?.history ?? []), { at, by: me.name, label: 'Submitted' }],
    } as TrainingRequest
    // Simulated network latency.
    setTimeout(() => {
      update((d) => ({ ...d, requests: existing ? d.requests.map((r) => (r.id === req.id ? req : r)) : [req, ...d.requests] }), { action: 'Submitted training request', target: req.topic })
      navigate(`/requests/${req.id}`)
    }, 500)
  }

  const temporary = form.participants.filter((p) => !isInternalEmail(p.email)).length

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-28">
      <Link to="/requests" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="size-4" /> My requests
      </Link>
      <div>
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">{existing ? 'Continue draft' : 'New training request'}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          For <span className="font-semibold text-zinc-700">{team}</span>
        </p>
      </div>

      {/* Phones: compact progress. */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-brand-700">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <span className="text-zinc-500">{STEPS[stepIndex].title}</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {STEPS.map((x, i) => (
            <span key={x.id} className={cn('h-1.5 flex-1 rounded-full', i <= stepIndex ? 'bg-brand-600' : 'bg-zinc-200')} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Desktop: vertical stepper. */}
        <nav aria-label="Request steps" className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-zinc-200/80 bg-white p-3">
          <div className="px-1.5 pt-1 pb-3">
            <p className="flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-900">Your request</span>
              <span className="text-brand-700">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
            </p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <span className="block h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
            </span>
          </div>
          <ol className="space-y-1">
            {STEPS.map((x, i) => {
              const current = x.id === step
              const bad = (checked.has(x.id) || tried || step === 'review') && stepErrors(x.id).length > 0
              // A tick only for steps behind you that are actually complete.
              const done = i < stepIndex && !stepErrors(x.id).length
              return (
                <li key={x.id} className="relative">
                  {i < STEPS.length - 1 && <span aria-hidden className={cn('absolute top-10 left-[19px] h-[calc(100%-1.75rem)] w-0.5', done ? 'bg-brand-600' : 'bg-zinc-200')} />}
                  <button
                    type="button"
                    onClick={() => goTo(x.id)}
                    aria-current={current ? 'step' : undefined}
                    className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition', current ? 'bg-brand-50/70' : 'hover:bg-zinc-50')}
                  >
                    <span
                      className={cn(
                        'relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                        bad ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : done ? 'bg-brand-600 text-white' : current ? 'bg-charcoal text-white' : 'border-2 border-zinc-200 bg-white text-zinc-500',
                      )}
                    >
                      {bad ? <AlertCircle className="size-4" /> : done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-sm font-semibold', current ? 'text-zinc-900' : 'text-zinc-700')}>{x.title}</span>
                      {bad && <span className="block text-xs font-medium text-brand-700">{stepErrors(x.id).length} to fix</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
      {tried && errorCount > 0 && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          <AlertCircle className="size-4 shrink-0" /> {errorCount} field{errorCount === 1 ? ' needs' : 's need'} attention before you can submit.
        </p>
      )}

      {step === 'about' && (
      <Section icon={FileText} eyebrow="Step 1 of 5" title="About the training">
        <div>
          <Label htmlFor="rq-topic">Request title</Label>
          <input id="rq-topic" maxLength={80} value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Tariff changes refresher for agents" aria-invalid={!!show('topic')} aria-describedby="rq-topic-err" className={cn(inputCls, show('topic') ? 'border-brand-500' : 'border-zinc-200')} />
          <div className="mt-1.5 flex items-start justify-between gap-3">
            <Err id="rq-topic-err" msg={show('topic')} />
            <span className="ml-auto shrink-0 text-[11px] text-zinc-400 tabular-nums">{form.topic.length}/80</span>
          </div>
        </div>
        <div>
          <Label>Training type</Label>
          <div id="rq-type" role="radiogroup" aria-label="Training type" aria-invalid={!!show('trainingTypeId')} className="grid gap-2.5 sm:grid-cols-2">
            {data.trainingTypes.map((t) => {
              const on = form.trainingTypeId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set('trainingTypeId', t.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3.5 text-left transition',
                    on ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-100' : show('trainingTypeId') ? 'border-brand-300 hover:border-brand-400' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60',
                  )}
                >
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-300')}>
                    {on && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-zinc-900">{t.name}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{t.level}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <Err id="rq-type-err" msg={show('trainingTypeId')} />
        </div>
        <div>
          <Label>Categories</Label>
          <div className="flex flex-wrap gap-2" aria-invalid={!!show('categories')}>
            {data.categories.map((c) => (
              <Chip
                key={c.id}
                on={form.categories.includes(c.name)}
                onClick={() =>
                  setForm((f) => {
                    const on = f.categories.includes(c.name)
                    // Deselecting a category also drops its sub-categories.
                    const subs = on ? (f.subcategories ?? []).filter((s) => !c.subcategories.some((x) => x.name === s)) : (f.subcategories ?? [])
                    return { ...f, categories: on ? f.categories.filter((x) => x !== c.name) : [...f.categories, c.name], subcategories: subs }
                  })
                }
              >
                {c.name}
              </Chip>
            ))}
            {/* Categories the requester added that aren't in the managed list. */}
            {form.categories
              .filter((name) => !data.categories.some((c) => c.name === name))
              .map((name) => (
                <Chip key={name} on onClick={() => toggle('categories', name)}>
                  {name}
                </Chip>
              ))}
            <AddChip
              label="Add category"
              placeholder="New category"
              onAdd={(name) => {
                if (!form.categories.some((c) => c.toLowerCase() === name.toLowerCase())) set('categories', [...form.categories, name])
              }}
            />
          </div>
          {form.categories.length > 0 && (
            <div className="mt-4 space-y-3 rounded-xl bg-zinc-50/80 p-3.5">
              <p className="text-xs font-semibold text-zinc-600">
                Sub-categories <span className="font-normal text-zinc-400">(optional)</span>
              </p>
              {form.categories.map((cat) => {
                const managed = data.categories.find((c) => c.name === cat)?.subcategories ?? []
                // Custom sub-categories are stored as "Category: Name" so the training team sees where they belong.
                const custom = (form.subcategories ?? []).filter((x) => x.startsWith(`${cat}: `))
                return (
                  <div key={cat}>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {managed.map((sc) => (
                        <Chip key={sc.id} on={(form.subcategories ?? []).includes(sc.name)} onClick={() => toggle('subcategories', sc.name)}>
                          {sc.name}
                        </Chip>
                      ))}
                      {custom.map((x) => (
                        <Chip key={x} on onClick={() => toggle('subcategories', x)}>
                          {x.slice(cat.length + 2)}
                        </Chip>
                      ))}
                      <AddChip
                        label="Add sub-category"
                        placeholder={`New ${cat} sub-category`}
                        onAdd={(name) => {
                          const v = `${cat}: ${name}`
                          if (!(form.subcategories ?? []).includes(v) && !managed.some((m) => m.name.toLowerCase() === name.toLowerCase())) set('subcategories', [...(form.subcategories ?? []), v])
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Err id="rq-cat-err" msg={show('categories') ?? show('otherCategory')} />
        </div>
      </Section>
      )}

      {step === 'audience' && (
      <>
      <Section icon={Users} eyebrow="Step 2 of 5" title="Audience">
        <div>
          <Label>Target audience</Label>
          <div className="flex flex-wrap gap-2" aria-invalid={!!show('targetGroupIds')}>
            {data.groups.map((g) => (
              <Chip key={g.id} on={form.targetGroupIds.includes(g.id)} onClick={() => toggle('targetGroupIds', g.id)}>
                {g.name}
              </Chip>
            ))}
          </div>
          <input
            aria-label="Other audience"
            value={form.audienceNote}
            onChange={(e) => set('audienceNote', e.target.value)}
            placeholder="Anyone else? e.g. new team leads in Hawassa"
            className={cn(inputCls, 'mt-2 border-zinc-200')}
          />
          <Err id="rq-aud-err" msg={show('targetGroupIds')} />
        </div>
      </Section>
      <Section icon={UserPlus} title="Participants">
        <div className={cn('grid grid-cols-1 gap-2', newIsExternal ? 'sm:grid-cols-[1.2fr_1fr_auto]' : 'sm:grid-cols-[1fr_auto]')}>
          <input
            aria-label="Participant email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOne())}
            placeholder="name@safaricom.et or an outside email"
            className={cn(inputCls, 'border-zinc-200')}
          />
          {/* Only outside (temporary) trainees need a typed name. */}
          {newIsExternal && (
            <input autoFocus aria-label="Participant name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOne())} placeholder="Full name (required)" className={cn(inputCls, 'border-zinc-200')} />
          )}
          <button type="button" onClick={addOne} disabled={!newEmail.trim() || (newIsExternal && !newName.trim())} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-white hover:bg-charcoal-light disabled:opacity-40">
            <UserPlus className="size-4" /> Add
          </button>
        </div>
        {EMAIL_RE.test(newEmail.trim()) && (
          <p className="-mt-3 text-xs text-zinc-500">
            {newIsExternal ? 'Outside email — add their full name.' : newKnown ? newKnown.name : 'Company email — name comes from the directory'}
          </p>
        )}

        <details className="group rounded-xl border border-zinc-200 p-4 open:bg-zinc-50/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-800">
            <Users className="size-4 text-zinc-500" /> Add many at once
            <Plus className="ml-auto size-4 text-zinc-400 transition group-open:rotate-45" />
          </summary>
          <div className="mt-4 space-y-3">
            <textarea
              aria-label="Paste participants"
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'One per line, or CSV with a header:\nname,email\nAbebe Kebede,abebe.kebede@safaricom.et'}
              className={cn(inputCls, 'border-zinc-200 font-mono text-xs')}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!paste.trim()} onClick={() => (importText(paste), setPaste(''))} className="rounded-lg bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-charcoal-light disabled:opacity-40">
                Add pasted list
              </button>
              <button type="button" onClick={() => listInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50">
                <Upload className="size-3.5" /> Upload CSV
              </button>
              <input ref={listInput} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => (onListFile(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
          </div>
        </details>

        {importMsg && (
          <div className={cn('rounded-xl px-4 py-3 text-sm', importMsg.errors.length ? 'bg-amber-500/10 text-amber-900' : 'bg-mpesa-500/10 text-mpesa-800')}>
            {importMsg.ok > 0 && <p className="font-medium">Added {importMsg.ok} participant{importMsg.ok === 1 ? '' : 's'} (duplicates skipped).</p>}
            {importMsg.errors.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {importMsg.errors.slice(0, 5).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {importMsg.errors.length > 5 && <li>…and {importMsg.errors.length - 5} more lines skipped</li>}
              </ul>
            )}
          </div>
        )}

        <div aria-invalid={!!show('participants')}>
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>
              {form.participants.length} participant{form.participants.length === 1 ? '' : 's'}
              {temporary ? ` · ${temporary} temporary` : ''}
            </span>
            {form.participants.length > 0 && (
              <button type="button" onClick={() => set('participants', [])} className="font-semibold text-zinc-600 hover:text-brand-600">
                Clear all
              </button>
            )}
          </div>
          <ul className={cn('max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl border scrollbar-thin', show('participants') ? 'border-brand-500' : 'border-zinc-200')}>
            {form.participants.map((p, i) => {
              const temp = !isInternalEmail(p.email)
              return (
                <li key={p.email} className="flex items-center gap-3 px-3 py-2">
                  <input
                    aria-label={`Name for ${p.email}`}
                    value={p.name}
                    onChange={(e) => set('participants', form.participants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder={temp ? 'Name required' : 'Name'}
                    className={cn('w-40 min-w-0 rounded-lg border px-2 py-1 text-sm outline-none focus:border-brand-500 sm:w-48', temp && !p.name.trim() && tried ? 'border-brand-500' : 'border-transparent hover:border-zinc-200')}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-600">{p.email}</span>
                  {temp && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Temporary</span>}
                  <button type="button" onClick={() => set('participants', form.participants.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600" aria-label={`Remove ${p.email}`}>
                    <X className="size-4" />
                  </button>
                </li>
              )
            })}
            {!form.participants.length && <li className="px-3 py-6 text-center text-sm text-zinc-400">No participants yet</li>}
          </ul>
          <Err id="rq-part-err" msg={show('participants')} />
        </div>
      </Section>
      </>
      )}

      {step === 'when' && (
      <Section icon={CalendarDays} eyebrow="Step 3 of 5" title="Delivery and timing">
        <div>
          <Label>Delivery method</Label>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Delivery method">
            {(
              [
                ['Online', Video, 'Microsoft Teams or another online tool'],
                ['Physical', MapPin, 'In a training room or office'],
              ] as const
            ).map(([v, Icon, sub]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.delivery === v}
                onClick={() => set('delivery', v)}
                className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-left transition', form.delivery === v ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-zinc-200 hover:bg-zinc-50')}
              >
                <Icon className={cn('mt-0.5 size-5 shrink-0', form.delivery === v ? 'text-brand-600' : 'text-zinc-500')} />
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">{v}</span>
                  <span className="block text-xs text-zinc-500">{sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        {form.delivery === 'Physical' && (
          <div>
            <Label htmlFor="rq-loc">Location</Label>
            <input id="rq-loc" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Building, floor, room" aria-invalid={!!show('location')} className={cn(inputCls, show('location') ? 'border-brand-500' : 'border-zinc-200')} />
            <Err id="rq-loc-err" msg={show('location')} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rq-date">Preferred date</Label>
            <input id="rq-date" type="date" min={todayISO()} value={form.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} aria-invalid={!!show('preferredDate')} className={cn(inputCls, show('preferredDate') ? 'border-brand-500' : 'border-zinc-200')} />
            <Err id="rq-date-err" msg={show('preferredDate')} />
          </div>
          <div>
            <Label htmlFor="rq-time">Preferred time</Label>
            <input id="rq-time" type="time" value={form.preferredTime} onChange={(e) => set('preferredTime', e.target.value)} aria-invalid={!!show('preferredTime')} className={cn(inputCls, show('preferredTime') ? 'border-brand-500' : 'border-zinc-200')} />
            <Err id="rq-time-err" msg={show('preferredTime')} />
          </div>
        </div>
        <DuplicateWarning duplicates={duplicates} data={data} />
      </Section>
      )}

      {step === 'goals' && (
      <Section icon={Target} eyebrow="Step 4 of 5" title="Objectives and details">
        <div>
          <Label htmlFor="rq-obj">Training objectives</Label>
          <textarea id="rq-obj" rows={3} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} placeholder="What should participants be able to do after the training?" aria-invalid={!!show('objectives')} className={cn(inputCls, show('objectives') ? 'border-brand-500' : 'border-zinc-200')} />
          <Err id="rq-obj-err" msg={show('objectives')} />
        </div>
        <div>
          <Label htmlFor="rq-desc" optional>
            Description
          </Label>
          <textarea id="rq-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Background, business case or anything the training team should know" className={cn(inputCls, 'border-zinc-200')} />
        </div>
        <div>
          <Label optional>Attachments</Label>
          <button type="button" onClick={() => attachInput.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-zinc-200 px-4 py-6 text-center transition hover:border-zinc-300 hover:bg-zinc-50">
            <Paperclip className="size-5 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-800">Attach files</span>
            <span className="text-xs text-zinc-500">{ATTACHMENT_LIMITS.map((r) => `${r.label} up to ${r.maxMb} MB`).join(' · ')}</span>
          </button>
          <input ref={attachInput} type="file" multiple accept={ATTACHMENT_LIMITS.flatMap((r) => r.ext.map((e) => `.${e}`)).join(',')} className="hidden" onChange={(e) => (onAttach(e.target.files), (e.target.value = ''))} />
          {fileErrors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs font-medium text-brand-700">
              {fileErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {form.attachments.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {form.attachments.map((a) => (
                <li key={a.name} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white py-1.5 pr-1.5 pl-2.5 text-xs text-zinc-700">
                  <FileText className="size-3.5 text-zinc-500" /> {a.name}
                  <button type="button" onClick={() => set('attachments', form.attachments.filter((x) => x.name !== a.name))} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600" aria-label={`Remove ${a.name}`}>
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-zinc-400">In this prototype only the file name and size are kept.</p>
        </div>
      </Section>
      )}

      {step === 'review' && (
        <ReviewStep
          rows={[
            { step: 'about', title: 'About the training', items: [['Title', form.topic], ['Training type', data.trainingTypes.find((t) => t.id === form.trainingTypeId)?.name ?? ''], ['Categories', [...form.categories, ...(otherOn && form.otherCategory ? [form.otherCategory] : [])].join(', ')]] },
            { step: 'audience', title: 'Audience & participants', items: [['Groups', form.targetGroupIds.map((g) => data.groups.find((x) => x.id === g)?.name ?? g).join(', ')], ['Other audience', form.audienceNote], ['Participants', form.participants.length ? `${form.participants.length} people${temporary ? ` · ${temporary} temporary` : ''}` : '']] },
            { step: 'when', title: 'Delivery & timing', items: [['Delivery', form.delivery === 'Online' ? 'Online (Microsoft Teams)' : 'In person'], ...(form.delivery === 'Physical' ? [['Location', form.location] as [string, string]] : []), ['Preferred date', form.preferredDate ? shortDate(form.preferredDate) : ''], ['Preferred time', form.preferredTime]] },
            { step: 'goals', title: 'Objectives & files', items: [['Objectives', form.objectives], ['Details', form.description], ['Attachments', form.attachments.map((a) => a.name).join(', ')]] },
          ]}
          errorsFor={(id) => stepErrors(id).length}
          onEdit={goTo}
          duplicate={duplicates.length > 0}
        />
      )}
        </div>
      </div>

      {/* Sticky actions so they're reachable from anywhere on the long form. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-64" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2">
          <span className="mr-auto hidden text-xs text-zinc-500 sm:block">{existing?.draftExpiresAt ? 'Draft kept for 24 hours from when you started it' : 'Not saved yet'}</span>
          <button type="button" onClick={saveDraft} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50">
            <Save className="size-4" /> Save draft
          </button>
          {stepIndex > 0 && (
            <button type="button" onClick={() => goTo(STEPS[stepIndex - 1].id)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
              <ArrowLeft className="size-4" /> Back
            </button>
          )}
          {step === 'review' ? (
            <button type="button" onClick={submit} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 hover:bg-brand-700 disabled:opacity-60">
              {busy === 'submit' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit request
            </button>
          ) : (
            <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white hover:bg-charcoal-light">
              {STEPS[stepIndex + 1].id === 'review' ? 'Review' : 'Next'} <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Last step: everything entered, grouped by step, with an Edit link per group. */
function ReviewStep({
  rows,
  errorsFor,
  onEdit,
  duplicate,
}: {
  rows: { step: StepId; title: string; items: [string, string][] }[]
  errorsFor: (id: StepId) => number
  onEdit: (id: StepId) => void
  duplicate: boolean
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Review your request</h2>
      </div>
      {duplicate && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800">
          <AlertCircle className="size-4 shrink-0" /> Your team already has a request for this training type on this date. You can still submit.
        </p>
      )}
      {rows.map((r) => {
        const bad = errorsFor(r.step)
        return (
          <div key={r.step} className={cn('rounded-2xl border bg-white p-5', bad ? 'border-brand-200' : 'border-zinc-200/80')}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold text-zinc-900">
                {bad ? <AlertCircle className="size-4 text-brand-600" /> : <CheckCircle2 className="size-4 text-mpesa-600" />}
                {r.title}
              </h3>
              <button type="button" onClick={() => onEdit(r.step)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                <Pencil className="size-3.5" /> {bad ? `Fix ${bad}` : 'Edit'}
              </button>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {r.items.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className={cn('mt-0.5 text-sm break-words', value ? 'font-medium text-zinc-900' : 'text-zinc-400')}>{value || 'Not provided'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </section>
  )
}
