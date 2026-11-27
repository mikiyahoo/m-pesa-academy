import { Building2, Eye, Globe2, Link2, Lock, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { shortDate } from '../helpers'
import { useAdmin } from '../store'
import type { AdminTraining } from '../types'
import { Badge, Button, Empty, PageHeader, SearchInput, Select, StatCard, TabBar, Table, Tabs, trainingStatusTone } from '../ui'

type Access = 'ALL' | 'PUBLIC' | 'DEPARTMENT' | 'INVITE'

const isInviteOnly = (t: AdminTraining) => !t.isPublic && !t.department

/**
 * Who can see each training: public (open to people who self-register), a department's own,
 * or invite-only (just the people enrolled). Admins can open a training up or close it here.
 */
export function AdminVisibility() {
  const { data, update } = useAdmin()
  const { confirm, toast } = useFeedback()
  const [tab, setTab] = useState<Access>('ALL')
  const [q, setQ] = useState('')
  const [department, setDepartment] = useState('')

  const departments = useMemo(() => [...new Set(data.trainings.map((t) => t.department).filter((d): d is string => !!d))].sort(), [data.trainings])
  const live = data.trainings.filter((t) => t.status !== 'CANCELLED')
  const counts: Record<Access, number> = {
    ALL: live.length,
    PUBLIC: live.filter((t) => t.isPublic).length,
    DEPARTMENT: live.filter((t) => !!t.department).length,
    INVITE: live.filter(isInviteOnly).length,
  }

  const rows = live
    .filter((t) => (tab === 'ALL' ? true : tab === 'PUBLIC' ? !!t.isPublic : tab === 'DEPARTMENT' ? !!t.department : isInviteOnly(t)))
    .filter((t) => !department || t.department === department)
    .filter((t) => !q || `${t.name} ${t.department ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date))

  const setPublic = async (t: AdminTraining, on: boolean) => {
    if (!(await confirm({
      title: on ? `Make ${t.name} public?` : `Revoke public access to ${t.name}?`,
      message: on
        ? 'Self-registered users will be able to find and join this training.'
        : 'It will no longer appear to self-registered users. Existing training records are kept.',
      confirmLabel: on ? 'Make public' : 'Revoke public access',
      danger: !on,
    }))) return
    update((d) => ({ ...d, trainings: d.trainings.map((x) => (x.id === t.id ? { ...x, isPublic: on || undefined } : x)) }), {
      action: 'Changed public access',
      target: t.name,
      entityId: t.id,
      entityType: 'Training',
      changes: [{ field: 'Visibility', from: t.isPublic ? 'Public' : 'Private', to: on ? 'Public' : 'Private' }],
    })
    toast(on ? `“${t.name}” is now open to self-registered users` : `“${t.name}” is no longer public`)
  }

  const copyLink = async (t: AdminTraining) => {
    const link = `${window.location.origin}/trainings/adm-${t.id}`
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copied')
    } catch {
      toast(link)
    }
  }

  return (
    <>
      <PageHeader title="Training Visibility" />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Globe2} label="Public" value={counts.PUBLIC} hint="Self-registered users can join" tone="green" />
        <StatCard icon={Building2} label="Department" value={counts.DEPARTMENT} hint="Run by a department" tone="amber" />
        <StatCard icon={Lock} label="Invite only" value={counts.INVITE} hint="Only people enrolled" tone="zinc" />
        <StatCard icon={Users} label="All trainings" value={counts.ALL} hint="Not counting cancelled" tone="red" />
      </div>

      <TabBar>
        <Tabs<Access>
          value={tab}
          onChange={setTab}
          label="Visibility"
          items={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'PUBLIC', label: 'Public', count: counts.PUBLIC },
            { value: 'DEPARTMENT', label: 'Department', count: counts.DEPARTMENT },
            { value: 'INVITE', label: 'Invite only', count: counts.INVITE },
          ]}
        />
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          {departments.length > 0 && (
            <Select aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-auto! py-1.5 text-xs">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          )}
          <SearchInput value={q} onChange={setQ} placeholder="Search trainings…" className="flex-1 sm:w-64" />
        </div>
      </TabBar>

      {rows.length ? (
        <Table head={['Training', 'Who can see it', 'Date', 'Status', 'Enrolled', '']} minWidth={820}>
          {rows.map((t) => {
            const open = t.status !== 'COMPLETED'
            return (
              <tr key={t.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/trainings/${t.id}`} className="font-medium text-zinc-900 hover:text-brand-600">
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {t.isPublic && (
                      <Badge tone="green">
                        <Globe2 className="mr-1 size-3" /> Public · self-registered users can join
                      </Badge>
                    )}
                    {t.department && (
                      <Badge tone="amber">
                        <Building2 className="mr-1 size-3" /> {t.department}
                      </Badge>
                    )}
                    {isInviteOnly(t) && (
                      <Badge>
                        <Lock className="mr-1 size-3" /> Invite only
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{shortDate(t.date)}</td>
                <td className="px-4 py-3">
                  <Badge tone={trainingStatusTone[t.status]}>{t.status[0] + t.status.slice(1).toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-zinc-700 tabular-nums">{t.participantIds.length}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {t.isPublic && (
                      <Button size="sm" variant="ghost" onClick={() => void copyLink(t)} aria-label={`Copy link to ${t.name}`}>
                        <Link2 className="size-3.5" /> Copy link
                      </Button>
                    )}
                    {open && (
                      <Button size="sm" variant={t.isPublic ? 'outline' : 'primary'} onClick={() => setPublic(t, !t.isPublic)}>
                        {t.isPublic ? 'Make private' : 'Make public'}
                      </Button>
                    )}
                    <Link to={`/admin/trainings/${t.id}`} aria-label={`Open ${t.name}`} className="grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800">
                      <Eye className="size-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </Table>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          <Empty icon={Globe2} title="No trainings here" text="Try another visibility tab or clear the filters." />
        </div>
      )}
    </>
  )
}
