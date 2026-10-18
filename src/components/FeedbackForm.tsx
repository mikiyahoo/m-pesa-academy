import { Send } from 'lucide-react'
import { useState } from 'react'
import { FEEDBACK_STATEMENTS, LIKERT } from '../data/trainings'
import { useFeedback } from './Feedback'
import { cn, localISO } from '../lib/utils'
import type { FeedbackSubmission } from '../types'

const choice = (active: boolean) =>
  cn(
    'rounded-xl border px-3 py-2 text-xs font-medium transition sm:text-[13px]',
    active ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50',
  )

/**
 * Post-training feedback (TA-4.1, TE-4.1, URS 2.6, D5: mandatory).
 * Four Likert statements (all required), a required Yes/No recommend,
 * an optional comment and a "submit anonymously" toggle (D9).
 */
export function FeedbackSurvey({ onSubmit }: { onSubmit: (feedback: FeedbackSubmission) => void }) {
  const { toast } = useFeedback()
  const [likert, setLikert] = useState<number[]>(FEEDBACK_STATEMENTS.map(() => 0))
  const [recommend, setRecommend] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [anonymous, setAnonymous] = useState(false)

  const answered = likert.filter((v) => v > 0).length + (recommend !== null ? 1 : 0)
  const required = FEEDBACK_STATEMENTS.length + 1
  const valid = answered === required

  const submit = () => {
    onSubmit({ likert, recommend: recommend ?? false, comment: comment.trim(), anonymous, submittedAt: localISO() })
    toast(anonymous ? 'Feedback submitted anonymously — thank you!' : 'Feedback submitted — thank you!')
  }

  return (
    <div className="space-y-8">
      {FEEDBACK_STATEMENTS.map((statement, i) => (
        <fieldset key={statement}>
          <legend className="flex gap-3 text-[15px] font-medium text-zinc-900">
            <span className="font-bold">{i + 1}.</span> {statement}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2 pl-6">
            {LIKERT.map((label, v) => (
              <button key={label} type="button" onClick={() => setLikert((l) => l.map((x, xi) => (xi === i ? v + 1 : x)))} aria-pressed={likert[i] === v + 1} className={choice(likert[i] === v + 1)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="flex gap-3 text-[15px] font-medium text-zinc-900">
          <span className="font-bold">{FEEDBACK_STATEMENTS.length + 1}.</span> Would you recommend this training to a colleague?
        </legend>
        <div className="mt-3 flex gap-2 pl-6">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => setRecommend(v)} aria-pressed={recommend === v} className={cn(choice(recommend === v), 'min-w-24')}>
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="flex gap-3 text-[15px] font-medium text-zinc-900">
          <span className="font-bold">{FEEDBACK_STATEMENTS.length + 2}.</span> Anything else? <span className="font-normal text-zinc-500">(optional)</span>
        </legend>
        <div className="mt-3 pl-6">
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What worked well, and what could be better…"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-6">
        <label className="flex items-center gap-2.5">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="size-4 accent-brand-600" />
          <span className="text-sm text-zinc-700">Submit anonymously</span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {answered}/{required} required answered
          </span>
          <button
            onClick={submit}
            disabled={!valid}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Send className="size-4" /> Submit feedback
          </button>
        </div>
      </div>
    </div>
  )
}
