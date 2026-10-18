import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn, formatDate, localISO, todayISO } from '../lib/utils'

type Range = { from: string; to: string }

const iso = (d: Date) => localISO(d).slice(0, 10)
const shift = (days: number) => {
  const d = new Date(`${todayISO()}T00:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}

/** Quick ranges offered above the custom dates. */
function presets(): { label: string; range: Range }[] {
  const t = new Date(`${todayISO()}T00:00:00`)
  return [
    { label: 'All dates', range: { from: '', to: '' } },
    { label: 'This month', range: { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) } },
    { label: 'Last 30 days', range: { from: shift(-29), to: todayISO() } },
    { label: 'Last 90 days', range: { from: shift(-89), to: todayISO() } },
    { label: 'This year', range: { from: `${t.getFullYear()}-01-01`, to: `${t.getFullYear()}-12-31` } },
  ]
}

const label = ({ from, to }: Range) => {
  const f = (d: string) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' })
  if (!from && !to) return 'All dates'
  if (from && to) return `${f(from)} – ${f(to)}`
  return from ? `From ${f(from)}` : `Until ${f(to)}`
}

/** One date-range button (like the learner Report) that opens quick ranges and custom From / To dates. */
export function DateRangePicker({ value, onChange, className }: { value: Range; onChange: (r: Range) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const list = presets()
  const current = list.find((p) => p.range.from === value.from && p.range.to === value.to)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-surface px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
      >
        <CalendarDays className="size-4 shrink-0 text-zinc-600" />
        <span className="whitespace-nowrap">{label(value)}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-surface p-3 shadow-xl">
          <ul className="space-y-0.5">
            {list.map((p) => (
              <li key={p.label}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.range)
                    setOpen(false)
                  }}
                  className={cn('flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition', current?.label === p.label ? 'bg-brand-50 font-semibold text-brand-700' : 'text-zinc-700 hover:bg-zinc-100')}
                >
                  {p.label}
                  {current?.label === p.label && <Check className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-zinc-100 pt-3">
            <p className={cn('mb-2 text-xs font-semibold', current ? 'text-zinc-500' : 'text-brand-700')}>Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-600">
                From
                <input
                  type="date"
                  value={value.from}
                  max={value.to || undefined}
                  onChange={(e) => onChange({ ...value, from: e.target.value })}
                  className="w-full min-w-0 rounded-lg border border-zinc-200 bg-surface px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand-500"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-600">
                To
                <input
                  type="date"
                  value={value.to}
                  min={value.from || undefined}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                  className="w-full min-w-0 rounded-lg border border-zinc-200 bg-surface px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand-500"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
