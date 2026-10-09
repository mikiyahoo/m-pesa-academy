import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { adminUser, currentUser, DEMO_PASSWORD } from '../data/trainings'
import type { User } from '../types'

const STORAGE_KEY = 'mpesa-learning:auth:v1'

type Stage = 'signedOut' | 'otp' | 'signedIn'
export type Role = 'learner' | 'admin'

const accounts: { role: Role; user: User }[] = [
  { role: 'learner', user: currentUser },
  { role: 'admin', user: adminUser },
]

type PendingOtp = { role: Role; phone: string; code: string; expiresAt: number }

type Auth = {
  stage: Stage
  role: Role
  user: User
  pending: PendingOtp | null
  login: (email: string, password: string) => string | null
  resendOtp: () => void
  verifyOtp: (code: string) => string | null
  cancelOtp: () => void
  logout: () => void
}

const AuthContext = createContext<Auth | null>(null)

const OTP_TTL_MS = 5 * 60 * 1000

const newCode = () => String(Math.floor(100000 + Math.random() * 900000))

function loadRole(): Role | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)
    return v === 'learner' || v === 'admin' ? v : null
  } catch {
    return null
  }
}

function saveRole(role: Role | null) {
  try {
    if (role) sessionStorage.setItem(STORAGE_KEY, role)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Session persistence is best-effort.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(loadRole)
  const [pending, setPending] = useState<PendingOtp | null>(null)
  const stage: Stage = role ? 'signedIn' : pending ? 'otp' : 'signedOut'

  const signIn = (r: Role | null) => {
    saveRole(r)
    setRole(r)
  }

  const auth = useMemo<Auth>(
    () => ({
      stage,
      role: role ?? pending?.role ?? 'learner',
      user: accounts.find((a) => a.role === (role ?? pending?.role))?.user ?? currentUser,
      pending,
      login: (email, password) => {
        const id = email.trim().toLowerCase()
        const account = accounts.find((a) => a.user.email === id || a.user.phone === id)
        if (!account) return 'No account found for that email or phone number.'
        if (password !== DEMO_PASSWORD) return 'Incorrect password. Please try again.'
        setPending({ role: account.role, phone: account.user.phone, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS })
        return null
      },
      resendOtp: () => setPending((p) => p && { ...p, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS }),
      verifyOtp: (code) => {
        if (!pending) return 'Your session expired. Please sign in again.'
        if (Date.now() > pending.expiresAt) return 'This code has expired. Request a new one.'
        if (code !== pending.code) return 'Invalid code. Please check and try again.'
        signIn(pending.role)
        setPending(null)
        return null
      },
      cancelOtp: () => setPending(null),
      logout: () => {
        setPending(null)
        signIn(null)
      },
    }),
    [stage, role, pending],
  )

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
