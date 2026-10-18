import { useEffect, useState } from 'react'

const SEEN_KEY = 'mpesa-learning:intro-seen'
const DURATION = 4000

function seenThisSession() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 4-second opener: the logo tile pops in, the book's pages open, the star spins in with sparkles,
 * then the wordmark rises and everything fades out. Once per browser session; skipped for
 * people who prefer reduced motion.
 */
export function SplashIntro() {
  const [show, setShow] = useState(() => !seenThisSession() && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // The intro may simply play again next time.
    }
    const t = window.setTimeout(() => setShow(false), DURATION)
    return () => window.clearTimeout(t)
  }, [show])

  if (!show) return null
  return (
    <div
      aria-hidden
      onClick={() => setShow(false)}
      className="splash fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-gradient-to-br from-brand-600 via-[#8e2118] to-[#5e1914]"
    >
      {/* Centred on the right edge so half the pattern sits off-screen. */}
      <div className="pointer-events-none absolute top-1/2 right-0 aspect-square h-[160%] translate-x-1/2 -translate-y-1/2">
        <img src="/M-PESA Pattern.svg" alt="" className="splash-pattern size-full opacity-10" />
      </div>
      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 32 32" className="splash-tile relative size-28 drop-shadow-2xl sm:size-32">
          <rect width="32" height="32" rx="8" ry="8" fill="#fff" />
          {/* back page */}
          <path className="splash-back" fill="#7f1216" d="M11.6,24c-2.4-2.1-5.6-3-8.8-3.6h0c2.4-.6,4.8-1.7,6.7-3.2,1,0,3.7,1.3,3.4,1.9-1.1,2.5-1.1,3.4-1.3,4.9Z" />
          {/* front page */}
          <path className="splash-front" fill="#d03c3b" d="M28.5,12.8l-4.6,8.6c-4.2-.7-8.5.8-12.2,2.6.6-2,1.2-4.2,2.6-5.8,3.8-4.2,8.8-6.8,14.2-5.5Z" />
          {/* star */}
          <path className="splash-star" fill="#ddb614" d="M13.9,6.9c.6,2.4,2.6,4.3,5,4.9-2.5.5-4.4,2.7-5.1,5.1-.6-2.4-2.5-4.5-5-5.1,2.5-.5,4.3-2.6,5.1-4.9Z" />
          {/* sparkles */}
          <circle className="splash-spark splash-spark-1" cx="20.5" cy="7" r="0.7" fill="#ddb614" />
          <circle className="splash-spark splash-spark-2" cx="8" cy="8.5" r="0.5" fill="#ddb614" />
          <circle className="splash-spark splash-spark-3" cx="19" cy="15.5" r="0.45" fill="#ddb614" />
        </svg>
        <p className="splash-word mt-6 text-center leading-none font-bold tracking-tight text-white">
          <span className="block text-3xl sm:text-4xl">M-PESA</span>
          <span className="mt-1 block text-lg font-semibold text-white/85 sm:text-xl">Academy</span>
        </p>
      </div>
    </div>
  )
}
