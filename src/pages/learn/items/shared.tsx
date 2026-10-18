import { CheckCircle2, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none'
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50'

/** Item heading: small type label above a large title, like a course reader. */
export function ItemTitle({ eyebrow, title, aside }: { eyebrow: ReactNode; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-2xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[2rem]">{title}</h1>
      </div>
      {aside}
    </div>
  )
}

/**
 * Viewer name + date tiled across content. Screenshots aren't blocked (D4),
 * but anything captured carries who viewed it and when.
 */
export function Watermark({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-center gap-x-16 gap-y-20">
        {Array.from({ length: 48 }, (_, i) => (
          <span key={i} className={cn('text-xs font-semibold whitespace-nowrap', dark ? 'text-white/[0.09]' : 'text-zinc-900/[0.05]')}>
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Completion row under a lesson: done state, undo for the last finished module, or the complete button. */
export function CompletionRow({
  done,
  canUndo,
  onUndo,
  children,
}: {
  done: boolean
  canUndo: boolean
  onUndo: () => void
  children: ReactNode
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3.5 sm:px-5">
      {done ? (
        <>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-mpesa-700">
            <CheckCircle2 className="size-5 fill-mpesa-600 text-white" /> Completed
          </span>
          {canUndo && (
            <button onClick={onUndo} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800">
              <RotateCcw className="size-3.5" /> Mark as not complete
            </button>
          )}
        </>
      ) : (
        children
      )}
    </div>
  )
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`
