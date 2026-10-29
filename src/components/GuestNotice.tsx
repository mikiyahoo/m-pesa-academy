import { Globe2 } from 'lucide-react'
import { loadAdminData } from '../admin/storage'
import { daysLeft, isTemporary } from '../admin/temporary'
import { isGuest } from '../lib/publicAccess'
import { useAuth } from '../store/Auth'

/** Tells guests and external trainees why they see a shorter training list, and when access ends. */
export function GuestNotice() {
  const { personId } = useAuth()
  const person = personId ? loadAdminData().people.find((p) => p.id === personId) : undefined
  if (!person || !isTemporary(person)) return null
  const left = daysLeft(person)
  return (
    <p className="flex items-start gap-3 rounded-2xl bg-brand-50/70 px-4 py-3 text-sm text-brand-800 ring-1 ring-brand-100">
      <Globe2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <span>
        {isGuest(person) ? 'You’re using a guest account.' : 'You have external trainee access.'} You can see <b>public trainings</b> and the ones you’re invited to
        {left !== null && left >= 0 && (
          <>
            {' '}
            · access ends in <b>{left === 0 ? 'less than a day' : `${left} day${left === 1 ? '' : 's'}`}</b>
          </>
        )}
        .
      </span>
    </p>
  )
}
