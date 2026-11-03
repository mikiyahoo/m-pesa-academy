import { ArrowRight, CheckCircle2, Download, Eye, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { dateTime } from './helpers'
import { exportXlsx } from './reports/export'
import { useAdmin } from './store'
import type { AdminTraining, Assessment, AssessmentSubmission, Person } from './types'
import { Avatar, Badge, Button, Empty, Modal, StatCard } from './ui'
import { FullPageDialog } from './Wizard'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../store/Auth'
import { cn, localISO } from '../lib/utils'

type Row = { person: Person; subs: AssessmentSubmission[]; best?: AssessmentSubmission; result: 'Passed' | 'Failed' | 'Needs grading' | 'Not taken' }

/** One row per participant: their attempts for this assessment and the best graded result. */
function resultRows(people: Person[], t: AdminTraining, a: Assessment, submissions: AssessmentSubmission[]): Row[] {
  return t.participantIds
    .map((pid) => people.find((p) => p.id === pid))
    .filter((p): p is Person => !!p)
    .map((person) => {
      const subs = submissions.filter((s) => s.assessmentId === a.id && s.trainingId === t.id && s.personId === person.id).sort((x, y) => x.attempt - y.attempt)
      const graded = subs.filter((s) => s.status === 'graded' && typeof s.score === 'number')
      const best = graded.sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0] ?? subs.at(-1)
      const result: Row['result'] = !subs.length ? 'Not taken' : !graded.length ? 'Needs grading' : (best?.score ?? 0) >= a.passMark ? 'Passed' : 'Failed'
      return { person, subs, best, result }
    })
}

const tone = { Passed: 'green', Failed: 'red', 'Needs grading': 'amber', 'Not taken': 'zinc' } as const

/** The participant's answer to one question, as text for the spreadsheet. */
function answerText(a: Assessment, qid: string, value: number | string | undefined) {
  const q = a.questions.find((x) => x.id === qid)
  if (value === undefined || value === '') return ''
  if (q?.type === 'mcq' && typeof value === 'number') return q.options?.[value] ?? String(value)
  return String(value)
}

