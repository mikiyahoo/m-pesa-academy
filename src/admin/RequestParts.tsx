import { AlertTriangle, Check, Copy, FileText, Link2, MapPin, Paperclip, Users, Video, X } from 'lucide-react'
import { useFeedback } from '../components/Feedback'
import { Empty } from './ui'
import { cn } from '../lib/utils'
import { dateTime, shortDate, time12 } from './helpers'
import { isInternalEmail } from './requests'
import type { AdminData, RequestStatus, TrainingRequest } from './types'

const statusStyle: Record<RequestStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  PENDING: 'bg-amber-500/10 text-amber-700 ring-amber-500/25',
  APPROVED: 'bg-mpesa-500/10 text-mpesa-700 ring-mpesa-500/25',
  REJECTED: 'bg-brand-50 text-brand-700 ring-brand-200',
}
const statusLabel: Record<RequestStatus, string> = { DRAFT: 'Draft', PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' }

export function RequestStatusPill({ status, className }: { status: RequestStatus; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusStyle[status], className)}>{statusLabel[status]}</span>
}

/** Submitted → Under review → Approved / Rejected → Scheduled, with the date each step happened (RQ-1.4). */
export function RequestTimeline({ request }: { request: TrainingRequest }) {
  const at = (label: string) => request.history.find((h) => h.label === label)
  const rejected = request.status === 'REJECTED'
  const steps = [
    { label: 'Submitted', done: !!request.submittedAt, when: request.submittedAt },
    { label: 'Under review', done: request.status !== 'DRAFT', when: undefined, current: request.status === 'PENDING' },
    rejected
      ? { label: 'Rejected', done: true, when: at('Rejected')?.at, bad: true }
      : { label: 'Approved', done: request.status === 'APPROVED', when: at('Approved')?.at },
    ...(rejected ? [] : [{ label: 'Scheduled', done: !!request.trainingId, when: at('Scheduled')?.at }]),
  ]
  return (
    <ol className="grid gap-3 sm:flex sm:items-start sm:gap-0">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center">
          {i < steps.length - 1 && (
            <span className={cn('absolute top-4 left-[calc(50%+18px)] hidden h-0.5 w-[calc(100%-36px)] sm:block', steps[i + 1].done ? 'bg-mpesa-500' : 'bg-zinc-200')} aria-hidden />
          )}
          <span
            className={cn(
              'relative grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold',
              'bad' in s && s.bad ? 'bg-brand-600 text-white' : s.done ? 'bg-mpesa-600 text-white' : 'current' in s && s.current ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-400',
            )}
          >
            {'bad' in s && s.bad ? <X className="size-4" /> : s.done && !('current' in s && s.current) ? <Check className="size-4" strokeWidth={3} /> : i + 1}
          </span>
          <span className="sm:mt-2">
            <span className={cn('block text-sm font-semibold', s.done || ('current' in s && s.current) ? 'text-zinc-900' : 'text-zinc-400')}>{s.label}</span>
            <span className="block text-xs text-zinc-500">{s.when ? shortDate(s.when.slice(0, 10)) : 'current' in s && s.current ? 'In progress' : '—'}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function JoinLink({ link }: { link: string }) {
  const { toast } = useFeedback()
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-mpesa-500/30 bg-mpesa-500/[0.06] p-3">
      <Link2 className="size-4 shrink-0 text-mpesa-700" />
      <code className="min-w-0 flex-1 truncate text-xs text-zinc-800 select-all">{link}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link)
            toast('Join link copied')
          } catch {
            toast('Copy failed — select the link and copy it manually', { tone: 'error' })
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-xs font-semibold text-mpesa-700 shadow-sm ring-1 ring-mpesa-500/30 hover:bg-mpesa-500/10"
      >
        <Copy className="size-3.5" /> Copy link
      </button>
    </div>
  )
}

export function DuplicateWarning({ duplicates, data }: { duplicates: TrainingRequest[]; data: AdminData }) {
  if (!duplicates.length) return null
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">Possible duplicate</p>
        <p className="mt-0.5 text-amber-800">
          {duplicates.length === 1 ? 'Another request' : `${duplicates.length} other requests`} from {duplicates[0].team} for the same training type on{' '}
          {shortDate(duplicates[0].preferredDate)}:{' '}
          {duplicates.map((d) => `“${d.topic}” (${statusLabel[d.status].toLowerCase()}, ${data.people.find((p) => p.id === d.requesterId)?.name ?? 'unknown'})`).join(', ')}.
        </p>
      </div>
    </div>
  )
}

const fmtSize = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** Every field of a request, laid out for review (admin modal and requester detail page). */
export function RequestDetails({ request, data }: { request: TrainingRequest; data: AdminData }) {
  const type = data.trainingTypes.find((t) => t.id === request.trainingTypeId)
  const groups = request.targetGroupIds.map((g) => data.groups.find((x) => x.id === g)?.name).filter(Boolean)
  const temporary = request.participants.filter((p) => !isInternalEmail(p.email)).length
  const rows: [string, React.ReactNode][] = [
    ['Training type', type?.name ?? '—'],
    ['Categories', [...request.categories, ...(request.otherCategory ? [`Other: ${request.otherCategory}`] : [])].join(', ') || '—'],
    ...(request.subcategories?.length ? ([['Sub-categories', request.subcategories.join(', ')]] as [string, React.ReactNode][]) : []),
    ['Target audience', [groups.join(', '), request.audienceNote].filter(Boolean).join(' · ') || '—'],
    [
      'Delivery',
      <span key="d" className="inline-flex items-center gap-1.5">
        {request.delivery === 'Online' ? <Video className="size-4 text-zinc-500" /> : <MapPin className="size-4 text-zinc-500" />}
        {request.delivery}
        {request.delivery === 'Physical' && request.location ? ` — ${request.location}` : ''}
      </span>,
    ],
    ['Preferred date', request.preferredDate ? `${shortDate(request.preferredDate)}${request.preferredTime ? ` at ${time12(request.preferredTime)}` : ''}` : '—'],
    ['Submitted', request.submittedAt ? dateTime(request.submittedAt) : 'Not yet'],
  ]
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className="text-xs text-zinc-500">Training objectives</h4>
        <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-800">{request.objectives || '—'}</p>
      </div>
      {request.description && (
        <div>
          <h4 className="text-xs text-zinc-500">Description</h4>
          <p className="mt-0.5 text-sm whitespace-pre-line text-zinc-800">{request.description}</p>
        </div>
      )}
      <div>
        <h4 className="flex items-center gap-2 text-xs text-zinc-500">
          <Users className="size-3.5" /> Participants ({request.participants.length}
          {temporary ? `, ${temporary} temporary` : ''})
        </h4>
        <ul className="mt-2 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 scrollbar-thin">
          {request.participants.map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-zinc-900">{p.name || '—'}</span>
                <span className="block truncate text-xs text-zinc-500">{p.email}</span>
              </span>
              {!isInternalEmail(p.email) && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Temporary</span>}
            </li>
          ))}
          {!request.participants.length && (
            <li>
              <Empty compact icon={Users} title="No participants added" />
            </li>
          )}
        </ul>
      </div>
      {request.attachments.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-xs text-zinc-500">
            <Paperclip className="size-3.5" /> Attachments
          </h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {request.attachments.map((a) => (
              <li key={a.name} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700">
                <FileText className="size-3.5 text-zinc-500" /> {a.name} <span className="text-zinc-400">{fmtSize(a.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
