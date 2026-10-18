import { useEffect, useState, type ReactNode } from 'react'
import { loadAdminData } from '../../admin/storage'
import { accessBlock, missingProfile } from '../../admin/temporary'
import { useAuth } from '../../store/Auth'
import { ProfileSetup } from './ProfileSetup'

/**
 * For temporary trainees: signs them out once access is revoked or expired (TA-1.4, TE-1.4),
 * and asks for missing profile details before anything else (TE-1.1).
 */
export function TemporaryGate({ children }: { children: ReactNode }) {
  const { personId, logout } = useAuth()
  const [version, setVersion] = useState(0)
  const person = personId ? loadAdminData().people.find((p) => p.id === personId) : undefined
  const blocked = personId ? (person ? accessBlock(person) : 'Your account no longer exists.') : null

  useEffect(() => {
    if (blocked) logout(blocked)
  }, [blocked, logout])

  // Re-check when the tab regains focus, e.g. after an admin revokes access in another tab.
  useEffect(() => {
    const onFocus = () => setVersion((v) => v + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!personId) return <>{children}</>
  if (blocked || !person) return null
  if (missingProfile(person).length) return <ProfileSetup key={version} person={person} onDone={() => setVersion((v) => v + 1)} />
  return <>{children}</>
}
