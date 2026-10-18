import QRCode from 'qrcode'
import { useEffect, useId, useState, type ReactNode } from 'react'

export type CertificateFields = {
  name: string
  course: string
  score?: number
  issued: string // formatted date
  trainer: string
  certificateId: string
}

/** The three M-PESA certificate layouts; admins pick one per template (X03). */
export type CertificateLayout = 'sweep' | 'border' | 'tiles'

export const CERTIFICATE_LAYOUTS: { value: CertificateLayout; label: string; hint: string }[] = [
  { value: 'sweep', label: 'Red sweep', hint: 'Pattern top right over a red curve, QR column on the right' },
  { value: 'border', label: 'Pattern border', hint: 'Patterned left edge, name in red, pattern top right' },
  { value: 'tiles', label: 'Brighter future', hint: 'Red tiles down the right edge, faint pattern behind' },
]

const RED = '#d03c3b'
const INK = '#16181d'
const SCRIPT = "'Segoe Script','Brush Script MT','Lucida Handwriting',cursive"

function useQr(certificateId: string) {
  const [qr, setQr] = useState('')
  const url = `${typeof window === 'undefined' ? '' : window.location.origin}/verify/${certificateId}`
  useEffect(() => {
    let live = true
    QRCode.toDataURL(url, { margin: 0, width: 240, color: { dark: INK, light: '#ffffff' } }).then((u) => live && setQr(u))
    return () => {
      live = false
    }
  }, [url])
  return qr
}

function Qr({ src, id, className }: { src: string; id: string; className?: string }) {
  return (
    <div className={`rounded-[0.6em] border-[0.15em] bg-white p-[0.75em] ${className ?? ''}`} style={{ borderColor: RED }}>
      {src ? <img src={src} alt={`QR code to verify certificate ${id}`} className="aspect-square w-full" /> : <div className="aspect-square w-full bg-zinc-100" />}
    </div>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={RED} strokeWidth="1.9" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
      <g fill={RED} stroke="none">
        {[7.5, 12, 16.5].flatMap((x) => [13, 16.8].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />))}
      </g>
    </svg>
  )
}

/** Document icon with "Certificate ID:" over the ID, used by every layout. */
function CertificateIdBlock({ id, className }: { id: string; className?: string }) {
  return (
    <div className={`flex items-center gap-[1.1em] ${className ?? ''}`}>
      <svg viewBox="0 0 24 24" className="size-[2.9em] shrink-0" fill="none" stroke={RED} strokeWidth="1.7" aria-hidden>
        <rect x="5" y="2.5" width="14" height="19" rx="2" />
        <path d="M8.5 7h7M8.5 10.5h4.5" strokeLinecap="round" />
        <circle cx="10" cy="15.6" r="1.7" />
        <path d="M8.9 17.1 8.3 19.5l1.7-.9 1.7.9-.6-2.4" strokeLinejoin="round" />
      </svg>
      <div className="min-w-0 leading-tight">
        <p className="text-[1.2em] text-zinc-600">Certificate ID:</p>
        <p className="truncate text-[1.35em] font-semibold tracking-wide">{id}</p>
      </div>
    </div>
  )
}

/** Calendar icon + date, a rule under the date, then "Date issued" — same on every design. */
function DateIssued({ issued, className }: { issued: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-[1.2em]">
        <CalendarIcon className="size-[2.4em] shrink-0" />
        <p className="text-[1.65em] font-bold">{issued}</p>
      </div>
      <span className="mt-[0.6em] ml-[3.6em] block h-px bg-zinc-400" />
      <p className="mt-[0.7em] ml-[2.88em] text-[1.25em] text-zinc-500">Date issued</p>
    </div>
  )
}

function Signature({ trainer, color = RED, className }: { trainer: string; color?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="truncate pl-[0.4em] text-[3.3em] leading-none" style={{ color, fontFamily: SCRIPT }}>
        {trainer.split(' ')[0]}
      </p>
      <span className="mt-[0.6em] block h-px bg-zinc-400" />
      <p className="mt-[0.8em] text-[1.5em] font-bold">{trainer}</p>
      <p className="text-[1.25em] text-zinc-500">Trainer</p>
    </div>
  )
}

