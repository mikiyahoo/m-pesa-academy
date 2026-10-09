import { Check, FileQuestion, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { shortDate } from '../helpers'
import { uid, useAdmin } from '../store'
import type { RequestStatus, TrainingRequest } from '../types'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, requestStatusTone, Select, Tabs, Textarea } from '../ui'
import { NewTrainingModal } from './Trainings'

type Filter = 'ALL' | RequestStatus

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const { data, update } = useAdmin()
  const people = data.people.filter((p) => p.status === 'Active')
  const [form, setForm] = useState({ requesterId: people[0]?.id ?? '', topic: '', journeyId: '', participants: '10', preferredDate: '', reason: '' })
  const valid = form.topic.trim() && form.preferredDate && Number(form.participants) > 0

  const save = () => {
    const r: TrainingRequest = {
      id: uid('r'),
      requesterId: form.requesterId,
      topic: form.topic.trim(),
      journeyId: form.journeyId || undefined,
      participants: Number(form.participants),
      preferredDate: form.preferredDate,
      reason: form.reason.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    update((d) => ({ ...d, requests: [r, ...d.requests] }), { action: 'Logged training request', target: r.topic })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Log training request"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Submit request
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Topic">
            <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} autoFocus />
          </Field>
        </div>
        <Field label="Requested by">
          <Select value={form.requesterId} onChange={(e) => setForm({ ...form, requesterId: e.target.value })}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Suggested journey">
          <Select value={form.journeyId} onChange={(e) => setForm({ ...form, journeyId: e.target.value })}>
            <option value="">Not sure</option>
            {data.journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Participants">
          <Input type="number" min={1} value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} />
        </Field>
        <Field label="Preferred date">
          <Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reason">
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function AdminRequests() {
  const { data, update } = useAdmin()
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [creating, setCreating] = useState(false)
  const [scheduling, setScheduling] = useState<TrainingRequest | null>(null)

  const rows = data.requests.filter((r) => filter === 'ALL' || r.status === filter)
  const count = (s: Filter) => (s === 'ALL' ? data.requests.length : data.requests.filter((r) => r.status === s).length)

  const decide = (r: TrainingRequest, status: RequestStatus) => {
    update((d) => ({ ...d, requests: d.requests.map((x) => (x.id === r.id ? { ...x, status } : x)) }), {
      action: status === 'APPROVED' ? 'Approved training request' : 'Rejected training request',
      target: r.topic,
    })
    if (status === 'APPROVED') setScheduling(r)
  }

  return (
    <>
      <PageHeader
        title="Training Requests"
        description="Review requests from teams and turn them into scheduled trainings."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Log request
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as Filter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase(), count: count(v) }))}
        />
      </div>

      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const requester = data.people.find((p) => p.id === r.requesterId)
            const journey = data.journeys.find((j) => j.id === r.journeyId)
            return (
              <Card key={r.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-zinc-900">{r.topic}</h3>
                  <Badge tone={requestStatusTone[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-600">{r.reason || 'No reason given.'}</p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-zinc-500">Participants</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">{r.participants}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Preferred date</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">{shortDate(r.preferredDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Journey</dt>
                    <dd className="mt-0.5 truncate font-medium text-zinc-900">{journey?.name ?? '—'}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {requester && <Avatar name={requester.name} size="sm" />}
                    <span>
                      <span className="block font-medium text-zinc-800">{requester?.name ?? 'Unknown'}</span>
                      {requester?.department} · {shortDate(r.createdAt)}
                    </span>
                  </span>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => decide(r, 'REJECTED')}>
                        <X className="size-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => decide(r, 'APPROVED')}>
                        <Check className="size-3.5" /> Approve
                      </Button>
                    </div>
                  )}
                  {r.status === 'APPROVED' && (
                    <Button size="sm" onClick={() => setScheduling(r)}>
                      Schedule training
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <Empty icon={FileQuestion} title="No requests here" text="Requests from teams will appear in this list." />
        </Card>
      )}

      {creating && <NewRequestModal onClose={() => setCreating(false)} />}
      {scheduling && (
        <NewTrainingModal open onClose={() => setScheduling(null)} preset={{ name: scheduling.topic, journeyId: scheduling.journeyId, date: scheduling.preferredDate }} />
      )}
    </>
  )
}
