import { ArrowRight, Award, CalendarDays, Check, Circle, Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, formatDate, progressPercent, progressStatus, sessionStatus, timeRange } from '../lib/utils'
import type { ProgressStatus, Training, TrainingProgress } from '../types'
import { Banner } from './Banner'

export const progressColor: Record<ProgressStatus, string> = {
  Completed: 'text-mpesa-600',
  'In Progress': 'text-amber-600',
  'Not Started': 'text-zinc-500',
}

const statusBadge: Record<ProgressStatus, { cls: string; icon: typeof Check; iconCls: string }> = {
  Completed: { cls: 'bg-mpesa-600 text-white', icon: Check, iconCls: 'bg-white text-mpesa-600' },
  'In Progress': { cls: 'bg-charcoal text-white', icon: Clock, iconCls: 'bg-white text-charcoal' },
  'Not Started': { cls: 'bg-white/95 text-zinc-700', icon: Circle, iconCls: 'bg-zinc-200 text-zinc-500' },
}

const barColor: Record<ProgressStatus, string> = {
  Completed: 'bg-mpesa-600',
  'In Progress': 'bg-brand-600',
  'Not Started': 'bg-zinc-300',
}

/** Small Microsoft Teams–style mark for the "delivered on Teams" detail. */
function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="17.5" cy="6.5" r="2.5" fill="#7b83eb" />
      <rect x="13.5" y="10" width="8" height="8.5" rx="3" fill="#7b83eb" />
      <circle cx="11" cy="5.5" r="3" fill="#5059c9" />
      <rect x="7" y="9.5" width="10" height="10.5" rx="3.5" fill="#5059c9" />
      <rect x="2.5" y="7" width="10" height="10" rx="2" fill="#4b53bc" />
      <path d="M5 9.6h5v1.4H8.2v4.4H6.8V11H5z" fill="#fff" />
    </svg>
  )
}

/** The single next step for a training, matching its progress. */
function CardAction({ training, status, className }: { training: Training; status: ProgressStatus; className?: string }) {
  const base = 'relative z-10 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition'
  if (status === 'Completed')
    return (
      <Link
        to={`/certificates/${training.id}`}
        className={cn(base, 'border-2 border-mpesa-500/30 bg-mpesa-500/[0.06] text-mpesa-700 hover:border-mpesa-500/50 hover:bg-mpesa-500/10', className)}
      >
        <Award className="size-4" /> View Certificate <ArrowRight className="size-4" />
      </Link>
    )
  return (
    <Link
      to={`/trainings/${training.id}`}
      className={cn(
        base,
        'border-2 border-transparent',
        status === 'In Progress' ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 hover:bg-brand-700' : 'bg-charcoal text-white hover:bg-charcoal-light',
        className,
      )}
    >
      {status === 'In Progress' ? 'Continue' : 'Start Learning'} <ArrowRight className="size-4" />
    </Link>
  )
}

function Meta({ training, stacked = false }: { training: Training; stacked?: boolean }) {
  const teams = training.venue === 'ONLINE' && !!training.teamsJoinUrl
  return (
    <div className={cn('flex gap-x-4 gap-y-3', stacked ? 'flex-col' : 'flex-wrap items-center')}>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <CalendarDays className="size-[18px]" />
        </span>
        <span className="text-xs leading-snug">
          <span className="block text-sm font-semibold text-zinc-900">{formatDate(training.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span className="text-zinc-500">{timeRange(training)}</span>
        </span>
      </div>
      {!stacked && <span className="hidden h-8 w-px bg-zinc-200 min-[420px]:block" aria-hidden />}
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', teams ? 'bg-[#eef0ff]' : 'bg-zinc-100 text-zinc-700')}>
          {teams ? <TeamsIcon className="size-[22px]" /> : <MapPin className="size-[18px]" />}
        </span>
        <span className="min-w-0 truncate text-sm font-medium text-zinc-800">{teams ? 'Microsoft Teams' : training.venue}</span>
      </div>
    </div>
  )
}

export function TrainingCard({ training, progress, layout = 'grid' }: { training: Training; progress?: TrainingProgress; layout?: 'grid' | 'list' }) {
  const status = progressStatus(training, progress)
  const live = sessionStatus(training) === 'Active'
  const percent = progressPercent(training, progress)
  const badge = statusBadge[status]

  const badges = (
    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
      <span className={cn('inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-semibold shadow-md', badge.cls)}>
        <span className={cn('grid size-5 place-items-center rounded-full', badge.iconCls)}>
          <badge.icon className="size-3" strokeWidth={3} />
        </span>
        {status}
      </span>
      {live && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-600 shadow-md">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-600" /> Live today
        </span>
      )}
    </div>
  )

  // Kept shorter than the full row so the bar reads as a meter, not a divider.
  const progressBar = (
    <div className="w-full max-w-[150px] min-w-[96px] flex-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full rounded-full', barColor[status])} style={{ width: `${percent}%` }} />
      </div>
      <p className={cn('mt-1.5 text-xs font-medium whitespace-nowrap', status === 'Completed' ? 'text-mpesa-600' : 'text-zinc-500')}>{percent}% complete</p>
    </div>
  )

  // The title link stretches over the whole card; the action button sits above it (z-10).
  const titleLink = (
    <Link to={`/trainings/${training.id}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
      {training.title}
    </Link>
  )

  if (layout === 'list') {
    return (
      <article className="group relative flex flex-col gap-5 rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition focus-within:ring-2 focus-within:ring-brand-500 hover:shadow-xl md:flex-row md:items-center">
        <div className="relative aspect-[5/2] shrink-0 overflow-hidden rounded-2xl bg-zinc-100 md:w-64">
          <Banner training={training} className="size-full" />
          {badges}
        </div>
        <div className="min-w-0 flex-1 px-2 md:px-0">
          <h3 className="line-clamp-2 text-lg leading-snug font-bold text-zinc-900 group-hover:text-brand-600">{titleLink}</h3>
          <p className="mt-0.5 text-sm text-zinc-500">Trainer: {training.trainer}</p>
          <div className="mt-4">
            <Meta training={training} stacked />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-2 pb-2 md:w-64 md:flex-col md:items-stretch md:px-0 md:pr-3 md:pb-0">
          {progressBar}
          <CardAction training={training} status={status} />
        </div>
      </article>
    )
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative aspect-[5/2] overflow-hidden bg-zinc-100">
        <Banner training={training} className="size-full transition duration-300 group-hover:scale-[1.03]" />
        {badges}
        <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/30 backdrop-blur transition group-hover:bg-white group-hover:text-brand-600">
          <ArrowRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        <h3 className="line-clamp-2 text-base leading-snug font-bold text-zinc-900 group-hover:text-brand-600">{titleLink}</h3>
        <p className="mt-0.5 text-[13px] text-zinc-500">Trainer: {training.trainer}</p>
        <div className="mt-3.5 flex-1">
          <Meta training={training} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {progressBar}
          <CardAction training={training} status={status} />
        </div>
      </div>
    </article>
  )
}
