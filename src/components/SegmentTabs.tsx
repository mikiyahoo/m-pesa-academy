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
}: {
  items: SegmentTab<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('scrollbar-none flex gap-1 overflow-x-auto', className)}>
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
  )
}
