import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MapPin, UserRound, XCircle } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { JoinLink, RequestDetails, RequestStatusPill, RequestTimeline } from '../admin/RequestParts'
import { dateTime, longDate, time12 } from '../admin/helpers'
import { trainerIdsOf } from '../admin/scheduling'
import { cn } from '../lib/utils'
import { useRequester } from './useRequester'

export function RequestDetail() {
  const { id } = useParams()
  const { data, mine, team } = useRequester()
  const request = mine.find((r) => r.id === id)

  if (!request) return <Navigate to="/requests" replace />
  if (request.status === 'DRAFT') return <Navigate to={`/requests/${request.id}/edit`} replace />

  const trainers = trainerIdsOf(request).map((trainerId) => data.people.find((person) => person.id === trainerId)).filter((person): person is NonNullable<typeof person> => !!person)
  const training = data.trainings.find((t) => t.id === request.trainingId)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/requests" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="size-4" /> My requests
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">{request.topic}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {request.team} · submitted {request.submittedAt ? dateTime(request.submittedAt) : ''}
          </p>
        </div>
        <RequestStatusPill status={request.status} className="px-3 py-1 text-sm" />
      </header>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
        <RequestTimeline request={request} />
      </section>

      {request.status === 'PENDING' && (
        <section className="flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5">
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-bold text-zinc-900">Waiting for the training team</h2>
            <p className="mt-0.5 text-sm text-zinc-600">You’ll see the decision here and get an email as soon as your request is approved or rejected.</p>
          </div>
        </section>
      )}

      {request.status === 'REJECTED' && request.rejection && (
        <section className="flex gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <XCircle className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <div>
            <h2 className="font-bold text-zinc-900">Request rejected</h2>
            <p className="mt-1 text-sm font-medium text-brand-800">{request.rejection.reason}</p>
            {request.rejection.comment && <p className="mt-1 text-sm text-zinc-700">“{request.rejection.comment}”</p>}
            <Link to="/requests/new" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Submit a new request
            </Link>
          </div>
        </section>
      )}

      {request.status === 'APPROVED' && (
        <section className="space-y-4 rounded-2xl border border-mpesa-500/25 bg-white p-5 sm:p-6">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mpesa-600" />
            <div>
              <h2 className="font-bold text-zinc-900">Approved</h2>
              <p className="mt-0.5 text-sm text-zinc-600">
                {trainers.length ? <><span className="font-medium text-zinc-800">{trainers.map((trainer) => trainer.name).join(', ')}</span> will run this training.{' '}</> : null}
                {training ? 'It’s on the calendar.' : 'The trainer will confirm the date and time.'}
              </p>
            </div>
          </div>

          {training && (
            <dl className={cn('grid grid-cols-1 gap-3 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-3')}>
              <div className="flex gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                <div>
                  <dt className="text-xs text-zinc-500">Date</dt>
                  <dd className="font-medium text-zinc-900">{longDate(training.date)}</dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                <div>
                  <dt className="text-xs text-zinc-500">Time</dt>
                  <dd className="font-medium text-zinc-900">
                    {time12(training.startTime)} – {time12(training.endTime)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                <div>
                  <dt className="text-xs text-zinc-500">Location</dt>
                  <dd className="font-medium text-zinc-900">{training.location}</dd>
                </div>
              </div>
            </dl>
          )}

          {request.joinLink && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-zinc-900">Join link for your team</h3>
              <JoinLink link={request.joinLink} />
              <p className="mt-2 flex items-start gap-2 text-xs text-zinc-500">
                <UserRound className="mt-0.5 size-3.5 shrink-0" />
                Share it with colleagues in {team}. It only works for people who already have portal access in your team.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-bold text-zinc-900">Request details</h2>
        <RequestDetails request={request} data={data} />
      </section>
    </div>
  )
}
