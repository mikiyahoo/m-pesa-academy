import { CheckCircle2, ClipboardList, MessageSquare, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { uid, useAdmin } from '../store'
import type { Assessment, AssessmentKind, FeedbackForm } from '../types'
import { Avatar, Badge, Button, Card, CardTitle, downloadCsv, Empty, Field, Input, Modal, PageHeader, Select } from '../ui'

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-3.5', i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300')} />
      ))}
    </span>
  )
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/* -------------------------------- Feedback forms ------------------------------ */

function FormModal({ form, onClose }: { form?: FeedbackForm; onClose: () => void }) {
  const { update } = useAdmin()
  const [title, setTitle] = useState(form?.title ?? '')
  const [questions, setQuestions] = useState<string[]>(form?.questions ?? [''])
  const valid = title.trim() && questions.some((q) => q.trim())

  const save = () => {
    const next = { id: form?.id ?? uid('ff'), title: title.trim(), questions: questions.map((q) => q.trim()).filter(Boolean) }
    update((d) => ({ ...d, feedbackForms: form ? d.feedbackForms.map((f) => (f.id === form.id ? next : f)) : [...d.feedbackForms, next] }), {
      action: form ? 'Updated feedback form' : 'Created feedback form',
      target: next.title,
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={form ? 'Edit feedback form' : 'New feedback form'}
      description="Participants rate each question from 1 to 5 and can leave a comment."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save form
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Rating questions</p>
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <Input value={q} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Question ${i + 1}`} />
                <Button variant="ghost" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} disabled={questions.length === 1} aria-label="Remove question">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setQuestions([...questions, ''])}>
            <Plus className="size-3.5" /> Add question
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function AdminFeedbackForms() {
  const { data } = useAdmin()
  const [editing, setEditing] = useState<FeedbackForm | 'new' | null>(null)
  return (
    <>
      <PageHeader
        title="Feedback Forms"
        description="Collect participant feedback after each training."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New form
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.feedbackForms.map((f) => {
          const responses = data.feedbackResponses.filter((r) => r.formId === f.id)
          const score = avg(responses.flatMap((r) => r.ratings))
          return (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-violet-500/10 text-violet-500">
                  <MessageSquare className="size-5" />
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                  Edit
                </Button>
              </div>
              <h3 className="mt-3 font-semibold text-zinc-900">{f.title}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
                {f.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                <Stars value={score} /> {score ? score.toFixed(1) : '—'} · {responses.length} responses
              </div>
            </Card>
          )
        })}
      </div>
      {editing && <FormModal form={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/* ------------------------------ Feedback responses ---------------------------- */

export function AdminFeedbackResponses() {
  const { data } = useAdmin()
  const [params, setParams] = useSearchParams()
  const trainingId = params.get('training') ?? ''
  const responses = data.feedbackResponses.filter((r) => !trainingId || r.trainingId === trainingId)
  const trainingsWithResponses = data.trainings.filter((t) => data.feedbackResponses.some((r) => r.trainingId === t.id))

  // Per-question averages only make sense for a single form.
  const formIds = [...new Set(responses.map((r) => r.formId))]
  const form = formIds.length === 1 ? data.feedbackForms.find((f) => f.id === formIds[0]) : undefined
  const overall = avg(responses.flatMap((r) => r.ratings))
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: responses.flatMap((r) => r.ratings).filter((x) => x === n).length }))
  const totalRatings = Math.max(1, distribution.reduce((s, d) => s + d.count, 0))

  return (
    <>
      <PageHeader
        title="Feedback Responses"
        description="What participants said about their trainings."
        actions={
          <Button
            onClick={() =>
              downloadCsv(
                'feedback.csv',
                ['Training', 'Participant', 'Average rating', 'Comment', 'Date'],
                responses.map((r) => [data.trainings.find((t) => t.id === r.trainingId)?.name ?? '', data.people.find((p) => p.id === r.participantId)?.name ?? '', avg(r.ratings).toFixed(1), r.comment, r.submittedAt]),
              )
            }
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-5 max-w-md">
        <Select value={trainingId} onChange={(e) => setParams(e.target.value ? { training: e.target.value } : {})}>
          <option value="">All trainings</option>
          {trainingsWithResponses.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {responses.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="space-y-5">
            <Card>
              <p className="text-sm text-zinc-500">Average rating</p>
              <p className="mt-1 flex items-center gap-3 text-4xl font-bold text-zinc-900">
                {overall.toFixed(1)} <Stars value={overall} />
              </p>
              <p className="mt-1 text-xs text-zinc-500">{responses.length} responses</p>
              <div className="mt-4 space-y-1.5">
                {distribution.map((d) => (
                  <div key={d.n} className="flex items-center gap-2 text-xs text-zinc-600">
                    <span className="w-3">{d.n}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(d.count / totalRatings) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </Card>
            {form && (
              <Card>
                <CardTitle>By question</CardTitle>
                <ul className="space-y-3">
                  {form.questions.map((q, i) => {
                    const v = avg(responses.map((r) => r.ratings[i]).filter((x) => x !== undefined))
                    return (
                      <li key={q}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="text-zinc-700">{q}</span>
                          <span className="font-semibold text-zinc-900">{v.toFixed(1)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${(v / 5) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )}
          </div>
          <Card>
            <CardTitle>Comments</CardTitle>
            <ul className="divide-y divide-zinc-100">
              {responses.map((r) => {
                const p = data.people.find((x) => x.id === r.participantId)
                const t = data.trainings.find((x) => x.id === r.trainingId)
                return (
                  <li key={r.id} className="flex gap-3 py-3">
                    <Avatar name={p?.name ?? '?'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-zinc-900">{p?.name}</span>
                        <Stars value={avg(r.ratings)} />
                      </div>
                      <p className={cn('mt-0.5 text-sm', r.comment ? 'text-zinc-700' : 'text-zinc-400 italic')}>{r.comment || 'No comment'}</p>
                      {!trainingId && <p className="mt-0.5 truncate text-xs text-zinc-500">{t?.name}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      ) : (
        <Card>
          <Empty icon={MessageSquare} title="No responses yet" text="Responses appear once participants submit feedback." />
        </Card>
      )}
    </>
  )
}

/* --------------------------------- Assessments -------------------------------- */

function AssessmentModal({ kind, assessment, onClose }: { kind: AssessmentKind; assessment?: Assessment; onClose: () => void }) {
  const { update } = useAdmin()
  const [title, setTitle] = useState(assessment?.title ?? '')
  const [passMark, setPassMark] = useState(String(assessment?.passMark ?? (kind === 'POST' ? 70 : 0)))
  const [questions, setQuestions] = useState(assessment?.questions ?? [{ id: uid('q'), question: '', options: ['', '', ''], answer: 0 }])

  const valid = title.trim() && questions.every((q) => q.question.trim() && q.options.every((o) => o.trim()))
  const setQ = (i: number, patch: Partial<Assessment['questions'][number]>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)))

  const save = () => {
    const next: Assessment = { id: assessment?.id ?? uid('a'), title: title.trim(), kind, passMark: Number(passMark) || 0, questions }
    update((d) => ({ ...d, assessments: assessment ? d.assessments.map((a) => (a.id === assessment.id ? next : a)) : [...d.assessments, next] }), {
      action: assessment ? 'Updated assessment' : 'Created assessment',
      target: next.title,
    })
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={assessment ? 'Edit assessment' : `New ${kind === 'PRE' ? 'pre' : 'post'}-assessment`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save assessment
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Pass mark (%)">
          <Input type="number" min={0} max={100} value={passMark} onChange={(e) => setPassMark(e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex gap-2">
              <Input value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder={`Question ${i + 1}`} />
              <Button variant="ghost" disabled={questions.length === 1} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label="Remove question">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {q.options.map((o, oi) => (
                <label key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`ans-${q.id}`} checked={q.answer === oi} onChange={() => setQ(i, { answer: oi })} className="accent-mpesa-600" title="Mark as correct answer" />
                  <Input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={`Option ${oi + 1}`} className="py-1.5" />
                </label>
              ))}
              <p className="text-xs text-zinc-500">Select the radio button next to the correct answer.</p>
            </div>
          </div>
        ))}
        <Button size="sm" onClick={() => setQuestions([...questions, { id: uid('q'), question: '', options: ['', '', ''], answer: 0 }])}>
          <Plus className="size-3.5" /> Add question
        </Button>
      </div>
    </Modal>
  )
}

export function AdminAssessments() {
  const { kind: kindParam = 'pre' } = useParams()
  const kind: AssessmentKind = kindParam === 'post' ? 'POST' : 'PRE'
  const { data } = useAdmin()
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null)
  const [viewing, setViewing] = useState<Assessment | null>(null)
  const list = data.assessments.filter((a) => a.kind === kind)
  const label = kind === 'PRE' ? 'Pre-Assessments' : 'Post-Assessments'

  return (
    <>
      <PageHeader
        title={label}
        description={kind === 'PRE' ? 'Measure what participants know before a training.' : 'Certify what participants learned after a training.'}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New assessment
          </Button>
        }
      />
      {list.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((a) => {
            const used = data.trainings.filter((t) => t.preAssessmentId === a.id || t.postAssessmentId === a.id)
            return (
              <Card key={a.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-sky-500/10 text-sky-500">
                    <ClipboardList className="size-5" />
                  </span>
                  <Badge tone={kind === 'PRE' ? 'blue' : 'green'}>{kind}</Badge>
                </div>
                <h3 className="mt-3 font-semibold text-zinc-900">{a.title}</h3>
                <p className="mt-1 flex-1 text-sm text-zinc-500">
                  {a.questions.length} questions · {a.passMark ? `pass mark ${a.passMark}%` : 'not graded'} · used in {used.length} training{used.length === 1 ? '' : 's'}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => setViewing(a)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <Empty icon={ClipboardList} title={`No ${label.toLowerCase()} yet`} action={<Button onClick={() => setEditing('new')}>Create one</Button>} />
        </Card>
      )}
      {editing && <AssessmentModal kind={kind} assessment={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.title} description={`${viewing.questions.length} questions`} wide>
          <ol className="space-y-4">
            {viewing.questions.map((q, i) => (
              <li key={q.id}>
                <p className="text-sm font-medium text-zinc-900">
                  {i + 1}. {q.question}
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {q.options.map((o, oi) => (
                    <li key={oi} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', oi === q.answer ? 'border-mpesa-500 bg-mpesa-500/10 text-zinc-900' : 'border-zinc-200 text-zinc-600')}>
                      {oi === q.answer && <CheckCircle2 className="size-4 text-mpesa-600" />}
                      {o}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  )
}

