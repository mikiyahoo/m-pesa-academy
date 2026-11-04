import { approvedDetails, customPassword, originalEmail } from '../lib/profileRequests'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadAdminData, saveAdminData } from '../admin/storage'
import { accessBlock, isTemporary } from '../admin/temporary'
import type { Person } from '../admin/types'
import { createGuest, validateGuest, type GuestSignUp, type GuestSignUpErrors } from '../lib/publicAccess'
import { adminUser, currentUser, DEMO_PASSWORD, departmentAdminUser, requesterUser, trainerUser } from '../data/trainings'
import { localISO } from '../lib/utils'
import type { User } from '../types'

const STORAGE_KEY = 'mpesa-learning:auth:v2'
/**
 * Sign-in lives in sessionStorage (one per tab, so several roles can be open side by side).
 * A tab opened from a link starts empty, so the opening tab leaves a short-lived hand-off.
 */
const HANDOFF_KEY = 'mpesa-learning:auth-handoff'
const HANDOFF_MS = 15_000
const INTRO_SEEN_KEY = 'mpesa-learning:intro-seen'

type Stage = 'signedOut' | 'otp' | 'signedIn'
export type Role = 'learner' | 'admin' | 'department' | 'requester' | 'trainer'

const accounts: { role: Role; user: User; personId?: string }[] = [
  { role: 'learner', user: currentUser },
  { role: 'admin', user: adminUser },
  { role: 'requester', user: requesterUser },
  { role: 'trainer', user: trainerUser, personId: 's3' },
  { role: 'department', user: departmentAdminUser, personId: 'dept-admin-demo' },
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
  /** Passwordless sign-in for guests and external trainees: a code goes to their phone. */
  loginWithCode: (emailOrPhone: string) => string | null
  /** Creates a guest account (public trainings only) and sends a code to confirm the phone. */
  signUp: (form: GuestSignUp) => GuestSignUpErrors | null
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

/** Signing-in identity for an external person (invited trainee or self sign-up guest). */
const externalIdentity = (person: Person): Identity => ({
  role: 'learner',
  personId: person.id,
  user: {
    name: person.name,
    email: person.email,
    phone: person.phone,
    role: `${person.source === 'self-signup' ? 'Guest' : 'Temporary trainee'}${person.organization ? ` · ${person.organization}` : ''}`,
  },
})

function loadSession(): Identity | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Identity
      return s.role && s.user ? s : null
    }
    // A new tab opened from a link in a signed-in tab: take over that sign-in (and skip the intro).
    const handoff = localStorage.getItem(HANDOFF_KEY)
    if (!handoff) return null
    localStorage.removeItem(HANDOFF_KEY)
    const { s, at } = JSON.parse(handoff) as { s: Identity; at: number }
    if (!s?.role || !s.user || Date.now() - at > HANDOFF_MS) return null
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    return s
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

  // Opening an app link in a new tab (target=_blank, Ctrl/⌘-click or middle-click) hands the sign-in over.
  useEffect(() => {
    if (!session) return
    const onOpen = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.origin !== window.location.origin) return
      const newTab = a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1
      if (!newTab) return
      try {
        localStorage.setItem(HANDOFF_KEY, JSON.stringify({ s: session, at: Date.now() }))
      } catch {
        // Best-effort: the new tab asks to sign in instead.
      }
    }
    document.addEventListener('click', onOpen, true)
    document.addEventListener('auxclick', onOpen, true)
    return () => {
      document.removeEventListener('click', onOpen, true)
      document.removeEventListener('auxclick', onOpen, true)
    }
  }, [session])

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
        const id = originalEmail(email)
        // Anyone an admin has made a Department Admin can sign in with their work email (demo password).
        const deptPerson = loadAdminData().people.find((p) => p.role === 'Department Admin' && (p.email.toLowerCase() === id || p.phone === id))
        const account =
          accounts.find((a) => a.user.email === id || a.user.phone === id) ??
          (deptPerson
            ? { role: 'department' as Role, personId: deptPerson.id, user: { name: deptPerson.name, email: deptPerson.email, phone: deptPerson.phone, role: `Department Admin · ${deptPerson.department}` } }
            : undefined)
        if (!account) {
          const external = loadAdminData().people.some((p) => isTemporary(p) && (p.email.toLowerCase() === id || p.phone === id))
          return external
            ? 'Guests and external trainees don’t use a password. Choose “Sign in with a code” instead.'
            : 'No account found for that email or phone number. New here? Create a guest account to join public trainings.'
        }
        if (password !== (customPassword(account.user.email) ?? DEMO_PASSWORD)) return 'Incorrect password. Please try again.'
        // An admin can deactivate an account or give it an end date (validity period).
        const record = loadAdminData().people.find((p) => p.email.toLowerCase() === account.user.email.toLowerCase())
        if (record?.status === 'Inactive') return 'Your account is inactive. Contact the training team.'
        if (record?.accessEnd && record.accessEnd < localISO().slice(0, 10)) return 'Your access period has ended. Contact the training team to extend it.'
        setNotice(null)
        const approved = approvedDetails(account.user)
        setPending({ ...account, user: approved, phone: approved.phone, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS })
        return null
      },
      loginWithInvite: (token) => {
        const data = loadAdminData()
        const person = data.people.find((p) => p.inviteToken === token)
        if (!person) return 'This invite link isn’t valid. Check that you copied the whole link from your email.'
        const blocked = accessBlock(person)
        if (blocked) return blocked
        setNotice(null)
        setPending({ ...externalIdentity(person), phone: person.phone, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS })
        return null
      },
      loginWithCode: (emailOrPhone) => {
        const id = emailOrPhone.trim().toLowerCase().replace(/[\s-]/g, '')
        const person = loadAdminData().people.find((p) => isTemporary(p) && (p.email.toLowerCase() === id || p.phone === id))
        if (!person) {
          return accounts.some((a) => a.user.email === id || a.user.phone === id)
            ? 'Company staff sign in with their password.'
            : 'No guest account found for that email or phone. Create a guest account first.'
        }
        const blocked = accessBlock(person)
        if (blocked) return blocked
        setNotice(null)
        setPending({ ...externalIdentity(person), phone: person.phone, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS })
        return null
      },
      signUp: (form) => {
        const data = loadAdminData()
        const errors = validateGuest(form, data)
        if (Object.keys(errors).length) return errors
        const created = createGuest(data, form)
        saveAdminData(created.data)
        setNotice(null)
        setPending({ ...externalIdentity(created.person), phone: created.person.phone, code: newCode(), expiresAt: Date.now() + OTP_TTL_MS })
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
