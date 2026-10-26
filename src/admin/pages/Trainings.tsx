import { AlertTriangle, BadgeCheck, CalendarDays, Eye, GraduationCap, MapPin, Plus, QrCode, Repeat, Users } from 'lucide-react'
import { RowMenu, type RowMenuItem } from '../../components/RowMenu'
import { ViewToggle } from '../../pages/Learning'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { shortDate, time12 } from '../helpers'
import { NewTrainingModal } from '../TrainingForm'
import { AdminCalendar, AdminTrainingStats } from './Calendar'
import { conflictIndex, trainerIdsOf } from '../scheduling'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import type { AdminTraining, TrainingStatus } from '../types'
import { Avatar, Badge, Button, Empty, PageHeader, SearchInput, Table, TabBar, Tabs, trainingStatusTone } from '../ui'

type Filter = 'ALL' | TrainingStatus
type TrainingsAdminView = 'list' | 'calendar'

export { NewTrainingModal, type TrainingPreset } from '../TrainingForm'

export function AdminTrainings() {
  const { data } = useAdmin()
  const scope = useScope()
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<TrainingsAdminView>(() => searchParams.get('view') === 'calendar' ? 'calendar' : 'list')
  useEffect(() => {
    setView(searchParams.get('view') === 'calendar' ? 'calendar' : 'list')
  }, [searchParams])
  const changeView = (next: TrainingsAdminView) => {
    setView(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'calendar') params.set('view', 'calendar')
    else params.delete('view')
    setSearchParams(params, { replace: true })
  }
  const conflicts = useMemo(() => conflictIndex(data.trainings, data.people), [data.trainings, data.people])

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data.trainings.length }
    data.trainings.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1))
    return c
  }, [data.trainings])

  const rows = data.trainings
    .filter((t) => filter === 'ALL' || t.status === filter)
    .filter((t) => !q || `${t.name} ${t.location}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <PageHeader
        title={scope.trainerId ? 'My sessions' : 'Trainings'}
        description={scope.trainerId ? 'Sessions you conduct. The training team schedules new ones.' : 'Schedule, manage and track every training session.'}
        actions={
          !scope.trainerId && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New training
            </Button>
          )
        }
      />
      <div className="mb-5">
        <AdminTrainingStats />
      </div>
      <TabBar>
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          items={(['ALL', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'] as Filter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase(), count: counts[v] ?? 0 }))}
        />
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <SearchInput value={q} onChange={setQ} placeholder="Search trainings…" className="flex-1 sm:w-64" />
          <ViewToggle view={view} onChange={changeView} calendar grid={false} remember={false} />
        </div>
      </TabBar>
      {view === 'calendar' ? <AdminCalendar embedded trainings={rows} /> : rows.length ? (
        <>
          {/* Keep the list compact on desktop and readable on phones. */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {rows.map((t) => (
              <TrainingTile key={t.id} t={t} conflict={conflicts.has(t.id)} />
            ))}
          </div>
          {/* Data table for the list view on desktop. */}
          <div className="hidden md:block">
            <Table head={['Training', 'Journey', 'Date', 'Location', 'Participants', 'Status', '']}>
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/trainings/${t.id}`} className="font-medium text-zinc-900 hover:text-brand-600">
                      {t.name}
                    </Link>
                    {(t.seriesId || conflicts.has(t.id)) && (
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {t.seriesId && (
                          <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                            <Repeat className="size-3" /> Series
                          </span>
                        )}
                        {conflicts.has(t.id) && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700" title="Trainer or trainees are booked elsewhere at the same time">
                            <AlertTriangle className="size-3" /> Conflict
                          </span>
                        )}
                      </span>
                    )}
                    <p className="text-xs text-zinc-500">{trainerIdsOf(t).map((id) => data.people.find((person) => person.id === id)?.name).filter(Boolean).join(', ')}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{data.journeys.find((j) => j.id === t.journeyId)?.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" /> {shortDate(t.date)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {time12(t.startTime)} – {time12(t.endTime)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" /> {t.location}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" /> {t.participantIds.length}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={trainingStatusTone[t.status]}>{statusLabel(t.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowMenu label={`Actions for ${t.name}`} items={trainingMenu(t.id, !!scope.trainerId)} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          <Empty icon={GraduationCap} title="No trainings found" text="Try another filter or create a new training." />
        </div>
      )}
      {creating && <NewTrainingModal open onClose={() => setCreating(false)} />}
    </>
  )
}

