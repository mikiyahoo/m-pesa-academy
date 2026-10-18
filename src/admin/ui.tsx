import { Award, BarChart3, CheckCircle2, ChevronDown, ClipboardCheck, Clock, Download, FileQuestion, GraduationCap, MessageSquare, Search, Star, UserCheck, Users, X, XCircle } from 'lucide-react'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/utils'
import type { RequestStatus, TrainingStatus } from './types'
import { UserAvatar } from '../components/UserAvatar'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-zinc-200/80 bg-surface p-5 transition-all', className)}>{children}</section>
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-semibold text-zinc-900">{children}</h2>
      {action}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'md' }

export function Button({ variant = 'outline', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white shadow-xs hover:bg-brand-700 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-500/20',
        variant === 'outline' && 'border border-zinc-200 bg-surface text-zinc-800 shadow-xs hover:bg-zinc-50 hover:border-zinc-300',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        variant === 'danger' && 'border border-brand-200 bg-surface text-brand-700 hover:bg-brand-50',
        className,
      )}
    />
  )
}

export function Badge({ children, tone = 'zinc', className }: { children: ReactNode; tone?: 'zinc' | 'green' | 'red' | 'amber' | 'blue'; className?: string }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200/80',
    green: 'bg-mpesa-500/10 text-mpesa-700 ring-mpesa-500/25 dark:text-mpesa-500',
    red: 'bg-brand-50 text-brand-700 ring-brand-200 dark:text-brand-500',
    amber: 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-400',
    blue: 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-400',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset', tones[tone], className)}>{children}</span>
}

export const trainingStatusTone: Record<TrainingStatus, 'zinc' | 'green' | 'red' | 'amber' | 'blue'> = {
  SCHEDULED: 'zinc',
  ONGOING: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
}

export const requestStatusTone: Record<RequestStatus, 'zinc' | 'green' | 'red' | 'amber'> = {
  DRAFT: 'zinc',
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <UserAvatar name={name} className={size === 'sm' ? 'size-7' : 'size-9'} />
  )
}

export type StatTone = 'zinc' | 'red' | 'green' | 'amber'

/** Icon for a stat card that didn't pass one, picked from its label so every number card has an icon tile. */
const STAT_ICONS: [RegExp, React.ComponentType<{ className?: string }>][] = [
  [/certif/i, Award],
  [/attend|present|check-?in/i, UserCheck],
  [/fail/i, XCircle],
  [/pass|score|grade|average|avg/i, Star],
  [/feedback|rating|response/i, MessageSquare],
  [/request/i, FileQuestion],
  [/complet|done|finish/i, CheckCircle2],
  [/hour|time|minute|duration/i, Clock],
  [/view|download/i, Download],
  [/trainee|people|participant|learner|enrol|user|member/i, Users],
  [/training|session|course/i, GraduationCap],
  [/submit|assessment|attempt|grading/i, ClipboardCheck],
]
const iconFor = (label: string) => STAT_ICONS.find(([re]) => re.test(label))?.[1] ?? BarChart3
const statTile: Record<StatTone, string> = {
  red: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15',
  green: 'bg-mpesa-500/10 text-mpesa-600',
  amber: 'bg-amber-500/10 text-amber-600',
  zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800',
}

/** One stat card for every admin page, matching the learner portal: icon left, label above value, hint below. */
export function StatCard({ icon: Icon, label, value, hint, tone = 'zinc', className }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: ReactNode; hint?: ReactNode; tone?: StatTone; className?: string }) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-4 shadow-card sm:p-5', className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {(() => {
          const Shown = Icon ?? iconFor(label)
          return (
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-full sm:size-12', statTile[tone])}>
              <Shown className="size-5" />
            </span>
          )
        })()}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-600 sm:text-[13px]">{label}</p>
          <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-auto pt-3 text-xs text-zinc-500">{hint}</p>}
    </Card>
  )
}

export function ProgressBar({ value, className, tone = 'red' }: { value: number; className?: string; tone?: 'red' | 'green' }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-zinc-100', className)}>
      <div className={cn('h-full rounded-full transition-all', tone === 'red' ? 'bg-brand-600' : 'bg-mpesa-500')} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function PageHeader({ title, description, actions, meta }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl leading-tight font-bold tracking-tight text-zinc-900">{title}</h1>
        {/* Titles stand alone like the learner portal; `description` is kept for screen readers only. */}
        {description && <p className="sr-only">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-5 text-sm text-zinc-500">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-full border border-transparent bg-zinc-100 py-2 pr-4 pl-9 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-brand-500 focus:bg-surface focus:ring-2 focus:ring-brand-100 dark:bg-zinc-800/70 dark:focus:bg-surface"
      />
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-surface px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cn(inputCls, props.className)} />
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...props} className={cn(inputCls, props.className)} />
/** Native select with our own chevron, so the arrow has the same breathing room as the text on the left. */
export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => {
  // Width classes size the wrapper; everything else styles the select itself.
  const tokens = (className ?? '').split(/\s+/).filter(Boolean)
  const widths = tokens.filter((t) => /(^|:)w-/.test(t))
  const rest = tokens.filter((t) => !widths.includes(t))
  const auto = widths.some((w) => w.startsWith('w-auto'))
  return (
    <span className={cn('relative', widths.length ? cn('inline-block', widths.join(' ')) : 'block w-full')}>
      <select {...props} className={cn(inputCls, 'appearance-none pr-9', rest.join(' '), auto ? 'w-auto!' : 'w-full')} />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
    </span>
  )
}

export function Modal({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    restore.current = document.activeElement as HTMLElement | null
    // Keep an autofocused field; otherwise start focus at the dialog itself.
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      // Trap Tab inside the dialog and wrap at either end.
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((n) => n.offsetParent !== null)
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (restore.current?.isConnected) restore.current.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={dialog}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl outline-none sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-zinc-900">{title}</h2>
            {description && <p id={descId} className="mt-0.5 text-sm text-zinc-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 scrollbar-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
        <Icon className="size-7" />
      </span>
      <p className="mt-4 text-base font-bold text-zinc-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Table({ head, children, minWidth = 720 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-surface scrollbar-thin">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-zinc-200/80 bg-zinc-50/75 text-xs font-semibold text-zinc-600">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3.5 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100/90 text-zinc-800">{children}</tbody>
      </table>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; label?: string }) {
  // Learner-style red pill tabs (matches SegmentTabs) with tablist semantics and arrow-key moves.
  const move = (dir: 1 | -1) => {
    const i = items.findIndex((it) => it.value === value)
    const next = items[(i + dir + items.length) % items.length]
    if (next) onChange(next.value)
  }
  return (
    <div role="tablist" aria-label={label} className="scrollbar-none flex flex-wrap gap-1">
      {items.map((it) => {
        const active = value === it.value
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
              }
            }}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
              active
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn('grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')}>
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}
