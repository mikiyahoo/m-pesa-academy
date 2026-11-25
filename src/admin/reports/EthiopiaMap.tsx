import { Award, MapPin, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui'
import { ETHIOPIA_REGIONS, ETHIOPIA_SIZE } from './ethiopiaRegions'

export type RegionRow = {
  region: string
  enrolments: number
  attendanceRate: number
  completionRate: number
  avgScore: number
  certificates: number
  rating: 'high' | 'medium' | 'low'
}

const FILL = { high: 'fill-mpesa-600', medium: 'fill-amber-400', low: 'fill-brand-600', none: 'fill-zinc-200' } as const
const DOT = { high: 'bg-mpesa-600', medium: 'bg-amber-400', low: 'bg-brand-600', none: 'bg-zinc-300' } as const
const LABEL = { high: 'Optimal', medium: 'Standard', low: 'Needs focus', none: 'No learners' } as const
const SHORT: Record<string, string> = { 'Benishangul-Gumuz': 'Benishangul' }
// City-state labels sit beside their marker so they don't cover each other.
const CITY_LABEL: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' }> = {
  'Addis Ababa': { dx: -12, dy: 4, anchor: 'end' },
  'Dire Dawa': { dx: 11, dy: -6, anchor: 'start' },
  Harari: { dx: 11, dy: 12, anchor: 'start' },
}

const areas = ETHIOPIA_REGIONS.filter((r) => !r.city)
const cities = ETHIOPIA_REGIONS.filter((r) => r.city)

/**
 * Regional performance on a map of Ethiopia: regions coloured by health, the three city-states as
 * markers, the selected region's details beside the map and every region listed underneath.
 */
