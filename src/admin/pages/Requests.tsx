import { AlertTriangle, CalendarPlus, Check, Eye, FileQuestion, MapPin, Plus, Users, Video, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { localISO } from '../../lib/utils'
import { useFeedback } from '../../components/Feedback'
import { DuplicateWarning, JoinLink, RequestDetails, RequestStatusPill, RequestTimeline } from '../RequestParts'
import { dateTime, shortDate, time12 } from '../helpers'
import { findDuplicates, makeJoinLink, personByEmail, REJECTION_REASONS } from '../requests'
import { useAdmin } from '../store'
import type { RequestStatus, TrainingRequest } from '../types'
import { Avatar, Button, Card, Empty, Field, Modal, PageHeader, Select, TabBar, Tabs, Textarea } from '../ui'
import { NewTrainingModal, type TrainingPreset } from './Trainings'

type Filter = 'ALL' | Exclude<RequestStatus, 'DRAFT'>
const now = () => localISO()

function RejectModal({ request, onClose }: { request: TrainingRequest; onClose: () => void }) {
  const { update } = useAdmin()
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const needsComment = reason === 'Other'
  const valid = reason && (!needsComment || comment.trim())

  const reject = () => {
    update(
      (d) => ({
        ...d,
        requests: d.requests.map((r) =>
          r.id === request.id
            ? { ...r, status: 'REJECTED', rejection: { reason, comment: comment.trim() }, history: [...r.history, { at: now(), by: 'Training team', label: 'Rejected', detail: reason }] }
            : r,
        ),
      }),
      { action: 'Rejected training request', target: request.topic },
    )
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reject request"
      description={`“${request.topic}” from ${request.team}. The requester sees the reason and comment.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={reject}>
            <X className="size-4" /> Reject request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
            <option value="">Choose a reason…</option>
            {REJECTION_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label={needsComment ? 'Comment (required for “Other”)' : 'Comment (optional)'}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add context the requester will find useful, e.g. an alternative session." />
        </Field>
      </div>
    </Modal>
  )
}

function ApproveModal({ request, onClose, onApproved }: { request: TrainingRequest; onClose: () => void; onApproved: (trainerIds: string[]) => void }) {
  const { data, update } = useAdmin()
  const { confirm } = useFeedback()
  const trainers = data.people.filter((p) => p.role === 'Trainer' && p.status === 'Active')
  const [trainerIds, setTrainerIds] = useState(() => {
    const existing = (request.trainerIds?.length ? request.trainerIds : [request.trainerId ?? '']).filter((id) => trainers.some((trainer) => trainer.id === id))
    const selected = [...new Set(existing)]
    if (!selected.length) {
      const defaultTrainer = trainers.find((trainer) => trainer.canApprove) ?? trainers[0]
      if (defaultTrainer) selected.push(defaultTrainer.id)
    }
    if (selected.length < 2) {
      const secondTrainer = trainers.find((trainer) => !selected.includes(trainer.id))
      if (secondTrainer) selected.push(secondTrainer.id)
    }
    return selected
  })
  const [addingTrainer, setAddingTrainer] = useState(false)
  const [candidateTrainerId, setCandidateTrainerId] = useState('')
  const assignedTrainers = trainerIds.map((id) => trainers.find((trainer) => trainer.id === id)).filter((trainer): trainer is (typeof trainers)[number] => !!trainer)
  const availableTrainers = trainers.filter((trainer) => !trainerIds.includes(trainer.id))

  const removeTrainer = async (trainerId: string) => {
    const trainer = assignedTrainers.find((item) => item.id === trainerId)
    if (!trainer) return
    const confirmed = await confirm({
      title: `Remove ${trainer.name} from this request?`,
      message: 'This trainer will no longer be assigned to the request. You can add another trainer before approving.',
      confirmLabel: 'Remove trainer',
      danger: true,
    })
    if (confirmed) setTrainerIds((ids) => ids.filter((id) => id !== trainerId))
  }

  const addTrainer = async () => {
    const candidate = availableTrainers.find((item) => item.id === candidateTrainerId)
    if (!candidate) return
    const confirmed = await confirm({
      title: `Assign ${candidate.name} to this request?`,
      message: 'This trainer will be assigned when you approve the request.',
      confirmLabel: 'Add trainer',
    })
    if (confirmed) {
      setTrainerIds((ids) => [...new Set([...ids, candidate.id])])
      setAddingTrainer(false)
      setCandidateTrainerId('')
    }
  }

  const approve = () => {
    const assignedTrainers = data.people.filter((person) => trainerIds.includes(person.id))
    const trainerId = trainerIds[0] ?? ''
    update(
      (d) => ({
        ...d,
        requests: d.requests.map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: 'APPROVED',
                trainerId,
                trainerIds,
                joinLink: makeJoinLink(r.id),
                history: [...r.history, { at: now(), by: 'Training team', label: 'Approved', detail: `Trainers: ${assignedTrainers.map((trainer) => trainer.name).join(', ') || '—'}` }],
              }
            : r,
        ),
      }),
      { action: 'Approved training request', target: request.topic },
    )
    onApproved(trainerIds)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Approve request"
      description="Assign one or more trainers to run this training. The requester gets a join link to share with their team."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!trainerIds.length} onClick={approve}>
            <Check className="size-4" /> Approve and assign
          </Button>
        </>
      }
    >
      <Field label="Trainers">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {assignedTrainers.map((trainer) => (
            <div key={trainer.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2">
              <Avatar name={trainer.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">{trainer.name}</span>
                <span className="block truncate text-xs text-zinc-500">{trainer.department}</span>
              </span>
              <button type="button" onClick={() => void removeTrainer(trainer.id)} aria-label={`Remove ${trainer.name}`} title="Remove trainer" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 transition hover:bg-brand-100">
                <X className="size-4" />
              </button>
            </div>
          ))}
          {addingTrainer ? (
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Select className="min-w-0 flex-1" value={candidateTrainerId} onChange={(event) => setCandidateTrainerId(event.target.value)} autoFocus>
                <option value="">Choose another trainer…</option>
                {availableTrainers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} — {item.department}</option>
                ))}
              </Select>
              <Button size="sm" variant="primary" disabled={!candidateTrainerId} onClick={() => void addTrainer()}>
                <Plus className="size-3.5" /> Add
              </Button>
              <Button size="sm" onClick={() => setAddingTrainer(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" disabled={!availableTrainers.length} onClick={() => { setCandidateTrainerId(availableTrainers[0]?.id ?? ''); setAddingTrainer(true) }}>
              <Plus className="size-3.5" /> Add trainer
            </Button>
          )}
        </div>
      </Field>
    </Modal>
  )
}

export function AdminRequests() {
  const { data } = useAdmin()
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [viewing, setViewing] = useState<string | null>(null)
  const [modal, setModal] = useState<null | { kind: 'approve' | 'reject'; id: string }>(null)
  const [scheduling, setScheduling] = useState<TrainingPreset | null>(null)

  // Drafts belong to the requester until submitted.
  const submitted = data.requests.filter((r) => r.status !== 'DRAFT').sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
  const rows = submitted.filter((r) => filter === 'ALL' || r.status === filter)
  const count = (s: Filter) => (s === 'ALL' ? submitted.length : submitted.filter((r) => r.status === s).length)
  const viewed = data.requests.find((r) => r.id === viewing)
  const acting = data.requests.find((r) => r.id === modal?.id)

  const presetFor = (r: TrainingRequest, trainerIds?: string[]): TrainingPreset => ({
    name: r.topic,
    typeId: r.trainingTypeId,
    trainerId: trainerIds?.[0] ?? r.trainerId,
    trainerIds: trainerIds ?? r.trainerIds,
    date: r.preferredDate,
    startTime: r.preferredTime,
    location: r.delivery === 'Online' ? 'ONLINE' : r.location,
    participantIds: r.participants.map((p) => personByEmail(data.people, p.email)?.id).filter((x): x is string => !!x),
    requestId: r.id,
  })

  return (
    <>
      <PageHeader title="Training Requests" description="Requests submitted by team representatives. Approve to assign trainers and schedule, or reject with a reason." />
      <TabBar>
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as Filter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase(), count: count(v) }))}
        />
      </TabBar>

      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const requester = data.people.find((p) => p.id === r.requesterId)
            const type = data.trainingTypes.find((t) => t.id === r.trainingTypeId)
            const dupes = r.status === 'PENDING' ? findDuplicates(r, data.requests) : []
            const training = data.trainings.find((t) => t.id === r.trainingId)
            return (
              <Card key={r.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-zinc-900">{r.topic}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {type?.name} · {r.categories.join(', ')}
                    </p>
                  </div>
                  <RequestStatusPill status={r.status} />
                </div>

                <dl className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-zinc-500">Preferred</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">
                      {shortDate(r.preferredDate)}
                      {r.preferredTime && <span className="block text-zinc-500">{time12(r.preferredTime)}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Delivery</dt>
                    <dd className="mt-0.5 flex items-start gap-1 font-medium text-zinc-900">
                      {r.delivery === 'Online' ? <Video className="mt-0.5 size-3.5 shrink-0" /> : <MapPin className="mt-0.5 size-3.5 shrink-0" />}
                      <span className="line-clamp-2">{r.delivery === 'Online' ? 'Online' : r.location}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Participants</dt>
                    <dd className="mt-0.5 flex items-center gap-1 font-medium text-zinc-900">
                      <Users className="size-3.5" /> {r.participants.length}
                    </dd>
                  </div>
                </dl>

                <p className="line-clamp-2 text-sm text-zinc-600">{r.objectives}</p>

                {dupes.length > 0 && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800">
                    <AlertTriangle className="size-3.5 shrink-0" /> Possible duplicate of “{dupes[0].topic}”
                  </p>
                )}
                {r.status === 'REJECTED' && r.rejection && (
                  <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
                    <span className="font-semibold">{r.rejection.reason}</span>
                    {r.rejection.comment && ` — ${r.rejection.comment}`}
                  </p>
                )}
                {r.status === 'APPROVED' && (
                  <p className="text-xs text-zinc-600">
                    Trainers: <span className="font-medium text-zinc-900">{(r.trainerIds?.length ? r.trainerIds : [r.trainerId].filter((id): id is string => !!id)).map((id) => data.people.find((person) => person.id === id)?.name).filter(Boolean).join(', ') || '—'}</span>
                    {training ? (
                      <>
                        {' · '}
                        <Link to={`/admin/trainings/${training.id}`} className="font-medium text-brand-600 hover:underline">
                          {training.name}
                        </Link>
                      </>
                    ) : (
                      <span className="text-amber-700"> · not scheduled yet</span>
                    )}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {requester && <Avatar name={requester.name} size="sm" />}
                    <span>
                      <span className="block font-medium text-zinc-800">{requester?.name ?? 'Unknown'}</span>
                      {r.team} · {r.submittedAt ? dateTime(r.submittedAt) : ''}
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(r.id)}>
                      <Eye className="size-3.5" /> Details
                    </Button>
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="danger" onClick={() => setModal({ kind: 'reject', id: r.id })}>
                          <X className="size-3.5" /> Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => setModal({ kind: 'approve', id: r.id })}>
                          <Check className="size-3.5" /> Approve
                        </Button>
                      </>
                    )}
                    {r.status === 'APPROVED' && !training && (
                      <Button size="sm" variant="primary" onClick={() => setScheduling(presetFor(r))}>
                        <CalendarPlus className="size-3.5" /> Schedule
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <Empty icon={FileQuestion} title="No requests here" text="Requests submitted by team representatives appear in this list." />
        </Card>
      )}

      {viewed && (
        <Modal open wide onClose={() => setViewing(null)} title={viewed.topic} description={`${viewed.team} · requested by ${data.people.find((p) => p.id === viewed.requesterId)?.name ?? 'unknown'}`}>
          <div className="space-y-6">
            <RequestTimeline request={viewed} />
            {viewed.status === 'PENDING' && <DuplicateWarning duplicates={findDuplicates(viewed, data.requests)} data={data} />}
            {viewed.joinLink && <JoinLink link={viewed.joinLink} />}
            <RequestDetails request={viewed} data={data} />
            <div>
              <h4 className="text-xs text-zinc-500">History</h4>
              <ul className="mt-2 space-y-1.5 text-sm">
                {viewed.history.map((h, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2 text-zinc-700">
                    <span className="text-zinc-400">{dateTime(h.at)}</span>
                    <span className={cn('font-medium', h.label === 'Rejected' ? 'text-brand-700' : 'text-zinc-900')}>{h.label}</span>
                    <span>by {h.by}</span>
                    {h.detail && <span className="text-zinc-500">· {h.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}

      {modal?.kind === 'reject' && acting && <RejectModal request={acting} onClose={() => setModal(null)} />}
      {modal?.kind === 'approve' && acting && (
        <ApproveModal
          request={acting}
          onClose={() => setModal(null)}
          onApproved={(trainerIds) => {
            setModal(null)
            setScheduling(presetFor(acting, trainerIds))
          }}
        />
      )}
      {scheduling && <NewTrainingModal open onClose={() => setScheduling(null)} preset={scheduling} />}
    </>
  )
}
