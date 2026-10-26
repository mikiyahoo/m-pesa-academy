import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Circle, Download, Play, Printer, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { downloadCertificatePdf, printCertificate } from '../../lib/certificateExport'
import { downloadPdfBytes, fillCertificatePdf, printPdfBytes } from '../../lib/fillableCertificate'
import { Link } from 'react-router-dom'
import { useFeedback } from '../../components/Feedback'
import { cn, localISO } from '../../lib/utils'
import { shortDate } from '../helpers'
import { anonymiser, attendanceMap, bestScore, eligibility, runIssuing, templateFor } from '../insights'
import { filterTrainings, useReportFilters } from '../reports/filters'
import { trainerIdsOf } from '../scheduling'
import { ExportMenu, FilterBar, Stat } from '../reports/ReportParts'
import { useScope } from '../scope'
import { useAdmin } from '../store'
import type { AdminData, AdminTraining, IssuedCertificate } from '../types'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, SearchInput, Select, Table, Textarea } from '../ui'
import { CertificatePreview } from './Settings'

const MANUAL_REASONS = ['Attendance recorded on paper', 'Assessment taken offline', 'Feedback collected on paper', 'System issue during the session', 'Approved exception']

function rosterOf(data: AdminData, t: AdminTraining) {
  const marks = attendanceMap(data, t)
  return t.participantIds.map((pid) => {
    const e = eligibility(data, t, pid, marks)
    return { pid, person: data.people.find((p) => p.id === pid), cert: t.certificates?.find((c) => c.personId === pid), score: bestScore(data, t, pid), ...e }
  })
}

/**
 * Certification tracker (X06): eligible trainees per session, automatic issuing with a manual
 * fallback (X02), reissue, download and export. Trainers see only sessions they conduct.
 */