function download(t: AdminTraining, a: Assessment, label: string, rows: Row[]) {
  const results = {
    name: 'Results',
    header: ['Participant', 'Email', 'Department', 'Attempts', 'Best score (%)', 'Pass mark (%)', 'Result', 'Last submitted'],
    rows: rows.map((r) => [r.person.name, r.person.email, r.person.department, r.subs.length, r.best?.score ?? '', a.passMark, r.result, r.subs.at(-1)?.submittedAt ? dateTime(r.subs.at(-1)!.submittedAt) : '']),
  }
  const answers = {
    name: 'Answers',
    header: ['Participant', 'Email', 'Attempt', 'Score (%)', ...a.questions.map((q, i) => `Q${i + 1}. ${q.question}`.slice(0, 60))],
    rows: rows.flatMap((r) => r.subs.map((s) => [r.person.name, r.person.email, s.attempt, s.score ?? 'Not graded', ...a.questions.map((q) => answerText(a, q.id, s.answers[q.id]))])),
  }
  const key = (q: Assessment['questions'][number]) =>
    q.type === 'mcq' && typeof q.answer === 'number' ? (q.options?.[q.answer] ?? '') : typeof q.answer === 'string' ? q.answer : ''
  const questions = { name: 'Questions', header: ['#', 'Question', 'Type', 'Correct / model answer', 'Weight'], rows: a.questions.map((q, i) => [i + 1, q.question, q.type, key(q), q.weight]) }
  exportXlsx(`${t.name} – ${label} results`.replace(/[\\/:*?"<>|]+/g, '-'), [results, answers, questions])
}

/** Summary, per-participant results and an Excel export for one of a training's assessments. */
export function AssessmentResults({ training, assessment, label }: { training: AdminTraining; assessment: Assessment; label: string }) {
  const { data, update } = useAdmin()
  const { user } = useAuth()
  const { confirm, toast } = useFeedback()
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<Row | null>(null)

  // Clears the person's attempts for this assessment so they can take it again (admins and trainers).
  const resetAttempt = async (r: Row) => {
    const ok = await confirm({ title: `Reset ${r.person.name}'s attempts?`, message: `Their ${r.subs.length} attempt${r.subs.length === 1 ? '' : 's'} at “${assessment.title}” are removed and they can take it again.`, confirmLabel: 'Reset attempts' })
    if (!ok) return
    const at = localISO()
    update(
      (d) => ({
        ...d,
        submissions: d.submissions.filter((x) => !(x.assessmentId === assessment.id && x.trainingId === training.id && x.personId === r.person.id)),
        trainings: d.trainings.map((t) => (t.id === training.id ? { ...t, attemptResets: [...(t.attemptResets ?? []), { personId: r.person.id, assessmentId: assessment.id, at, by: user.name }] } : t)),
      }),
      { action: 'Reset assessment attempts', target: `${r.person.name} · ${assessment.title}`, silent: true },
    )
    toast(`${r.person.name} can take “${assessment.title}” again`)
  }
  const rows = resultRows(data.people, training, assessment, data.submissions)
  const taken = rows.filter((r) => r.subs.length)
  const scores = taken.map((r) => r.best?.score).filter((s): s is number => typeof s === 'number')
  const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null
  const passed = rows.filter((r) => r.result === 'Passed').length
  const pending = rows.filter((r) => r.result === 'Needs grading').length

  const summary = [`${taken.length}/${rows.length} submitted`, avg === null ? null : `avg ${avg}%`, `${passed} passed`, pending ? `${pending} to grade` : null].filter(Boolean).join(' · ')

  return (
    <>
      {/* One clickable row, like the Feedback card: opens the responses; the icon downloads the Excel file. */}
      <div className="flex items-center gap-1 rounded-xl border border-zinc-200 transition hover:bg-zinc-50">
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
          <CheckCircle2 className="size-5 shrink-0 text-mpesa-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-900">{label}</span>
            <span className="block truncate text-xs text-zinc-500" title={assessment.title}>
              {assessment.title}
            </span>
            <span className="block text-xs font-medium text-brand-600">View responses · {summary}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-zinc-700" />
        </button>
        <button
          type="button"
          onClick={() => download(training, assessment, label, rows)}
          disabled={!taken.length}
          aria-label={`Download ${label} results as Excel`}
          title={taken.length ? 'Download results (Excel)' : 'No responses yet'}
          className="mr-1.5 grid size-9 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
        >
          <Download className="size-4" />
        </button>
      </div>

      {open && (
        <FullPageDialog
          title={`${label} · ${assessment.title}`}
          subtitle={`Pass mark ${assessment.passMark}%`}
          onClose={() => setOpen(false)}
          footer={
            <>
              <span className="mr-auto self-center text-xs text-zinc-500">
                {rows.length} participant{rows.length === 1 ? '' : 's'} · {taken.length} submitted
              </span>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </>
          }
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">{label}</h2>
            <Button onClick={() => download(training, assessment, label, rows)} disabled={!taken.length}>
              <Download className="size-4" /> Export to Excel
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total submissions" value={taken.length} />
            <StatCard label="Passed" value={passed} />
            <StatCard label="Failed" value={rows.filter((r) => r.result === 'Failed').length} />
            <StatCard label="Average score" value={avg === null ? '—' : `${avg}%`} />
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200/80 scrollbar-thin">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
                <tr>
                  <th className="px-3 py-3">User name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Attempts</th>
                  <th className="px-3 py-3">Submitted at</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <tr key={r.person.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={r.person.name} size="sm" />
                        <span className="font-medium text-zinc-900">{r.person.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600">{r.person.email}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{typeof r.best?.score === 'number' ? `${r.best.score}%` : '—'}</td>
                    <td className="px-3 py-2.5 tabular-nums">{r.subs.length}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">{r.subs.at(-1) ? dateTime(r.subs.at(-1)!.submittedAt) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={tone[r.result]}>{r.result.toUpperCase()}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={!r.subs.length} onClick={() => setDetails(r)}>
                          <Eye className="size-3.5" /> View details
                        </Button>
                        <Button size="sm" variant="ghost" disabled={!r.subs.length} onClick={() => resetAttempt(r)}>
                          <RotateCcw className="size-3.5" /> Reset attempt
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty compact icon={Eye} title="No participants yet" />}
          </div>
        </FullPageDialog>
      )}

      {details && (
        <Modal open wide onClose={() => setDetails(null)} title={details.person.name} description={`${assessment.title} · ${details.subs.length} attempt${details.subs.length === 1 ? '' : 's'}`} footer={<Button onClick={() => setDetails(null)}>Close</Button>}>
          <div className="space-y-5">
            {details.subs.map((sub) => (
              <section key={sub.id}>
                <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                  Attempt {sub.attempt}
                  <span className="font-normal text-zinc-500">· {dateTime(sub.submittedAt)}</span>
                  <Badge tone={sub.status !== 'graded' ? 'amber' : (sub.score ?? 0) >= assessment.passMark ? 'green' : 'red'}>{sub.status !== 'graded' ? 'NEEDS GRADING' : `${sub.score}%`}</Badge>
                </p>
                <ol className="space-y-2">
                  {assessment.questions.map((q, i) => {
                    const given = answerText(assessment, q.id, sub.answers[q.id])
                    const correct = q.type === 'mcq' && typeof q.answer === 'number' ? sub.answers[q.id] === q.answer : undefined
                    return (
                      <li key={q.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                        <p className="font-medium text-zinc-900">
                          {i + 1}. {q.question}
                        </p>
                        <p className={cn('mt-1', correct === false ? 'text-brand-700' : correct ? 'text-mpesa-700' : 'text-zinc-700')}>
                          {correct === undefined ? '' : correct ? '✓ ' : '✗ '}
                          {given || <span className="text-zinc-400">No answer recorded</span>}
                        </p>
                        {correct === false && q.options && typeof q.answer === 'number' && <p className="mt-0.5 text-xs text-zinc-500">Correct answer: {q.options[q.answer]}</p>}
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
