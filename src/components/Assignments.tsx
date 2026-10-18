import { BookOpenCheck, CalendarClock, CheckCircle2, Download, FileText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { canDownloadFile, downloadMaterial, materialFileName } from '../admin/materialFiles'
import type { Material } from '../admin/types'
import { activeLearner } from '../lib/learner'
import { acknowledgeAssignment, assignmentState, markAssignmentOpened, myLearnerId, type AssignmentState } from '../lib/assignments'
import { cn, formatDate } from '../lib/utils'
import { useFeedback } from './Feedback'
import { useDialogFocus } from '../lib/useDialogFocus'

const stateStyle: Record<AssignmentState, string> = {
  Acknowledged: 'bg-mpesa-500/10 text-mpesa-700',
  Read: 'bg-mpesa-500/10 text-mpesa-700',
  'Not opened': 'bg-zinc-100 text-zinc-600',
  Overdue: 'bg-brand-50 text-brand-700',
}

function StatePill({ m }: { m: Material }) {
  const st = assignmentState(m, myLearnerId())
  const label = st === 'Read' && m.requiresAck ? 'Needs acknowledgement' : st === 'Read' ? 'Done' : st
  return <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', st === 'Read' && m.requiresAck ? 'bg-amber-500/10 text-amber-700' : stateStyle[st])}>{label}</span>
}

/** One assigned reading as a row; opens the reader. */
export function AssignmentRow({ m, onOpen }: { m: Material; onOpen: (m: Material) => void }) {
  return (
    <button onClick={() => onOpen(m)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-zinc-50/60">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <BookOpenCheck className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-900">{m.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <CalendarClock className="size-3.5" />
          {m.dueDate ? `Due ${formatDate(m.dueDate, { month: 'short', day: 'numeric' })}` : 'No due date'} · {m.minutes} min
        </span>
      </span>
      <StatePill m={m} />
    </button>
  )
}

/** Reads an assigned material; opening it is recorded, and acknowledging confirms it when required. */
export function AssignmentReader({ m, onClose }: { m: Material; onClose: () => void }) {
  const { toast } = useFeedback()
  const [acked, setAcked] = useState(!!m.assignmentProgress?.[myLearnerId()]?.acknowledgedAt)
  const [agree, setAgree] = useState(false)
  const downloadable = canDownloadFile(m) && m.downloadableGroupIds.some((g) => activeLearner().groupIds.includes(g))

  const panel = useRef<HTMLElement>(null)
  useDialogFocus(panel, onClose)
  useEffect(() => {
    markAssignmentOpened(m.id)
  }, [m.id])

  return (
    <div role="dialog" aria-modal="true" aria-label={m.title} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <article ref={panel} className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
              Assigned reading · {m.minutes} min{m.dueDate ? ` · due ${formatDate(m.dueDate, { month: 'short', day: 'numeric' })}` : ''}
            </p>
            <h2 className="mt-1 text-xl leading-tight font-bold text-zinc-900">{m.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-5 overflow-y-auto px-6 py-5 text-[15px] leading-relaxed text-zinc-700">
          <p>{m.description || 'Read this material carefully.'}</p>
          {canDownloadFile(m) && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
                <FileText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-900">{materialFileName(m)}</span>
                <span className="block text-xs text-zinc-500">Version {m.version} · {downloadable ? 'downloadable for your group' : 'view in the portal'}</span>
              </span>
              {downloadable && (
                <button
                  onClick={async () => {
                    if (await downloadMaterial(m)) toast(`Downloaded ${materialFileName(m)}`)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  <Download className="size-3.5" /> Download
                </button>
              )}
            </div>
          )}
          {m.skills.length > 0 && (
            <p className="text-sm text-zinc-500">
              <span className="font-semibold text-zinc-700">Covers:</span> {m.skills.join(', ')}
            </p>
          )}
        </div>
        <footer className="border-t border-zinc-100 px-6 py-4">
          {!m.requiresAck ? (
            <p className="flex items-center gap-2 text-sm font-medium text-mpesa-700">
              <CheckCircle2 className="size-4" /> Opened — this assignment is done.
            </p>
          ) : acked ? (
            <p className="flex items-center gap-2 text-sm font-medium text-mpesa-700">
              <CheckCircle2 className="size-4" /> You acknowledged this material.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-sm text-zinc-700">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-4 accent-brand-600" />I have read and understood this material
              </label>
              <button
                disabled={!agree}
                onClick={() => {
                  acknowledgeAssignment(m.id)
                  setAcked(true)
                  toast('Acknowledged — thanks!')
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
              >
                <CheckCircle2 className="size-4" /> Acknowledge
              </button>
            </div>
          )}
        </footer>
      </article>
    </div>
  )
}
