import { ArrowLeft, Loader2, ClipboardPaste, MessageSquareText, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../store/Auth'
import { AuthShell } from './AuthShell'

const LENGTH = 6
const RESEND_SECONDS = 30

const maskPhone = (p: string) => `${p.slice(0, 2)}******${p.slice(-2)}`

export function Otp() {
  const { pending, verifyOtp, resendOtp, cancelOtp } = useAuth()
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [showSms, setShowSms] = useState(true)
  const [resent, setResent] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Re-show the fake SMS whenever a new code is issued.
  useEffect(() => {
    setShowSms(true)
  }, [pending?.code])

  const submit = (code: string) => {
    setLoading(true)
    setError(null)
    setTimeout(() => {
      const err = verifyOtp(code)
      setLoading(false)
      if (err) {
        setError(err)
        setDigits(Array(LENGTH).fill(''))
        // Wait for the inputs to re-enable before focusing.
        setTimeout(() => inputs.current[0]?.focus())
      }
    }, 600)
  }

  // Accepts one digit, or several at once (e.g. SMS autofill drops the whole code into one box).
  const setAt = (i: number, raw: string) => {
    const value = raw.replace(/\D/g, '')
    const next = [...digits]
    if (value.length <= 1) next[i] = value
    else [...value.slice(0, LENGTH - i)].forEach((d, k) => (next[i + k] = d))
    setDigits(next)
    const last = Math.min(i + Math.max(value.length, 1), LENGTH - 1)
    if (value) inputs.current[value.length > 1 ? last : Math.min(i + 1, LENGTH - 1)]?.focus()
    if (next.every(Boolean)) submit(next.join(''))
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs.current[i + 1]?.focus()
  }

  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!text) return
    e.preventDefault()
    const next = Array.from({ length: LENGTH }, (_, i) => text[i] ?? '')
    setDigits(next)
    inputs.current[Math.min(text.length, LENGTH - 1)]?.focus()
    if (next.every(Boolean)) submit(next.join(''))
  }

  return (
    <AuthShell>
      {pending && showSms && (
        <div className="fixed top-4 right-4 left-4 z-50 mx-auto max-w-sm animate-[slidein_.35s_ease-out] rounded-2xl bg-zinc-900/95 p-4 text-white shadow-2xl sm:left-auto">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mpesa-500">
              <MessageSquareText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex justify-between text-xs text-white/60">
                <span className="font-medium text-white">M-PESA</span> now
              </p>
              <p className="mt-0.5 text-sm">
                Your M-PESA Academy verification code is <b className="tracking-widest">{pending.code}</b>. It expires in 5 minutes.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-white/50">Demo only — no real SMS is sent.</p>
                {/* Like a phone's "fill code from Messages": drops the code into the boxes and signs in. */}
                <button
                  type="button"
                  onClick={() => {
                    const code = pending.code.slice(0, LENGTH)
                    setDigits(Array.from({ length: LENGTH }, (_, i) => code[i] ?? ''))
                    setShowSms(false)
                    submit(code)
                  }}
                  disabled={loading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60"
                >
                  <ClipboardPaste className="size-3.5" /> Insert code
                </button>
              </div>
            </div>
            <button onClick={() => setShowSms(false)} className="text-xs text-white/60 hover:text-white">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <button onClick={cancelOtp} className="mb-8 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="size-4" /> Back to sign in
      </button>

      <span className="grid size-12 place-items-center rounded-xl bg-mpesa-500/10 text-mpesa-600">
        <ShieldCheck className="size-6" />
      </span>
      <h2 className="mt-5 text-2xl font-bold tracking-tight">Verify it’s you</h2>
      <p className="mt-1 text-sm text-zinc-500">
        We sent a 6-digit code to <span className="font-medium text-zinc-800">{maskPhone(pending?.phone ?? '')}</span>. Enter it below to continue.
      </p>

      <div className="mt-8 flex justify-between gap-2" onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el
            }}
            autoFocus={i === 0}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            value={d}
            disabled={loading}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => setAt(i, e.target.value.length === 2 && digits[i] ? e.target.value.replace(digits[i], '') : e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className={cn(
              'size-12 rounded-xl border text-center text-lg font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:size-13',
              error ? 'border-brand-500' : 'border-zinc-200',
            )}
          />
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">{error}</p>
      ) : (
        resent && <p className="mt-4 rounded-xl bg-mpesa-500/10 px-3 py-2 text-sm text-mpesa-700">A new code has been sent. Previous codes no longer work.</p>
      )}

      <button
        onClick={() => submit(digits.join(''))}
        disabled={loading || digits.some((d) => !d)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Verify & continue
      </button>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Didn’t get the code?{' '}
        {cooldown > 0 ? (
          <span>Resend in 0:{String(cooldown).padStart(2, '0')}</span>
        ) : (
          <button
            onClick={() => {
              resendOtp()
              setCooldown(RESEND_SECONDS)
              setError(null)
              setResent(true)
              setDigits(Array(LENGTH).fill(''))
              inputs.current[0]?.focus()
            }}
            className="font-medium text-brand-600 hover:underline"
          >
            Resend code
          </button>
        )}
      </p>
    </AuthShell>
  )
}
