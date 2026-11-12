import { ArrowRight, CalendarDays, Check, ClipboardCheck, Clock, FileText, Lock, MapPin, MessageSquare, PlayCircle, User, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, formatDate, lockedReasonOf, moduleOpen, progressPercent, progressStatus, timeRange } from '../lib/utils'
import { learnPath } from '../pages/learn/outline'
import type { Training, TrainingProgress } from '../types'

/**
 * Details and materials of one training beside the list, without leaving it (US09):
 * schedule, progress, every module with its state, and the steps after the modules.
 */
export function TrainingPreview({ training: t, progress: p, onClose }: { training: Training; progress?: TrainingProgress; onClose: () => void }) {
  const status = progressStatus(t, p)
  const percent = progressPercent(t, p)
  const done = (id: string) => !!p?.completedModules.includes(id)
  const minutes = t.modules.reduce((s, m) => s + (m.minutes ?? 0), 0)
  return (
    <aside aria-label={`Preview of ${t.title}`} className="self-start overflow-hidden rounded-2xl border border-zinc-200/80 bg-white xl:sticky xl:top-0">
      <div className="relative">
        {t.cover ? <img src={t.cover} alt="" className="h-36 w-full object-cover" /> : <div className="h-20 bg-gradient-to-br from-brand-500 to-brand-700" />}
        <button type="button" onClick={onClose} aria-label="Close preview" className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-white/95 text-zinc-700 shadow-sm hover:text-brand-600">
          <X className="size-4" />
        </button>
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-zinc-800 shadow-sm">{status}</span>
      </div>
      <div className="p-5">
        <p className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">{t.category}</p>
        <h2 className="mt-1 text-base leading-snug font-bold text-zinc-900">{t.title}</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
          <li className="flex items-center gap-2">
            <User className="size-3.5 text-zinc-400" /> {t.trainer}
          </li>
          <li className="flex items-center gap-2">
            <CalendarDays className="size-3.5 text-zinc-400" /> {formatDate(t.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {timeRange(t)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-3.5 text-zinc-400" /> {t.venue === 'ONLINE' ? (t.teamsJoinUrl ? 'Microsoft Teams' : 'Online') : t.venue}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-3.5 text-zinc-400" /> {t.modules.length} module{t.modules.length === 1 ? '' : 's'} · {minutes} min of content
          </li>
        </ul>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-800">Progress</span>
            <span className="font-bold text-zinc-900 tabular-nums">{percent}%</span>
          </div>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <span className={cn('block h-full rounded-full', status === 'Completed' ? 'bg-mpesa-600' : 'bg-brand-600')} style={{ width: `${percent}%` }} />
          </span>
        </div>

        <p className="mt-5 text-sm font-bold text-zinc-900">Materials</p>
        <ol className="mt-2 space-y-1.5">
          {t.modules.map((m, i) => {
            const isDone = done(m.id)
            const open = isDone || moduleOpen(t, p, i)
            const Icon = m.kind === 'video' ? PlayCircle : FileText
            return (
              <li key={m.id}>
                <Link
                  to={open ? learnPath(t.id, m.id) : `/trainings/${t.id}`}
                  title={open ? undefined : lockedReasonOf(t, p, i)}
                  className={cn('flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs transition', open ? 'hover:bg-zinc-50' : 'opacity-60')}
                >
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', isDone ? 'bg-mpesa-500/10 text-mpesa-600' : open ? 'bg-brand-50 text-brand-600' : 'bg-zinc-100 text-zinc-500')}>
                    {isDone ? <Check className="size-3.5" strokeWidth={3} /> : open ? <Icon className="size-3.5" /> : <Lock className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-zinc-900">{m.title}</span>
                    <span className="block truncate text-zinc-500">
                      {m.skippable ? 'Optional · ' : ''}
                      {m.kind === 'video' ? 'Video' : 'Reading'} · {m.minutes} min
                      {!open ? ` · ${lockedReasonOf(t, p, i)}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
          {!t.modules.length && <li className="px-2.5 py-2 text-xs text-zinc-500">No materials yet.</li>}
          <li className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-zinc-600">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
              <ClipboardCheck className="size-3.5" />
            </span>
            Final assessment{p?.quizScore != null ? ` · best ${p.quizScore}%` : ''}
          </li>
          <li className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-zinc-600">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
              <MessageSquare className="size-3.5" />
            </span>
            Feedback{p?.feedback ? ' · sent' : ''}
          </li>
        </ol>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to={`/trainings/${t.id}`} className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
            Details
          </Link>
          <Link to={learnPath(t.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700">
            {status === 'Completed' ? 'Review' : status === 'In Progress' ? 'Continue' : 'Start'} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </aside>
  )
}
