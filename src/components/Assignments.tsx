import { BookOpenCheck, CalendarClock, CheckCircle2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MaterialAttachmentPreview } from '../admin/MaterialAttachmentPreview'
import { canDownloadFile } from '../admin/materialFiles'
import { loadAdminData } from '../admin/storage'
import type { Material } from '../admin/types'
import { activeLearner } from '../lib/learner'
import { acknowledgeAssignment, assignmentState, markAssignmentOpened, myLearnerId, type AssignmentState } from '../lib/assignments'
import { cn, formatDate } from '../lib/utils'
import { useFeedback } from './Feedback'
import { useDialogFocus } from '../lib/useDialogFocus'
import { PptxViewer } from './PptxViewer'

const stateStyle: Record<AssignmentState, string> = {
  Acknowledged: 'bg-mpesa-500/10 text-mpesa-700',
  Read: 'bg-mpesa-500/10 text-mpesa-700',
  'Not opened': 'bg-zinc-100 text-zinc-600',
  Overdue: 'bg-brand-50 text-brand-700',
}

function StatePill({ m, personId }: { m: Material; personId: string }) {
  const st = assignmentState(m, personId)
  const label = st === 'Read' && m.requiresAck ? 'Needs acknowledgement' : st === 'Read' ? 'Done' : st
  return <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', st === 'Read' && m.requiresAck ? 'bg-amber-500/10 text-amber-700' : stateStyle[st])}>{label}</span>
}

/** One assigned reading as a row; opens the reader. */
export function AssignmentRow({ m, onOpen, personId = myLearnerId() }: { m: Material; onOpen: (m: Material) => void; personId?: string }) {
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
      <StatePill m={m} personId={personId} />
    </button>
  )
}

/** Reads an assigned material; opening it is recorded, and acknowledging confirms it when required. */
export function AssignmentReader({ m, onClose, personId = myLearnerId() }: { m: Material; onClose: () => void; personId?: string }) {
  const { toast } = useFeedback()
  const [acked, setAcked] = useState(!!m.assignmentProgress?.[personId]?.acknowledgedAt)
  const [agree, setAgree] = useState(false)
  const person = loadAdminData().people.find((item) => item.id === personId)
  const personGroups = person?.groupIds ?? (activeLearner().personId === personId ? activeLearner().groupIds : [])
  const downloadable = canDownloadFile(m) && m.downloadableGroupIds.some((g) => personGroups.includes(g))

  const panel = useRef<HTMLElement>(null)
  useDialogFocus(panel, onClose)
  useEffect(() => {
    markAssignmentOpened(m.id, personId)
  }, [m.id, personId])
  useEffect(() => {
    setAcked(!!m.assignmentProgress?.[personId]?.acknowledgedAt)
    setAgree(false)
  }, [m.id, m.assignmentProgress, personId])

  return (
    <div role="dialog" aria-modal="true" aria-label={m.title} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <article ref={panel} className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 text-[15px] leading-relaxed text-zinc-700">
          {m.fileId ? (
            <>
              {m.description && <p>{m.description}</p>}
              <MaterialAttachmentPreview type={m.type} title={m.title} fileId={m.fileId} fileName={m.fileName} fileSize={m.fileSize} allowDownload={downloadable} />
            </>
          ) : m.type === 'PRESENTATION' ? (
            <PptxViewer url="/trainings/Sample Training.pptx" title={m.title} />
          ) : (
            <article className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50 p-6 sm:p-9">
              <p className="text-sm font-extrabold tracking-tight text-brand-600">M-PESA Academy · {m.type.toLowerCase()}</p>
              <h3 className="mt-5 text-xl font-bold text-zinc-900">{m.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">{m.description || 'Read this material carefully.'}</p>
              {m.skills.length > 0 && <p className="mt-5 border-t border-zinc-200 pt-4 text-sm text-zinc-600"><span className="font-semibold text-zinc-800">Topics:</span> {m.skills.join(', ')}</p>}
              <p className="mt-5 text-xs text-zinc-400">Version {m.version} · Updated {formatDate(m.updatedAt)}</p>
            </article>
          )}
          {m.fileId && m.skills.length > 0 && (
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
                  acknowledgeAssignment(m.id, personId)
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
