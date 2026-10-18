import { AlertCircle, ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

/** Renders into the admin content area (under the header, beside the sidebar) when it exists. */
function InPage({ label, children }: { label: string; children: ReactNode }) {
  const slot = document.getElementById('admin-page-overlay')
  const page = (
    <div role="region" aria-label={label} className={slot ? 'flex h-full flex-col bg-canvas' : 'fixed inset-0 z-40 flex flex-col bg-canvas'}>
      {children}
    </div>
  )
  return slot ? createPortal(page, slot) : page
}

export type WizardStep<T extends string> = { id: T; title: string; problems?: number }

/**
 * Full-page, step-by-step editor for long admin forms (like the requester's request form):
 * a step list on the left, one step at a time, and Back / Next / Save in a bottom bar.
 */
export function Wizard<T extends string>({
  title,
  steps,
  step,
  onStep,
  onClose,
  onSave,
  canSave,
  saveLabel = 'Save',
  children,
}: {
  title: string
  steps: WizardStep<T>[]
  step: T
  onStep: (s: T) => void
  onClose: () => void
  onSave: () => void
  canSave: boolean
  saveLabel?: string
  children: ReactNode
}) {
  const index = steps.findIndex((s) => s.id === step)
  const last = index === steps.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role=dialog][aria-modal]') && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <InPage label={title}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-surface px-4 sm:px-6">
        <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
          <X className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-zinc-900">{title}</h1>
        <span className="text-xs font-semibold text-brand-700">
          Step {index + 1} of {steps.length}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Phones: progress bar. */}
          <div className="flex gap-1.5 lg:hidden">
            {steps.map((s, i) => (
              <span key={s.id} className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-brand-600' : 'bg-zinc-200')} />
            ))}
          </div>
          <nav aria-label="Steps" className="hidden lg:block">
            <ol className="sticky top-0 space-y-1 rounded-2xl border border-zinc-200/80 bg-surface p-3">
              {steps.map((s, i) => {
                const current = s.id === step
                // Only flag steps you've moved past (or everything on the last step).
                const bad = !!s.problems && (i < index || last)
                const done = i < index && !bad
                return (
                  <li key={s.id} className="relative">
                    {i < steps.length - 1 && <span aria-hidden className={cn('absolute top-10 left-[23px] h-[calc(100%-1.5rem)] w-0.5', done ? 'bg-brand-600' : 'bg-zinc-200')} />}
                    <button
                      type="button"
                      onClick={() => onStep(s.id)}
                      aria-current={current ? 'step' : undefined}
                      className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition', current ? 'bg-brand-50/70' : 'hover:bg-zinc-50')}
                    >
                      <span
                        className={cn(
                          'relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                          bad && !current ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : done ? 'bg-brand-600 text-white' : current ? 'bg-charcoal text-white' : 'border-2 border-zinc-200 bg-surface text-zinc-500',
                        )}
                      >
                        {bad && !current ? <AlertCircle className="size-4" /> : done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={cn('block text-sm font-semibold', current ? 'text-zinc-900' : 'text-zinc-700')}>{s.title}</span>
                        {bad && <span className="block text-xs font-medium text-brand-700">{s.problems} to fix</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-zinc-200 bg-surface/95 px-4 py-3 backdrop-blur sm:px-6" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="mr-auto rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
            Cancel
          </button>
          {index > 0 && (
            <button type="button" onClick={() => onStep(steps[index - 1].id)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">
              <ArrowLeft className="size-4" /> Back
            </button>
          )}
          {last ? (
            <button type="button" onClick={onSave} disabled={!canSave} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none">
              <Check className="size-4" strokeWidth={3} /> {saveLabel}
            </button>
          ) : (
            <button type="button" onClick={() => onStep(steps[index + 1].id)} className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-charcoal-light">
              {index + 2 === steps.length ? 'Review' : 'Next'} <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </footer>
    </InPage>
  )
}

/** One step's card: icon tile, title, then the fields. */
export function WizardCard({ icon: Icon, title, action, children }: { icon: React.ComponentType<{ className?: string }>; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-7">
      <div className="flex items-center gap-3.5 border-b border-zinc-100 pb-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-5" />
        </span>
        <h2 className="min-w-0 flex-1 text-lg leading-tight font-bold text-zinc-900">{title}</h2>
        {action}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

/** Full-page container for long admin forms that manage their own steps: top bar, optional left rail, body, bottom bar. */
export function FullPageDialog({ title, subtitle, onClose, aside, footer, children }: { title: string; subtitle?: ReactNode; onClose: () => void; aside?: ReactNode; footer: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role=dialog][aria-modal]') && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <InPage label={title}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-surface px-4 sm:px-6">
        <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
          <X className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-zinc-900">{title}</h1>
        {subtitle && <span className="hidden text-xs font-semibold text-brand-700 sm:block">{subtitle}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className={cn('mx-auto grid max-w-6xl gap-6 p-4 sm:p-6', !!aside && 'lg:grid-cols-[240px_minmax(0,1fr)]')}>
          {aside && <nav aria-label="Steps">{aside}</nav>}
          <div className="min-w-0 rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-7">{children}</div>
        </div>
      </div>
      <footer className="shrink-0 border-t border-zinc-200 bg-surface/95 px-4 py-3 backdrop-blur sm:px-6" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2">{footer}</div>
      </footer>
    </InPage>
  )
}
