import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn, formatDate, parseDate, sessionStatus, timeRange, todayISO } from '../lib/utils'
import { useStore } from '../store/AppStore'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dot = { Active: 'bg-brand-600', Upcoming: 'bg-amber-500', Completed: 'bg-mpesa-500' }

export function CalendarPage() {
  const { trainings } = useStore()
  const today = todayISO()
  const [cursor, setCursor] = useState(() => {
    const d = parseDate(today)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(today)

  const days = useMemo(() => {
    const start = new Date(cursor)
    start.setDate(1 - start.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const byDate = useMemo(() => {
    const map: Record<string, typeof trainings> = {}
    trainings.forEach((t) => (map[t.date] ??= []).push(t))
    return map
  }, [trainings])

  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1))
  const selectedSessions = byDate[selected] ?? []
  const upcoming = trainings.filter((t) => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-zinc-500">Your scheduled training sessions.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4">
            <h2 className="font-semibold">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const d = parseDate(today)
                  setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                  setSelected(today)
                }}
                className="mr-2 rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-50"
              >
                Today
              </button>
              <button onClick={() => shift(-1)} className="rounded-lg p-1.5 hover:bg-zinc-100" aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </button>
              <button onClick={() => shift(1)} className="rounded-lg p-1.5 hover:bg-zinc-100" aria-label="Next month">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-zinc-100 text-center text-xs font-medium text-zinc-500">
            {weekdays.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = iso(d)
              const items = byDate[key] ?? []
              const inMonth = d.getMonth() === cursor.getMonth()
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={cn(
                    'flex min-h-16 flex-col items-start gap-1 border-r border-b border-zinc-100 p-1.5 text-left transition sm:min-h-24 [&:nth-child(7n)]:border-r-0',
                    !inMonth && 'bg-zinc-50/70 text-zinc-400',
                    selected === key && 'bg-brand-50/60 ring-1 ring-brand-200 ring-inset',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs',
                      key === today && 'bg-brand-600 font-semibold text-white',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {items.map((t) => (
                    <span key={t.id} className="flex w-full items-center gap-1 truncate rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-700">
                      <span className={cn('size-1.5 shrink-0 rounded-full', dot[sessionStatus(t)])} />
                      <span className="hidden truncate sm:inline">{t.title}</span>
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
          <div className="flex gap-4 p-3 text-xs text-zinc-500">
            {Object.entries(dot).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', c)} /> {k}
              </span>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {selectedSessions.length ? (
              <ul className="mt-3 space-y-2">
                {selectedSessions.map((t) => (
                  <li key={t.id}>
                    <Link to={`/trainings/${t.id}`} className="block rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="size-3.5" /> {timeRange(t)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <MapPin className="size-3.5" /> {t.venue}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No sessions on this day.</p>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Coming up</h3>
            <ul className="mt-3 space-y-3">
              {upcoming.map((t) => {
                const d = parseDate(t.date)
                return (
                  <li key={t.id}>
                    <Link to={`/trainings/${t.id}`} className="flex gap-3 hover:opacity-80">
                      <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-brand-50 py-1 text-brand-700">
                        <span className="text-[10px] font-medium uppercase">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-base leading-tight font-semibold">{d.getDate()}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm font-medium">{t.title}</span>
                        <span className="text-xs text-zinc-500">{timeRange(t)}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
