import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Link2,
  Layers,
  RefreshCw,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { useFeedback } from '../../components/Feedback'
import { CancelModal, ChangeTrainerModal, ConflictList, InviteModal, RescheduleModal, ScheduleHistory } from '../ScheduleModals'
import { describeRecurrence, findConflicts, trainerIdsOf } from '../scheduling'
import { InviteTemporaryModal } from './TemporaryAccess'
import { MaterialPreview } from '../MaterialPreview'
import { AttendancePanel } from '../teams/AttendancePanel'
import { CheckInPanel } from '../checkin/CheckInPanel'
import { TrainingCertificates } from '../TrainingCertificates'
import { longDate, shortDate, time12 } from '../helpers'
import { classProgress, participantProgress, useAdmin } from '../store'
import type { AdminTraining, AssessmentKind, Material, TrainingStatus } from '../types'
import { Avatar, Badge, Button, Card, CardTitle, Empty, Field, Modal, ProgressBar, Select, trainingStatusTone } from '../ui'

const scheduledDuration = (startTime: string, endTime: string) => {
  const minutes = (time: string) => {
    const [hours, mins] = time.split(':').map(Number)
    return hours * 60 + mins
  }
  const totalMinutes = Math.max(0, minutes(endTime) - minutes(startTime))
  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  if (!hours) return `${remainingMinutes}Min`
  return `${hours}Hr${remainingMinutes ? ` ${remainingMinutes}Min` : ''}`
}

function AttachAssessmentModal({ training, kind, onClose }: { training: AdminTraining; kind: AssessmentKind; onClose: () => void }) {
  const { data, update } = useAdmin()
  const options = data.assessments.filter((a) => a.kind === kind)
  const [id, setId] = useState(options[0]?.id ?? '')
  const key = kind === 'PRE' ? 'preAssessmentId' : 'postAssessmentId'
  const label = kind === 'PRE' ? 'pre-assessment' : 'post-assessment'

  const save = () => {
    update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, [key]: id } : t)) }), {
      action: `Attached ${label}`,
      target: training.name,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add ${label}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!id} onClick={save}>
            Attach
          </Button>
        </>
      }
    >
      {options.length ? (
        <Field label="Assessment">
          <Select value={id} onChange={(e) => setId(e.target.value)}>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.questions.length} questions)
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-zinc-500">
          No {label}s exist yet.{' '}
          <Link to={`/admin/assessments/${kind.toLowerCase()}`} className="text-brand-600 hover:underline">
            Create one
          </Link>
          .
        </p>
      )}
    </Modal>
  )
}

