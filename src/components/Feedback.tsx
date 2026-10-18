import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'

type ToastTone = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; tone: ToastTone; action?: { label: string; onClick: () => void } }
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean }

type FeedbackApi = {
  toast: (message: string, opts?: { tone?: ToastTone; action?: Toast['action'] }) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const Ctx = createContext<FeedbackApi | null>(null)

const toneIcon = { success: CheckCircle2, error: XCircle, info: Info }
const toneColor = { success: 'text-mpesa-500', error: 'text-brand-500', info: 'text-sky-400' }

function ConfirmDialog({ opts, onDone }: { opts: ConfirmOptions; onDone: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onDone(false)} />
      <div role="alertdialog" aria-modal aria-labelledby="confirm-title" className="relative w-full max-w-sm animate-[slidein_.18s_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
        <span className={cn('grid size-10 place-items-center rounded-full', opts.danger ? 'bg-brand-50 text-brand-600' : 'bg-zinc-100 text-zinc-600')}>
          <AlertTriangle className="size-5" />
        </span>
        <h2 id="confirm-title" className="mt-4 text-base font-bold text-zinc-900">
          {opts.title}
        </h2>
        {opts.message && <p className="mt-1 text-sm text-zinc-500">{opts.message}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => onDone(false)} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => onDone(true)}
            className={cn('rounded-xl px-4 py-2 text-sm font-semibold text-white transition', opts.danger ? 'bg-brand-600 hover:bg-brand-700' : 'bg-zinc-900 hover:bg-zinc-800')}
          >
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** App-wide toasts and confirm dialogs (replaces window.confirm / silent saves). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback<FeedbackApi['toast']>(
    (message, opts) => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-3), { id, message, tone: opts?.tone ?? 'success', action: opts?.action }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const confirm = useCallback<FeedbackApi['confirm']>((opts) => new Promise((resolve) => setPendingConfirm({ opts, resolve })), [])

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[70] flex flex-col items-center gap-2 sm:left-auto sm:items-end">
        {toasts.map((t) => {
          const Icon = toneIcon[t.tone]
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-[slidein_.25s_ease-out] items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-2xl">
              <Icon className={cn('size-5 shrink-0', toneColor[t.tone])} />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    dismiss(t.id)
                  }}
                  className="font-semibold text-white underline-offset-2 hover:underline"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="text-white/50 hover:text-white" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
      {pendingConfirm && (
        <ConfirmDialog
          opts={pendingConfirm.opts}
          onDone={(ok) => {
            pendingConfirm.resolve(ok)
            setPendingConfirm(null)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}
