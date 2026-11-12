import { Building2, PauseCircle, PlayCircle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import { Avatar, Badge, Button, Empty, PageHeader, Table } from '../ui'

/**
 * Departments that run their own training (US44): who leads each one, how big it is, and an admin switch to
 * suspend or restore its access. Suspended department admins can't sign in until it's restored.
 */
export function AdminDepartments() {
  const { data, update } = useAdmin()
  const { confirm } = useFeedback()
  const scope = useScope()
  const suspended = new Set(data.suspendedDepartments ?? [])
  const names = [...new Set(data.people.map((p) => p.department).filter((d): d is string => !!d && d !== 'Visitor'))].sort()
  const rows = names.map((name) => ({
    name,
    leads: data.people.filter((p) => p.role === 'Department Admin' && p.department === name),
    members: data.people.filter((p) => p.department === name).length,
    trainings: data.trainings.filter((t) => t.department === name).length,
  }))

  const toggle = async (name: string) => {
    const on = !suspended.has(name)
    if (on && !(await confirm({ title: `Suspend ${name}?`, message: 'Its department admins can’t sign in or manage trainings until you restore access. Their content and trainings stay as they are.', confirmLabel: 'Suspend access', danger: true }))) return
    update((d) => ({ ...d, suspendedDepartments: on ? [...(d.suspendedDepartments ?? []), name] : (d.suspendedDepartments ?? []).filter((x) => x !== name) }), {
      action: on ? 'Suspended department access' : 'Restored department access',
      target: name,
      changes: [{ field: 'Department access', from: on ? 'Active' : 'Suspended', to: on ? 'Suspended' : 'Active' }],
    })
  }

  // Main admins only.
  if (scope.role !== 'admin') return <Navigate to="/admin" replace />

  return (
    <>
      <PageHeader title="Departments" description="Departments that run their own training, and their access." />
      {rows.length ? (
        <Table head={['Department', 'Department admins', 'People', 'Trainings', 'Access', '']} minWidth={760}>
          {rows.map((r) => (
            <tr key={r.name} className="transition hover:bg-zinc-50/80">
              <td className="px-4 py-3 font-semibold text-zinc-900">{r.name}</td>
              <td className="px-4 py-3">
                {r.leads.length ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {r.leads.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
                        <Avatar name={p.name} size="sm" /> {p.name}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">No department admin yet</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-700 tabular-nums">{r.members}</td>
              <td className="px-4 py-3 text-zinc-700 tabular-nums">{r.trainings}</td>
              <td className="px-4 py-3">{suspended.has(r.name) ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge>}</td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant={suspended.has(r.name) ? 'primary' : 'outline'} onClick={() => void toggle(r.name)}>
                  {suspended.has(r.name) ? (
                    <>
                      <PlayCircle className="size-3.5" /> Restore
                    </>
                  ) : (
                    <>
                      <PauseCircle className="size-3.5" /> Suspend
                    </>
                  )}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-surface">
          <Empty icon={Building2} title="No departments yet" text="Departments appear when people are added with a department." />
        </div>
      )}
    </>
  )
}
