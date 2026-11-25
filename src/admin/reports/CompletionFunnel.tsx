import { ArrowDown, ArrowUp, Award, BarChart3, Filter, Lightbulb } from 'lucide-react'
import { cn } from '../../lib/utils'

export type FunnelStage = { name: string; count: number; pctOfTotal: number; dropOff: number }

// Layer colours, red at the top to green at the bottom (light → base for a soft sheen).
const FILLS: [string, string][] = [
  ['#e8504a', '#c0201f'],
  ['#ff8f45', '#ef5d14'],
  ['#ffcf45', '#f2a60d'],
  ['#62d374', '#2ea84a'],
  ['#34ad4f', '#167a35'],
]

// Chart geometry (SVG units).
const W = 660
const LAYER = 62
const DIP = 12 // how far each layer's rim curves down in the middle
const TOP = DIP + 6
const H = TOP + LAYER * 5 + DIP * 2 + 6
const CX = W / 2

const strip = (name: string) => name.replace(/^\d+\.\s*/, '')

/**
 * Completion funnel: steps on the left, a layered funnel in the middle (each layer as wide as its
 * share of enrolments), the drop-off for every step on the right, and the certified count below.
 */
export function CompletionFunnel({ stages, worst, trend }: { stages: FunnelStage[]; worst: FunnelStage; trend: number[] }) {
  const total = stages[0]?.count ?? 0
  const last = stages[stages.length - 1]
  const delta = trend.length >= 2 ? trend[trend.length - 1] - trend[trend.length - 2] : null

  // An even taper (the numbers on each layer carry the data), the same shape every time.
  const widths = [96, 82, 69, 58, 49, 41]
  const layers = stages.map((s, i) => {
    const tp = (W * widths[i]) / 100
    const bp = (W * widths[i + 1]) / 100
    const yt = TOP + i * LAYER
    const yb = yt + LAYER
    return {
      stage: s,
      i,
      tp,
      yt,
      d: `M${CX - tp / 2},${yt} Q${CX},${yt + DIP * 2} ${CX + tp / 2},${yt} L${CX + bp / 2},${yb} Q${CX},${yb + DIP * 2} ${CX - bp / 2},${yb} Z`,
      rim: `M${CX - tp / 2},${yt} Q${CX},${yt + DIP * 2} ${CX + tp / 2},${yt}`,
      mid: (yt + yb) / 2 + DIP,
    }
  })
  const pctY = (y: number) => `${(y / H) * 100}%`

  return (
    <div className="space-y-5">
      {/* Bottleneck + overall conversion */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-[#fff8ef] to-orange-50/60 p-4 sm:p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <Lightbulb className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-amber-950">Primary Drop-off Bottleneck</h3>
          <p className="mt-0.5 text-xs text-zinc-700">
            The steepest drop-off occurs at <strong className="font-semibold text-zinc-900">{worst.name}</strong> with a <span className="font-bold text-brand-600">-{worst.dropOff}% drop-off</span>. Targeted reminders for this stage
            will yield the highest completion gains.
          </p>
        </div>
        <div className="flex items-center gap-5 border-amber-200 sm:border-l sm:pl-6">
          <div>
            <p className="text-xs font-medium text-zinc-600">Overall Conversion</p>
            <p className="mt-0.5 flex items-center gap-2">
              <span className="text-2xl font-black text-zinc-900">{last?.pctOfTotal ?? 0}%</span>
              {delta !== null && (
                <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold', delta >= 0 ? 'bg-mpesa-500/15 text-mpesa-700' : 'bg-brand-50 text-brand-700')} title="Change from the month before">
                  {delta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />} {delta >= 0 ? '+' : ''}
                  {delta}%
                </span>
              )}
            </p>
          </div>
          {trend.length >= 2 && <Sparkline points={trend} />}
        </div>
      </div>

      {/* Funnel card */}
      <div className="rounded-2xl border border-zinc-200/80 bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Filter className="mt-0.5 size-5 shrink-0 fill-brand-600 text-brand-600" />
          <div>
            <h3 className="text-base font-bold text-zinc-900">Completion Funnel</h3>
            <p className="text-xs text-zinc-500">Track how learners progress through the training journey</p>
          </div>
        </div>

        {total === 0 ? (
          <p className="mt-6 rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">No enrolments match these filters yet, so there is nothing to show.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_210px]">
              {/* Steps */}
              <div className="relative hidden lg:block">
                {layers.map((l) => (
                  <div key={l.stage.name} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-3" style={{ top: pctY(l.mid) }}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">{l.i + 1}</span>
                    <span className="text-sm leading-snug font-bold text-zinc-900">{strip(l.stage.name)}</span>
                  </div>
                ))}
              </div>

              {/* Funnel */}
              <div className="relative mx-auto w-full max-w-[680px]">
                <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Completion funnel: ${stages.map((s) => `${strip(s.name)} ${s.count}`).join(', ')}`}>
                  <defs>
                    {FILLS.map(([a, b], i) => (
                      <linearGradient key={i} id={`funnel-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={a} />
                        <stop offset="100%" stopColor={b} />
                      </linearGradient>
                    ))}
                    <filter id="funnel-shadow" x="-10%" y="-10%" width="120%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.18" />
                    </filter>
                  </defs>
                  {/* Bottom layer first so each layer above casts its shadow on the next. */}
                  {[...layers].reverse().map((l) => (
                    <g key={l.stage.name} filter="url(#funnel-shadow)">
                      <path d={l.d} fill={`url(#funnel-fill-${l.i})`} />
                      <path d={l.rim} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />
                    </g>
                  ))}
                  {/* The open top of the funnel */}
                  <ellipse cx={CX} cy={layers[0].yt} rx={layers[0].tp / 2} ry={DIP} fill="#ef6a63" stroke="#f59d98" strokeWidth={1.5} />
                </svg>
                {layers.map((l) => (
                  <div key={`v-${l.stage.name}`} className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center leading-tight text-white" style={{ top: pctY(l.mid), textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
                    <span className="block text-lg font-black tabular-nums sm:text-2xl">{l.stage.count.toLocaleString()}</span>
                    <span className="block text-[10px] font-semibold whitespace-nowrap sm:text-xs">{l.stage.pctOfTotal}% of Enrolled</span>
                  </div>
                ))}
              </div>

              {/* Drop-off summary */}
              <div className="relative hidden lg:block">
                <div className="absolute inset-x-0 rounded-2xl border border-zinc-200/80 bg-surface shadow-sm" style={{ top: pctY(layers[0].mid - LAYER / 2 + 4), bottom: `${(1 - (layers[layers.length - 1].mid + LAYER / 2 - 2) / H) * 100}%` }} />
                <div className="absolute inset-x-4 flex -translate-y-1/2 items-center gap-2 text-sm font-bold text-zinc-900" style={{ top: pctY(layers[0].mid) }}>
                  <BarChart3 className="size-4 text-brand-600" /> Drop-off Summary
                </div>
                {layers.slice(1).map((l) => (
                  <DropItem key={l.stage.name} stage={l.stage} lost={stages[l.i - 1].count - l.stage.count} worst={l.stage === worst} className="absolute inset-x-2.5 -translate-y-1/2" style={{ top: pctY(l.mid) }} />
                ))}
              </div>
            </div>

            {/* Steps and drop-offs as a list on smaller screens */}
            <ol className="mt-4 space-y-2 lg:hidden">
              {stages.map((s, i) => (
                <li key={s.name} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-900">{strip(s.name)}</span>
                  {i > 0 && <DropItem stage={s} lost={stages[i - 1].count - s.count} worst={s === worst} compact />}
                </li>
              ))}
            </ol>

            <div className="mt-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-mpesa-500/30 bg-mpesa-500/10 py-1.5 pr-4 pl-1.5 text-sm">
                <span className="grid size-7 place-items-center rounded-full bg-mpesa-600 text-white">
                  <Award className="size-4" />
                </span>
                <span className="font-bold text-zinc-900">{(last?.count ?? 0).toLocaleString()} certified</span>
                <span className="text-zinc-600">· {last?.pctOfTotal ?? 0}% of everyone enrolled</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DropItem({ stage, lost, worst, compact, className, style }: { stage: FunnelStage; lost: number; worst: boolean; compact?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('flex items-center gap-2.5 rounded-xl border', compact ? 'px-2.5 py-1' : 'px-3 py-2', worst ? 'border-amber-300 bg-amber-50' : 'border-zinc-100 bg-brand-50/40', className)}
      style={style}
      title={`${lost.toLocaleString()} learner${lost === 1 ? '' : 's'} did not reach this step`}
    >
      <span className={cn('grid shrink-0 place-items-center rounded-lg', compact ? 'size-6' : 'size-8', worst ? 'bg-amber-100 text-orange-600' : 'bg-brand-50 text-brand-600')}>
        <ArrowDown className="size-4" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={cn('block font-bold', compact ? 'text-xs' : 'text-sm', worst ? 'text-orange-600' : 'text-brand-700')}>{stage.dropOff}% drop</span>
        <span className={cn('block text-[11px]', worst ? 'font-semibold text-zinc-800' : 'text-brand-600/80')}>{worst ? 'Biggest drop' : `${lost.toLocaleString()} lost`}</span>
      </span>
    </div>
  )
}

/** Small line of the overall conversion month by month. */
function Sparkline({ points }: { points: number[] }) {
  const w = 110
  const h = 36
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const xy = points.map((v, i) => [(i / (points.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f26a21" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f26a21" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${w},${h}L0,${h}Z`} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#f26a21" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