export function AdminCertificates() {
  const { data, update } = useAdmin()
  const { toast } = useFeedback()
  const scope = useScope()
  const { filters, set, clear, active } = useReportFilters()
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState<{ t: AdminTraining; pid: string } | null>(null)
  const [preview, setPreview] = useState<{ t: AdminTraining; c: IssuedCertificate } | null>(null)
  const previewArt = useRef<HTMLDivElement>(null)
  const exportPreview = async (kind: 'print' | 'pdf') => {
    const node = previewArt.current?.firstElementChild as HTMLElement | null
    if (!node || !preview) return
    try {
      const template = data.templates.find((item) => item.id === preview.c.templateId) ?? templateFor(data, preview.t)
      if (template?.pdfTemplateData) {
        const participant = data.people.find((person) => person.id === preview.c.personId)
        const bytes = await fillCertificatePdf(template.pdfTemplateData, {
          name: participant?.name ?? preview.c.personId,
          email: participant?.email ?? '',
          training: preview.t.name,
          date: new Date(preview.c.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          code: `MPL-${preview.t.date.replaceAll('-', '')}-${preview.t.id.toUpperCase()}-${preview.c.personId.toUpperCase()}`,
        })
        if (kind === 'pdf') downloadPdfBytes(bytes, `Certificate - ${name(preview.c.personId)} - ${preview.t.name}`)
        else printPdfBytes(bytes)
      } else if (kind === 'pdf') await downloadCertificatePdf(node, `Certificate - ${name(preview.c.personId)} - ${preview.t.name}`)
      else await printCertificate(node)
    } catch {
      toast('Could not prepare the certificate — please try again', { tone: 'error' })
    }
  }

  const base = data.trainings.filter((t) => t.status !== 'CANCELLED' && (!scope.trainerId || trainerIdsOf(t).includes(scope.trainerId)))
  const trainings = useMemo(() => filterTrainings(data, filters, base).sort((a, b) => b.date.localeCompare(a.date)), [data, filters, base])
  const rows = useMemo(
    () =>
      trainings.map((t) => {
        const roster = rosterOf(data, t)
        return { t, roster, issued: roster.filter((r) => r.cert).length, eligible: roster.filter((r) => r.eligible).length, pending: roster.filter((r) => r.eligible && !r.cert).length }
      }),
    [data, trainings],
  )
  const notTriggered = rows.filter((r) => r.t.status === 'COMPLETED' && !r.t.certificatesRunAt)
  const name = (pid: string) => data.people.find((p) => p.id === pid)?.name ?? pid
  const trainerNames = (t: AdminTraining) => trainerIdsOf(t).map(name).join(', ') || '—'

  const run = (t: AdminTraining) => {
    const before = (t.certificates ?? []).length
    const next = runIssuing(data, t, 'Automatic issuing')
    const n = (next.certificates ?? []).length - before
    update((d) => ({ ...d, trainings: d.trainings.map((x) => (x.id === t.id ? next : x)) }), { action: `Issued ${n} certificate${n === 1 ? '' : 's'}`, target: t.name, silent: true })
    toast(n ? `${n} certificate${n === 1 ? '' : 's'} issued for ${t.name}` : `No new eligible trainees in ${t.name}`)
  }

  const issueOne = (t: AdminTraining, pid: string, reason?: string) => {
    const cert: IssuedCertificate = { personId: pid, issuedAt: localISO(), issuedBy: 'Manual issue', method: reason ? 'manual' : 'auto', templateId: templateFor(data, t)?.id ?? '', reason }
    update((d) => ({ ...d, trainings: d.trainings.map((x) => (x.id === t.id ? { ...x, certificates: [...(x.certificates ?? []).filter((c) => c.personId !== pid), cert] } : x)) }), {
      action: reason ? 'Issued certificate manually' : 'Issued certificate',
      target: `${name(pid)} · ${t.name}`,
      changes: reason ? [{ field: 'Reason', from: '', to: reason }] : undefined,
    })
  }

  const reissue = (t: AdminTraining, pid: string) =>
    update((d) => ({ ...d, trainings: d.trainings.map((x) => (x.id === t.id ? { ...x, certificates: x.certificates?.map((c) => (c.personId === pid ? { ...c, reissuedAt: localISO(), templateId: templateFor(d, t)?.id ?? c.templateId } : c)) } : x)) }), {
      action: 'Reissued certificate',
      target: `${name(pid)} · ${t.name}`,
    })

  const totals = { issued: rows.reduce((s, r) => s + r.issued, 0), pending: rows.reduce((s, r) => s + r.pending, 0), eligible: rows.reduce((s, r) => s + r.eligible, 0) }
  const q = query.trim().toLowerCase()

  return (
    <>
      <PageHeader
        title="Certificates"
        description={scope.trainerId ? 'Issue certificates for the sessions you conduct.' : 'Track who is eligible, issue certificates and fix anything automatic issuing missed.'}
        actions={
          <ExportMenu
            filename="certificates"
            title="M-PESA Academy — Certification tracker"
            personal
            sheets={(anon) => {
              const a = anon ? anonymiser() : undefined
              return [
                { name: 'Sessions', header: ['Training', 'Date', 'Trainers', 'Participants', 'Eligible', 'Issued', 'Pending', 'Issuing run'], rows: rows.map((r) => [r.t.name, r.t.date, trainerNames(r.t), r.t.participantIds.length, r.eligible, r.issued, r.pending, r.t.certificatesRunAt?.slice(0, 10) ?? 'Not yet']) },
                {
                  name: 'Trainees',
                  header: ['Training', 'Trainee', 'Attendance', 'Feedback', 'Score', 'Eligible', 'Certificate', 'Issued', 'Method', 'Reason'],
                  rows: rows.flatMap((r) => r.roster.map((x) => [r.t.name, a ? a(x.pid) : name(x.pid), x.mark ?? '', x.feedback ? 'Yes' : 'No', x.score ?? '', x.eligible ? 'Yes' : 'No', x.cert ? 'Issued' : '', x.cert?.issuedAt.slice(0, 10) ?? '', x.cert?.method ?? '', x.cert?.reason ?? ''])),
                },
              ]
            }}
          />
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Issued" value={totals.issued} tone="green" />
        <Stat label="Eligible" value={totals.eligible} hint="Attended, feedback, passed" />
        <Stat label="Eligible, not issued" value={totals.pending} tone="amber" />
        <Stat label="Sessions not triggered" value={notTriggered.length} tone="red" />
      </div>

      {notTriggered.length > 0 && (
        <Card className="mt-5 border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 font-semibold text-zinc-900">
            <AlertTriangle className="size-4 text-amber-600" /> Automatic issuing hasn't run for {notTriggered.length} finished session{notTriggered.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-3 space-y-2">
            {notTriggered.map((r) => (
              <li key={r.t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.t.name}</span> <span className="text-zinc-500">· {shortDate(r.t.date)} · {r.pending} eligible</span>
                </span>
                <Button size="sm" variant="primary" onClick={() => run(r.t)}>
                  <Play className="size-3.5" /> Run issuing
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-5">
        <FilterBar filters={filters} set={set} clear={clear} active={active} hide={scope.trainerId ? ['trainerId', 'status'] : ['status']} />
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty icon={BadgeCheck} title="No sessions match" text="Try clearing the filters." />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const open = openId === r.t.id
            const tpl = templateFor(data, r.t)
            const roster = r.roster.filter((x) => !q || x.person?.name.toLowerCase().includes(q) || x.person?.email.toLowerCase().includes(q))
            return (
              <Card key={r.t.id} className="p-0">
                <button onClick={() => setOpenId(open ? null : r.t.id)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left sm:px-5">
                  <ChevronRight className={cn('size-4 shrink-0 text-zinc-400 transition', open && 'rotate-90')} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-zinc-900">{r.t.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {shortDate(r.t.date)} · {trainerNames(r.t)} · template {tpl?.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <Badge tone="green">{r.issued} issued</Badge>
                    {r.pending > 0 && <Badge tone="amber">{r.pending} pending</Badge>}
                    <span className="text-zinc-500">
                      {r.eligible}/{r.t.participantIds.length} eligible
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-zinc-200 p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <SearchInput value={query} onChange={setQuery} placeholder="Search trainees…" className="w-full sm:w-64" />
                      <div className="flex gap-2">
                        <Link to={`/admin/trainings/${r.t.id}`} className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                          Open session
                        </Link>
                        <Button variant="primary" onClick={() => run(r.t)} disabled={!r.pending}>
                          <BadgeCheck className="size-4" /> Issue to {r.pending} eligible
                        </Button>
                      </div>
                    </div>
                    <Table head={['Trainee', 'Attendance', 'Feedback', 'Assessment', 'Certificate', '']} minWidth={760}>
                      {roster.map((x) => (
                        <tr key={x.pid}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{x.person?.name}</p>
                            <p className="text-xs text-zinc-500">{x.person?.email}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <Check ok={x.attended} label={x.mark ?? '—'} />
                          </td>
                          <td className="px-4 py-2.5">
                            <Check ok={x.feedback} label={x.feedback ? 'Submitted' : 'Missing'} />
                          </td>
                          <td className="px-4 py-2.5">
                            <Check ok={x.passed} label={x.score !== undefined ? `${x.score}%` : x.passed ? 'Completed' : 'Not passed'} />
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {x.cert ? (
                              <>
                                <Badge tone={x.cert.method === 'manual' ? 'blue' : 'green'}>{x.cert.method === 'manual' ? 'Manual' : 'Issued'}</Badge>
                                <span className="ml-2 text-zinc-500">{shortDate(x.cert.issuedAt.slice(0, 10))}</span>
                                {x.cert.reissuedAt && <span className="block text-zinc-400">Reissued {shortDate(x.cert.reissuedAt.slice(0, 10))}</span>}
                                {x.cert.reason && <span className="block text-zinc-400">{x.cert.reason}</span>}
                              </>
                            ) : x.eligible ? (
                              <Badge tone="amber">Eligible</Badge>
                            ) : (
                              <span className="text-zinc-400">Not eligible</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {x.cert ? (
                              <div className="inline-flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setPreview({ t: r.t, c: x.cert! })} aria-label={`Download certificate for ${x.person?.name}`}>
                                  <Download className="size-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => reissue(r.t, x.pid)}>
                                  <RotateCcw className="size-3.5" /> Reissue
                                </Button>
                              </div>
                            ) : x.eligible ? (
                              <Button size="sm" variant="primary" onClick={() => issueOne(r.t, x.pid)}>
                                Issue
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => setManual({ t: r.t, pid: x.pid })}>
                                Issue manually
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {manual && <ManualIssueModal name={name(manual.pid)} training={manual.t.name} onClose={() => setManual(null)} onIssue={(reason) => issueOne(manual.t, manual.pid, reason)} />}
      {preview && (
        <Modal
          open
          wide
          onClose={() => setPreview(null)}
          title="Certificate"
          description={`${name(preview.c.personId)} · ${preview.t.name}`}
          footer={
            <>
              <Button onClick={() => setPreview(null)}>Close</Button>
              <Button onClick={() => void exportPreview('print')}>
                <Printer className="size-4" /> Print
              </Button>
              <Button variant="primary" onClick={() => void exportPreview('pdf')}>
                <Download className="size-4" /> Download PDF
              </Button>
            </>
          }
        >
          <div ref={previewArt} className="overflow-hidden rounded-xl border border-zinc-200">
            <CertificatePreview
              template={data.templates.find((t) => t.id === preview.c.templateId) ?? templateFor(data, preview.t)}
              name={name(preview.c.personId)}
              email={data.people.find((person) => person.id === preview.c.personId)?.email ?? ''}
              course={preview.t.name}
              trainer={trainerNames(preview.t)}
              certificateId={`MPL-${preview.t.date.replaceAll('-', '')}-${preview.t.id.toUpperCase()}-${preview.c.personId.toUpperCase()}`}
              issued={new Date(preview.c.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              score={bestScore(data, preview.t, preview.c.personId)}
            />
          </div>
        </Modal>
      )}
    </>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', ok ? 'text-zinc-800' : 'text-zinc-500')}>
      {ok ? <CheckCircle2 className="size-4 text-mpesa-600" /> : <Circle className="size-4 text-zinc-300" />} {label}
    </span>
  )
}

function ManualIssueModal({ name, training, onClose, onIssue }: { name: string; training: string; onClose: () => void; onIssue: (reason: string) => void }) {
  const [reason, setReason] = useState(MANUAL_REASONS[0])
  const [note, setNote] = useState('')
  const full = note.trim() ? `${reason} — ${note.trim()}` : reason
  return (
    <Modal
      open
      onClose={onClose}
      title="Issue certificate manually"
      description={`${name} doesn't meet every requirement for ${training}. A reason is recorded in the audit log.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onIssue(full)
              onClose()
            }}
          >
            Issue certificate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {MANUAL_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Signed attendance sheet kept by the trainer" />
        </Field>
      </div>
    </Modal>
  )
}
