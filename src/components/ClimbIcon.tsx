/** Person climbing steps towards a flag — "keep progressing". Uses currentColor; the goal step and flag are lighter. */
export function ClimbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden>
      {/* Steps */}
      <rect x="5" y="36" width="8" height="5" rx="1.5" />
      <rect x="15" y="30" width="8" height="11" rx="1.5" />
      <rect x="25" y="25" width="8" height="16" rx="1.5" />
      <rect x="35" y="20" width="8" height="21" rx="1.5" opacity="0.6" />
      {/* Ground */}
      <rect x="3" y="43" width="42" height="2.5" rx="1.25" />
      {/* Flag */}
      <rect x="40.2" y="5" width="1.8" height="15" rx="0.9" opacity="0.6" />
      <path d="M42 5.5h-6.5l2 3-2 3H42z" opacity="0.6" />
      {/* Climber */}
      <circle cx="13" cy="9" r="3.4" />
      <path d="M10.6 13.6c1.1-.8 2.6-.9 3.8-.2l1.2.7 4.6 1.2a1.6 1.6 0 1 1-.8 3.1l-3.3-.9-.9 4.6 3 2.6c.4.3.6.8.6 1.3v5.4a1.7 1.7 0 0 1-3.4 0v-4.6l-3.4-2.8-2.6 5.5a1.7 1.7 0 0 1-3.1-1.4l3.3-7.2.6-3.6-1.6 1.6-.4 2.4a1.6 1.6 0 1 1-3.2-.5l.5-3c.1-.4.3-.7.5-.9z" />
    </svg>
  )
}
