import { AlertTriangle, CheckCircle2, ClipboardList, Copy, FileQuestion, FileText, Library, ListChecks, MessageSquare, Plus, Settings2, Star, Trash2 } from 'lucide-react'
import { Wizard, WizardCard } from '../Wizard'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { cn } from '../../lib/utils'
import { uid, useAdmin } from '../store'
import { feedbackAverage, responseAverage } from '../insights'
import type { Assessment, AssessmentKind, AssessmentQuestion, AssessmentSubmission, FeedbackForm, FeedbackQuestionType, QuestionType } from '../types'
import { Avatar, Badge, Button, Card, CardTitle, downloadCsv, Empty, Field, Input, Modal, PageHeader, Select, StatCard, Table, Tabs, Textarea } from '../ui'

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

const FEEDBACK_TYPES: { value: FeedbackQuestionType; label: string; hint: string }[] = [
  { value: 'likert', label: '5-point scale', hint: 'Strongly disagree → Strongly agree' },
  { value: 'yesno', label: 'Yes / No', hint: 'Single choice' },
  { value: 'open', label: 'Open comment', hint: 'Free text' },
]
const typeLabel = (t: FeedbackQuestionType) => FEEDBACK_TYPES.find((x) => x.value === t)!.label

type DraftQuestion = { question: string; type: FeedbackQuestionType }