function StatusMenu({ training, onCancel }: { training: AdminTraining; onCancel: () => void }) {
  const { update } = useAdmin()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const setStatus = (status: TrainingStatus) => {
    if (status === 'CANCELLED') {
      setOpen(false)
      onCancel()
      return
    }
    update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, status } : t)) }), {
      action: `Marked as ${status.toLowerCase()}`,
      target: training.name,
    })
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((o) => !o)} aria-label="More actions" className="px-2.5">
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-zinc-200 bg-surface p-1 text-sm shadow-lg">
          <p className="px-3 py-1.5 text-xs text-zinc-500">Set status</p>
          {(['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as TrainingStatus[]).map((s) => (
            <button
              key={s}
              disabled={s === training.status}
              onClick={() => setStatus(s)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              {s === 'CANCELLED' ? 'Cancel…' : s[0] + s.slice(1).toLowerCase()}
              {s === training.status && <span className="text-xs text-zinc-400">current</span>}
            </button>
          ))}
          <p className="mt-1 border-t border-zinc-100 px-3 pt-2 pb-1.5 text-xs text-zinc-500">Who can join</p>
          <button
            onClick={() => {
              update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, isPublic: !training.isPublic || undefined } : t)) }), {
                action: training.isPublic ? 'Made training invite-only' : 'Made training public',
                target: training.name,
              })
              setOpen(false)
            }}
            className="flex w-full items-center rounded-xl px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100"
          >
            {training.isPublic ? 'Make invite-only' : 'Make public (open to guests)'}
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminTrainingDetail() {
  const { id = '' } = useParams()
  const { data, update } = useAdmin()
  const training = data.trainings.find((t) => t.id === id)
  const [openModules, setOpenModules] = useState<string[]>([])
  // Deep link from list menus: /admin/trainings/:id#attendance scrolls to check-in and attendance.
  useEffect(() => {
    if (window.location.hash !== '#attendance') return
    const t = window.setTimeout(() => document.getElementById('attendance')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => window.clearTimeout(t)
  }, [id])
  const [preview, setPreview] = useState<Material | null>(null)
  const [modal, setModal] = useState<null | 'reschedule' | 'invite' | 'invite-new' | 'cancel' | 'trainer' | 'PRE' | 'POST'>(null)
  const { toast } = useFeedback()

  const journey = data.journeys.find((j) => j.id === training?.journeyId)
  useEffect(() => {
    if (journey?.modules[0]) setOpenModules([journey.modules[0].id])
  }, [journey?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!training) {
    return <Empty icon={CalendarDays} title="Training not found" action={<Link to="/admin/trainings" className="text-sm text-brand-600 hover:underline">Back to trainings</Link>} />
  }

  const moduleIds = journey?.modules.map((m) => m.id) ?? []
  const trainers = trainerIdsOf(training).map((trainerId) => data.people.find((person) => person.id === trainerId)).filter((person): person is NonNullable<typeof person> => !!person)
  const pre = data.assessments.find((a) => a.id === training.preAssessmentId)
  const post = data.assessments.find((a) => a.id === training.postAssessmentId)
  const form = data.feedbackForms.find((f) => f.id === training.feedbackFormId)
  const responses = data.feedbackResponses.filter((r) => r.trainingId === training.id)
  const participants = training.participantIds.map((pid) => data.people.find((p) => p.id === pid)).filter((p) => !!p)
  const editable = training.status !== 'COMPLETED' && training.status !== 'CANCELLED'
  const conflicts = training.status === 'CANCELLED' ? [] : findConflicts(training, data.trainings, data.people)
  const category = data.categories.find((c) => c.id === training.categoryId)
  const subcategory = category?.subcategories.find((s) => s.id === training.subcategoryId)
  const seriesSessions = training.seriesId ? data.trainings.filter((t) => t.seriesId === training.seriesId).sort((a, b) => a.date.localeCompare(b.date)) : []

  const toggleModule = (mid: string) => setOpenModules((o) => (o.includes(mid) ? o.filter((x) => x !== mid) : [...o, mid]))

  const removeParticipant = (pid: string, name: string) => {
    update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, participantIds: t.participantIds.filter((x) => x !== pid) } : t)) }), {
      action: `Removed participant ${name}`,
      target: training.name,
    })
  }

  const detachAssessment = (kind: AssessmentKind) =>
    update((d) => ({ ...d, trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, [kind === 'PRE' ? 'preAssessmentId' : 'postAssessmentId']: undefined } : t)) }), {
      action: `Removed ${kind === 'PRE' ? 'pre' : 'post'}-assessment`,
      target: training.name,
    })

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl leading-tight font-bold tracking-tight text-zinc-900">
            {training.name}
            <Badge tone={trainingStatusTone[training.status]}>{training.status}</Badge>
            {training.isPublic && <Badge tone="green">PUBLIC</Badge>}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {longDate(training.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4" /> {training.participantIds.length} Participants
            </span>
            {training.seriesId && (
              <span className="flex items-center gap-1.5">
                <Layers className="size-4" /> Session {seriesSessions.findIndex((t) => t.id === training.id) + 1} of {seriesSessions.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {training.inviteLink && editable && (
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(training.inviteLink!)
                  toast('Invite link copied')
                } catch {
                  toast('Copy failed', { tone: 'error' })
                }
              }}
            >
              <Link2 className="size-4" /> Copy invite link
            </Button>
          )}
          <Button onClick={() => setModal('reschedule')} disabled={!editable}>
            <CalendarDays className="size-4" /> Reschedule
          </Button>
          <Button variant="primary" onClick={() => setModal('invite')} disabled={!editable}>
            <UserPlus className="size-4" /> Invite
          </Button>
          <StatusMenu training={training} onCancel={() => setModal('cancel')} />
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-5">
          <ConflictList conflicts={conflicts} data={data} trainerIds={trainerIdsOf(training)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="space-y-5">
          <Card>
            <div className="mb-5 flex items-center gap-2">
              <h2 className="font-bold text-zinc-900">{journey?.name ?? 'No journey'}</h2>
              <span className="rounded-full border border-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">Journey</span>
            </div>
            <div className="space-y-2">
              {journey?.modules.map((m, i) => {
                const open = openModules.includes(m.id)
                const progress = classProgress(training, m.id)
                return (
                  <div key={m.id} className="rounded-xl border border-zinc-200">
                    <button onClick={() => toggleModule(m.id)} className="flex w-full items-center gap-3 p-4 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">
                          {i + 1}. {m.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <ProgressBar value={progress} className="w-16" />
                          <span>{progress}% Class Progress</span>
                          <span className="flex items-center gap-1">
                            <FileText className="size-3.5" /> {m.materialIds.length} Material{m.materialIds.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      {open ? <ChevronUp className="size-4 text-zinc-500" /> : <ChevronDown className="size-4 text-zinc-500" />}
                    </button>
                    {open && (
                      <div className="px-4 pb-4">
                        <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Materials</p>
                        <div className="space-y-2">
                          {m.materialIds.map((mid) => {
                            const mat = data.materials.find((x) => x.id === mid)
                            if (!mat) return null
                            return (
                              <div key={mid} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-zinc-900">{mat.title}</p>
                                  <p className="text-[10px] tracking-wide text-zinc-500 uppercase">
                                    {mat.type} · {mat.minutes} mins
                                  </p>
                                </div>
                                <button onClick={() => setPreview(mat)} className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-800 hover:bg-zinc-200/60">
                                  <PlayCircle className="size-4" /> Preview
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardTitle>Schedule</CardTitle>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                [CalendarDays, 'Training Date', shortDate(training.date)],
                [Clock, 'Training Time', `${time12(training.startTime)} - ${time12(training.endTime)} (${scheduledDuration(training.startTime, training.endTime)})`],
                [MapPin, training.delivery === 'Online' || training.location === 'ONLINE' ? 'Delivery' : 'Location', training.location === 'ONLINE' ? 'Online · Microsoft Teams' : training.location],
                [RefreshCw, 'Recurring', training.recurrence ? describeRecurrence(training.recurrence, seriesSessions[0]?.date) : 'No'],
                [Layers, 'Category', category ? `${category.name}${subcategory ? ` › ${subcategory.name}` : ''}` : '—'],
                [BarChart3, 'Level', training.level ?? '—'],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Clock
                return (
                  <div key={label as string} className="flex gap-3">
                    <I className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                    <div>
                      <dt className="text-xs text-zinc-500">{label as string}</dt>
                      <dd className="mt-0.5 font-semibold text-zinc-900">{value as string}</dd>
                    </div>
                  </div>
                )
              })}
            </dl>
            {training.description && <p className="mt-5 border-t border-zinc-100 pt-4 text-sm text-zinc-600">{training.description}</p>}
          </Card>

          <Card>
            <CardTitle
              action={
                editable && (
                  <Button size="sm" variant="ghost" onClick={() => setModal('trainer')}>
                    <UserCog className="size-3.5" /> Change
                  </Button>
                )
              }
            >
              Trainers
            </CardTitle>
            {trainers.length ? (
              <div className="space-y-2">
                {trainers.map((trainer) => (
                  <div key={trainer.id} className="flex items-center gap-3">
                    <Avatar name={trainer.name} />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{trainer.name}</p>
                      <p className="text-xs text-zinc-500">{trainer.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No trainer assigned.</p>
            )}
          </Card>
          <ScheduleHistory training={training} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle>Assessments</CardTitle>
            <div className="space-y-3 text-sm">
              {(
                [
                  ['PRE', 'Pre-Assessment', pre],
                  ['POST', 'Post-Assessment', post],
                ] as const
              ).map(([kind, label, a]) =>
                a ? (
                  <div key={kind} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">{label}</p>
                      <p className="truncate font-medium text-zinc-900">{a.title}</p>
                    </div>
                    <button onClick={() => detachAssessment(kind)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label={`Remove ${label}`}>
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div key={kind} className="flex items-center justify-between">
                    <span className="text-zinc-500">No {label}</span>
                    <button onClick={() => setModal(kind)} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                      <Plus className="size-3.5" /> Add
                    </button>
                  </div>
                ),
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Feedback</CardTitle>
            {form ? (
              <Link to={`/admin/feedback/responses?training=${training.id}`} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 transition hover:bg-zinc-50">
                <MessageSquare className="size-5 text-brand-600" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">{form.title}</span>
                  <span className="text-xs text-zinc-500">
                    View Responses{responses.length ? ` · ${responses.length}` : ''}
                  </span>
                </span>
                <ArrowRight className="size-4 text-zinc-700" />
              </Link>
            ) : (
              <p className="text-sm text-zinc-500">No feedback form attached.</p>
            )}
          </Card>

          <Card>
            <CardTitle action={<span className="text-xs text-zinc-500">{participants.length}</span>}>Participants</CardTitle>
            {participants.length ? (
              <ul className="-mr-2 max-h-[420px] space-y-1 overflow-y-auto pr-2 scrollbar-thin">
                {participants.map((p) => (
                  <li key={p.id} className="group flex items-center gap-3 rounded-xl py-1.5">
                    <Avatar name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{p.name}</p>
                      <p className="truncate text-xs text-zinc-500">{p.email}</p>
                    </div>
                    <span className={cn('text-xs text-zinc-600', editable && 'group-hover:hidden')}>{participantProgress(training, p.id, moduleIds)}%</span>
                    {editable && (
                      <button onClick={() => removeParticipant(p.id, p.name)} className="hidden rounded p-1 text-zinc-400 group-hover:block hover:bg-zinc-100 hover:text-brand-600" aria-label={`Remove ${p.name}`}>
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Users} title="No participants yet" action={editable && <Button size="sm" onClick={() => setModal('invite')}>Invite participants</Button>} />
            )}
          </Card>
        </div>
      </div>

      <div id="attendance" className="mt-5 scroll-mt-6 space-y-5">
        <CheckInPanel training={training} />
        <AttendancePanel training={training} />
        {training.status !== 'CANCELLED' && <TrainingCertificates training={training} />}
      </div>

      <MaterialPreview material={preview} onClose={() => setPreview(null)} />
      {modal === 'reschedule' && <RescheduleModal training={training} onClose={() => setModal(null)} />}
      {modal === 'cancel' && <CancelModal training={training} onClose={() => setModal(null)} />}
      {modal === 'trainer' && <ChangeTrainerModal training={training} onClose={() => setModal(null)} />}
      {modal === 'invite' && <InviteModal training={training} onClose={() => setModal(null)} onInviteNew={() => setModal('invite-new')} />}
      {modal === 'invite-new' && <InviteTemporaryModal trainingId={training.id} onClose={() => setModal(null)} />}
      {(modal === 'PRE' || modal === 'POST') && <AttachAssessmentModal training={training} kind={modal} onClose={() => setModal(null)} />}
    </>
  )
}
