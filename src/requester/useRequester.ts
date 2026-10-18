import { useEffect } from 'react'
import { isDraftExpired } from '../admin/requests'
import { useAdmin } from '../admin/store'
import { useAuth } from '../store/Auth'

/** The signed-in requester's person record, their requests, and the shared admin store. */
export function useRequester() {
  const { user } = useAuth()
  const admin = useAdmin()
  const { data, update } = admin
  const me = data.people.find((p) => p.email.toLowerCase() === user.email.toLowerCase())
  const mine = data.requests.filter((r) => r.requesterId === me?.id)

  // RQ-1.2: drafts are discarded once their 24 hours are up.
  const expired = mine.filter((r) => isDraftExpired(r)).map((r) => r.id)
  const expiredKey = expired.join(',')
  useEffect(() => {
    if (!expiredKey) return
    const ids = new Set(expiredKey.split(','))
    update((d) => ({ ...d, requests: d.requests.filter((r) => !ids.has(r.id)) }))
  }, [expiredKey, update])

  return { ...admin, me, team: me?.department ?? '', mine: mine.filter((r) => !expired.includes(r.id)) }
}
