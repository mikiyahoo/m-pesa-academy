/** Gold trophy with sparkles, for dark "progress" cards. */
export function TrophyIllustration({ className, burst = false }: { className?: string; burst?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id="tr-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f5b400" />
          <stop offset="1" stopColor="#c98a00" />
        </linearGradient>
      </defs>
      {burst ? (
        <g stroke="#f0283f" strokeWidth="3" strokeLinecap="round">
          <path d="M14 26l8 6" />
          <path d="M8 44h9" />
          <path d="M14 62l8-5" />
          <path d="M106 26l-8 6" />
          <path d="M112 44h-9" />
          <path d="M106 62l-8-5" />
        </g>
      ) : (
        <>
          <path d="M96 18l2.5 6 6 2.5-6 2.5L96 35l-2.5-6-6-2.5 6-2.5z" fill="#fff" opacity="0.9" />
          <path d="M22 30l1.5 3.5L27 35l-3.5 1.5L22 40l-1.5-3.5L17 35l3.5-1.5z" fill="#fff" opacity="0.6" />
          <circle cx="104" cy="58" r="2" fill="#f0283f" />
          <circle cx="16" cy="62" r="1.5" fill="#fff" opacity="0.5" />
        </>
      )}
      {/* Handles */}
      <path d="M36 32H24c0 18 8 26 18 28" fill="none" stroke="url(#tr-gold)" strokeWidth="6" strokeLinecap="round" />
      <path d="M84 32h12c0 18-8 26-18 28" fill="none" stroke="url(#tr-gold)" strokeWidth="6" strokeLinecap="round" />
      {/* Cup */}
      <path d="M34 22h52v18c0 18-12 30-26 30S34 58 34 40z" fill="url(#tr-gold)" />
      {burst ? (
        <path d="M60 30l3.5 7.2 7.9 1.1-5.7 5.6 1.4 7.9L60 48l-7.1 3.8 1.4-7.9-5.7-5.6 7.9-1.1z" fill="#fff" opacity="0.92" />
      ) : (
        <path d="M44 26v14c0 10 5 18 12 21" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      )}
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

/** Glossy red target with a dart and red rays, for the home intro card. */
export function DartTargetIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} aria-hidden>
      <defs>
        <radialGradient id="dt-red" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff5a5f" />
          <stop offset="0.55" stopColor="#e1262d" />
          <stop offset="1" stopColor="#a8101a" />
        </radialGradient>
        <radialGradient id="dt-white" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1dede" />
        </radialGradient>
        <linearGradient id="dt-shaft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4d55" />
          <stop offset="1" stopColor="#1f2126" />
        </linearGradient>
      </defs>
      {/* Rays */}
      <g stroke="#ef3b44" strokeWidth="3.5" strokeLinecap="round">
        <path d="M14 34l9 5" />
        <path d="M10 54h10" />
        <path d="M30 14l5 9" />
      </g>
      {/* Soft shadow */}
      <ellipse cx="72" cy="128" rx="34" ry="5" fill="#d03c3b" opacity="0.12" />
      {/* Rings */}
      <circle cx="72" cy="72" r="50" fill="url(#dt-red)" />
      <circle cx="72" cy="72" r="38" fill="url(#dt-white)" />
      <circle cx="72" cy="72" r="27" fill="url(#dt-red)" />
      <circle cx="72" cy="72" r="16" fill="url(#dt-white)" />
      <circle cx="72" cy="72" r="7" fill="url(#dt-red)" />
      {/* Gloss */}
      <path d="M38 50a40 40 0 0 1 30-24" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
      {/* Dart */}
      <path d="M72 72l40-40" stroke="url(#dt-shaft)" strokeWidth="5" strokeLinecap="round" />
      <path d="M72 72l7-2-5-5z" fill="#1f2126" />
      <path d="M106 38l6-20 6 6-6 6z" fill="#e1262d" />
      <path d="M106 38l20-6-6-6-6 6z" fill="#b5141d" />
    </svg>
  )
}