const statusLabel = (s: TrainingStatus) => s[0] + s.slice(1).toLowerCase()

const trainingMenu = (id: string, trainer: boolean): RowMenuItem[] => [
  { label: 'Open training', icon: Eye, to: `/admin/trainings/${id}`, primary: true },
  { label: 'Attendance & check-in', icon: QrCode, to: `/admin/trainings/${id}#attendance` },
  { label: 'Certificates', icon: BadgeCheck, to: '/admin/certificates' },
      ...(trainer ? [] : [{ label: 'Calendar', icon: CalendarDays, to: '/admin/trainings?view=calendar' }]),
]

/** Training as a learner-style card: banner with status and trainer, title, journey, when/where, participants. */
function TrainingTile({ t, conflict }: { t: AdminTraining; conflict: boolean }) {
  const { data } = useAdmin()
  const trainers = trainerIdsOf(t).map((id) => data.people.find((person) => person.id === id)).filter((person): person is NonNullable<typeof person> => !!person)
  const journey = data.journeys.find((j) => j.id === t.journeyId)
  const cover = t.coverId ? data.trainingCovers?.[t.coverId] : undefined
  const trainer = trainers[0]
  const [first, ...rest] = (trainer?.name ?? '').split(' ')
  return (
    <article className="group relative flex flex-col rounded-3xl border border-zinc-200/80 bg-surface p-3 transition hover:-translate-y-0.5 hover:shadow-xl focus-within:ring-2 focus-within:ring-brand-500">
      <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-[#b3302f] to-[#6e1a15]">
        {cover ? (
          <>
            <img src={cover} alt="" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" aria-hidden="true" />
          </>
        ) : (
          <>
            <img src="/M-PESA Pattern.svg" alt="" className="absolute -right-6 -bottom-8 h-[150%] opacity-25 transition duration-300 group-hover:scale-105" aria-hidden />
            <GraduationCap className="absolute top-1/2 left-5 size-10 -translate-y-1/2 text-white/25" aria-hidden />
          </>
        )}
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <Badge tone={trainingStatusTone[t.status]} className="bg-white/95 backdrop-blur">
            {statusLabel(t.status)}
          </Badge>
          {t.seriesId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/25 backdrop-blur-md">
              <Repeat className="size-3" /> Series
            </span>
          )}
        </span>
        {conflict && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950" title="Trainer or trainees are booked elsewhere at the same time">
            <AlertTriangle className="size-3" /> Conflict
          </span>
        )}
        {trainer && (
          <span className="absolute right-2.5 bottom-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full bg-black/25 py-0.5 pr-2.5 pl-0.5 text-[11px] font-medium text-white ring-1 ring-white/25 backdrop-blur-md">
            <Avatar name={trainer.name} size="sm" />
            <span className="truncate">{rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first}{trainers.length > 1 && ` +${trainers.length - 1}`}</span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold text-zinc-900 group-hover:text-brand-600">
          <Link to={`/admin/trainings/${t.id}`} className="after:absolute after:inset-0 focus:outline-none">
            {t.name}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{journey?.name ?? 'No journey'}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600">
          <span className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0 text-brand-600" />
            <span className="truncate">
              {shortDate(t.date)} · {time12(t.startTime)}
            </span>
          </span>
          <span className="h-4 w-px shrink-0 bg-zinc-200" />
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-zinc-400" />
            <span className="truncate">{t.location}</span>
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <Users className="size-3.5" /> {t.participantIds.length} enrolled
          </span>
          <span className="relative z-10">
            <RowMenu label={`Actions for ${t.name}`} items={trainingMenu(t.id, false)} />
          </span>
        </div>
      </div>
    </article>
  )
}
