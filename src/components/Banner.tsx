import type { Training } from '../types'

const W = 400
const H = 180

function Wordmark({ x, y, size, color = '#fff', dash = '#39B54A' }: { x: number; y: number; size: number; color?: string; dash?: string }) {
  return (
    <text x={x} y={y} fontFamily="Poppins, sans-serif" fontWeight={800} fontSize={size} fill={color} letterSpacing={-1}>
      m<tspan fill={dash}>-</tspan>pesa
    </text>
  )
}

function Phone({ x, y, scale = 1, screen = '#39B54A' }: { x: number; y: number; scale?: number; screen?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={6} y={18} width={44} height={60} rx={10} fill="#f2c9a5" transform="rotate(-8 28 48)" />
      <rect width={52} height={96} rx={8} fill="#1d1d1f" />
      <rect x={4} y={6} width={44} height={84} rx={5} fill="#fff" />
      <rect x={4} y={6} width={44} height={18} rx={5} fill={screen} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={9 + c * 13} y={32 + r * 15} width={9} height={9} rx={2} fill={r === 0 && c === 0 ? '#d03c3b' : '#d4d4d8'} />),
      )}
      <rect x={9} y={78} width={35} height={6} rx={3} fill={screen} />
    </g>
  )
}

function Title({ text, x, y, size, color, anchor = 'start' }: { text: string; x: number; y: number; size: number; color: string; anchor?: 'start' | 'middle' }) {
  return (
    <text x={x} y={y} fontFamily="Poppins, sans-serif" fontWeight={800} fontSize={size} fill={color} textAnchor={anchor}>
      {text.split('\n').map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * 1.15}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function Banner({ training, className }: { training: Training; className?: string }) {
  if (training.cover) {
    return (
      <>
        <img src={training.cover} alt="" loading="lazy" decoding="async" className={`${className ?? ''} object-cover`} />
        {/* Soft brand tint over the photo, plus darker top and bottom edges so badges and chips stay readable. */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-brand-700/30 via-brand-600/5 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/35 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" aria-hidden />
      </>
    )
  }

  const title = training.bannerTitle ?? ''
  const id = `b-${training.id}`

  let art
  switch (training.banner) {
    case 'fayda':
      art = (
        <>
          <rect width={W} height={H} fill="#fff" />
          <defs>
            <pattern id={`${id}-p`} width={26} height={26} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 13h26M13 0v26" stroke="#f4dcdc" strokeWidth={1} />
            </pattern>
            <radialGradient id={`${id}-g`}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}-p)`} />
          <ellipse cx={W / 2} cy={H / 2 + 6} rx={150} ry={70} fill={`url(#${id}-g)`} />
          <Wordmark x={316} y={30} size={18} color="#39B54A" dash="#d03c3b" />
          <Title text={title} x={W / 2} y={88} size={22} color="#d03c3b" anchor="middle" />
        </>
      )
      break
    case 'green':
      art = (
        <>
          <rect width={W} height={H} fill="#39B54A" />
          <path d={`M180 ${H} C 220 120, 300 150, ${W} 110 L ${W} ${H} Z`} fill="#d03c3b" />
          <path d={`M210 ${H} C 250 140, 320 160, ${W} 135 L ${W} ${H} Z`} fill="#c10522" />
          <Phone x={24} y={40} scale={1.15} screen="#2a9a3a" />
          <Wordmark x={110} y={44} size={18} />
          <rect x={240} y={56} width={140} height={58} rx={6} fill="#fff" />
          <Title text={title} x={310} y={80} size={15} color="#d03c3b" anchor="middle" />
        </>
      )
      break
    case 'optimization':
      art = (
        <>
          <rect width={W} height={H} fill="#f7fbf7" />
          <Title text={title} x={W / 2} y={36} size={20} color="#2a9a3a" anchor="middle" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${36 + i * 56} 92)`}>
              <circle r={18} fill={i % 2 ? '#39B54A' : '#2a9a3a'} />
              <path d="M-7 0l5 5 9-10" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
              {i < 3 && <path d="M24 0h16" stroke="#9ca3af" strokeWidth={2} strokeDasharray="3 3" />}
            </g>
          ))}
          <Phone x={250} y={60} scale={0.95} />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(318 ${72 + i * 28})`}>
              <circle r={8} fill="#39B54A" />
              <rect x={14} y={-5} width={52} height={10} rx={5} fill="#d1fae5" />
            </g>
          ))}
        </>
      )
      break
    case 'merchant':
      art = (
        <>
          <rect width={W} height={H} fill="#e7e2d8" />
          <rect x={0} y={0} width={W} height={70} fill="#c7d2cc" />
          {[...Array(7)].map((_, i) => (
            <circle key={i} cx={30 + i * 60} cy={95 + (i % 2) * 10} r={30} fill={['#6b7280', '#b45309', '#475569', '#9a3412'][i % 4]} opacity={0.45} />
          ))}
          <rect x={180} y={60} width={160} height={92} rx={8} fill="#39B54A" />
          <rect x={192} y={72} width={52} height={52} rx={4} fill="#fff" />
          {[...Array(16)].map((_, i) => (
            <rect key={i} x={196 + (i % 4) * 11} y={76 + Math.floor(i / 4) * 11} width={9} height={9} fill={(i * 7) % 3 ? '#111' : '#fff'} />
          ))}
          <Title text={title} x={254} y={92} size={13} color="#fff" />
          <Wordmark x={254} y={138} size={14} dash="#d03c3b" />
        </>
      )
      break
    case 'dark':
      art = (
        <>
          <rect width={W} height={H} fill="#111827" />
          <circle cx={330} cy={40} r={90} fill="#d03c3b" opacity={0.25} />
          <circle cx={60} cy={170} r={70} fill="#39B54A" opacity={0.25} />
          <path d="M300 60l40 16v30c0 22-18 38-40 46-22-8-40-24-40-46V76z" fill="#39B54A" />
          <path d="M285 104l10 10 22-24" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Title text={title} x={32} y={78} size={24} color="#fff" />
          <Wordmark x={32} y={150} size={18} />
        </>
      )
      break
    default:
      art = (
        <>
          <defs>
            <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ec1c2e" />
              <stop offset="0.55" stopColor="#d10a24" />
              <stop offset="1" stopColor="#a3061a" />
            </linearGradient>
            <filter id={`${id}-sh`} x="-30%" y="-20%" width="160%" height="150%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#4a0010" floodOpacity="0.45" />
            </filter>
          </defs>
          <rect width={W} height={H} fill={`url(#${id}-bg)`} />
          {/* Soft blobs behind the phone */}
          <path d="M250 180c-14-40 4-92 46-118 40-25 92-14 104 6v112z" fill="#fff" opacity={0.07} />
          <path d="M292 180c-6-30 12-62 44-74 30-11 56 4 64 20v54z" fill="#fff" opacity={0.08} />
          <circle cx={330} cy={30} r={38} fill="#fff" opacity={0.05} />
          <Wordmark x={34} y={104} size={58} />
          <text x={36} y={130} fontFamily="Poppins, sans-serif" fontSize={10.5} fill="#fff" opacity={0.92}>
            More than a payment. A better tomorrow.
          </text>
          {/* Tilted phone with a soft shadow and sparkle lines */}
          <g transform="translate(282 46) rotate(-9 26 48)" filter={`url(#${id}-sh)`}>
            <rect width={56} height={104} rx={11} fill="#1f1f22" />
            <rect x={4} y={5} width={48} height={94} rx={8} fill="#fff" />
            <rect x={4} y={5} width={48} height={20} rx={8} fill="#39b54a" />
            <rect x={4} y={17} width={48} height={8} fill="#39b54a" />
            {[0, 1, 2].map((r) =>
              [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={10 + c * 13} y={33 + r * 15} width={10} height={10} rx={2.5} fill={r === 0 && c === 0 ? '#d03c3b' : '#e4e4e7'} />),
            )}
            <rect x={10} y={84} width={36} height={7} rx={3.5} fill="#2ea836" />
          </g>
          <g stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.9}>
            <path d="M348 42l-5 9" />
            <path d="M336 38l-1 7" />
            <path d="M352 56l-7 2" />
          </g>
        </>
      )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={`${training.title} banner`}>
      {art}
    </svg>
  )
}
