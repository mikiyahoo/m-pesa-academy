import { Search, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn, initials } from '../lib/utils'
import type { RequestStatus, TrainingStatus } from './types'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl border border-zinc-200 bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]', className)}>{children}</section>
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        variant === 'outline' && 'border border-zinc-200 bg-surface text-zinc-800 shadow-sm hover:bg-zinc-50',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        variant === 'danger' && 'border border-brand-200 bg-surface text-brand-700 hover:bg-brand-50',
        className,
      )}
    />
  )
}

export function Badge({ children, tone = 'zinc', className }: { children: ReactNode; tone?: 'zinc' | 'green' | 'red' | 'amber' | 'blue'; className?: string }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
    green: 'bg-mpesa-500/10 text-mpesa-700 ring-mpesa-500/20 dark:text-mpesa-500',
    red: 'bg-brand-50 text-brand-700 ring-brand-200 dark:text-brand-500',
    amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400',
    blue: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400',
  }
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset', tones[tone], className)}>{children}</span>
}

export const trainingStatusTone: Record<TrainingStatus, 'zinc' | 'green' | 'red' | 'amber' | 'blue'> = {
  SCHEDULED: 'zinc',
  ONGOING: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'red',
}

export const requestStatusTone: Record<RequestStatus, 'zinc' | 'green' | 'red' | 'amber'> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-zinc-100 font-medium text-zinc-600', size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-sm')}>
      {initials(name)}
    </span>
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
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
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
        className="w-full rounded-lg border border-zinc-200 bg-surface py-2 pr-3 pl-9 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-zinc-200 bg-surface px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

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
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={cn(inputCls, props.className)} />

export function Modal({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Close">
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
    <div className="flex flex-col items-center py-12 text-center">
      <Icon className="size-8 text-zinc-300" />
      <p className="mt-3 text-sm font-medium text-zinc-800">{title}</p>
      {text && <p className="mt-0.5 text-xs text-zinc-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Table({ head, children, minWidth = 720 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-surface scrollbar-thin">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-800">{children}</tbody>
      </table>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-zinc-100 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn('rounded-md px-3 py-1 text-xs font-medium transition', value === it.value ? 'bg-surface text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}
        >
          {it.label}
          {it.count !== undefined && <span className="ml-1.5 text-zinc-400">{it.count}</span>}
        </button>
      ))}
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
