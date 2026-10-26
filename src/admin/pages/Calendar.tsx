import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Plus, Repeat, Users, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn, todayISO } from '../../lib/utils'
import { longDate, time12 } from '../helpers'
import { conflictIndex, trainerIdsOf, WEEKDAYS } from '../scheduling'
import { useAdmin } from '../store'
import { NewTrainingModal } from '../TrainingForm'
import type { AdminTraining } from '../types'
import { Button, Empty, PageHeader, Select } from '../ui'
import { useScope } from '../scope'
import { DateTile, EventChip, StatStrip, TONE, type Tone } from '../../components/CalendarParts'
import { Ban, CalendarCheck2, CheckCircle2, Hourglass } from 'lucide-react'

/** Calendar states from URS 2.3: Confirmed, Pending, Cancelled (plus Completed for past sessions). */
type Kind = 'confirmed' | 'pending' | 'completed' | 'cancelled'
type Entry = {
  key: string
  kind: Kind
  date: string
  start: string
  end: string
  title: string
  to: string
  training?: AdminTraining
  conflict: boolean
  meta: string
}

// Same tones as the learner calendar (components/CalendarParts).
const KIND_TONE: Record<Kind, Tone> = { confirmed: 'green', pending: 'amber', completed: 'zinc', cancelled: 'red' }
const KIND: Record<Kind, { label: string; dot: string; icon: typeof CheckCircle2 }> = {
  confirmed: { label: 'Confirmed', dot: TONE.green.dot, icon: CalendarCheck2 },
  pending: { label: 'Pending', dot: TONE.amber.dot, icon: Hourglass },
  completed: { label: 'Completed', dot: TONE.zinc.dot, icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', dot: TONE.red.dot, icon: Ban },
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function AdminTrainingStats() {
  const { data } = useAdmin()
  const monthKey = todayISO().slice(0, 7)
  const monthTrainings = data.trainings.filter((training) => training.date.startsWith(monthKey))
  const counts: Record<Kind, number> = {
    confirmed: monthTrainings.filter((training) => training.status !== 'CANCELLED' && training.status !== 'COMPLETED').length,
    pending: data.requests.filter((request) => request.status === 'APPROVED' && !request.trainingId && !!request.preferredDate?.startsWith(monthKey)).length,
    completed: monthTrainings.filter((training) => training.status === 'COMPLETED').length,
    cancelled: monthTrainings.filter((training) => training.status === 'CANCELLED').length,
  }

  return <StatStrip items={(Object.keys(KIND) as Kind[]).map((kind) => ({
    icon: KIND[kind].icon,
    label: `${KIND[kind].label} this month`,
    value: counts[kind],
    tone: KIND_TONE[kind],
  }))} />
}

export function AdminCalendar({ embedded = false, trainings }: { embedded?: boolean; trainings?: AdminTraining[] } = {}) {
  const { data } = useAdmin()
  const scope = useScope()
  const calendarTrainings = trainings ?? data.trainings
  const today = todayISO()
  const [cursor, setCursor] = useState(() => new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1))
  const [view, setView] = useState<'month' | 'agenda'>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'agenda' : 'month'))
  const [trainer, setTrainer] = useState('')
  const [team, setTeam] = useState('')
  const [type, setType] = useState('')
  const [kinds, setKinds] = useState<Kind[]>(['confirmed', 'pending', 'completed', 'cancelled'])
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)

  const conflicts = useMemo(() => conflictIndex(data.trainings, data.people), [data.trainings, data.people])
  const teams = useMemo(() => [...new Set([...data.groups.map((g) => g.name), ...data.requests.map((r) => r.team)])].sort(), [data.groups, data.requests])

  const entries = useMemo<Entry[]>(() => {
    const inTeam = (t: AdminTraining) => {
      if (!team) return true
      const group = data.groups.find((g) => g.name === team)
      const fromRequest = data.requests.some((r) => r.trainingId === t.id && r.team === team)
      return fromRequest || (!!group && t.participantIds.some((pid) => data.people.find((p) => p.id === pid)?.groupIds.includes(group.id)))
    }
    const sessions: Entry[] = calendarTrainings
      .filter((t) => (!trainer || trainerIdsOf(t).includes(trainer)) && (!type || t.typeId === type) && inTeam(t))
      .map((t) => ({
        key: t.id,
        kind: t.status === 'CANCELLED' ? 'cancelled' : t.status === 'COMPLETED' ? 'completed' : 'confirmed',
        date: t.date,
        start: t.startTime,
        end: t.endTime,
        title: t.name,
        to: `/admin/trainings/${t.id}`,
        training: t,
        conflict: conflicts.has(t.id),
        meta: `${trainerIdsOf(t).map((id) => data.people.find((person) => person.id === id)?.name).filter(Boolean).join(', ') || 'No trainer'} · ${t.location === 'ONLINE' ? 'Online' : t.location}`,
      }))
    // Approved requests that don't have a session yet appear as Pending on the preferred date.
    const pending: Entry[] = (embedded ? [] : data.requests)
      .filter((r) => r.status === 'APPROVED' && !r.trainingId && r.preferredDate && (!trainer || trainerIdsOf(r).includes(trainer)) && (!type || r.trainingTypeId === type) && (!team || r.team === team))
      .map((r) => ({
        key: r.id,
        kind: 'pending',
        date: r.preferredDate,
        start: r.preferredTime || '09:00',
        end: r.preferredTime || '09:00',
        title: r.topic,
        to: '/admin/requests',
        conflict: false,
        meta: `Approved request · ${r.team} · needs scheduling`,
      }))
    return [...sessions, ...pending].filter((e) => kinds.includes(e.kind)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  }, [data, calendarTrainings, embedded, trainer, type, team, kinds, conflicts])

  const byDate = useMemo(() => {
    const m = new Map<string, Entry[]>()
    entries.forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e]))
    return m
  }, [entries])

  const days = useMemo(() => {
    const start = new Date(cursor)
    start.setDate(1 - start.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const monthKey = iso(cursor).slice(0, 7)
  const monthEntries = entries.filter((e) => e.date.startsWith(monthKey))
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1))
  const selectedEntries = selected ? (byDate.get(selected) ?? []) : []

  const entryRow = (e: Entry) => (
    <Link key={e.key} to={e.to} className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-zinc-50">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', KIND[e.kind].dot)} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium text-zinc-900', e.kind === 'cancelled' && 'line-through opacity-70')}>{e.title}</span>
        <span className="block text-xs text-zinc-500">
          {e.kind === 'pending' ? 'Preferred ' : ''}
          {time12(e.start)}
          {e.end !== e.start ? `–${time12(e.end)}` : ''} · {e.meta}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">{KIND[e.kind].label}</span>
          {e.training?.seriesId && (
            <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              <Repeat className="size-3" /> Series
            </span>
          )}
          {e.conflict && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <AlertTriangle className="size-3" /> Conflict
            </span>
          )}
        </span>
      </span>
      {e.training && (e.training.location === 'ONLINE' ? <Video className="mt-1 size-4 shrink-0 text-zinc-400" /> : <MapPin className="mt-1 size-4 shrink-0 text-zinc-400" />)}
    </Link>
  )

  return (
    <>
      {!embedded && <PageHeader
        title="Calendar"
        description={scope.trainerId ? 'Sessions you conduct.' : 'Every scheduled session, plus approved requests still waiting for a date.'}
        actions={
          !scope.trainerId && (
            <Button variant="primary" onClick={() => setCreating(selected && selected >= today ? selected : today)}>
              <Plus className="size-4" /> Schedule training
            </Button>
          )
        }
      />}

      {!embedded && <StatStrip
        className="mb-5"
        items={(Object.keys(KIND) as Kind[]).map((k) => ({
          icon: KIND[k].icon,
          label: KIND[k].label + ' this month',
          value: monthEntries.filter((e) => e.kind === k).length,
          tone: KIND_TONE[k],
          active: kinds.length === 1 && kinds[0] === k,
          onClick: () => setKinds(kinds.length === 1 && kinds[0] === k ? (Object.keys(KIND) as Kind[]) : [k]),
        }))}
      />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select aria-label="Trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} className="w-auto! py-1.5 text-xs">
            <option value="">All trainers</option>
            {data.people.filter((p) => p.role === 'Trainer').map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)} className="w-auto! py-1.5 text-xs">
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Select aria-label="Training type" value={type} onChange={(e) => setType(e.target.value)} className="w-auto! py-1.5 text-xs">
            <option value="">All types</option>
            {data.trainingTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <div className="flex rounded-xl border border-zinc-200 p-0.5">
            {(
              [
                ['month', CalendarDays, 'Month view'],
                ['agenda', List, 'Agenda view'],
              ] as const
            ).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} aria-label={label} aria-pressed={view === v} className={cn('rounded-lg p-1.5', view === v ? 'bg-charcoal text-white' : 'text-zinc-500 hover:bg-zinc-100')}>
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <h2 className="text-lg font-bold text-zinc-900">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => {
              setCursor(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1))
              setSelected(today)
            }} className="rounded-xl border border-zinc-200 px-3.5 py-1.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50">
                  Today
                </button>
                <div className="flex rounded-xl border border-zinc-200">
                  <button onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-l-xl text-zinc-600 hover:bg-zinc-50" aria-label="Previous month">
                    <ChevronLeft className="size-4" />
                  </button>
                  <button onClick={() => shift(1)} className="grid size-8 place-items-center rounded-r-xl border-l border-zinc-200 text-zinc-600 hover:bg-zinc-50" aria-label="Next month">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 border-y border-zinc-100 text-left text-xs font-medium text-zinc-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2.5 py-2.5 sm:px-4">
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = iso(d)
                const list = byDate.get(key) ?? []
                const inMonth = d.getMonth() === cursor.getMonth()
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(key)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(key))}
                    aria-label={`${longDate(key)}, ${list.length} item${list.length === 1 ? '' : 's'}`}
                    aria-pressed={selected === key}
                    className={cn(
                      'relative flex min-h-20 cursor-pointer flex-col gap-1.5 border-r border-b border-zinc-100 p-1.5 text-left transition sm:min-h-32 sm:p-3 [&:nth-child(7n)]:border-r-0',
                      // Same as the learner calendar: today is a soft pink cell with a red outline.
                      key === today ? 'z-10 rounded-xl bg-brand-50/80 ring-1 ring-brand-300 ring-inset' : selected === key ? 'bg-zinc-50' : 'hover:bg-zinc-50/70',
                    )}
                  >
                    <span className={cn('grid size-7 place-items-center rounded-full text-sm sm:size-8 sm:text-[15px]', key === today ? 'bg-brand-600 font-bold text-white' : inMonth ? 'font-medium text-zinc-800' : 'text-zinc-400')}>{d.getDate()}</span>
                    <div className="space-y-1.5">
                      {list.slice(0, 2).map((e) => (
                        <EventChip
                          key={e.key}
                          tone={KIND_TONE[e.kind]}
                          title={e.title}
                          time={(e.kind === 'pending' ? 'Preferred ' : '') + time12(e.start) + (e.end !== e.start ? ' – ' + time12(e.end) : '')}
                          to={e.to}
                          strike={e.kind === 'cancelled'}
                          icon={e.conflict ? <AlertTriangle className="size-3 shrink-0 text-amber-600" /> : undefined}
                          onClick={(ev) => ev.stopPropagation()}
                        />
                      ))}
                      {list.length > 2 && <span className="block px-1 text-[10px] font-medium text-zinc-500">+{list.length - 2} more</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 px-4 py-3.5 sm:px-5">
        {(Object.keys(KIND) as Kind[]).map((k) => {
          const on = kinds.includes(k)
          return (
            <button
              key={k}
              onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
              aria-pressed={on}
              className={cn('inline-flex items-center gap-2 text-xs font-medium transition', on ? 'text-zinc-700' : 'text-zinc-400 line-through')}
            >
              <span className={cn('size-2 rounded-full', KIND[k].dot)} /> {KIND[k].label}
            </button>
          )
        })}
        <span className="inline-flex items-center gap-1.5 px-1 text-xs text-zinc-500">
          <AlertTriangle className="size-3.5 text-amber-600" /> = trainer or trainee double-booked
        </span>
      </div>
          </section>

          <aside className="h-fit rounded-2xl border border-zinc-200/80 bg-surface p-5">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-zinc-900">{longDate(selected)}</h3>
                  {selected >= today && !scope.trainerId && (
                    <Button size="sm" variant="ghost" onClick={() => setCreating(selected)}>
                      <Plus className="size-3.5" /> Add
                    </Button>
                  )}
                </div>
                <div className="mt-2 -mx-2">
                  {selectedEntries.length ? (
                    selectedEntries.map(entryRow)
                  ) : (
                    <div className="mx-2 mt-2 rounded-2xl bg-brand-50/60 px-5 py-6 text-center">
                      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface text-brand-600 shadow-sm">
                        <CalendarCheck2 className="size-6" />
                      </span>
                      <p className="mt-3 font-bold text-zinc-900">{selected === today ? 'Nothing scheduled today' : 'Nothing on this day'}</p>
                      <p className="mt-1 text-sm text-zinc-500">{selected >= today && !scope.trainerId ? 'Use Add to schedule a training here.' : 'Pick another day to see its sessions.'}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-zinc-900">This month</h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {(Object.keys(KIND) as Kind[]).map((k) => (
                    <div key={k} className="rounded-xl bg-zinc-50 p-3">
                      <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className={cn('size-2 rounded-full', KIND[k].dot)} /> {KIND[k].label}
                      </dt>
                      <dd className="mt-1 text-xl font-bold text-zinc-900">{monthEntries.filter((e) => e.kind === k).length}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="size-3.5" /> Click a day to see its sessions.
                </p>
              </>
            )}
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          {monthEntries.length ? (
            [...new Set(monthEntries.map((e) => e.date))].map((date) => (
              <section key={date} className="border-b border-zinc-100 p-3 last:border-b-0">
                <h3 className={cn('mb-1 flex items-center gap-3 px-2.5 text-xs font-semibold tracking-wide uppercase', date === today ? 'text-brand-600' : 'text-zinc-500')}>
                  <DateTile date={date} tone={date === today ? 'red' : 'zinc'} />
                  <span>
                    {longDate(date)}
                    {date === today && ' · Today'}
                  </span>
                </h3>
                {monthEntries.filter((e) => e.date === date).map(entryRow)}
              </section>
            ))
          ) : (
            <Empty icon={CalendarDays} title="Nothing scheduled this month" text="Adjust the filters or schedule a new training." />
          )}
        </div>
      )}

      {creating && <NewTrainingModal open onClose={() => setCreating(null)} preset={{ date: creating }} />}
    </>
  )
}