export function RegionMap({ rows }: { rows: RegionRow[] }) {
  const byRegion = useMemo(() => new Map(rows.map((r) => [r.region, r])), [rows])
  const [selected, setSelected] = useState<string>(rows[0]?.region ?? 'Addis Ababa')
  const current = byRegion.get(selected)
  const tone = (region: string) => byRegion.get(region)?.rating ?? 'none'
  const describe = (region: string) => {
    const r = byRegion.get(region)
    return `${region}: ${r ? `${r.enrolments} enrolments, ${r.completionRate}% completion` : 'no learners'}`
  }
  const keys = (region: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(region)
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* The map */}
      <div className="rounded-2xl border border-zinc-200/80 bg-surface p-4 sm:p-5">
        <svg viewBox={`0 0 ${ETHIOPIA_SIZE.w} ${ETHIOPIA_SIZE.h}`} role="group" aria-label="Map of Ethiopia coloured by regional training performance" className="mx-auto h-auto w-full max-w-[680px]">
          {/* The selected region is drawn last so its outline sits on top. */}
          {[...areas].sort((x, y) => Number(selected === x.region) - Number(selected === y.region)).map((c) => {
            const isSel = selected === c.region
            return (
              <g
                key={c.region}
                role="button"
                tabIndex={0}
                aria-label={describe(c.region)}
                aria-pressed={isSel}
                onClick={() => setSelected(c.region)}
                onKeyDown={keys(c.region)}
                className={cn('cursor-pointer outline-none transition-opacity', isSel ? '' : 'opacity-90 hover:opacity-100 focus-visible:opacity-100')}
                style={isSel ? { filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.45))' } : undefined}
              >
                <path d={c.fill} className={FILL[tone(c.region)]} fillRule="evenodd" />
                <path d={c.border || c.fill} className="fill-none stroke-white" strokeWidth={isSel ? 3 : 1.5} strokeLinejoin="round" strokeLinecap="round" />
                <title>{c.region}</title>
              </g>
            )
          })}
          {/* Region names */}
          {areas.map((c) => (
            <text key={`t-${c.region}`} x={c.label[0]} y={c.label[1]} textAnchor="middle" className="pointer-events-none fill-white text-[13px] font-bold" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.4)', strokeWidth: 3 }}>
              {SHORT[c.region] ?? c.region}
            </text>
          ))}
          {/* City-states: their small area plus a marker */}
          {cities.map((c) => {
            const isSel = selected === c.region
            const [x, y] = c.label
            const l = CITY_LABEL[c.region]
            return (
              <g key={c.region} role="button" tabIndex={0} aria-label={describe(c.region)} aria-pressed={isSel} onClick={() => setSelected(c.region)} onKeyDown={keys(c.region)} className="cursor-pointer outline-none">
                <path d={c.fill} className={cn(FILL[tone(c.region)], 'stroke-white')} strokeWidth={1} />
                <circle cx={x} cy={y} r={isSel ? 9 : 7} className={cn(FILL[tone(c.region)], 'stroke-white transition-all')} strokeWidth={isSel ? 3 : 2} style={isSel ? { filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' } : undefined} />
                <text x={x + l.dx} y={y + l.dy} textAnchor={l.anchor} className="fill-zinc-800 text-[13px] font-bold" style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.9)', strokeWidth: 3.5 }}>
                  {c.region}
                </text>
                <title>{c.region}</title>
              </g>
            )
          })}
        </svg>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-zinc-600">
          {(['high', 'medium', 'low', 'none'] as const).map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-full', DOT[k])} /> {LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      {/* Details */}
      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Selected region</p>
              <h3 className="mt-0.5 flex items-center gap-1.5 text-xl font-bold text-zinc-900">
                <MapPin className="size-5 shrink-0 text-brand-600" /> <span className="truncate">{selected}</span>
              </h3>
            </div>
            <Badge tone={current ? (current.rating === 'high' ? 'green' : current.rating === 'medium' ? 'blue' : 'amber') : 'zinc'}>{LABEL[current?.rating ?? 'none']}</Badge>
          </div>
          {current ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-zinc-50 px-2 py-3">
                  <Users className="mx-auto size-4 text-zinc-500" />
                  <p className="mt-1 text-lg font-bold text-zinc-900 tabular-nums">{current.enrolments.toLocaleString()}</p>
                  <p className="text-[11px] text-zinc-500">Enrolments</p>
                </div>
                <div className="rounded-xl bg-zinc-50 px-2 py-3">
                  <Award className="mx-auto size-4 text-zinc-500" />
                  <p className="mt-1 text-lg font-bold text-zinc-900 tabular-nums">{current.certificates.toLocaleString()}</p>
                  <p className="text-[11px] text-zinc-500">Certificates</p>
                </div>
                <div className="rounded-xl bg-zinc-50 px-2 py-3">
                  <span className="text-xs font-bold text-zinc-500">AVG</span>
                  <p className="mt-0.5 text-lg font-bold text-zinc-900 tabular-nums">{current.avgScore ? `${current.avgScore}%` : '—'}</p>
                  <p className="text-[11px] text-zinc-500">Assessment score</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <Meter label="Completion rate" value={current.completionRate} tone={current.completionRate >= 70 ? 'bg-mpesa-600' : current.completionRate >= 50 ? 'bg-amber-500' : 'bg-brand-600'} />
                <Meter label="Attendance rate" value={current.attendanceRate} tone="bg-blue-600" />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No learners are enrolled from {selected} in this period.</p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          <h3 className="px-5 pt-4 pb-2 text-base font-bold text-zinc-900">All regions ({rows.length})</h3>
          <ul className="max-h-[360px] divide-y divide-zinc-100 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.region}>
                <button type="button" onClick={() => setSelected(r.region)} aria-pressed={selected === r.region} className={cn('flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-zinc-50', selected === r.region && 'bg-brand-50/50')}>
                  <span className={cn('size-2.5 shrink-0 rounded-full', DOT[r.rating])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{r.region}</span>
                    <span className="block text-xs text-zinc-500">
                      {r.enrolments.toLocaleString()} enrolments · {r.certificates} certificates
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-zinc-600 tabular-nums">
                    <span className="block font-bold text-zinc-900">{r.completionRate}% done</span>
                    <span>{r.attendanceRate}% attended</span>
                  </span>
                </button>
              </li>
            ))}
            {!rows.length && <li className="px-5 py-6 text-sm text-zinc-500">No regional data for these filters.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-medium">
        <span className="text-zinc-600">{label}</span>
        <span className="font-bold text-zinc-900">{value}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
