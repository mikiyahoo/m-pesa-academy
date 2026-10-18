import type { ReactNode } from 'react'

export type RingSegment = { value: number; color: string }

/**
 * Ring of separate rounded arcs with a clear gap between each (e.g. green progress and grey
 * remainder). Round caps reach past an arc's end by half the stroke, so every end is trimmed
 * by that plus half the gap. A single non-empty segment draws as a full ring.
 */
export function SegmentRing({
  segments,
  size = 80,
  stroke = 8,
  label,
  children,
  className,
}: {
  segments: RingSegment[]
  size?: number
  stroke?: number
  label: string
  children?: ReactNode
  className?: string
}) {
  const c = size / 2
  const r = c - stroke / 2 - 1
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const parts = segments.filter((x) => x.value > 0)
  const trim = stroke / 2 / r + 0.07
  const arc = (start: number, end: number) => {
    const x1 = c + r * Math.cos(start)
    const y1 = c + r * Math.sin(start)
    const x2 = c + r * Math.cos(end)
    const y2 = c + r * Math.sin(end)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2}`
  }

  let angle = 0
  const paths = parts.map((p) => {
    const sweep = (p.value / total) * Math.PI * 2
    const start = angle + trim
    // Very small segments still show as a short dash instead of vanishing.
    const end = Math.max(angle + sweep - trim, start + 0.001)
    angle += sweep
    return { d: arc(start, end), color: p.color }
  })

  return (
    <div className={`relative shrink-0 ${className ?? ''}`} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        {parts.length <= 1 ? (
          <circle cx={c} cy={c} r={r} fill="none" stroke={parts[0]?.color ?? '#e4e4e7'} strokeWidth={stroke} />
        ) : (
          paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round" />)
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-content-center text-center">{children}</div>}
    </div>
  )
}
