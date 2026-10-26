import { BarChart3, ChevronDown, Download, FileSpreadsheet, FileText, Printer, X } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { useAdmin } from '../store'
import { REGIONS } from '../temporary'
import { Button, Card, Select, StatCard, type StatCardTrend } from '../ui'
import { exportCsv, exportXlsx, printReport, type Sheet } from './export'
import type { ReportFilters } from './filters'
import { EmptyState } from '../../components/EmptyState'
import { DateRangePicker } from '../../components/DateRangePicker'

/** Filter bar shared by every report (D02). `hide` drops filters that don't apply to a report. */
export function FilterBar({
  filters,
  set,
  clear,
  active,
  hide = [],
}: {
  filters: ReportFilters
  set: (p: Partial<ReportFilters>) => void
  clear: () => void
  active: number
  hide?: (keyof ReportFilters)[]
}) {
  const { data } = useAdmin()
  const [open, setOpen] = useState(false)
  const show = (k: keyof ReportFilters) => !hide.includes(k)
  const trainers = data.people.filter((p) => p.role === 'Trainer' || p.role === 'Admin')
  return (
    <Card className="mb-5 p-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={{ from: filters.from, to: filters.to }} onChange={(r) => set({ from: r.from, to: r.to })} />
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 sm:hidden">
          More <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
        </button>
        <div className={cn('w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap', open ? 'grid' : 'hidden')}>
          {show('typeId') && (
            <Select value={filters.typeId} onChange={(e) => set({ typeId: e.target.value })} aria-label="Training type" title={data.trainingTypes.find((t) => t.id === filters.typeId)?.name ?? 'All types'} className="w-full sm:w-[14rem] h-10 py-0 text-xs truncate">
              <option value="">All types</option>
              {data.trainingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
          {show('groupId') && (
            <Select value={filters.groupId} onChange={(e) => set({ groupId: e.target.value })} aria-label="Team" title={data.groups.find((g) => g.id === filters.groupId)?.name ?? 'All teams'} className="w-full sm:w-[11rem] h-10 py-0 text-xs truncate">
              <option value="">All teams</option>
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
          {show('region') && (
            <Select value={filters.region} onChange={(e) => set({ region: e.target.value })} aria-label="Region" title={filters.region || 'All regions'} className="w-full sm:w-[11rem] h-10 py-0 text-xs truncate">
              <option value="">All regions</option>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
          {show('trainerId') && (
            <Select value={filters.trainerId} onChange={(e) => set({ trainerId: e.target.value })} aria-label="Trainer" title={trainers.find((p) => p.id === filters.trainerId)?.name ?? 'All trainers'} className="w-full sm:w-[13rem] h-10 py-0 text-xs truncate">
              <option value="">All trainers</option>
              {trainers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          {show('status') && (
            <Select value={filters.status} onChange={(e) => set({ status: e.target.value as ReportFilters['status'] })} aria-label="Status" title={filters.status || 'Any status'} className="w-full sm:w-[9rem] h-10 py-0 text-xs truncate">
              <option value="">Any status</option>
              {['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'].map((s) => (
                <option key={s} value={s}>
                  {s[0] + s.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          )}
          {show('delivery') && (
            <Select value={filters.delivery} onChange={(e) => set({ delivery: e.target.value as ReportFilters['delivery'] })} aria-label="Delivery mode" title={filters.delivery || 'Online & physical'} className="w-full sm:w-[11rem] h-10 py-0 text-xs truncate">
              <option value="">Online &amp; physical</option>
              <option>Online</option>
              <option>Physical</option>
            </Select>
          )}
        </div>
        {active > 0 && (
          <button onClick={clear} className="ml-auto inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
            <X className="size-3.5" /> Clear {active}
          </button>
        )}
      </div>
    </Card>
  )
}

/** CSV / Excel / PDF export with an anonymise toggle for trainee-level data (D03). */
export function ExportMenu({ filename, title, sheets, personal = false }: { filename: string; title: string; sheets: (anonymise: boolean) => Sheet[]; personal?: boolean }) {
  const [open, setOpen] = useState(false)
  const [anon, setAnon] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100'
  return (
    <div ref={ref} className="relative print:hidden">
      <Button variant="primary" onClick={() => setOpen((o) => !o)}>
        <Download className="size-4" /> Export <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-60 rounded-xl border border-zinc-200 bg-surface p-1.5 shadow-lg">
          <button
            className={item}
            onClick={() => {
              const s = sheets(anon)
              exportXlsx(filename, s)
              setOpen(false)
            }}
          >
            <FileSpreadsheet className="size-4 text-mpesa-600" /> Excel (.xlsx)
          </button>
          <button
            className={item}
            onClick={() => {
              exportCsv(filename, sheets(anon)[0])
              setOpen(false)
            }}
          >
            <FileText className="size-4 text-zinc-500" /> CSV
          </button>
          <button
            className={item}
            onClick={() => {
              setOpen(false)
              setTimeout(() => printReport(title), 50)
            }}
          >
            <Printer className="size-4 text-brand-600" /> PDF (print)
          </button>
          {personal && (
            <label className="mt-1 flex items-center gap-2 border-t border-zinc-100 px-3 pt-2.5 pb-1.5 text-xs text-zinc-600">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="size-3.5 accent-brand-600" />
              Anonymise trainees in Excel / CSV
            </label>
          )}
        </div>
      )}
    </div>
  )
}

const statTrends = createContext<Record<string, StatCardTrend | null>>({})

export function StatTrendProvider({ trends, children }: { trends: Record<string, StatCardTrend | null>; children: ReactNode }) {
  return <statTrends.Provider value={trends}>{children}</statTrends.Provider>
}

export function useReportStatTrend(label: string) {
  return useContext(statTrends)[label] ?? undefined
}

/** Report stat: the shared admin StatCard, with its matching recent-period comparison. */
export function Stat({ label, value, hint, tone = 'zinc', icon }: { label: string; value: ReactNode; hint?: string; tone?: 'zinc' | 'red' | 'green' | 'amber'; icon?: React.ComponentType<{ className?: string }> }) {
  const trend = useReportStatTrend(label)
  return <StatCard label={label} value={value} hint={hint} tone={tone} icon={icon} trend={trend} />
}

/** Horizontal bars: label, bar, value. */
export function Bars({ items, max, format = (v) => String(v), tone = 'red' }: { items: { label: string; value: number; hint?: string }[]; max?: number; format?: (v: number) => string; tone?: 'red' | 'green' | 'amber' }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return <EmptyState compact icon={BarChart3} title="No data for these filters" text="Widen the date range or clear a filter." />
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-zinc-700" title={i.hint ?? i.label}>
            {i.label}
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className={cn('h-full rounded-full', tone === 'green' ? 'bg-mpesa-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, (i.value / top) * 100)}%` }} />
          </div>
          <span className="text-right font-medium text-zinc-900 tabular-nums">{format(i.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Vertical month columns for trends. */
export function Trend({ points, format = (v) => String(v), tone = 'red' }: { points: { label: string; value: number }[]; format?: (v: number) => string; tone?: 'red' | 'green' | 'amber' }) {
  const top = Math.max(1, ...points.map((p) => p.value))
  if (!points.length) return <EmptyState compact icon={BarChart3} title="No data for these filters" text="Widen the date range or clear a filter." />
  return (
    <div className="flex h-40 items-end gap-2">
      {points.map((p) => (
        <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-700 tabular-nums">{format(p.value)}</span>
          <div className={cn('w-full max-w-10 rounded-t-md', tone === 'green' ? 'bg-mpesa-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-600')} style={{ height: `${Math.max(4, (p.value / top) * 100)}px` }} />
          <span className="truncate text-[11px] text-zinc-500">{p.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Responsive grouped month bars with a same-month last-year comparison. */
export function ComparisonBars({
  points,
  currentLabel,
  previousLabel,
}: {
  points: { label: string; current: number; previous: number }[]
  currentLabel: string
  previousLabel: string
}) {
  if (!points.length) return <EmptyState compact icon={BarChart3} title="No enrolment data for these filters" text="Widen the date range or clear a filter." />
  const maximum = Math.max(1, ...points.flatMap((point) => [point.current, point.previous]))
  const ticks = [100, 75, 50, 25, 0]
  const bar = (value: number, color: string, label: string) => {
    const height = value ? Math.max(3, (value / maximum) * 76) : 0
    return (
      <div className="relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${label}: ${value}`}>
        <span className="absolute z-10 mb-1 text-[10px] font-medium leading-none text-zinc-700 tabular-nums" style={{ bottom: `calc(${height}% + 4px)` }}>{value}</span>
        <div className={cn('w-full max-w-7 rounded-t-md transition-[height]', color)} style={{ height: `${height}%` }} />
      </div>
    )
  }

  return (
    <div className="flex min-h-[220px] flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-600" />{currentLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-zinc-300" />{previousLabel}</span>
      </div>
      <div className="min-h-[174px] flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin">
        <div className="relative h-full min-h-[174px]" style={{ minWidth: `${Math.max(520, points.length * 48)}px` }}>
          <div className="absolute inset-x-0 top-1 bottom-7 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((tick) => <div key={tick} className="border-t border-dashed border-zinc-200" />)}
          </div>
          <div className="relative flex h-full items-stretch gap-1 px-1">
            {points.map((point) => (
              <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                <div className="flex h-[148px] w-full items-end justify-center gap-1">
                  {bar(point.current, 'bg-brand-600', `${point.label} · ${currentLabel}`)}
                  {bar(point.previous, 'bg-zinc-300', `${point.label} · ${previousLabel}`)}
                </div>
                <span className="mt-1 h-6 max-w-full truncate text-[11px] text-zinc-500" title={point.label}>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
