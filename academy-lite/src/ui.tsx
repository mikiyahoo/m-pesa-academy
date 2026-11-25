import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export const cn = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/* ---------------------------------- toasts ---------------------------------- */

const ToastContext = createContext<(text: string) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), text })
    timer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.id} role="status" className="animate-pop pointer-events-none absolute top-16 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-center text-sm font-medium whitespace-nowrap text-white shadow-lg backdrop-blur">
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/* --------------------------------- avatars ---------------------------------- */

export function Avatar({ src, name, size = 40, ring, className }: { src?: string; name: string; size?: number; ring?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-200 font-semibold text-zinc-600', ring, className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} className="size-full object-cover" /> : initials}
    </span>
  )
}

/* ---------------------------------- sheets ---------------------------------- */

/** Bottom sheet that slides up over the current screen, like the comment and share panels people know. */
export function Sheet({ open, onClose, title, children, height = '72%', dark }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; height?: string; dark?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <button type="button" aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-black/40" />
      <div className={cn('animate-sheet absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl shadow-2xl', dark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900')} style={{ height }}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300/70" />
        {title && (
          <div className="relative flex shrink-0 items-center justify-center px-12 py-3">
            <h2 className="truncate text-sm font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className={cn('absolute right-3 grid size-8 place-items-center rounded-full', dark ? 'hover:bg-white/10' : 'hover:bg-zinc-100')}>
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}

/* -------------------------------- confetti ---------------------------------- */

const COLORS = ['#d03c3b', '#39b54a', '#f59e0b', '#3b82f6', '#ec4899', '#ffffff']
export function Confetti({ count = 26 }: { count?: number }) {
  const [bits] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      i,
      color: COLORS[i % COLORS.length],
      dx: `${(Math.random() - 0.5) * 320}px`,
      dy: `${-80 - Math.random() * 260}px`,
      delay: `${Math.random() * 0.15}s`,
      w: 6 + Math.random() * 6,
    })),
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b) => (
        <span key={b.i} className="animate-confetti absolute top-1/2 left-1/2 rounded-sm" style={{ background: b.color, width: b.w, height: b.w * 0.5, animationDelay: b.delay, ['--dx' as string]: b.dx, ['--dy' as string]: b.dy }} />
      ))}
    </div>
  )
}

export const timeLabel = (at: number) => {
  const d = new Date(at)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const y = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
