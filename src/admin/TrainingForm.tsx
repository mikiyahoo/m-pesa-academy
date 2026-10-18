import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  CheckCircle2,
  Layers,
  MapPin,
  Plus,
  Repeat,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FullPageDialog } from './Wizard'
import { cn, localISO, todayISO } from '../lib/utils'
import { shortDate, time12 } from './helpers'
import { describeRecurrence, findConflicts, LEVELS, makeInviteLink, MAX_OCCURRENCES, occurrenceDates, WEEKDAYS } from './scheduling'
import { uid, useAdmin } from './store'
import { demoMeeting } from './teams/attendance'
import type { AdminTraining, Journey, Recurrence, RecurrenceFreq, TrainingLevel } from './types'
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from './ui'

export type TrainingPreset = {
  name?: string
  journeyId?: string
  typeId?: string
  trainerId?: string
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
      description="Create a learning journey right from here and assign it to this session."
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

type StepId = 1 | 2 | 3 | 4
const STEPS = [
  { id: 1 as StepId, label: 'Basics', desc: 'Title & category' },
  { id: 2 as StepId, label: 'Schedule', desc: 'Date & venue' },
  { id: 3 as StepId, label: 'Audience', desc: 'Trainer & learners' },
  { id: 4 as StepId, label: 'Review', desc: 'Tests & confirmation' },
]

/** Schedule a session or a recurring series (TA-2.2, TA-2.3, TR-2.2, URS 2.3). */
export function NewTrainingModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: TrainingPreset }) {
  const { data, update } = useAdmin()
  const navigate = useNavigate()
  const [step, setStep] = useState<StepId>(1)
  const [triedSteps, setTriedSteps] = useState<Record<number, boolean>>({})
  const [newJourneyOpen, setNewJourneyOpen] = useState(false)
  const trainers = data.people.filter((p) => p.role === 'Trainer' && p.status === 'Active')
  const startDate = preset?.date && preset.date >= todayISO() ? preset.date : todayISO()
  const presetOnline = preset?.location === 'ONLINE'

  const [f, setF] = useState(() => ({
    name: preset?.name ?? '',
    categoryId: data.categories[0]?.id ?? '',
    subcategoryId: '',
    description: '',
    typeId: preset?.typeId ?? data.trainingTypes[0]?.id ?? '',
    level: 'Beginner' as TrainingLevel,
    journeyId: preset?.journeyId ?? data.journeys[0]?.id ?? '',
    trainerId: preset?.trainerId ?? trainers[0]?.id ?? '',
    preAssessmentId: '',
    postAssessmentId: '',
    delivery: (presetOnline ? 'Online' : preset?.location ? 'Physical' : 'Online') as 'Online' | 'Physical',
    location: presetOnline ? '' : (preset?.location ?? ''),
    date: startDate,
    startTime: preset?.startTime || '09:00',
    endTime: '17:00',
    repeat: false,
    freq: 'weekly' as RecurrenceFreq,
    interval: 1,
    weekdays: [weekdayOf(startDate)],
    until: addDays(startDate, 28),
    groupIds: [] as string[],
    emails: '',
  }))
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const category = data.categories.find((c) => c.id === f.categoryId)
  const journey = data.journeys.find((j) => j.id === f.journeyId)
  const trainingType = data.trainingTypes.find((t) => t.id === f.typeId)
  const assignedTrainer = data.people.find((p) => p.id === f.trainerId)
  const rule: Recurrence = { freq: f.freq, interval: Math.max(1, f.interval), weekdays: f.freq === 'weekly' ? f.weekdays : [], until: f.until }
  const dates = useMemo(() => (f.repeat ? occurrenceDates(f.date, rule) : [f.date]), [f.repeat, f.date, f.freq, f.interval, f.weekdays, f.until]) // eslint-disable-line react-hooks/exhaustive-deps

  // Participants: preset (approved request) + chosen groups + pasted emails matched to the directory.
  const pasted = [...new Set(f.emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))]
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
  const conflicts = useMemo(
    () =>
      dates
        .map((date) => ({ date, list: findConflicts({ date, startTime: f.startTime, endTime: f.endTime, trainerId: f.trainerId, participantIds }, data.trainings, data.people) }))
        .filter((x) => x.list.length),
    [dates, f.startTime, f.endTime, f.trainerId, participantKey, data.trainings, data.people], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Validation rules by step
  const step1Errors: Record<string, string> = {}
  if (!f.name.trim()) step1Errors.name = 'Enter a training title.'
  if (!f.categoryId) step1Errors.categoryId = 'Choose a category.'
  if (!f.journeyId) step1Errors.journeyId = 'Choose a journey.'

  const step2Errors: Record<string, string> = {}
  if (f.delivery === 'Physical' && !f.location.trim()) step2Errors.location = 'Physical sessions need a location.'
  if (!f.date) step2Errors.date = 'Choose a date.'
  else if (f.date < todayISO()) step2Errors.date = 'The date can’t be in the past.'
  if (f.startTime >= f.endTime) step2Errors.endTime = 'End time must be after the start time.'
  if (f.repeat && f.until <= f.date) step2Errors.until = 'Choose an end date after the first session.'
  if (f.repeat && f.freq === 'weekly' && !f.weekdays.length) step2Errors.weekdays = 'Pick at least one day.'

  const step3Errors: Record<string, string> = {}
  if (!f.trainerId) step3Errors.trainerId = 'Choose a trainer.'

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
    } else if (step === 2) {
      if (Object.keys(step2Errors).length) {
        setTriedSteps((x) => ({ ...x, 2: true }))
        return
      }
      setStep(3)
    } else if (step === 3) {
      if (Object.keys(step3Errors).length) {
        setTriedSteps((x) => ({ ...x, 3: true }))
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
      setStep(3)
      return
    }

    const at = localISO()
    const seriesId = f.repeat && dates.length > 1 ? uid('ser') : undefined
    const sessions: AdminTraining[] = dates.map((date) => {
      const id = uid('t')
      return {
        id,
        name: f.name.trim(),
        journeyId: f.journeyId,
        typeId: f.typeId,
        trainerId: f.trainerId,
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
        feedbackFormId: (data.feedbackForms.find((ff) => ff.trainingTypeIds?.includes(f.typeId)) ?? data.feedbackForms[0])?.id,
        teamsMeeting: f.delivery === 'Online' ? demoMeeting(id) : undefined,
        inviteLink: makeInviteLink(id),
        history: [{ at, by: 'Training team', action: 'Created', detail: seriesId ? describeRecurrence(rule, f.date) : undefined }],
        progress: {},
      }
    })
    update(
      (d) => ({
        ...d,
        trainings: [...sessions, ...d.trainings],
        requests: preset?.requestId
          ? d.requests.map((r) => (r.id === preset.requestId ? { ...r, trainingId: sessions[0].id, history: [...r.history, { at, by: 'Training team', label: 'Scheduled', detail: sessions[0].name }] } : r))
          : d.requests,
      }),
      { action: seriesId ? `Created a series of ${sessions.length} sessions` : 'Created training', target: sessions[0].name },
    )
    onClose()
    navigate(`/admin/trainings/${sessions[0].id}`)
  }

  const conflictCount = conflicts.reduce((n, c) => n + c.list.length, 0)

  if (!open) return null
  const stepper = (
        <div className="sticky top-0 rounded-2xl border border-zinc-200/80 bg-surface p-3">
          <div className="grid grid-cols-4 gap-1 lg:grid-cols-1">
            {STEPS.map((s) => {
              const isPast = step > s.id
              const isCurrent = step === s.id
              const accessible = canNavigateTo(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!accessible && !isPast}
                  onClick={() => {
                    if (s.id < step) setStep(s.id)
                    else if (s.id > step && accessible) setStep(s.id)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl p-2 text-left transition sm:flex-row',
                    isCurrent
                      ? 'bg-brand-50/70'
                      : isPast
                      ? 'hover:bg-zinc-100/70'
                      : 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition',
                      isPast
                        ? 'bg-mpesa-600 text-white'
                        : isCurrent
                        ? 'bg-brand-600 text-white shadow-xs ring-4 ring-brand-100'
                        : 'bg-zinc-200 text-zinc-600',
                    )}
                  >
                    {isPast ? <Check className="size-3.5" /> : s.id}
                  </span>
                  <div className="min-w-0 text-center sm:text-left">
                    <span className={cn('block text-xs font-semibold', isCurrent ? 'text-brand-900' : 'text-zinc-800')}>
                      {s.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
  )

  return (
    <FullPageDialog
      onClose={onClose}
      title={preset?.requestId ? 'Schedule approved request' : 'Schedule a training'}
      subtitle={`Step ${step} of 4`}
      aside={stepper}
      footer={
        <>
          <div className="mr-auto hidden sm:flex items-center gap-2 text-xs text-zinc-500">
            <span>{dates.length} session{dates.length === 1 ? '' : 's'}</span>
            <span>·</span>
            <span>{participantIds.length} participant{participantIds.length === 1 ? '' : 's'}</span>
          </div>
          <Button onClick={onClose}>Cancel</Button>
          {step > 1 && (
            <Button onClick={() => setStep((s) => (s - 1) as StepId)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          )}
          {step < 4 ? (
            <Button variant="primary" onClick={handleNext}>
              Next <ArrowRight className="size-4" />
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
      <div className="space-y-6">
        {/* STEP 1: BASICS */}
        {step === 1 && (
          <section className="space-y-4">
            <div>
              <Field label="Training title">
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
                <Field label="Category">
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

              <Field label="Sub-category (optional)">
                <Select value={f.subcategoryId} onChange={(e) => set('subcategoryId', e.target.value)} disabled={!category?.subcategories.length}>
                  <option value="">{category?.subcategories.length ? 'None' : 'No sub-categories'}</option>
                  {category?.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-900">Training journey</label>
                  <button
                    type="button"
                    onClick={() => setNewJourneyOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="size-3" /> New journey
                  </button>
                </div>
                <Select value={f.journeyId} onChange={(e) => set('journeyId', e.target.value)}>
                  {data.journeys.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </Select>
                {err1('journeyId') && <p className="mt-1 text-xs text-brand-600">{err1('journeyId')}</p>}
              </div>

              <Field label="Training type">
                <Select value={f.typeId} onChange={(e) => set('typeId', e.target.value)}>
                  {data.trainingTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Level">
                <Select value={f.level} onChange={(e) => set('level', e.target.value as TrainingLevel)}>
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Description (optional)">
              <Textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What the session covers and who it's for" />
            </Field>
          </section>
        )}

        {/* STEP 2: SCHEDULE & DELIVERY */}
        {step === 2 && (
          <section className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-zinc-900">Delivery mode</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Delivery method">
                {(
                  [
                    ['Online', Video, 'Microsoft Teams meeting link will be created automatically'],
                    ['Physical', MapPin, 'Conducted in an onsite conference room or training hall'],
                  ] as const
                ).map(([v, Icon, sub]) => (
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
                      <span className="block text-xs text-zinc-500 leading-relaxed">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>

              {f.delivery === 'Physical' && (
                <div className="mt-3">
                  <Field label="Venue / Location">
                    <Input
                      value={f.location}
                      onChange={(e) => set('location', e.target.value)}
                      placeholder="e.g. M-PESA Hub, Training Room 4"
                      className={cn(err2('location') && 'border-brand-500 ring-1 ring-brand-500')}
                    />
                  </Field>
                  {err2('location') && <p className="mt-1 text-xs text-brand-600">{err2('location')}</p>}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-zinc-900">Session frequency</h4>
                <div className="inline-flex rounded-xl bg-zinc-200/70 p-1" role="radiogroup" aria-label="Once or recurring">
                  {(
                    [
                      [false, 'One-time session', CalendarRange],
                      [true, 'Recurring series', Repeat],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={f.repeat === v}
                      onClick={() => set('repeat', v)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                        f.repeat === v ? 'bg-surface text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900',
                      )}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Field label={f.repeat ? 'First session date' : 'Date'}>
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
                <div className="space-y-4 border-t border-zinc-200/80 pt-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Repeats">
                      <Select value={f.freq} onChange={(e) => set('freq', e.target.value as RecurrenceFreq)}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </Select>
                    </Field>
                    <Field label={`Every (${f.freq === 'daily' ? 'days' : f.freq === 'weekly' ? 'weeks' : 'months'})`}>
                      <Input type="number" min={1} max={12} value={f.interval} onChange={(e) => set('interval', Math.max(1, Number(e.target.value) || 1))} />
                    </Field>
                    <div>
                      <Field label="Series end date">
                        <Input type="date" min={f.date} value={f.until} onChange={(e) => set('until', e.target.value)} className={cn(err2('until') && 'border-brand-500')} />
                      </Field>
                      {err2('until') && <p className="mt-1 text-xs text-brand-600">{err2('until')}</p>}
                    </div>
                  </div>

                  {f.freq === 'weekly' && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-zinc-700">Days of the week</p>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((d, i) => {
                          const on = f.weekdays.includes(i)
                          return (
                            <button
                              key={d}
                              type="button"
                              aria-pressed={on}
                              onClick={() => set('weekdays', on ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i].sort())}
                              className={cn(
                                'size-9 rounded-xl text-xs font-semibold transition',
                                on ? 'bg-brand-600 text-white shadow-xs' : 'bg-surface text-zinc-600 border border-zinc-200 hover:bg-zinc-100',
                              )}
                            >
                              {d}
                            </button>
                          )
                        })}
                      </div>
                      {err2('weekdays') && <p className="mt-1 text-xs text-brand-600">{err2('weekdays')}</p>}
                    </div>
                  )}

                  <div className="rounded-xl bg-surface p-3 border border-zinc-200 text-xs text-zinc-700">
                    <p className="font-semibold text-zinc-900">{describeRecurrence(rule, f.date)}</p>
                    <p className="mt-1 text-zinc-500">
                      Generates {dates.length} scheduled session{dates.length === 1 ? '' : 's'}
                      {dates.length >= MAX_OCCURRENCES ? ` (capped at ${MAX_OCCURRENCES})` : ''}: {dates.slice(0, 5).map((d) => shortDate(d)).join(', ')}
                      {dates.length > 5 ? ` … ${shortDate(dates.at(-1)!)}` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* STEP 3: AUDIENCE & TRAINERS */}
        {step === 3 && (
          <section className="space-y-5">
            <div>
              <Field label="Assigned trainer">
                <Select value={f.trainerId} onChange={(e) => set('trainerId', e.target.value)}>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.department || 'Training'})
                    </option>
                  ))}
                </Select>
              </Field>
              {err3('trainerId') && <p className="mt-1 text-xs text-brand-600">{err3('trainerId')}</p>}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-zinc-900">Target learner groups</label>
              {(preset?.participantIds?.length ?? 0) > 0 && (
                <p className="text-xs text-mpesa-700 bg-mpesa-500/10 border border-mpesa-500/30 rounded-lg px-3 py-1.5 font-medium">
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
              <Field
                label="Direct participant emails (optional)"
                hint="Paste email addresses separated by commas or spaces. Directory users will be resolved automatically."
              >
                <Textarea rows={3} value={f.emails} onChange={(e) => set('emails', e.target.value)} placeholder="awet.gebrehiwet@partner.safaricom.et, ..." />
              </Field>
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
        )}

        {/* STEP 4: ASSESSMENTS & REVIEW */}
        {step === 4 && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Pre-assessment (optional)">
                <Select value={f.preAssessmentId} onChange={(e) => set('preAssessmentId', e.target.value)}>
                  <option value="">None (skip baseline test)</option>
                  {data.assessments.filter((a) => a.kind === 'PRE').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Post-assessment (optional)">
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
                    {f.delivery === 'Online' ? 'Teams Online' : f.location}
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
                    {assignedTrainer?.name || 'Unassigned'}
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
                  <Layers className="size-3 text-zinc-400" /> Journey: {journey?.name || 'None'}
                </span>
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
                          ? `${assignedTrainer?.name} is already running “${c.training.name}” (${time12(c.training.startTime)}–${time12(c.training.endTime)}).`
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

      {newJourneyOpen && <QuickJourneyModal onClose={() => setNewJourneyOpen(false)} onCreated={(id) => set('journeyId', id)} />}
    </FullPageDialog>
  )
}
