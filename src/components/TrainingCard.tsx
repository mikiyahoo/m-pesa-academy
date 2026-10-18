import { ArrowRight, Award, CalendarDays, Check, Circle, Clock, Heart, MapPin, MessageSquare, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { UserAvatar } from './UserAvatar'
import { scopedKey } from '../lib/learner'
import { Link } from 'react-router-dom'
import { cn, formatDate, isPassed, modulesDone, progressPercent, progressStatus, sessionStatus, timeRange } from '../lib/utils'
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

/** "Mariamawit Fekadeselase" → "Mariamawit F." for tight spots like the card photo chip. */
const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

const FAV_KEY = 'mpesa-learning:favourites'

const FAV_EVENT = 'mpesa-learning:favourites-change'

/** Favourite training ids, kept in sync when a heart is toggled anywhere on the page. */
export function useFavourites() {
  const [ids, setIds] = useState(readFavourites)
  useEffect(() => {
    const sync = () => setIds(readFavourites())
    window.addEventListener(FAV_EVENT, sync)
    return () => window.removeEventListener(FAV_EVENT, sync)
  }, [])
  return ids
}

export function readFavourites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(FAV_KEY)) ?? '[]')
  } catch {
    return []
  }
}

/** Heart toggle in the image corner; a per-browser convenience, so storage failures are ignored. */
function FavouriteButton({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(() => readFavourites().includes(id))
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = on ? readFavourites().filter((x) => x !== id) : [...readFavourites(), id]
    setOn(!on)
    try {
      localStorage.setItem(scopedKey(FAV_KEY), JSON.stringify(next))
      window.dispatchEvent(new Event(FAV_EVENT))
    } catch {
      // Favourites are a convenience only.
    }
  }
  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
      className={cn('absolute top-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-full bg-white/95 shadow-sm transition hover:scale-105', on ? 'text-brand-600' : 'text-zinc-600 hover:text-brand-600')}
    >
      <Heart className={cn('size-4', on && 'fill-current')} />
    </button>
  )
}

/** The single next step for a training, matching its progress. */
function CardAction({ training, progress, status, className }: { training: Training; progress?: TrainingProgress; status: ProgressStatus; className?: string }) {
  const base = 'relative z-10 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition'
  if (status === 'Completed')
    return (
      <Link
        to={`/certificates/${training.id}`}
        className={cn(base, 'border-2 border-mpesa-500/30 bg-mpesa-500/[0.06] text-mpesa-700 hover:border-mpesa-500/50 hover:bg-mpesa-500/10', className)}
      >
        <Award className="size-3.5" /> Certificate <ArrowRight className="size-3.5" />
      </Link>
    )
  // Only the feedback is missing (D5: it's the final step).
  if (progress && modulesDone(training, progress) && isPassed(progress) && !progress.feedback)
    return (
      <Link
        to={`/trainings/${training.id}/learn/feedback`}
        className={cn(base, 'border-2 border-transparent bg-amber-500 text-white shadow-sm shadow-amber-500/30 hover:bg-amber-600', className)}
      >
        <MessageSquare className="size-3.5" /> Feedback <ArrowRight className="size-3.5" />
      </Link>
    )
  if (status === 'In Progress')
    return (
      <Link to={`/trainings/${training.id}/learn`} className={cn('relative z-10 inline-flex shrink-0 items-center gap-2 text-xs font-semibold whitespace-nowrap text-zinc-800 transition hover:text-brand-600', className)}>
        <span className="grid size-6 place-items-center rounded-full border-[1.5px] border-brand-600 text-brand-600">
          <Play className="ml-px size-2.5 fill-current" />
        </span>
        Continue <ArrowRight className="size-3.5" />
      </Link>
    )
  return (
    <Link to={`/trainings/${training.id}/learn`} className={cn(base, 'border-2 border-transparent bg-charcoal text-white hover:bg-charcoal-light', className)}>
      Start <ArrowRight className="size-3.5" />
    </Link>
  )
}

