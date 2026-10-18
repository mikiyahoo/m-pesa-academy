import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

export type SegmentTab<T extends string> = { value: T; label: string; badge?: number | string }

/**
 * Learner-side tab bar: active tab is a red pill with a white badge, others are plain text
 * with a grey badge. Used by the trainings filter and the certificate design picker.
 */
export function SegmentTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  collapse = false,
}: {
  items: SegmentTab<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
  /** On phones, show one dropdown instead of a row of tabs. */
  collapse?: boolean
}) {
  return (
    <>
    {collapse && (
      <label className="relative min-w-0 flex-1 sm:hidden">
        <span className="sr-only">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-10 w-full cursor-pointer appearance-none rounded-xl bg-brand-600 pr-10 pl-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 outline-none focus:ring-2 focus:ring-brand-200"
        >
          {items.map((t) => (
            <option key={t.value} value={t.value} className="bg-white text-zinc-900">
              {t.label}
              {t.badge !== undefined ? ` (${t.badge})` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-white" />
      </label>
    )}
    <div role="tablist" aria-label={label} className={cn('scrollbar-none flex gap-1 overflow-x-auto', collapse && 'hidden sm:flex', className)}>
      {items.map((t) => {
        const active = value === t.value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
              active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-zinc-600 hover:bg-zinc-50',
            )}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className={cn('grid min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold', active ? 'bg-white text-brand-600' : 'bg-zinc-100 text-zinc-600')}>
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
    </>
  )
}
