import { CheckCircle2, LogIn } from 'lucide-react'
import { useState } from 'react'
import { FeedbackSurvey } from '../components/FeedbackForm'
import { loadAdminData, saveAdminData } from '../admin/storage'
import { uid } from '../admin/store'

/**
 * Feedback link that doesn't need a sign-in (US33): only when the trainer turned "sign-in required" off
 * for that training. Responses are saved without a name, like anonymous feedback.
 */
export function OpenFeedback({ id }: { id: string }) {
  const [done, setDone] = useState(false)
  const data = loadAdminData()
  const training = data.trainings.find((t) => t.id === id)
  const form = training ? (data.feedbackForms.find((f) => f.id === training.feedbackFormId) ?? data.feedbackForms[0]) : undefined

  const shell = (children: React.ReactNode) => (
    <div className="min-h-dvh bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
          <span className="leading-tight font-bold text-zinc-900">
            M-PESA <span className="block text-sm font-semibold text-zinc-500">Academy</span>
          </span>
        </div>
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8">{children}</div>
      </div>
    </div>
  )

  if (!training || !form)
    return shell(<p className="text-center text-sm text-zinc-600">This feedback link isn’t valid any more. Ask your trainer for a new one.</p>)

  if (!training.feedbackOpenLink)
    return shell(
      <div className="text-center">
        <p className="text-lg font-bold text-zinc-900">Sign in to give feedback</p>
        <p className="mt-1 text-sm text-zinc-500">The trainer asks participants to sign in for “{training.name}”.</p>
        <a href={`/give-feedback/${training.id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <LogIn className="size-4" /> Sign in and continue
        </a>
      </div>,
    )

  if (done)
    return shell(
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-mpesa-600" />
        <p className="mt-3 text-lg font-bold text-zinc-900">Thank you for your feedback</p>
        <p className="mt-1 text-sm text-zinc-500">It helps us improve “{training.name}”.</p>
      </div>,
    )

  return shell(
    <>
      <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Training feedback</p>
      <h1 className="mt-1 text-xl font-bold text-zinc-900">{training.name}</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">No sign-in needed. Your answers are anonymous.</p>
      <FeedbackSurvey
        onSubmit={(f) => {
          const latest = loadAdminData()
          saveAdminData({
            ...latest,
            feedbackResponses: [
              ...latest.feedbackResponses,
              { id: uid('fb'), formId: form.id, trainingId: training.id, participantId: `link-${uid('anon')}`, ratings: [...f.likert, f.recommend ? 1 : 0], comment: f.comment, submittedAt: f.submittedAt },
            ],
          })
          setDone(true)
        }}
      />
    </>,
  )
}
