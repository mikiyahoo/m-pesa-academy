/** Gold trophy with sparkles, for dark "progress" cards. */
export function TrophyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id="tr-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f5b400" />
          <stop offset="1" stopColor="#c98a00" />
        </linearGradient>
      </defs>
      <path d="M96 18l2.5 6 6 2.5-6 2.5L96 35l-2.5-6-6-2.5 6-2.5z" fill="#fff" opacity="0.9" />
      <path d="M22 30l1.5 3.5L27 35l-3.5 1.5L22 40l-1.5-3.5L17 35l3.5-1.5z" fill="#fff" opacity="0.6" />
      <circle cx="104" cy="58" r="2" fill="#f0283f" />
      <circle cx="16" cy="62" r="1.5" fill="#fff" opacity="0.5" />
      {/* Handles */}
      <path d="M36 32H24c0 18 8 26 18 28" fill="none" stroke="url(#tr-gold)" strokeWidth="6" strokeLinecap="round" />
      <path d="M84 32h12c0 18-8 26-18 28" fill="none" stroke="url(#tr-gold)" strokeWidth="6" strokeLinecap="round" />
      {/* Cup */}
      <path d="M34 22h52v18c0 18-12 30-26 30S34 58 34 40z" fill="url(#tr-gold)" />
      <path d="M44 26v14c0 10 5 18 12 21" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <path d="M54 70h12l3 16H51z" fill="#e0a100" />
      <rect x="40" y="86" width="40" height="10" rx="3" fill="url(#tr-gold)" />
      <rect x="34" y="96" width="52" height="12" rx="3" fill="#d03c3b" />
      <rect x="46" y="100" width="28" height="4" rx="2" fill="#fff" opacity="0.6" />
    </svg>
  )
}

/** Target with an arrow and leaves, for the motivational card. */
export function TargetIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 130" className={className} aria-hidden>
      <path d="M18 128c2-22 10-36 22-44" fill="none" stroke="#7fbf7f" strokeWidth="2" />
      <ellipse cx="26" cy="104" rx="5" ry="11" fill="#9fd29f" transform="rotate(-35 26 104)" />
      <ellipse cx="36" cy="92" rx="4" ry="9" fill="#7fbf7f" transform="rotate(30 36 92)" />
      <ellipse cx="22" cy="118" rx="4" ry="9" fill="#b5ddb5" transform="rotate(-60 22 118)" />
      <circle cx="78" cy="66" r="46" fill="#fff" />
      <circle cx="78" cy="66" r="46" fill="none" stroke="#d03c3b" strokeWidth="10" />
      <circle cx="78" cy="66" r="30" fill="none" stroke="#d03c3b" strokeWidth="9" />
      <circle cx="78" cy="66" r="13" fill="#d03c3b" />
      <path d="M78 66l42-40" stroke="#27272a" strokeWidth="4" strokeLinecap="round" />
      <path d="M118 20l12-2-6 10 10 0-12 10z" fill="#3f3f46" />
      <circle cx="78" cy="66" r="3" fill="#27272a" />
    </svg>
  )
}
