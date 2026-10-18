import { BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { shortDate } from './helpers'
import { attendanceMap, eligibility, templateFor } from './insights'
import { useAdmin } from './store'
import type { AdminTraining } from './types'
import { Avatar, Badge, Card, CardTitle, Empty } from './ui'

/** View-only list of certificates for one session (X04); issuing happens in the tracker. */
export function TrainingCertificates({ training: t }: { training: AdminTraining }) {
  const { data } = useAdmin()
  const certs = t.certificates ?? []
  const marks = attendanceMap(data, t)
  const pending = t.participantIds.filter((pid) => !certs.some((c) => c.personId === pid) && eligibility(data, t, pid, marks).eligible).length
  return (
    <Card>
      <CardTitle
        action={
          <Link to="/admin/certificates" className="text-xs font-semibold text-brand-600 hover:underline">
            Open tracker
          </Link>
        }
      >
        Certificates
      </CardTitle>
      <p className="-mt-2 mb-4 text-sm text-zinc-500">
        {certs.length} issued · template {templateFor(data, t)?.name}
        {pending > 0 && <span className="text-amber-700"> · {pending} eligible, not issued yet</span>}
        {t.status === 'COMPLETED' && !t.certificatesRunAt && <span className="text-brand-700"> · automatic issuing not run</span>}
      </p>
      {certs.length ? (
        <ul className="divide-y divide-zinc-100">
          {certs.map((c) => {
            const p = data.people.find((x) => x.id === c.personId)
            return (
              <li key={c.personId} className="flex items-center gap-3 py-2.5">
                <Avatar name={p?.name ?? '?'} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">{p?.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {shortDate(c.issuedAt.slice(0, 10))}
                    {c.reason ? ` · ${c.reason}` : ''}
                  </span>
                </span>
                <Badge tone={c.method === 'manual' ? 'blue' : 'green'}>{c.method === 'manual' ? 'Manual' : 'Auto'}</Badge>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty icon={BadgeCheck} title="No certificates yet" text="Certificates are issued once trainees attend, give feedback and pass." />
      )}
    </Card>
  )
}
