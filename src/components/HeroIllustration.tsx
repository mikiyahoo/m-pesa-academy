/** Decorative "learning desk" illustration for training heroes, drawn in M-PESA colours. */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 300" className={className} aria-hidden>
      <defs>
        <linearGradient id="hi-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#52525b" />
          <stop offset="1" stopColor="#18181b" />
        </linearGradient>
        <linearGradient id="hi-blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1f2" />
          <stop offset="1" stopColor="#fde4e7" />
        </linearGradient>
      </defs>

      {/* Soft background blob */}
      <path d="M52 168C38 96 112 30 206 24c92-6 196 22 220 104 22 76-26 150-122 160-84 9-118-24-176-20-48 3-64-40-76-100Z" fill="url(#hi-blob)" />
      <ellipse cx="236" cy="262" rx="186" ry="11" fill="#000" opacity="0.07" />

      {/* Left stack: two dark-grey books with a pencil cup */}
      <rect x="66" y="222" width="156" height="34" rx="5" fill="#27272a" />
      <rect x="196" y="227" width="22" height="24" rx="2" fill="#f5f5f4" />
      <path d="M200 233h16M200 239h16M200 245h16" stroke="#d6d3d1" strokeWidth="1.5" />
      <rect x="76" y="192" width="140" height="30" rx="5" fill="#52525b" />
      <rect x="190" y="196" width="22" height="22" rx="2" fill="#fafaf9" />
      <path d="M194 202h14M194 208h14M194 214h14" stroke="#e7e5e4" strokeWidth="1.5" />
      <rect x="76" y="200" width="112" height="4" rx="2" fill="#fff" opacity="0.35" />

      <g transform="rotate(-7 112 120)">
        <rect x="104" y="96" width="7" height="62" rx="2" fill="#d03c3b" />
        <path d="M104 96l3.5-9 3.5 9z" fill="#3f3f46" />
      </g>
      <g transform="rotate(6 132 120)">
        <rect x="128" y="88" width="7" height="70" rx="2" fill="#52525b" />
        <path d="M128 88l3.5-9 3.5 9z" fill="#3f3f46" />
      </g>
      <g transform="rotate(14 146 130)">
        <rect x="142" y="104" width="6" height="54" rx="2" fill="#f5b400" />
      </g>
      <rect x="98" y="134" width="56" height="58" rx="8" fill="#27272a" />
      <rect x="98" y="134" width="56" height="10" rx="5" fill="#3f3f46" />

      {/* Right stack: red book under the laptop, with a plant */}
      <rect x="226" y="228" width="208" height="28" rx="5" fill="#d03c3b" />
      <rect x="408" y="232" width="22" height="20" rx="2" fill="#fafaf9" />
      <path d="M412 238h14M412 244h14" stroke="#e7e5e4" strokeWidth="1.5" />

      <g>
        <ellipse cx="396" cy="128" rx="11" ry="34" fill="#2a9a3a" transform="rotate(-28 396 128)" />
        <ellipse cx="420" cy="122" rx="10" ry="36" fill="#39b54a" transform="rotate(18 420 122)" />
        <ellipse cx="408" cy="112" rx="10" ry="40" fill="#1f7a2d" />
        <ellipse cx="430" cy="148" rx="8" ry="24" fill="#2a9a3a" transform="rotate(48 430 148)" />
        <path d="M388 172h42l-5 56h-32z" fill="#f0283f" />
        <path d="M409 172h21l-5 56h-16z" fill="#c10522" />
        <rect x="385" y="168" width="48" height="10" rx="3" fill="#b9041f" />
      </g>

      {/* Laptop */}
      <rect x="246" y="104" width="148" height="104" rx="9" fill="#18181b" />
      <rect x="254" y="112" width="132" height="88" rx="5" fill="url(#hi-screen)" />
      <path d="M254 176c40-12 80 16 132-6v25a5 5 0 0 1-5 5H259a5 5 0 0 1-5-5Z" fill="#fff" opacity="0.08" />
      <circle cx="320" cy="156" r="22" fill="#fff" opacity="0.18" />
      <path d="M313 143l22 13-22 13z" fill="#fff" />
      <path d="M232 208h176l-12 20H244Z" fill="#d4d4d8" />
      <path d="M232 208h176v4H232z" fill="#a1a1aa" />
      <rect x="300" y="214" width="40" height="5" rx="2.5" fill="#a1a1aa" />
    </svg>
  )
}
