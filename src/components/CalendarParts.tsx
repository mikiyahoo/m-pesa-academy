import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn, parseDate } from '../lib/utils'

/*
 * Calendar building blocks shared by the learner calendar, the admin / trainer calendar
 * and the dashboards' "coming up" lists, so dates, statuses and tiles look the same everywhere.
 */

export type Tone = 'red' | 'amber' | 'green' | 'blue' | 'zinc'

export const TONE: Record<Tone, { dot: string; chip: string; tile: string; text: string; pill: string }> = {
  red: { dot: 'bg-brand-600', chip: 'bg-brand-50 text-brand-800 ring-brand-200/70 dark:text-brand-500', tile: 'bg-brand-50/80', text: 'text-brand-600', pill: 'bg-brand-50 text-brand-700' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-900 ring-amber-500/25 dark:text-amber-400', tile: 'bg-amber-500/10', text: 'text-amber-600', pill: 'bg-amber-500/10 text-amber-700' },
  green: { dot: 'bg-mpesa-600', chip: 'bg-mpesa-500/10 text-mpesa-900 ring-mpesa-500/25 dark:text-mpesa-500', tile: 'bg-mpesa-500/10', text: 'text-mpesa-600', pill: 'bg-mpesa-500/10 text-mpesa-700' },
  blue: { dot: 'bg-sky-500', chip: 'bg-sky-500/10 text-sky-900 ring-sky-500/25 dark:text-sky-400', tile: 'bg-sky-500/10', text: 'text-sky-600', pill: 'bg-sky-500/10 text-sky-700' },
  zinc: { dot: 'bg-zinc-400', chip: 'bg-zinc-100 text-zinc-700 ring-zinc-200', tile: 'bg-zinc-100', text: 'text-zinc-700', pill: 'bg-zinc-100 text-zinc-600' },
}

/** Month + day tile used in "coming up" lists and agenda headers. */
export function DateTile({ date, tone = 'red', className }: { date: string; tone?: Tone; className?: string }) {
  const d = parseDate(date)
  return (
    <span className={cn('grid w-12 shrink-0 place-items-center rounded-xl py-1.5', TONE[tone].tile, TONE[tone].text, className)}>
      <span className="text-[10px] font-bold tracking-wide uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
      <span className="text-xl leading-none font-bold">{d.getDate()}</span>
    </span>
  )
}

export type StatItem = { icon: LucideIcon; label: string; value: ReactNode; tone: Tone; onClick?: () => void; active?: boolean }

/**
 * One white card split into stat cells by thin lines, like the home page stats:
 * tinted icon on the left, label and number on the right.
 */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  const cols = items.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'
  return (
    <div className={cn('grid gap-3', cols, className)}>
      {items.map(({ icon: Icon, label, value, tone, onClick, active }) => {
        const body = (
          <>
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-full sm:size-12', TONE[tone].tile, TONE[tone].text)}>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-zinc-600 sm:text-[13px]">{label}</span>
              <span className="mt-0.5 block text-xl leading-tight font-bold tracking-tight text-zinc-900 sm:text-[1.65rem]">{value}</span>
            </span>
          </>
        )
        // White card with a thin outline: icon on the left, label and value beside it.
        const cls = cn(
          'flex min-w-0 items-center gap-3.5 rounded-2xl border border-zinc-200/80 bg-surface p-4 text-left shadow-card transition sm:p-5',
          onClick && 'hover:border-zinc-300',
          active && 'border-brand-300 ring-2 ring-brand-100',
        )
        return onClick ? (
          <button key={label} type="button" onClick={onClick} aria-pressed={active} className={cls}>
            {body}
          </button>
        ) : (
          <div key={label} className={cls}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

/** Two-line event chip for month cells: status dot + title, then the time. */
export function EventChip({ tone, title, time, to, strike, icon, onClick }: { tone: Tone; title: string; time: string; to: string; strike?: boolean; icon?: ReactNode; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <Link to={to} onClick={onClick} title={`${title} · ${time}`} className={cn('block rounded-lg px-1.5 py-1 ring-1 transition ring-inset hover:brightness-[0.97] sm:px-2.5 sm:py-1.5', TONE[tone].chip)}>
      <span className="flex items-center gap-2">
        <span className={cn('size-2 shrink-0 rounded-full', TONE[tone].dot)} />
        {icon}
        <span className={cn('hidden truncate text-xs font-medium text-zinc-900 sm:block', strike && 'line-through opacity-70')}>{title}</span>
      </span>
      <span className="mt-0.5 hidden truncate pl-4 text-[11px] text-zinc-500 sm:block">{time}</span>
    </Link>
  )
}

export function Legend({ items }: { items: { label: string; tone: Tone }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn('size-2 rounded-full', TONE[i.tone].dot)} /> {i.label}
        </span>
      ))}
    </div>
  )
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold', TONE[tone].pill)}>{children}</span>
}
