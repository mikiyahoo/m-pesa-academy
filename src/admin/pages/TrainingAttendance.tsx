import { ArrowLeft, CalendarDays, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { longDate } from '../helpers'
import { trainerIdsOf } from '../scheduling'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import { AttendancePanel } from '../teams/AttendancePanel'
import { Empty, PageHeader } from '../ui'
import { CheckInPanel } from '../checkin/CheckInPanel'

/** Dedicated check-in and attendance workspace for one training session. */
export function AdminTrainingAttendance() {
  const { id = '' } = useParams()
  const { data } = useAdmin()
  const scope = useScope()
  const training = data.trainings.find((item) => item.id === id)

  if (!training || (scope.trainerId && !trainerIdsOf(training).includes(scope.trainerId))) {
    return <Empty icon={CalendarDays} title="Training not found" action={<Link to="/admin/trainings" className="text-sm font-semibold text-brand-600 hover:underline">Back to trainings</Link>} />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Check-in & attendance"
        description={training.name}
        meta={
          <>
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /> {longDate(training.date)}</span>
            <span className="flex items-center gap-1.5"><Users className="size-4" /> {training.participantIds.length} Participants</span>
          </>
        }
        actions={
          <Link to={`/admin/trainings/${training.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-surface px-4 py-2 text-sm font-semibold text-zinc-800 shadow-xs transition-all hover:border-zinc-300 hover:bg-zinc-50">
            <ArrowLeft className="size-4" /> Training details
          </Link>
        }
      />
      <CheckInPanel training={training} />
      <AttendancePanel training={training} />
    </div>
  )
}