/** Date and venue side by side on one row; the venue shortens with an ellipsis if space runs out. */
function Meta({ training }: { training: Training }) {
  const teams = training.venue === 'ONLINE' && !!training.teamsJoinUrl
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <CalendarDays className="size-3.5" />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold text-zinc-900">{formatDate(training.date, { month: 'short', day: 'numeric' })}</span>
          <span className="block text-[10px] whitespace-nowrap text-zinc-500">{timeRange(training)}</span>
        </span>
      </div>
      <span className="h-6 w-px shrink-0 bg-zinc-200" aria-hidden />
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-lg', teams ? 'bg-[#eef0ff]' : 'bg-zinc-100 text-zinc-700')}>
          {teams ? <TeamsIcon className="size-4" /> : <MapPin className="size-3.5" />}
        </span>
        <span className="min-w-0 truncate text-[11px] font-medium text-zinc-800" title={teams ? 'Microsoft Teams' : training.venue}>{teams ? 'Teams' : training.venue}</span>
      </div>
    </div>
  )
}

/** `barWidth`: grid-card progress meter width in px (home cards are wider, so they use a longer bar). */
export function TrainingCard({ training, progress, layout = 'grid', barWidth = 88 }: { training: Training; progress?: TrainingProgress; layout?: 'grid' | 'list'; barWidth?: number }) {
  const status = progressStatus(training, progress)
  const live = sessionStatus(training) === 'Active'
  const percent = progressPercent(training, progress)
  const badge = statusBadge[status]

  const badges = (
    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
      <span className={cn('inline-flex items-center gap-1.5 rounded-full p-1.5 pr-3 text-[11px] font-semibold shadow-md', badge.cls)}>
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

  // Bar and percentage on one line; the bar stays short so it reads as a meter, not a divider.
  const progressBar = (
    <div className={cn('flex w-full flex-1 items-center gap-2.5', layout === 'grid' ? 'min-w-[60px]' : 'max-w-[190px] md:self-end')} style={layout === 'grid' ? { maxWidth: barWidth } : undefined} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${training.title}: ${percent}% complete`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/60 ring-inset">
        <div className={cn('h-full rounded-full transition-[width] duration-500', barColor[status])} style={{ width: `${Math.max(percent, percent ? 4 : 0)}%` }} />
      </div>
      <span className={cn('shrink-0 text-xs font-bold tabular-nums', status === 'Completed' ? 'text-mpesa-600' : status === 'In Progress' ? 'text-brand-600' : 'text-zinc-400')}>{percent}%</span>
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
      <article className="group relative flex flex-col gap-5 rounded-3xl border border-zinc-200/80 bg-white p-3 transition focus-within:ring-2 focus-within:ring-brand-500 hover:shadow-xl md:flex-row md:items-stretch">
        {/* The photo fills the card's height so the gap above, below and left of it is the same. */}
        <div className="relative aspect-[5/2] shrink-0 overflow-hidden rounded-2xl bg-zinc-100 md:aspect-auto md:min-h-36 md:w-64">
          <Banner training={training} className="size-full" />
          {badges}
          <FavouriteButton id={training.id} title={training.title} />
        </div>
        <div className="min-w-0 flex-1 px-2 md:self-center md:px-0 md:py-1">
          <h3 className="line-clamp-2 text-base leading-snug font-bold text-zinc-900 group-hover:text-brand-600">{titleLink}</h3>
          <p className="mt-0.5 text-[13px] text-zinc-500">Trainer: {training.trainer}</p>
          <div className="mt-4">
            <Meta training={training} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-2 pb-2 md:w-64 md:flex-col md:items-stretch md:justify-between md:self-stretch md:px-0 md:py-3 md:pr-3 md:pb-3">
          {progressBar}
          <CardAction training={training} progress={progress} status={status} className="md:self-end" />
        </div>
      </article>
    )
  }

  return (
    <article className="group relative flex flex-col rounded-3xl border border-zinc-200/80 bg-white p-3 transition focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-zinc-100">
        <Banner training={training} className="size-full transition duration-300 group-hover:scale-[1.03]" />
        {badges}
        <FavouriteButton id={training.id} title={training.title} />
        {/* Trainer sits on the photo so the title has room to breathe. */}
        <span className="absolute right-2.5 bottom-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full bg-black/25 py-0.5 pr-2.5 pl-0.5 text-[11px] font-medium text-white ring-1 ring-white/25 backdrop-blur-md">
          <UserAvatar name={training.trainer} className="size-5" />
          <span className="truncate" title={training.trainer}>{shortName(training.trainer)}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold text-zinc-900 group-hover:text-brand-600">{titleLink}</h3>
        <div className="mt-3.5 flex-1">
          <Meta training={training} />
        </div>
        {/* Progress meter and the next step side by side. */}
        <div className="mt-4 flex items-center justify-between gap-3">
          {progressBar}
          <CardAction training={training} progress={progress} status={status} />
        </div>
      </div>
    </article>
  )
}
