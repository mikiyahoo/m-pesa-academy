import { ArrowRight, Bell, CheckCircle2, Clock, FilePen, FilePlus2, Inbox, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { RequestStatusPill } from '../admin/RequestParts'
import { dateTime, shortDate } from '../admin/helpers'
import { draftTimeLeft } from '../admin/requests'
import type { RequestStatus } from '../admin/types'
import { cn } from '../lib/utils'
import { useRequester } from './useRequester'
import { EmptyState } from '../components/EmptyState'

type Tab = 'ALL' | Exclude<RequestStatus, 'DRAFT'>

export function RequesterDashboard() {
  const { data, update, me, team, mine } = useRequester()
  const { confirm } = useFeedback()
  const [tab, setTab] = useState<Tab>('ALL')

  const drafts = mine.filter((r) => r.status === 'DRAFT').sort((a, b) => (a.draftExpiresAt ?? '').localeCompare(b.draftExpiresAt ?? ''))
  const submitted = mine.filter((r) => r.status !== 'DRAFT').sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
  const rows = submitted.filter((r) => tab === 'ALL' || r.status === tab)
  const n = (s: RequestStatus) => mine.filter((r) => r.status === s).length

  // Dashboard notifications (RQ-1.4): every decision on my requests, newest first.
  const updates = submitted
    .flatMap((r) => r.history.filter((h) => h.label !== 'Submitted').map((h) => ({ ...h, request: r })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)

  const stats = [
    { label: 'Pending', value: n('PENDING'), icon: Clock, tint: 'bg-amber-500/10 text-amber-600', tab: 'PENDING' as Tab },
    { label: 'Approved', value: n('APPROVED'), icon: CheckCircle2, tint: 'bg-mpesa-500/10 text-mpesa-600', tab: 'APPROVED' as Tab },
    { label: 'Rejected', value: n('REJECTED'), icon: XCircle, tint: 'bg-brand-50 text-brand-600', tab: 'REJECTED' as Tab },
    { label: 'Drafts', value: drafts.length, icon: FilePen, tint: 'bg-zinc-100 text-zinc-700', tab: null },
  ]

  if (!me) {
    return <p className="rounded-2xl bg-white p-8 text-center text-sm text-zinc-500">Your account isn’t linked to a person record yet. Ask a training admin to add you.</p>
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-gradient-to-br from-white via-[#fff6f6] to-brand-50 p-6 sm:p-7">
        <div>
          <p className="text-sm font-semibold text-zinc-800">Hello, {me.name.split(' ')[0]} 👋</p>
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">Training requests</h1>
          <p className="mt-1 text-sm text-zinc-500">
            You request training on behalf of <span className="font-semibold text-zinc-800">{team}</span>.
          </p>
        </div>
        <Link to="/requests/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700">
          <FilePlus2 className="size-4" /> New request
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={!s.tab}
            onClick={() => s.tab && setTab(tab === s.tab ? 'ALL' : s.tab)}
            aria-pressed={!!s.tab && tab === s.tab}
            className={cn(
              'flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-card transition enabled:hover:border-zinc-300',
              s.tab && tab === s.tab ? 'border-zinc-900' : 'border-zinc-200/80',
            )}
          >
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-full', s.tint)}>
              <s.icon className="size-5" />
            </span>
            <span>
              <span className="block text-xs font-medium text-zinc-600 sm:text-[13px]">{s.label}</span>
              <span className="mt-0.5 block text-xl leading-tight font-bold tracking-tight text-zinc-900 tabular-nums sm:text-[1.65rem]">{s.value}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {drafts.length > 0 && (
            <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5">
              <h2 className="flex items-center gap-2 font-bold text-zinc-900">
                <FilePen className="size-5 text-zinc-700" /> Drafts
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">Drafts are deleted 24 hours after you start them.</p>
              <ul className="mt-3 divide-y divide-zinc-100">
                {drafts.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{d.topic || 'Untitled request'}</span>
                      <span className="text-xs text-amber-700">{draftTimeLeft(d)}</span>
                    </span>
                    <Link to={`/requests/${d.id}/edit`} className="rounded-lg bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-charcoal-light">
                      Continue editing
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this draft?', message: `“${d.topic || 'Untitled request'}” will be removed.`, confirmLabel: 'Delete', danger: true }))
                          update((x) => ({ ...x, requests: x.requests.filter((r) => r.id !== d.id) }), { action: 'Deleted draft request', target: d.topic || 'Untitled request' })
                      }}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600"
                      aria-label={`Delete draft ${d.topic}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-zinc-200/80 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4">
              <h2 className="font-bold text-zinc-900">My requests</h2>
              <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    aria-pressed={tab === t}
                    className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === t ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}
                  >
                    {t === 'ALL' ? 'All' : t[0] + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            {rows.length ? (
              <ul className="divide-y divide-zinc-100">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link to={`/requests/${r.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:bg-zinc-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-zinc-900 group-hover:text-brand-600">{r.topic}</span>
                        <span className="block text-xs text-zinc-500">
                          {data.trainingTypes.find((t) => t.id === r.trainingTypeId)?.name} · prefers {shortDate(r.preferredDate)} · {r.participants.length} participants
                        </span>
                        {r.status === 'REJECTED' && r.rejection && <span className="mt-1 block text-xs text-brand-700">Reason: {r.rejection.reason}</span>}
                      </span>
                      <RequestStatusPill status={r.status} />
                      <ArrowRight className="size-4 text-zinc-300 group-hover:text-brand-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Inbox}
                title={submitted.length ? 'No requests with this status' : 'No requests yet'}
                text="Submitted requests and their status appear here."
                action={
                  !submitted.length && (
                    <Link to="/requests/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700">
                      Create your first request
                    </Link>
                  )
                }
              />
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-zinc-200/80 bg-white p-5">
          <h2 className="flex items-center gap-2 font-bold text-zinc-900">
            <Bell className="size-5 text-brand-600" /> Updates
          </h2>
          {updates.length ? (
            <ol className="mt-4 space-y-4 border-l border-zinc-200 pl-4">
              {updates.map((u, i) => (
                <li key={i} className="relative">
                  <span
                    className={cn(
                      'absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-white',
                      u.label === 'Rejected' ? 'bg-brand-600' : u.label === 'Approved' ? 'bg-mpesa-500' : 'bg-charcoal',
                    )}
                  />
                  <Link to={`/requests/${u.request.id}`} className="block hover:opacity-80">
                    <span className="block text-sm text-zinc-800">
                      <span className="font-semibold">{u.label}</span> · {u.request.topic}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {u.detail ? `${u.detail} · ` : ''}
                      {dateTime(u.at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Decisions on your requests will appear here.</p>
          )}
          <p className="mt-5 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">You also get these updates by email once the portal is connected to email.</p>
        </aside>
      </div>
    </div>
  )
}