/** Score as a solid red rounded badge with a white medal and white number. */
function Score({ score }: { score?: number }) {
  if (score === undefined) return null
  return (
    <div className="mt-[0.65em] flex items-center gap-[0.8em]">
      <span className="text-[1.6em] text-zinc-600">with a score of</span>
      <span className="inline-flex items-center gap-[0.4em] rounded-[0.6em] px-[0.8em] py-[0.5em] text-white shadow-[0_0.25em_0.8em_rgba(208,60,59,0.25)]" style={{ background: RED }}>
        <svg viewBox="0 0 24 24" className="size-[1.5em]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="9" r="5.5" />
          <path d="M8.6 13.4 7 21l5-2.6 5 2.6-1.6-7.6" />
        </svg>
        <span className="text-[1.55em] leading-none font-bold">{score}%</span>
      </span>
    </div>
  )
}

function Tagline({ className }: { className?: string }) {
  return (
    <div className={`-mt-[0.3em] text-[1.05em] leading-[1.45] font-medium tracking-[0.08em] whitespace-nowrap text-zinc-700 uppercase ${className ?? ''}`}>
      <p>M-PESA</p>
      <p>Empowering people,</p>
      <p>Enabling digital economy</p>
      <span className="mt-[0.7em] block h-[0.18em] w-[3.6em]" style={{ background: RED }} />
    </div>
  )
}