function FeedbackBankPicker({ onAdd, onClose }: { onAdd: (q: DraftQuestion[]) => void; onClose: () => void }) {
  const { data } = useAdmin()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const cats = [...new Set(data.feedbackBank.map((q) => q.category))]
  return (
    <Modal
      open
      onClose={onClose}
      title="Add from feedback bank"
      description="Selected questions are copied into the form."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!picked.size}
            onClick={() => {
              onAdd(data.feedbackBank.filter((q) => picked.has(q.id)).map((q) => ({ question: q.question, type: q.type })))
              onClose()
            }}
          >
            Add {picked.size || ''} question{picked.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {cats.map((c) => (
          <div key={c}>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">{c}</p>
            <ul className="space-y-1.5">
              {data.feedbackBank
                .filter((q) => q.category === c)
                .map((q) => (
                  <li key={q.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={picked.has(q.id)}
                        onChange={() => setPicked((s) => {
                          const n = new Set(s)
                          if (n.has(q.id)) n.delete(q.id)
                          else n.add(q.id)
                          return n
                        })}
                        className="size-4 accent-brand-600"
                      />
                      <span className="flex-1 text-zinc-800">{q.question}</span>
                      <Badge>{typeLabel(q.type)}</Badge>
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/** Feedback form editor (F03): question types, bank questions, and the training types this form is the template for. */
function FormModal({ form, onClose }: { form?: FeedbackForm; onClose: () => void }) {
  const { data, update } = useAdmin()
  const [title, setTitle] = useState(form?.title ?? '')
  const [questions, setQuestions] = useState<DraftQuestion[]>(form ? form.questions.map((q, i) => ({ question: q, type: form.questionTypes?.[i] ?? 'likert' })) : [{ question: '', type: 'likert' }])
  const [types, setTypes] = useState<string[]>(form?.trainingTypeIds ?? [])
  const [bank, setBank] = useState(false)
  const valid = title.trim() && questions.some((q) => q.question.trim())
  const setQ = (i: number, patch: Partial<DraftQuestion>) => setQuestions(questions.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= questions.length) return
    const next = [...questions]
    ;[next[i], next[j]] = [next[j], next[i]]
    setQuestions(next)
  }

  const save = () => {
    const kept = questions.filter((q) => q.question.trim())
    const next: FeedbackForm = { id: form?.id ?? uid('ff'), title: title.trim(), questions: kept.map((q) => q.question.trim()), questionTypes: kept.map((q) => q.type), trainingTypeIds: types }
    const names = (ids: string[]) => ids.map((id) => data.trainingTypes.find((t) => t.id === id)?.name ?? id).join(', ') || '—'
    update(
      (d) => ({
        ...d,
        // One template per training type: claiming a type here releases it from other forms.
        feedbackForms: (form ? d.feedbackForms.map((f) => (f.id === form.id ? next : f)) : [...d.feedbackForms, next]).map((f) =>
          f.id === next.id ? f : { ...f, trainingTypeIds: f.trainingTypeIds?.filter((id) => !types.includes(id)) },
        ),
      }),
      {
        action: form ? 'Updated feedback form' : 'Created feedback form',
        target: next.title,
        changes: form
          ? [
              { field: 'Title', from: form.title, to: next.title },
              { field: 'Questions', from: String(form.questions.length), to: String(next.questions.length) },
              { field: 'Template for', from: names(form.trainingTypeIds ?? []), to: names(types) },
            ]
          : undefined,
      },
    )
    onClose()
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={form ? 'Edit feedback form' : 'New feedback form'}
      description="Mix 5-point scale, Yes/No and open questions. Learners also get an optional comment box."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Save form
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Questions</p>
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-2.5 sm:flex-row sm:items-center">
                <span className="hidden w-5 text-center text-xs font-semibold text-zinc-400 sm:block">{i + 1}</span>
                <Input value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder={`Question ${i + 1}`} className="flex-1" />
                <div className="flex items-center gap-1">
                  <Select value={q.type} onChange={(e) => setQ(i, { type: e.target.value as FeedbackQuestionType })} aria-label="Question type" className="w-40!">
                    {FEEDBACK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Move down">
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} disabled={questions.length === 1} aria-label="Remove question">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setQuestions([...questions, { question: '', type: 'likert' }])}>
              <Plus className="size-3.5" /> Add question
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBank(true)}>
              <ClipboardList className="size-3.5" /> Add from bank
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-zinc-700">Template for training types</p>
          <p className="mb-2 text-xs text-zinc-500">New sessions of these types use this form automatically.</p>
          <div className="flex flex-wrap gap-2">
            {data.trainingTypes.map((tt) => {
              const on = types.includes(tt.id)
              const other = data.feedbackForms.find((f) => f.id !== form?.id && f.trainingTypeIds?.includes(tt.id))
              return (
                <button
                  key={tt.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTypes(on ? types.filter((x) => x !== tt.id) : [...types, tt.id])}
                  className={cn('rounded-xl border px-3 py-1.5 text-xs font-medium transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50')}
                >
                  {tt.name}
                  {other && !on && <span className="ml-1 text-zinc-400">({other.title})</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {bank && <FeedbackBankPicker onClose={() => setBank(false)} onAdd={(qs) => setQuestions([...questions.filter((q) => q.question.trim()), ...qs])} />}
    </Modal>
  )
}

function FeedbackBank() {
  const { data, update } = useAdmin()
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState('Content')
  const [type, setType] = useState<FeedbackQuestionType>('likert')
  const cats = [...new Set(data.feedbackBank.map((q) => q.category))]
  return (
    <>
      <Card className="mb-4">
        <CardTitle>Add a question</CardTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px_auto]">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. The examples matched real customer situations." />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" list="fb-cats" aria-label="Category" />
          <datalist id="fb-cats">
            {cats.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Select value={type} onChange={(e) => setType(e.target.value as FeedbackQuestionType)} aria-label="Type">
            {FEEDBACK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            disabled={!question.trim() || !category.trim()}
            onClick={() => {
              update((d) => ({ ...d, feedbackBank: [...d.feedbackBank, { id: uid('fb'), category: category.trim(), question: question.trim(), type }] }), { action: 'Added feedback bank question', target: question.trim() })
              setQuestion('')
            }}
          >
            Add
          </Button>
        </div>
      </Card>
      <Table head={['Question', 'Category', 'Type', '']} minWidth={640}>
        {data.feedbackBank.map((q) => (
          <tr key={q.id}>
            <td className="px-4 py-3 text-zinc-800">{q.question}</td>
            <td className="px-4 py-3">
              <Badge tone="blue">{q.category}</Badge>
            </td>
            <td className="px-4 py-3 text-zinc-600">{typeLabel(q.type)}</td>
            <td className="px-4 py-3 text-right">
              <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => update((d) => ({ ...d, feedbackBank: d.feedbackBank.filter((x) => x.id !== q.id) }), { action: 'Deleted feedback bank question', target: q.question })}>
                <Trash2 className="size-3.5" />
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  )
}

export function AdminFeedbackForms() {
  const { data } = useAdmin()
  const [editing, setEditing] = useState<FeedbackForm | 'new' | null>(null)
  const [tab, setTab] = useState<'forms' | 'bank'>('forms')
  return (
    <>
      <PageHeader
        title="Feedback Forms"
        description="Forms, a reusable question bank and the template used for each training type."
        actions={
          tab === 'forms' && (
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> New form
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'forms', label: 'Forms', count: data.feedbackForms.length }, { value: 'bank', label: 'Question bank', count: data.feedbackBank.length }]} />
      </div>
      {tab === 'bank' ? (
        <FeedbackBank />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.feedbackForms.map((f) => {
            const responses = data.feedbackResponses.filter((r) => r.formId === f.id)
            const score = feedbackAverage(data, responses) ?? 0
            return (
              <Card key={f.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <MessageSquare className="size-5" />
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                    Edit
                  </Button>
                </div>
                <h3 className="mt-3 font-bold text-zinc-900">{f.title}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Template for: {f.trainingTypeIds?.length ? f.trainingTypeIds.map((id) => data.trainingTypes.find((t) => t.id === id)?.name ?? id).join(', ') : 'no training type'}
                </p>
                <ol className="mt-3 space-y-1.5 text-sm text-zinc-600">
                  {f.questions.map((q, i) => (
                    <li key={q} className="flex items-start gap-2">
                      <span className="w-4 shrink-0 text-xs text-zinc-400">{i + 1}.</span>
                      <span className="flex-1">{q}</span>
                      <Badge>{typeLabel(f.questionTypes?.[i] ?? 'likert')}</Badge>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  <Stars value={score} /> {score ? score.toFixed(1) : '—'} · {responses.length} responses
                </div>
              </Card>
            )
          })}
        </div>
      )}
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
  const formOf = (id: string) => data.feedbackForms.find((f) => f.id === id)
  const likertOf = (r: (typeof responses)[number]) => r.ratings.filter((_, i) => (formOf(r.formId)?.questionTypes?.[i] ?? 'likert') === 'likert')

  // Per-question results only make sense for a single form.
  const formIds = [...new Set(responses.map((r) => r.formId))]
  const form = formIds.length === 1 ? formOf(formIds[0]) : undefined
  const overall = feedbackAverage(data, responses) ?? 0
  const allLikert = responses.flatMap(likertOf)
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: allLikert.filter((x) => x === n).length }))
  const totalRatings = Math.max(1, distribution.reduce((s, d) => s + d.count, 0))
  const answersFor = (r: (typeof responses)[number]) => [r.comment, ...Object.values(r.texts ?? {})].filter(Boolean)

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
                ['Training', 'Participant', 'Average rating', 'Answers', 'Comment', 'Date'],
                responses.map((r) => [
                  data.trainings.find((t) => t.id === r.trainingId)?.name ?? '',
                  data.people.find((p) => p.id === r.participantId)?.name ?? '',
                  responseAverage(r, formOf(r.formId))?.toFixed(1) ?? '',
                  (formOf(r.formId)?.questions ?? []).map((q, i) => {
                    const t = formOf(r.formId)?.questionTypes?.[i] ?? 'likert'
                    return q + ': ' + (t === 'open' ? (r.texts?.[i] ?? '') : t === 'yesno' ? (r.ratings[i] ? 'Yes' : 'No') : r.ratings[i])
                  }).join(' | '),
                  r.comment,
                  r.submittedAt,
                ]),
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
              <p className="mt-1 text-xs text-zinc-500">{responses.length} responses · scale questions only</p>
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
                    const type = form.questionTypes?.[i] ?? 'likert'
                    if (type === 'open') {
                      const n = responses.filter((r) => r.texts?.[i]).length
                      return (
                        <li key={q} className="flex justify-between gap-3 text-sm">
                          <span className="text-zinc-700">{q}</span>
                          <span className="text-xs text-zinc-500">{n} answers</span>
                        </li>
                      )
                    }
                    const vals = responses.map((r) => r.ratings[i]).filter((x) => x !== undefined)
                    const v = type === 'yesno' ? (vals.length ? (vals.filter((x) => x === 1).length / vals.length) * 100 : 0) : avg(vals)
                    return (
                      <li key={q}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="text-zinc-700">{q}</span>
                          <span className="font-semibold text-zinc-900">{type === 'yesno' ? `${Math.round(v)}% yes` : v.toFixed(1)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div className={cn('h-full rounded-full', type === 'yesno' ? 'bg-mpesa-500' : 'bg-brand-600')} style={{ width: `${type === 'yesno' ? v : (v / 5) * 100}%` }} />
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
                const texts = answersFor(r)
                return (
                  <li key={r.id} className="flex gap-3 py-3">
                    <Avatar name={p?.name ?? '?'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-zinc-900">{p?.name}</span>
                        <Stars value={responseAverage(r, formOf(r.formId)) ?? 0} />
                      </div>
                      {texts.length ? (
                        texts.map((x) => (
                          <p key={x} className="mt-0.5 text-sm text-zinc-700">
                            {x}
                          </p>
                        ))
                      ) : (
                        <p className="mt-0.5 text-sm text-zinc-400 italic">No comment</p>
                      )}
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

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'upload', label: 'File upload' },
]

function BankPicker({ onAdd, onClose }: { onAdd: (q: AssessmentQuestion) => void; onClose: () => void }) {
  const { data } = useAdmin()
  const [cat, setCat] = useState('ALL')
  const cats = ['ALL', ...new Set(data.questionBank.map((q) => q.category))]
  const rows = data.questionBank.filter((q) => cat === 'ALL' || q.category === cat)
  return (
    <Modal open onClose={onClose} title="Add from question bank" description="Bank questions are copied into the assessment." wide>
      <div className="mb-3 max-w-xs">
        <Select value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {rows.map((q) => (
          <div key={q.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-900">{q.question}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                <Badge tone="blue">{q.category}</Badge> {QUESTION_TYPES.find((t) => t.value === q.type)?.label} · weight {q.weight}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onAdd({ ...q, id: uid('q') })}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        ))}
        {rows.length === 0 && <Empty compact icon={FileQuestion} title="No questions in this category" />}
      </div>
    </Modal>
  )
}

function AssessmentModal({ kind, assessment, onClose }: { kind: AssessmentKind; assessment?: Assessment; onClose: () => void }) {
  const { update } = useAdmin()
  const { toast } = useFeedback()
  const [title, setTitle] = useState(assessment?.title ?? '')
  const [passMark, setPassMark] = useState(String(assessment?.passMark ?? (kind === 'POST' ? 70 : 0)))
  const [topic, setTopic] = useState(assessment?.topic ?? '')
  const [mandatory, setMandatory] = useState(assessment?.mandatory ?? kind === 'POST')
  const [deadline, setDeadline] = useState(assessment?.deadline ?? '')
  const [lockAfterDeadline, setLockAfterDeadline] = useState(assessment?.lockAfterDeadline ?? false)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(String(assessment?.timeLimitMinutes ?? ''))
  const [timerScope, setTimerScope] = useState<'test' | 'question'>(assessment?.timerScope ?? 'test')
  const [maxAttempts, setMaxAttempts] = useState(String(assessment?.maxAttempts ?? ''))
  const [shuffle, setShuffle] = useState(assessment?.shuffle ?? false)
  const [grading, setGrading] = useState<'score' | 'passfail'>(assessment?.grading ?? 'score')
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(
    assessment?.questions ?? [{ id: uid('q'), type: 'mcq', question: '', options: ['', '', ''], answer: 0, weight: 1 }],
  )
  const [bankOpen, setBankOpen] = useState(false)

  const valid =
    title.trim() &&
    questions.length > 0 &&
    questions.every((q) => q.question.trim() && q.weight > 0 && (q.type !== 'mcq' || (q.options ?? []).filter((o) => o.trim()).length >= 2) && (q.type !== 'mcq' || q.answer !== undefined))
  const setQ = (i: number, patch: Partial<AssessmentQuestion>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)))

  const save = () => {
    const next: Assessment = {
      id: assessment?.id ?? uid('a'),
      title: title.trim(),
      kind,
      passMark: Number(passMark) || 0,
      mandatory,
      deadline: deadline || undefined,
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
      timerScope,
      maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
      shuffle,
      lockAfterDeadline,
      grading,
      topic: topic.trim() || undefined,
      templateOf: assessment?.templateOf,
      questions,
    }
    update((d) => ({ ...d, assessments: assessment ? d.assessments.map((a) => (a.id === assessment.id ? next : a)) : [...d.assessments, next] }), {
      action: assessment ? 'Updated assessment' : 'Created assessment',
      target: next.title,
      changes: assessment
        ? [
            { field: 'Pass mark', from: String(assessment.passMark), to: String(next.passMark) },
            { field: 'Time limit (min)', from: String(assessment.timeLimitMinutes ?? '—'), to: String(next.timeLimitMinutes ?? '—') },
            { field: 'Max attempts', from: String(assessment.maxAttempts ?? '—'), to: String(next.maxAttempts ?? '—') },
            { field: 'Deadline', from: assessment.deadline ?? '—', to: next.deadline ?? '—' },
            { field: 'Shuffle', from: String(assessment.shuffle), to: String(next.shuffle) },
            { field: 'Questions', from: String(assessment.questions.length), to: String(next.questions.length) },
          ]
        : undefined,
    })
    toast('Assessment saved')
    onClose()
  }

  const [step, setStep] = useState<'details' | 'settings' | 'questions' | 'review'>('details')
  const questionProblems = questions.filter((q) => !(q.question.trim() && q.weight > 0 && (q.type !== 'mcq' || ((q.options ?? []).filter((o) => o.trim()).length >= 2 && q.answer !== undefined)))).length
  const kindLabel = kind === 'PRE' ? 'Pre-assessment' : 'Post-assessment'

  return (
    <Wizard
      title={assessment ? `Edit ${assessment.title}` : `New ${kind === 'PRE' ? 'pre' : 'post'}-assessment`}
      steps={[
        { id: 'details', title: 'Details', problems: title.trim() ? 0 : 1 },
        { id: 'settings', title: 'Settings' },
        { id: 'questions', title: 'Questions', problems: questions.length ? questionProblems : 1 },
        { id: 'review', title: 'Review & save' },
      ]}
      step={step}
      onStep={setStep}
      onClose={onClose}
      onSave={save}
      canSave={!!valid}
      saveLabel="Save assessment"
    >
      {step === 'details' && (
        <WizardCard icon={FileText} title="Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Pass mark (%)">
          <Input type="number" min={0} max={100} value={passMark} onChange={(e) => setPassMark(e.target.value)} />
        </Field>
        <Field label="Topic" hint="Shown in failure reports">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Call Center Certification" />
        </Field>
        <Field label="Grading">
          <Select value={grading} onChange={(e) => setGrading(e.target.value as 'score' | 'passfail')}>
            <option value="score">Score</option>
            <option value="passfail">Pass / fail</option>
          </Select>
        </Field>
      </div>

        </WizardCard>
      )}

      {step === 'settings' && (
        <WizardCard icon={Settings2} title="Settings">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
          <input type="checkbox" className="accent-mpesa-600" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
          Mandatory — must pass to complete
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
          <input type="checkbox" className="accent-mpesa-600" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          Shuffle question order
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm">
          <input type="checkbox" className="accent-mpesa-600" checked={lockAfterDeadline} onChange={(e) => setLockAfterDeadline(e.target.checked)} />
          Lock after deadline
        </label>
        <Field label="Deadline">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <Field label="Time limit (minutes)" hint="Empty = untimed">
          <Input type="number" min={1} value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(e.target.value)} />
        </Field>
        <Field label="Timer scope">
          <Select value={timerScope} onChange={(e) => setTimerScope(e.target.value as 'test' | 'question')}>
            <option value="test">Whole test</option>
            <option value="question">Per question</option>
          </Select>
        </Field>
        <Field label="Max attempts" hint="Empty = unlimited">
          <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
        </Field>
      </div>

        </WizardCard>
      )}

      {step === 'questions' && (
        <WizardCard
          icon={ListChecks}
          title={`Questions (${questions.length})`}
          action={
            <Button size="sm" onClick={() => setBankOpen(true)}>
              <Library className="size-3.5" /> Add from bank
            </Button>
          }
        >
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex gap-2">
              <Input value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder={`Question ${i + 1}`} />
              <Select value={q.type} onChange={(e) => setQ(i, { type: e.target.value as QuestionType })} className="w-auto">
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Select value={q.weight} onChange={(e) => setQ(i, { weight: Number(e.target.value) })} className="w-24" title="Weight">
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    ×{w}
                  </option>
                ))}
              </Select>
              <Button variant="ghost" disabled={questions.length === 1} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label="Remove question">
                <Trash2 className="size-4" />
              </Button>
            </div>
            {q.type === 'mcq' && (
              <div className="mt-3 space-y-2">
                {(q.options ?? []).map((o, oi) => (
                  <label key={oi} className="flex items-center gap-2">
                    <input type="radio" name={`ans-${q.id}`} checked={q.answer === oi} onChange={() => setQ(i, { answer: oi })} className="accent-mpesa-600" title="Mark as correct answer" />
                    <Input value={o} onChange={(e) => setQ(i, { options: (q.options ?? []).map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={`Option ${oi + 1}`} className="py-1.5" />
          <Button size="sm" variant="ghost" disabled={(q.options ?? []).length <= 2} onClick={() => setQ(i, { options: (q.options ?? []).filter((_, k) => k !== oi), answer: q.answer === oi ? undefined : q.answer })} aria-label="Remove option">
            <Trash2 className="size-3.5" />
          </Button>
                  </label>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setQ(i, { options: [...(q.options ?? []), `Option ${(q.options ?? []).length + 1}`] })}>
                  <Plus className="size-3.5" /> Add option
                </Button>
                <p className="text-xs text-zinc-500">Select the radio button next to the correct answer.</p>
              </div>
            )}
            {q.type === 'descriptive' && (
              <div className="mt-3">
                <Field label="Model answer" hint="Shown to the grader">
                  <Textarea value={typeof q.answer === 'string' ? q.answer : ''} onChange={(e) => setQ(i, { answer: e.target.value })} placeholder="What a good answer includes…" />
                </Field>
              </div>
            )}
            {q.type === 'upload' && <p className="mt-3 text-xs text-zinc-500">Learners upload a file — graded manually against the model answer.</p>}
          </div>
        ))}
        <Button size="sm" onClick={() => setQuestions([...questions, { id: uid('q'), type: 'mcq', question: '', options: ['', '', ''], answer: 0, weight: 1 }])}>
          <Plus className="size-3.5" /> Add question
        </Button>
      </div>
        </WizardCard>
      )}

      {step === 'review' && (
        <WizardCard icon={CheckCircle2} title="Review & save">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ['Title', title.trim() || 'Not provided'],
              ['Type', kindLabel],
              ['Topic', topic.trim() || '—'],
              ['Pass mark', `${Number(passMark) || 0}% · ${grading === 'score' ? 'Score' : 'Pass / fail'}`],
              ['Mandatory', mandatory ? 'Yes — must pass to complete' : 'No'],
              ['Time limit', timeLimitMinutes ? `${timeLimitMinutes} min · ${timerScope === 'test' ? 'whole test' : 'per question'}` : 'Untimed'],
              ['Attempts', maxAttempts || 'Unlimited'],
              ['Deadline', deadline ? `${deadline}${lockAfterDeadline ? ' · locks after' : ''}` : '—'],
              ['Shuffle', shuffle ? 'Question order shuffled' : 'Fixed order'],
              ['Questions', `${questions.length} · ${questions.reduce((n, q) => n + q.weight, 0)} points`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-zinc-500">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium break-words text-zinc-900">{v}</dd>
              </div>
            ))}
          </dl>
          {!valid && (
            <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
              <AlertTriangle className="size-4 shrink-0" />
              {!title.trim() ? 'Add a title in Details.' : 'Some questions are incomplete — each needs text, and multiple choice needs two options and a correct answer.'}
            </p>
          )}
        </WizardCard>
      )}
      {bankOpen && (
        <BankPicker
          onAdd={(q) => {
            setQuestions([...questions, q])
            setBankOpen(false)
          }}
          onClose={() => setBankOpen(false)}
        />
      )}
    </Wizard>
  )
}

function BankQuestionModal({ onClose }: { onClose: () => void }) {
  const { update } = useAdmin()
  const { toast } = useFeedback()
  const [category, setCategory] = useState('Consumer')
  const [type, setType] = useState<QuestionType>('mcq')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', ''])
  const [answer, setAnswer] = useState(0)
  const [model, setModel] = useState('')
  const valid = question.trim() && (type !== 'mcq' || options.filter((o) => o.trim()).length >= 2)

  const save = () => {
    update(
      (d) => ({
        ...d,
        questionBank: [...d.questionBank, { id: uid('qb'), category, type, question: question.trim(), options: type === 'mcq' ? options : undefined, answer: type === 'mcq' ? answer : model.trim() || undefined, weight: 1 }],
      }),
      { action: 'Added question to bank', target: question.trim() },
    )
    toast('Question added to bank')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="New bank question" footer={<>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!valid} onClick={save}>Add to bank</Button>
    </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Question">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
        </Field>
        {type === 'mcq' && (
          <div className="space-y-2">
            {options.map((o, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name="bank-ans" checked={answer === i} onChange={() => setAnswer(i)} className="accent-mpesa-600" />
                <Input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
              </label>
            ))}
          </div>
        )}
        {type === 'descriptive' && (
          <Field label="Model answer">
            <Textarea value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

export function AdminAssessments() {
  const { kind: kindParam = 'pre' } = useParams()
  const kind: AssessmentKind = kindParam === 'post' ? 'POST' : 'PRE'
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const [tab, setTab] = useState<'list' | 'bank'>('list')
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null)
  const [viewing, setViewing] = useState<Assessment | null>(null)
  const [bankOpen, setBankOpen] = useState(false)
  const list = data.assessments.filter((a) => a.kind === kind)
  const label = kind === 'PRE' ? 'Pre-Assessments' : 'Post-Assessments'

  const clone = (a: Assessment) => {
    const copy: Assessment = { ...a, id: uid('a'), title: `${a.title} (copy)`, templateOf: a.id }
    update((d) => ({ ...d, assessments: [...d.assessments, copy] }), { action: 'Cloned assessment', target: a.title })
    toast('Cloned — results trace back to the original')
  }

  const remove = (a: Assessment) => {
    update(
      (d) => ({
        ...d,
        assessments: d.assessments.filter((x) => x.id !== a.id),
        trainings: d.trainings.map((t) => ({ ...t, preAssessmentId: t.preAssessmentId === a.id ? undefined : t.preAssessmentId, postAssessmentId: t.postAssessmentId === a.id ? undefined : t.postAssessmentId })),
        journeys: d.journeys.map((j) => ({ ...j, modules: j.modules.map((m) => ({ ...m, assessmentId: m.assessmentId === a.id ? undefined : m.assessmentId })) })),
        submissions: d.submissions.filter((s) => s.assessmentId !== a.id),
      }),
      { action: 'Deleted assessment', target: a.title },
    )
  }

  return (
    <>
      <PageHeader
        title={label}
        description={kind === 'PRE' ? 'Measure what participants know before a training.' : 'Certify what participants learned after a training.'}
        actions={
          <>
            {tab === 'bank' && (
              <Button variant="primary" onClick={() => setBankOpen(true)}>
                <Plus className="size-4" /> New bank question
              </Button>
            )}
            {tab === 'list' && (
              <Button variant="primary" onClick={() => setEditing('new')}>
                <Plus className="size-4" /> New assessment
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'list', label: 'Assessments', count: list.length }, { value: 'bank', label: 'Question bank', count: data.questionBank.length }]} />
      </div>

      {tab === 'bank' ? (
        <Table head={['Category', 'Type', 'Question', 'Correct answer / model', '']} minWidth={860}>
          {data.questionBank.map((q) => (
            <tr key={q.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3"><Badge tone="blue">{q.category}</Badge></td>
              <td className="px-4 py-3 text-zinc-600">{QUESTION_TYPES.find((t) => t.value === q.type)?.label}</td>
              <td className="px-4 py-3 max-w-md"><span className="line-clamp-2 text-sm text-zinc-900">{q.question}</span></td>
              <td className="px-4 py-3 max-w-md">
                <span className="line-clamp-2 text-sm text-zinc-600">
                  {q.type === 'mcq' ? (q.options?.[typeof q.answer === 'number' ? q.answer : 0] ?? '—') : (typeof q.answer === 'string' ? q.answer : '—')}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => update((d) => ({ ...d, questionBank: d.questionBank.filter((x) => x.id !== q.id) }), { action: 'Deleted bank question', target: q.question })} aria-label="Delete">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      ) : list.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((a) => {
            const used = data.trainings.filter((t) => t.preAssessmentId === a.id || t.postAssessmentId === a.id)
            return (
              <Card key={a.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
                    <ClipboardList className="size-5" />
                  </span>
                  <Badge tone={kind === 'PRE' ? 'blue' : 'green'}>{kind}</Badge>
                </div>
                <h3 className="mt-3 font-bold text-zinc-900">{a.title}</h3>
                <p className="mt-1 flex-1 text-sm text-zinc-500">
                  {a.questions.length} questions · {a.passMark ? `pass mark ${a.passMark}%` : 'not graded'} · used in {used.length} training{used.length === 1 ? '' : 's'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {a.mandatory && <Badge tone="amber">Mandatory</Badge>}
                  {a.timeLimitMinutes && <Badge>{a.timeLimitMinutes} min</Badge>}
                  {a.maxAttempts && <Badge>{a.maxAttempts} attempts</Badge>}
                  {a.shuffle && <Badge>Shuffled</Badge>}
                  {a.deadline && <Badge tone="red">Deadline {a.deadline}</Badge>}
                  {a.templateOf && <Badge tone="zinc">Clone</Badge>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => setViewing(a)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => clone(a)}>
                    <Copy className="size-3.5" /> Clone
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a)} aria-label="Delete">
                    <Trash2 className="size-3.5" />
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
      {bankOpen && <BankQuestionModal onClose={() => setBankOpen(false)} />}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.title} description={`${viewing.questions.length} questions`} wide>
          <ol className="space-y-4">
            {viewing.questions.map((q, i) => (
              <li key={q.id}>
                <p className="text-sm font-medium text-zinc-900">
                  {i + 1}. {q.question}
                </p>
                {q.type === 'mcq' ? (
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(q.options ?? []).map((o, oi) => (
                      <li key={oi} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm', oi === q.answer ? 'border-mpesa-500 bg-mpesa-500/10 text-zinc-900' : 'border-zinc-200 text-zinc-600')}>
                        {oi === q.answer && <CheckCircle2 className="size-4 text-mpesa-600" />}
                        {o}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                    {typeof q.answer === 'string' && q.answer ? q.answer : 'Graded manually — no model answer set.'}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  )
}

/* -------------------------------- Submissions --------------------------------- */

function GradeModal({ submission, onClose }: { submission: { id: string; score?: number; comment?: string }; onClose: () => void }) {
  const { update } = useAdmin()
  const { toast } = useFeedback()
  const [score, setScore] = useState(String(submission.score ?? ''))
  const [comment, setComment] = useState(submission.comment ?? '')

  const save = () => {
    update(
      (d) => ({
        ...d,
        submissions: d.submissions.map((s) => (s.id === submission.id ? { ...s, score: Number(score) || 0, status: 'graded' as const, comment: comment.trim() || undefined } : s)),
      }),
      { action: 'Graded submission', target: submission.id, silent: true, changes: [{ field: 'Score', from: submission.score !== undefined ? String(submission.score) : '—', to: String(Number(score) || 0) }] },
    )
    toast('Submission graded')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Grade submission" footer={<>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={score === ''} onClick={save}>Save grade</Button>
    </>}>
      <div className="space-y-4">
        <Field label="Score (%)">
          <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} autoFocus />
        </Field>
        <Field label="Trainer comment">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Feedback for the learner…" />
        </Field>
      </div>
    </Modal>
  )
}

function SubmissionView({ submission, onClose }: { submission: AssessmentSubmission; onClose: () => void }) {
  const { data } = useAdmin()
  const assessment = data.assessments.find((a) => a.id === submission.assessmentId)
  const person = data.people.find((p) => p.id === submission.personId)
  const training = data.trainings.find((t) => t.id === submission.trainingId)
  return (
    <Modal open onClose={onClose} title={assessment?.title ?? 'Submission'} description={`${person?.name ?? '?'} · ${training?.name ?? ''} · attempt ${submission.attempt}`} wide>
      <ol className="space-y-4">
        {assessment?.questions.map((q) => {
          const answer = submission.answers[q.id]
          return (
            <li key={q.id}>
              <p className="text-sm font-medium text-zinc-900">{q.question}</p>
              {q.type === 'mcq' ? (
                <div className="mt-1.5 text-sm">
                  <span className="text-zinc-600">Answer: {q.options?.[typeof answer === 'number' ? answer : -1] ?? '—'}</span>
                  {typeof q.answer === 'number' && (
                    <span className={cn('ml-2', answer === q.answer ? 'text-mpesa-600' : 'text-brand-600')}>
                      {answer === q.answer ? '· correct' : `· correct: ${q.options?.[q.answer] ?? '—'}`}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  {typeof answer === 'string' && answer ? answer : <span className="italic text-zinc-400">No answer</span>}
                  {typeof q.answer === 'string' && q.answer && <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-500">Model answer: {q.answer}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}

export function AdminSubmissions() {
  const { data } = useAdmin()
  const [assessmentId, setAssessmentId] = useState('')
  const [grading, setGrading] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const rows = data.submissions.filter((s) => !assessmentId || s.assessmentId === assessmentId)
  const graded = rows.filter((s) => s.status === 'graded' && s.score !== undefined)
  const average = graded.length ? graded.reduce((a, s) => a + (s.score ?? 0), 0) / graded.length : 0
  const needsGrading = rows.filter((s) => s.status === 'needs-grading').length
  const failed = graded.filter((s) => {
    const a = data.assessments.find((x) => x.id === s.assessmentId)
    return a && a.passMark > 0 && (s.score ?? 0) < a.passMark
  }).length
  const gradingRow = rows.find((s) => s.id === grading)
  const viewingRow = rows.find((s) => s.id === viewing)

  return (
    <>
      <PageHeader
        title="Assessment Submissions"
        description="Results and grading for learner attempts."
        actions={
          <>
          <Select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} aria-label="Assessment" className="w-auto">
            <option value="">All assessments</option>
            {data.assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
          <Button
            onClick={() =>
              downloadCsv(
                'submissions.csv',
                ['Assessment', 'Topic', 'Training', 'Participant', 'Attempt', 'Score', 'Status', 'Comment', 'Submitted'],
                rows.map((s) => [
                  data.assessments.find((a) => a.id === s.assessmentId)?.title ?? '',
                  data.assessments.find((a) => a.id === s.assessmentId)?.topic ?? '',
                  data.trainings.find((t) => t.id === s.trainingId)?.name ?? '',
                  data.people.find((p) => p.id === s.personId)?.name ?? '',
                  s.attempt,
                  s.score ?? '',
                  s.status,
                  s.comment ?? '',
                  s.submittedAt,
                ]),
              )
            }
          >
            Export CSV
          </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard tone="zinc" label="Submitted" value={rows.length} />
          <StatCard tone="green" label="Average score" value={graded.length ? `${average.toFixed(0)}%` : '—'} />
          <StatCard tone="amber" label="Needs grading" value={needsGrading} />
          <StatCard tone="red" label="Failed" value={failed} />
      </div>

      <Table head={['Participant', 'Assessment', 'Training', 'Attempt', 'Score', 'Status', 'Submitted', '']} minWidth={980}>
        {rows.map((s) => {
          const a = data.assessments.find((x) => x.id === s.assessmentId)
          const p = data.people.find((x) => x.id === s.personId)
          const t = data.trainings.find((x) => x.id === s.trainingId)
          const passed = s.status === 'graded' && s.score !== undefined && (a?.passMark ?? 0) > 0 ? (s.score ?? 0) >= a!.passMark : undefined
          return (
            <tr key={s.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar name={p?.name ?? '?'} size="sm" />
                  <span className="text-sm font-medium text-zinc-900">{p?.name ?? '?'}</span>
                </div>
              </td>
              <td className="px-4 py-3 max-w-52">
                <span className="line-clamp-1 text-sm text-zinc-700">{a?.title ?? s.assessmentId}</span>
                {a?.topic && <span className="block text-[10px] text-zinc-500 uppercase">{a.topic}</span>}
              </td>
              <td className="px-4 py-3 max-w-44"><span className="line-clamp-1 text-sm text-zinc-600">{t?.name ?? '—'}</span></td>
              <td className="px-4 py-3 text-zinc-600">#{s.attempt}</td>
              <td className="px-4 py-3">
                {s.score !== undefined ? (
                  <span className={cn('font-semibold', passed ? 'text-mpesa-600' : 'text-brand-600')}>{s.score}%</span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.status === 'graded' ? 'green' : 'amber'}>{s.status === 'graded' ? 'Graded' : 'Needs grading'}</Badge>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{s.submittedAt}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(s.id)}>
                    View
                  </Button>
                  {s.status === 'needs-grading' && (
                    <Button size="sm" variant="ghost" onClick={() => setGrading(s.id)}>
                      Grade
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </Table>
      {rows.length === 0 && (
        <Card>
          <Empty icon={ClipboardList} title="No submissions yet" text="Submissions appear once learners complete an assessment." />
        </Card>
      )}
      {gradingRow && <GradeModal submission={gradingRow} onClose={() => setGrading(null)} />}
      {viewingRow && <SubmissionView submission={viewingRow} onClose={() => setViewing(null)} />}
    </>
  )
}
