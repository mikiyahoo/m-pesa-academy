import { ArrowLeft, ArrowRight, Delete, Loader2, MessageSquareText, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { COURSES, TRAINERS } from './data'
import { useLite } from './store'
import { Avatar, cn } from './ui'

const LEN = 6
/** 9 digits after +251, starting with 9 (Safaricom/Ethio) or 7. A leading 0 is dropped. */
const clean = (v: string) => v.replace(/\D/g, '').replace(/^251/, '').replace(/^0/, '').slice(0, 9)
const pretty = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ')
const valid = (d: string) => /^[79]\d{8}$/.test(d)
const newCode = () => String(Math.floor(100000 + Math.random() * 900000))

/**
 * Phone sign-in for the demo: enter a number, a fake SMS arrives a moment later and the code fills
 * itself in (like a phone reading the SMS), then you're signed in. Typing the code by hand works too.
 */
export function Login() {
  const { set } = useLite()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [digits, setDigits] = useState('')
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState(false)
  const [sms, setSms] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(false)
  const [wait, setWait] = useState(0)
  const timers = useRef<number[]>([])

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  // Resend countdown.
  useEffect(() => {
    if (wait <= 0) return
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  /** Fill the code digit by digit, the way a phone pastes it from the SMS. */
  const autofill = (c: string) => {
    setSms(false)
    setAutoFilled(true)
    setError(false)
    c.split('').forEach((_, i) => later(() => setTyped(c.slice(0, i + 1)), 90 * (i + 1)))
  }

  const sendCode = () => {
    clearTimers()
    const c = newCode()
    setCode(c)
    setTyped('')
    setAutoFilled(false)
    setError(false)
    setSms(false)
    setSending(true)
    setStep('otp')
    setWait(30)
    later(() => (setSending(false), setSms(true)), 1200)
    later(() => autofill(c), 2600)
    later(() => setSms(false), 6500)
  }

  // A full code is checked straight away.
  useEffect(() => {
    if (step !== 'otp' || typed.length < LEN) return
    if (typed !== code) {
      setError(true)
      const t = window.setTimeout(() => setTyped(''), 450)
      return () => clearTimeout(t)
    }
    setVerifying(true)
    const t = window.setTimeout(() => set((x) => ({ ...x, phone: `+251 ${pretty(digits)}` })), 900)
    return () => clearTimeout(t)
  }, [typed, code, step, digits, set])

  return (
    <div className="relative flex size-full flex-col overflow-hidden bg-white text-zinc-900">
      {/* The fake SMS notification; tap it to fill the code now. */}
      {sms && (
        <button
          type="button"
          onClick={() => autofill(code)}
          className="animate-sms absolute inset-x-2 top-2 z-50 flex items-start gap-3 rounded-2xl bg-zinc-900/95 p-3 text-left text-white shadow-2xl backdrop-blur"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mpesa-500">
            <MessageSquareText className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between text-[11px] text-white/60">
              <span>Messages</span>
              <span>now</span>
            </span>
            <span className="block text-sm font-semibold">M-PESA Academy</span>
            <span className="block text-[13px] leading-snug text-white/85">
              {code} is your Academy Lite code. Don’t share it with anyone.
            </span>
          </span>
        </button>
      )}

      {step === 'phone' ? (
        <div className="animate-fade flex min-h-0 flex-1 flex-col px-6 pt-10 pb-6">
          <img src="/M-PESA-red-logo.svg" alt="M-PESA" className="h-7 w-fit" />
          <div className="mt-10 flex -space-x-3">
            {TRAINERS.slice(0, 5).map((t) => (
              <Avatar key={t.id} src={t.avatar} name={t.name} size={44} ring="ring-2 ring-white" />
            ))}
          </div>
          <h1 className="mt-5 text-[28px] leading-tight font-extrabold">
            Learn M-PESA
            <br />
            <span className="text-[#d03c3b]">a minute at a time</span>
          </h1>
          <p className="mt-2 text-[15px] text-zinc-500">
            Short videos, quick quizzes and real trainers. {COURSES.length} courses, free for agents and merchants.
          </p>

          <div className="mt-auto">
            <label htmlFor="lite-phone" className="text-sm font-semibold">
              Your phone number
            </label>
            <div className="mt-2 flex h-14 items-center gap-3 rounded-2xl border-2 border-zinc-200 px-4 focus-within:border-zinc-900">
              <span className="flex items-center gap-1.5 border-r border-zinc-200 pr-3 text-[15px] font-semibold">
                <span aria-hidden>🇪🇹</span> +251
              </span>
              <input
                id="lite-phone"
                value={pretty(digits)}
                onChange={(e) => setDigits(clean(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && valid(digits) && sendCode()}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="9xx xxx xxx"
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-wide outline-none placeholder:font-normal placeholder:text-zinc-300"
              />
            </div>
            <button
              type="button"
              disabled={!valid(digits)}
              onClick={sendCode}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#d03c3b] text-base font-bold text-white transition active:scale-[0.98] disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              Send code <ArrowRight className="size-5" />
            </button>
            <p className="mt-4 text-center text-xs text-zinc-400">
              We’ll text you a 6-digit code. Demo only: no real SMS is sent.
            </p>
          </div>
        </div>
      ) : (
        <div className="animate-fade flex min-h-0 flex-1 flex-col pt-4">
          <button
            type="button"
            onClick={() => (clearTimers(), setStep('phone'), setSms(false), setSending(false), setVerifying(false))}
            aria-label="Change number"
            className="ml-4 grid size-10 place-items-center rounded-full hover:bg-zinc-100"
          >
            <ArrowLeft className="size-5" />
          </button>

          {/* The code boxes sit in the middle of the space above the keypad. */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-[#d03c3b]/10 text-[#d03c3b]">
              <MessageSquareText className="size-7" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">Enter the code</h1>
            <p className="mt-1 text-[15px] text-zinc-500">
              Sent by SMS to <span className="font-semibold text-zinc-900">+251 {pretty(digits)}</span>
            </p>
            <div role="group" aria-label={`Code, ${typed.length} of ${LEN} digits`} className={cn('mt-7 flex w-full max-w-xs justify-between gap-2', error && 'animate-shake')}>
              {Array.from({ length: LEN }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'grid h-14 flex-1 place-items-center rounded-xl border-2 text-2xl font-bold transition',
                    error ? 'border-[#d03c3b] text-[#d03c3b]' : verifying ? 'border-mpesa-500 bg-mpesa-50 text-mpesa-700' : typed[i] ? 'border-zinc-900' : i === typed.length ? 'border-zinc-400' : 'border-zinc-200',
                  )}
                >
                  {typed[i] ?? ''}
                </span>
              ))}
            </div>
            <div className="mt-4 flex min-h-6 justify-center text-sm">
              {sending ? (
                <span className="flex items-center gap-2 text-zinc-500">
                  <Loader2 className="size-4 animate-spin" /> Sending code…
                </span>
              ) : verifying ? (
                <span className="flex items-center gap-2 font-semibold text-mpesa-600">
                  <Loader2 className="size-4 animate-spin" /> Signing you in…
                </span>
              ) : error ? (
                <span className="font-semibold text-[#d03c3b]">That code isn’t right. Try again.</span>
              ) : autoFilled ? (
                <span className="flex items-center gap-2 font-semibold text-mpesa-600">
                  <ShieldCheck className="size-4" /> Code filled in from your SMS
                </span>
              ) : (
                <span className="text-zinc-500">Waiting for the SMS…</span>
              )}
            </div>
            <div className="mt-3 text-sm">
              {wait > 0 ? (
                <span className="text-zinc-400">Resend code in 0:{String(wait).padStart(2, '0')}</span>
              ) : (
                <button type="button" onClick={sendCode} className="font-semibold text-[#d03c3b]">
                  Resend code
                </button>
              )}
            </div>
          </div>

          <Keypad
            disabled={verifying}
            onKey={(k) => {
              setError(false)
              setTyped((t) => (k === 'del' ? t.slice(0, -1) : (t + k).slice(0, LEN)))
            }}
          />
        </div>
      )}
    </div>
  )
}

/** The number pad for the code, like the phone's own dial pad. */
function Keypad({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
  const letters: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' }
  return (
    <div className="grid shrink-0 grid-cols-3 gap-1.5 bg-zinc-100 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onKey(k)}
            aria-label={k === 'del' ? 'Delete' : k}
            className={cn(
              'flex h-13 flex-col items-center justify-center rounded-xl text-zinc-900 transition select-none active:scale-95 disabled:opacity-50',
              k === 'del' ? 'active:bg-zinc-200' : 'bg-white shadow-[0_1px_0_rgba(0,0,0,0.08)] active:bg-zinc-200',
            )}
          >
            {k === 'del' ? (
              <Delete className="size-6" />
            ) : (
              <>
                <span className="text-2xl leading-none font-medium">{k}</span>
                {letters[k] && <span className="mt-0.5 text-[9px] font-semibold tracking-widest text-zinc-500">{letters[k]}</span>}
              </>
            )}
          </button>
        ),
      )}
    </div>
  )
}