/** Wrapper: sizes are em of 1% of the certificate width, so it scales the same everywhere. */
function Frame({ aspect, children }: { aspect: string; children: ReactNode }) {
  return (
    <div className={`relative w-full overflow-hidden bg-white [container-type:inline-size] ${aspect}`} style={{ color: INK, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div className="absolute inset-0" style={{ fontSize: '1cqw' }}>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------- 1 · Red sweep ------------------------------- */

function Sweep({ f, qr, gid }: { f: CertificateFields; qr: string; gid: string }) {
  return (
    <Frame aspect="aspect-[1.414]">
      <img src="/M-PESA Pattern.svg" alt="" aria-hidden className="pointer-events-none absolute -bottom-[30%] -left-[14%] w-[36%] opacity-[0.06] select-none" />
      <svg viewBox="0 0 141.4 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id={`sweep-${gid}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#b73332" />
            <stop offset="1" stopColor="#6b1f1e" />
          </linearGradient>
          <linearGradient id={`sweep-hi-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e05a59" />
            <stop offset="1" stopColor={RED} />
          </linearGradient>
        </defs>
        {/* The white page bows out to the right; red layers fill the crescent behind it. */}
        <path d="M120 0 C129.5 17 134.5 34 132.8 52 C131 70 124 87 115 100 L141.4 100 L141.4 0 Z" fill={`url(#sweep-hi-${gid})`} />
        <path d="M128 0 C135.5 17 139 35 137.6 53 C136.2 71 130 88 122 100 L141.4 100 L141.4 0 Z" fill={`url(#sweep-${gid})`} />
        <path d="M133.5 0 C139.5 18 141.4 37 140.6 56 C139.8 72 135 88 130 100 L141.4 100 L141.4 0 Z" fill="#7a2322" opacity="0.55" />
        <path d="M122 0 C131.4 17 136.3 34 134.6 52 C132.8 70 125.8 87 117 100" fill="none" stroke="#e8807f" strokeWidth="0.35" opacity="0.7" />
        {/* Layers: red wave at the back, a white disc over it, then the full pattern on top. */}
        <circle cx="141" cy="-3" r="26" fill="#ffffff" />
        <image href="/M-PESA Pattern.svg" x="117" y="-27" width="48" height="48" />
      </svg>

      <div className="absolute top-[7.5%] left-[7%] w-[60%]">
        <img src="/M-PESA-red-logo.svg" alt="M-PESA" className="h-[5.4em] w-auto" />
        <h1 className="mt-[1.65em] text-[5.2em] leading-[0.98] font-extrabold tracking-[-0.02em]">
          <span className="block">Certificate of</span>
          <span className="block" style={{ color: RED }}>
            Completion
          </span>
        </h1>
        <p className="mt-[1.4em] text-[1.75em] text-zinc-600">This certifies that</p>
        <p className="mt-[0.1em] truncate text-[4em] leading-tight font-extrabold tracking-[-0.01em]">{f.name}</p>
        <p className="mt-[0.9em] text-[1.75em] text-zinc-600">has successfully completed the training</p>
        <p className="mt-[0.2em] line-clamp-2 w-[86%] break-words text-[2.5em] leading-tight font-bold">{f.course}</p>
        <Score score={f.score} />
      </div>

      <Tagline className="absolute top-[7.5%] left-[67%]" />

      <DateIssued issued={f.issued} className="absolute bottom-[9%] left-[7%] w-[20%]" />
      <Signature trainer={f.trainer} className="absolute bottom-[6.5%] left-[36%] w-[18%]" />

      <div className="absolute top-[25%] bottom-[11%] left-[63%] w-px bg-zinc-300" />
      <div className="absolute top-[43%] left-[67%] w-[21%]">
        <Qr src={qr} id={f.certificateId} className="w-[10.5em]" />
        <p className="mt-[1.2em] text-[1.25em] leading-snug text-zinc-600">
          Scan to verify
          <br />
          this certificate
        </p>
        <span className="mt-[2.2em] block h-[0.16em] w-[3.2em]" style={{ background: RED }} />
        <CertificateIdBlock id={f.certificateId} className="mt-[2.2em]" />
      </div>
    </Frame>
  )
}

/* ----------------------------- 2 · Pattern border ---------------------------- */

/** One repeat of the left border motif, shaded with the same bright / mid / deep gradients as the tiles. */
function StripMotif({ y, gid }: { y: number; gid: string }) {
  const bright = `url(#strip-b-${gid})`
  const mid = `url(#strip-m-${gid})`
  const deep = `url(#strip-d-${gid})`
  return (
    <g transform={`translate(0 ${y})`}>
      <path d="M0 0 L20 14 L0 28 Z" fill={bright} />
      <path d="M20 0 L20 28 L6 14 Z" fill={deep} />
      <circle cx="10" cy="40" r="10" fill={mid} />
      {[54, 58, 62, 66].map((sy) => (
        <rect key={sy} x="0" y={sy} width="20" height="2.2" fill={bright} />
      ))}
      <path d="M0 72 L20 72 L10 86 Z" fill={mid} />
      <path d="M0 86 L10 72 L0 72 Z M20 86 L10 72 L20 72 Z" fill={deep} opacity="0.75" />
      <path d="M0 90 L20 104 L0 104 Z" fill={bright} />
    </g>
  )
}

function Border({ f, qr, gid }: { f: CertificateFields; qr: string; gid: string }) {
  return (
    <Frame aspect="aspect-[1.414]">
      <svg viewBox="0 0 20 740" preserveAspectRatio="xMidYMin slice" className="absolute inset-y-0 left-0 h-full w-[3.8%]" aria-hidden>
        <defs>
          <linearGradient id={`strip-b-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e05a59" />
            <stop offset="1" stopColor="#c23736" />
          </linearGradient>
          <linearGradient id={`strip-m-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d03c3b" />
            <stop offset="1" stopColor="#962b2a" />
          </linearGradient>
          <linearGradient id={`strip-d-${gid}`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b73332" />
            <stop offset="1" stopColor="#6b1f1e" />
          </linearGradient>
        </defs>
        {Array.from({ length: 8 }, (_, i) => (
          <StripMotif key={i} y={i * 104 - 20} gid={gid} />
        ))}
      </svg>
      <img src="/M-PESA Pattern.svg" alt="" aria-hidden className="pointer-events-none absolute -right-[16%] -bottom-[34%] w-[56%] opacity-[0.07] select-none" />
      <svg viewBox="0 0 141.4 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id={`curve-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={RED} />
            <stop offset="1" stopColor="#962b2a" />
          </linearGradient>
        </defs>
        <path d="M141.4 70 C136 84 126 94 113 100 L141.4 100 Z" fill={RED} opacity="0.16" />
        <path d="M141.4 76 C137 88 129 96 119 100 L141.4 100 Z" fill={`url(#curve-${gid})`} />
      </svg>
      <img src="/M-PESA Pattern.svg" alt="" aria-hidden className="pointer-events-none absolute -top-[27%] -right-[16%] w-[35%] select-none" />

      <img src="/M-PESA-red-logo.svg" alt="M-PESA" className="absolute top-[7.5%] left-[11%] h-[5.4em] w-auto" />
      <Tagline className="absolute top-[7.5%] left-[63%]" />

      <div className="absolute top-[22.5%] left-[11%] w-[56%]">
        <span className="block h-[0.3em] w-[4.4em]" style={{ background: RED }} />
        <h1 className="mt-[1.1em] leading-[0.95]">
          <span className="block text-[4.7em] font-extrabold tracking-[0.01em] uppercase">Certificate</span>
          <span className="mt-[0.1em] block text-[3.9em] font-light tracking-[0.02em] uppercase">of Completion</span>
        </h1>
        <p className="mt-[1.5em] text-[1.7em] text-zinc-600">This certifies that</p>
        <p className="mt-[0.1em] truncate text-[3.9em] leading-tight font-extrabold tracking-[-0.01em]" style={{ color: RED }}>
          {f.name}
        </p>
        <span className="mt-[0.9em] block h-px w-[95%]" style={{ background: `${RED}66` }} />
        <p className="mt-[1.1em] text-[1.7em] text-zinc-600">has successfully completed the training</p>
        <p className="mt-[0.25em] line-clamp-2 w-[86%] break-words text-[2.5em] leading-tight font-extrabold tracking-[-0.01em]">{f.course}</p>
        <Score score={f.score} />
      </div>

      <DateIssued issued={f.issued} className="absolute bottom-[9%] left-[11%] w-[20%]" />
      <Signature trainer={f.trainer} className="absolute bottom-[6.5%] left-[38%] w-[17.5%]" />


      {/* Verify column: QR, caption, then the certificate ID, stacked like design 1. */}
      <div className="absolute bottom-[7%] left-[63%] w-[19%]">
        <Qr src={qr} id={f.certificateId} className="w-[9.5em] shadow-[0_0.3em_1em_rgba(0,0,0,0.06)]" />
        <p className="mt-[1em] text-[1.2em] leading-snug text-zinc-600">
          Scan to verify
          <br />
          this certificate
        </p>
        <span className="mt-[1.4em] block h-[0.16em] w-[3.2em]" style={{ background: RED }} />
        <CertificateIdBlock id={f.certificateId} className="mt-[1.4em]" />
      </div>
    </Frame>
  )
}

/* ---------------------------- 3 · Brighter future ---------------------------- */

/**
 * Red tiles down the right edge, laid out on a strict grid: 11 equal rows separated by the
 * same white gap, and every shape spans the full column width so both edges stay straight.
 * Shapes are drawn in a 60 x 72 cell; the column box is 60 x 840 (5.4% of the width, full height).
 */
const CELL = 72
const GAP = (840 - 11 * CELL) / 10
// Four single-piece shapes repeated in order, so the column reads as a deliberate rhythm.
const MOTIFS = [
  'M60 0 V72 H0 Z', // diagonal triangle
  'M0 72 V26 Q0 0 26 0 H60 V46 Q60 72 34 72 Z', // rounded leaf
  'M60 0 V72 L10 40 Q4 36 10 32 Z', // chevron pointing left
  'M0 72 A60 60 0 0 1 60 12 V72 Z', // quarter circle
]
const SHADES = ['bright', 'deep', 'mid'] as const
// Background shade behind each shape, chosen for contrast.
const BACKDROP = { bright: 'deep', deep: 'bright', mid: 'deep' } as const
const TILE_SHAPES: { d: string; shade: (typeof SHADES)[number] }[] = Array.from({ length: 11 }, (_, i) => ({ d: MOTIFS[i % 4], shade: SHADES[i % 3] }))

function TileColumn({ gid }: { gid: string }) {
  const fill = { bright: `url(#tile-b-${gid})`, mid: `url(#tile-m-${gid})`, deep: `url(#tile-d-${gid})` }
  return (
    <svg viewBox="0 0 60 840" preserveAspectRatio="none" className="absolute inset-y-0 right-0 h-full w-[5.4%]" aria-hidden>
      <defs>
        <linearGradient id={`tile-b-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e05a59" />
          <stop offset="1" stopColor="#c23736" />
        </linearGradient>
        <linearGradient id={`tile-m-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d03c3b" />
          <stop offset="1" stopColor="#962b2a" />
        </linearGradient>
        <linearGradient id={`tile-d-${gid}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b73332" />
          <stop offset="1" stopColor="#6b1f1e" />
        </linearGradient>
      </defs>
      {/* Each row is a solid two-tone block: a full background in one shade, the shape on top in another. */}
      {TILE_SHAPES.map((t, i) => (
        <g key={i} transform={`translate(0 ${i * (CELL + GAP)})`}>
          <rect width="60" height={CELL} fill={fill[BACKDROP[t.shade]]} />
          <path d={t.d} fill={fill[t.shade]} />
        </g>
      ))}
    </svg>
  )
}

function Tiles({ f, qr, gid }: { f: CertificateFields; qr: string; gid: string }) {
  return (
    <Frame aspect="aspect-[1.375]">
      {/* Large grey pattern behind the tiles */}
      <div className="absolute inset-y-0 right-[5.4%] left-0 overflow-hidden" aria-hidden>
        {/* Cropped at the tile column so it never shows between the tiles. */}
        <img src="/M-PESA Pattern.svg" alt="" className="pointer-events-none absolute top-1/2 right-[-30.75%] w-[61.5%] -translate-y-1/2 opacity-[0.07] grayscale select-none" />
      </div>
      {/* Bottom corner wedge, then the tile column on top */}
      <svg viewBox="0 0 137.5 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id={`wedge-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e05a59" />
            <stop offset="1" stopColor="#962b2a" />
          </linearGradient>
        </defs>
        <path d="M128.9 88.4 Q128.9 86.8 127.9 88.1 L120.4 98.6 Q119.6 100 121.2 100 H128.9 Z" fill={`url(#wedge-${gid})`} />
      </svg>
      <TileColumn gid={gid} />

      <img src="/M-PESA-red-logo.svg" alt="M-PESA" className="absolute top-[7.5%] left-[7.5%] h-[5.4em] w-auto" />
      <Tagline className="absolute top-[7.5%] left-[70%]" />

      <div className="absolute top-[24%] left-[7.5%] w-[62%]">
        <h1 className="text-[5.4em] leading-[1] font-extrabold tracking-[-0.02em]">
          <span className="block">Certificate of</span>
          <span className="block" style={{ color: RED }}>
            Completion
          </span>
        </h1>
        <span className="mt-[1.6em] block h-[0.28em] w-[5.4em]" style={{ background: RED }} />
        <p className="mt-[1.8em] text-[1.75em] text-zinc-700">This certifies that</p>
        <p className="mt-[0.1em] truncate text-[4.1em] leading-tight font-extrabold tracking-[-0.01em]">{f.name}</p>
        <p className="mt-[0.6em] text-[1.75em] text-zinc-700">has successfully completed the training</p>
        <p className="mt-[0.3em] line-clamp-2 w-[86%] break-words text-[2.5em] leading-tight font-bold">{f.course}</p>
        <Score score={f.score} />
      </div>

      <DateIssued issued={f.issued} className="absolute bottom-[8%] left-[7.5%] w-[20%]" />
      <Signature trainer={f.trainer} className="absolute bottom-[5.5%] left-[38%] w-[18%]" />

      {/* Verify column: QR, caption, then the certificate ID, same as the other designs. */}
      <div className="absolute bottom-[12%] left-[70%] w-[20%]">
        <Qr src={qr} id={f.certificateId} className="w-[9.5em] shadow-[0_0.3em_1em_rgba(0,0,0,0.06)]" />
        <p className="mt-[1em] text-[1.2em] leading-snug text-zinc-600">
          Scan to verify
          <br />
          this certificate
        </p>
        <span className="mt-[1.4em] block h-[0.16em] w-[3.2em]" style={{ background: RED }} />
        <CertificateIdBlock id={f.certificateId} className="mt-[1.4em]" />
      </div>
    </Frame>
  )
}

/** M-PESA certificate in one of three layouts, each with a verify QR code and the certificate ID. */
export function CertificateDesign({ fields, layout = 'border' }: { fields: CertificateFields; layout?: CertificateLayout }) {
  const gid = useId().replace(/:/g, '')
  const qr = useQr(fields.certificateId)
  if (layout === 'sweep') return <Sweep f={fields} qr={qr} gid={gid} />
  if (layout === 'tiles') return <Tiles f={fields} qr={qr} gid={gid} />
  return <Border f={fields} qr={qr} gid={gid} />
}
