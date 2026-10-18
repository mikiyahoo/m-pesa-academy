import { createContext, useContext } from 'react'

/**
 * Who is using the admin screens. Admins see everything; a trainer (D04, S10) sees only the
 * sessions they conduct, and can edit only content they own or are tagged on (C02).
 */
export type Scope = { role: 'admin' | 'trainer'; trainerId?: string }

export const ScopeContext = createContext<Scope>({ role: 'admin' })

export const useScope = () => useContext(ScopeContext)
