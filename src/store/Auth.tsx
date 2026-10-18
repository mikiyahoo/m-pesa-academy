import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadAdminData, saveAdminData } from '../admin/storage'
import { accessBlock } from '../admin/temporary'
import { adminUser, currentUser, DEMO_PASSWORD, requesterUser, trainerUser } from '../data/trainings'
import { localISO } from '../lib/utils'
import type { User } from '../types'

const STORAGE_KEY = 'mpesa-learning:auth:v2'

type Stage = 'signedOut' | 'otp' | 'signedIn'
export type Role = 'learner' | 'admin' | 'requester' | 'trainer'

const accounts: { role: Role; user: User; personId?: string }[] = [
  { role: 'learner', user: currentUser },
  { role: 'admin', user: adminUser },
  { role: 'requester', user: requesterUser },
  { role: 'trainer', user: trainerUser, personId: 's3' },
]

/** A signed-in or signing-in identity. Temporary users carry their person id from the admin data. */
type Identity = { role: Role; user: User; personId?: string }
type PendingOtp = Identity & { phone: string; code: string; expiresAt: number }

type Auth = {
  stage: Stage
  role: Role
  user: User
  /** Set for temporary (invited) users; links the session to their person record. */
  personId?: string
  pending: PendingOtp | null
  login: (email: string, password: string) => string | null
  /** Starts sign-in from an invite link (TE-1.2). Returns an error message or null. */
  loginWithInvite: (token: string) => string | null
  resendOtp: () => void
  verifyOtp: (code: string) => string | null
  cancelOtp: () => void
  logout: (message?: string) => void
  /** Shown once on the sign-in page, e.g. after access expired mid-session. */
  notice: string | null
  updateUser: (user: User) => void
}

const AuthContext = createContext<Auth | null>(null)

const OTP_TTL_MS = 5 * 60 * 1000

const newCode = () => String(Math.floor(100000 + Math.random() * 900000))

function loadSession(): Identity | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Identity
    return s.role && s.user ? s : null
  } catch {
    return null
  }
}

function saveSession(s: Identity | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Session persistence is best-effort.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Identity | null>(loadSession)
  const [pending, setPending] = useState<PendingOtp | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const stage: Stage = session ? 'signedIn' : pending ? 'otp' : 'signedOut'

  const signIn = (s: Identity | null) => {
    saveSession(s)
    setSession(s)
  }

  const auth = useMemo<Auth>(
    () => ({
      stage,
      role: session?.role ?? pending?.role ?? 'learner',
      user: session?.user ?? pending?.user ?? currentUser,
      personId: session?.personId,
      pending,
      notice,
      login: (email, password) => {
        const id = email.trim().toLowerCase()
        const account = accounts.find((a) => a.user.email === id || a.user.phone === id)
        if (!account) return 'No account found for that email or phone number. Temporary trainees sign in with the link in their invite email.'
        if (password !== DEMO_PASSWORD) return 'Incorrect password. Please try again.'
        setNotice(null)
        setPending({ ...account, phone: account.user.phone, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS })
        return null
      },
      loginWithInvite: (token) => {
        const data = loadAdminData()
        const person = data.people.find((p) => p.inviteToken === token)
        if (!person) return 'This invite link isn’t valid. Check that you copied the whole link from your email.'
        const blocked = accessBlock(person)
        if (blocked) return blocked
        setNotice(null)
        setPending({
          role: 'learner',
          personId: person.id,
          user: { name: person.name, email: person.email, phone: person.phone, role: `Temporary trainee${person.organization ? ` · ${person.organization}` : ''}` },
          phone: person.phone,
          code: newCode(),
          expiresAt: Date.now() + OTP_TTL_MS,
        })
        return null
      },
      resendOtp: () => setPending((p) => p && { ...p, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS }),
      verifyOtp: (code) => {
        if (!pending) return 'Your session expired. Please sign in again.'
        if (Date.now() > pending.expiresAt) return 'This code has expired. Request a new one.'
        if (code !== pending.code) return 'Invalid code. Please check and try again.'
        if (pending.personId) {
          // Record acceptance and last sign-in on the person (shown on Temporary access).
          const data = loadAdminData()
          const at = localISO()
          saveAdminData({ ...data, people: data.people.map((p) => (p.id === pending.personId ? { ...p, acceptedAt: p.acceptedAt ?? at, lastSignInAt: at } : p)) })
        }
        signIn({ role: pending.role, user: pending.user, personId: pending.personId })
        setPending(null)
        return null
      },
      cancelOtp: () => setPending(null),
      logout: (message) => {
        setPending(null)
        setNotice(message ?? null)
        signIn(null)
      },
      updateUser: (user) => session && signIn({ ...session, user }),
    }),
    [stage, session, pending, notice],
  )

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
