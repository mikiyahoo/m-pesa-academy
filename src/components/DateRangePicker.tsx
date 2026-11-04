import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn, formatDate, localISO, todayISO } from '../lib/utils'

type Range = { from: string; to: string }

const iso = (d: Date) => localISO(d).slice(0, 10)
const shift = (days: number) => {
  const d = new Date(`${todayISO()}T00:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}

/** Quick ranges offered beside the calendar. */
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const short = (d: string) => (d ? formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' }) : '')

/** Month calendar that picks a range: first click sets the start, second the end. */
function RangeCalendar({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const start = value.from || value.to || todayISO()
  const [view, setView] = useState(() => new Date(`${start.slice(0, 7)}-01T00:00:00`))
  const [hover, setHover] = useState('')
  // A start is set and the end is still to pick.
  const picking = !!value.from && !value.to
  const year = view.getFullYear()
  const month = view.getMonth()
  const first = new Date(year, month, 1)
  const days = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - first.getDay() + i))
  const today = todayISO()
  const lo = value.from
  const hi = value.to || (picking ? hover : '')
  const [a, b] = lo && hi && hi < lo ? [hi, lo] : [lo, hi]

  const pick = (d: string) => {
    if (!value.from || value.to) return onChange({ from: d, to: '' })
    onChange(d < value.from ? { from: d, to: value.from } : { from: value.from, to: d })
  }

  return (
    <div className="w-[284px]" onMouseLeave={() => setHover('')}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-bold text-zinc-900">
          {MONTHS[month]} {year}
        </p>
        <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} aria-label="Next month" className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-zinc-500">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const key = iso(d)
          const inMonth = d.getMonth() === month
          const edge = key === a || key === b
          const between = !!a && !!b && key > a && key < b
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              onMouseEnter={() => setHover(key)}
              aria-pressed={edge}
              aria-label={formatDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              className={cn(
                'h-9 text-sm tabular-nums',
                between && 'bg-brand-50',
                key === a && !!b && a !== b && 'rounded-l-full bg-brand-50',
                key === b && !!a && a !== b && 'rounded-r-full bg-brand-50',
              )}
            >
              <span
                className={cn(
                  'mx-auto grid size-9 place-items-center rounded-full transition',
                  edge ? 'bg-brand-600 font-bold text-white shadow-sm' : between ? 'text-brand-700' : inMonth ? 'text-zinc-800 hover:bg-zinc-100' : 'text-zinc-300 hover:bg-zinc-50',
                  !edge && key === today && 'ring-1 ring-brand-300',
                )}
              >
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">{picking ? 'Now pick the end date' : 'Pick a start date, then an end date'}</p>
    </div>
  )
}

/** One date-range button (like the learner Report): quick ranges on the left, a range calendar on the right. */
export function DateRangePicker({ value, onChange, className, emptyLabel = 'All dates' }: { value: Range; onChange: (r: Range) => void; className?: string; emptyLabel?: string }) {
  const [open, setOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
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
    <div ref={ref} className={cn('relative min-w-0', className)}>
      <button
        type="button"
        onClick={() => {
          // Open toward the side with room for the calendar.
          const box = ref.current?.getBoundingClientRect()
          setAlignRight(!!box && box.left + 560 > window.innerWidth)
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        title={!value.from && !value.to ? emptyLabel : label(value)}
        className="flex h-10 max-w-[17rem] min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-surface px-3 text-xs font-semibold text-zinc-700 transition hover:border-brand-200 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
      >
        <CalendarDays className="size-4 shrink-0 text-zinc-600" />
        <span className="min-w-0 truncate whitespace-nowrap">{!value.from && !value.to ? emptyLabel : label(value)}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-zinc-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className={cn('absolute z-40 mt-2 flex max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-zinc-200 bg-surface p-3 shadow-xl sm:flex-row', alignRight ? 'right-0' : 'left-0')}>
          <div className="flex w-full flex-col sm:w-48">
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
              <p className={cn('mb-2 px-1 text-xs font-semibold', current ? 'text-zinc-500' : 'text-brand-700')}>Custom range</p>
              <div className="grid gap-1.5 px-1 text-xs">
                <p className="flex justify-between gap-2">
                  <span className="text-zinc-500">From</span>
                  <span className="font-semibold text-zinc-900">{short(value.from) || '—'}</span>
                </p>
                <p className="flex justify-between gap-2">
                  <span className="text-zinc-500">To</span>
                  <span className="font-semibold text-zinc-900">{short(value.to) || '—'}</span>
                </p>
              </div>
              {(value.from || value.to) && (
                <div className="mt-3 flex items-center gap-2 px-1">
                  <button type="button" onClick={() => onChange({ from: '', to: '' })} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                    Clear
                  </button>
                  {value.from && value.to && (
                    <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                      Done
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-zinc-100 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
            <RangeCalendar value={value} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  )
}
