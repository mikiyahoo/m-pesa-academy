import { ArrowLeft, ArrowRight, Award, CalendarDays, Check, CheckCircle2, Circle, Download, Hourglass, Loader2, Printer, Star, Trophy } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { downloadCertificatePdf, printCertificate } from '../lib/certificateExport'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/Auth'
import { CERTIFICATE_LAYOUTS, CertificateDesign, type CertificateLayout } from '../components/CertificateDesign'
import { SegmentTabs } from '../components/SegmentTabs'
import { StatStrip } from '../components/CalendarParts'
import { Banner } from '../components/Banner'
import { loadAdminData } from '../admin/storage'
import { certificateChecks, certificateId, formatDate, progressStatus } from '../lib/utils'
import { LATE_WINDOW_MINUTES } from '../data/trainings'
import { cn } from '../lib/utils'
import { useStore } from '../store/AppStore'
import type { Training, TrainingProgress } from '../types'

const LAYOUT_KEY = 'mpesa-learning:certificate-layout'

/** The admin's default template layout, unless the learner picked another design. */
function defaultLayout(): CertificateLayout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY) as CertificateLayout | null
    if (saved && CERTIFICATE_LAYOUTS.some((l) => l.value === saved)) return saved
  } catch {
    // Preference is best-effort.
  }
  return loadAdminData().templates.find((t) => t.isDefault)?.layout ?? 'border'
}

export function CertificateArt({ training, progress, layout }: { training: Training; progress: TrainingProgress; small?: boolean; layout?: CertificateLayout }) {
  const { user } = useAuth()
  return (
    <CertificateDesign
      layout={layout ?? defaultLayout()}
      fields={{
        name: user.name,
        course: training.title,
        score: progress.quizScore,
        issued: formatDate(progress.completedAt ?? training.date),
        trainer: training.trainer,
        certificateId: certificateId(training),
      }}
    />
  )
}

type CertTab = 'earned' | 'almost'

/** Where each missing certificate check is completed in the course player. */
const CHECK_TARGET: Record<string, string> = { attendance: 'session', feedback: 'feedback', assessment: 'assessment' }

export function Certificates() {
  const { trainings, progress } = useStore()
  const [params, setParams] = useSearchParams()
  // A certificate is earned only when every check passes (TA-6.5, URS 5).
  const earned = trainings
    .filter((t) => certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES).eligible)
    .sort((a, b) => (progress[b.id]?.completedAt ?? b.date).localeCompare(progress[a.id]?.completedAt ?? a.date))
  const almostThere = trainings
    .filter((t) => {
      const { eligible } = certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES)
      return !eligible && progressStatus(t, progress[t.id]) !== 'Not Started'
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  const tab: CertTab = params.get('tab') === 'almost' || (!earned.length && almostThere.length) ? 'almost' : 'earned'
  const setTab = (t: CertTab) => setParams(t === 'earned' ? {} : { tab: t }, { replace: true })

  const scores = earned.map((t) => progress[t.id]?.quizScore).filter((s): s is number => s !== undefined)
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const grid = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">Certificates</h1>
      </div>

      <StatStrip
        items={[
          { icon: Award, label: 'Earned', value: earned.length, tone: 'green' },
          { icon: Hourglass, label: 'Almost there', value: almostThere.length, tone: 'red' },
          { icon: Star, label: 'Average score', value: average !== null ? `${average}%` : '—', tone: 'zinc' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-2.5">
        <SegmentTabs
          label="Certificates"
          items={[
            { value: 'earned' as const, label: 'Earned', badge: earned.length },
            { value: 'almost' as const, label: 'Almost there', badge: almostThere.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        <p className="hidden pr-2 text-xs text-zinc-500 sm:block">
          {tab === 'earned' ? 'Open a certificate to view, print or save it as PDF.' : 'Finish the missing checks to unlock these.'}
        </p>
      </div>

      {tab === 'earned' ? (
        earned.length ? (
          <div className={grid}>
            {earned.map((t) => {
              const p = progress[t.id]
              return (
                <article key={t.id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white transition focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-0.5 hover:shadow-xl">
                  <div className="relative bg-zinc-100 p-3">
                    <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 transition duration-300 group-hover:scale-[1.02]">
                      <CertificateArt training={t} progress={p} />
                    </div>
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-mpesa-600 p-1.5 pr-3 text-[11px] font-semibold text-white shadow-md">
                      <span className="grid size-5 place-items-center rounded-full bg-white text-mpesa-600">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      Earned
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col px-3.5 pt-3 pb-3.5">
                    <h2 className="line-clamp-2 text-[15px] leading-snug font-bold text-zinc-900 group-hover:text-brand-600">
                      <Link to={`/certificates/${t.id}`} className="after:absolute after:inset-0 focus:outline-none">
                        {t.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">Trainer: {t.trainer}</p>
                    <div className="mt-3 flex flex-1 items-start gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className="grid size-6 place-items-center rounded-lg bg-brand-50 text-brand-600">
                          <CalendarDays className="size-3.5" />
                        </span>
                        <span className="leading-tight">
                          <span className="block text-[11px] font-semibold text-zinc-900">{formatDate(p.completedAt ?? t.date, { month: 'short', day: 'numeric' })}</span>
                          <span className="block text-[10px] text-zinc-500">Issued</span>
                        </span>
                      </span>
                      <span className="h-6 w-px bg-zinc-200" aria-hidden />
                      <span className="flex items-center gap-1.5">
                        <span className="grid size-6 place-items-center rounded-lg bg-mpesa-500/10 text-mpesa-600">
                          <Trophy className="size-3.5" />
                        </span>
                        <span className="leading-tight">
                          <span className="block text-[11px] font-semibold text-zinc-900">{p.quizScore ?? '—'}%</span>
                          <span className="block text-[10px] text-zinc-500">Score</span>
                        </span>
                      </span>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-medium text-zinc-400">{certificateId(t)}</span>
                      <span className="relative z-10 inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-mpesa-500/30 bg-mpesa-500/[0.06] px-3 py-1.5 text-xs font-semibold text-mpesa-700 transition group-hover:border-mpesa-500/50 group-hover:bg-mpesa-500/10">
                        <Award className="size-3.5" /> View <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <Empty
            icon={Award}
            title="No certificates yet"
            text="Check in, complete the training, pass the assessment and leave feedback to earn one."
            action={almostThere.length ? { label: 'See almost there', onClick: () => setTab('almost') } : undefined}
          />
        )
      ) : almostThere.length ? (
        <div className={grid}>
          {almostThere.map((t) => {
            const { checks } = certificateChecks(t, progress[t.id], LATE_WINDOW_MINUTES)
            const missing = checks.filter((c) => !c.ok)
            const done = checks.length - missing.length
            const next = missing[0]
            return (
              <article key={t.id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white transition focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-0.5 hover:shadow-xl">
                <div className="relative aspect-[5/2] overflow-hidden bg-zinc-100">
                  <Banner training={t} className="size-full transition duration-300 group-hover:scale-[1.03]" />
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-charcoal p-1.5 pr-3 text-[11px] font-semibold text-white shadow-md">
                    <span className="grid size-5 place-items-center rounded-full bg-white text-charcoal">
                      <Hourglass className="size-3" strokeWidth={2.5} />
                    </span>
                    {missing.length} to go
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-3.5 pt-3 pb-3.5">
                  <h2 className="line-clamp-2 text-[15px] leading-snug font-bold text-zinc-900 group-hover:text-brand-600">
                    <Link to={`/trainings/${t.id}`} className="after:absolute after:inset-0 focus:outline-none">
                      {t.title}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">Trainer: {t.trainer}</p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {checks.map((c) => (
                      <li key={c.key} className="flex items-center gap-2 text-xs">
                        {c.ok ? <CheckCircle2 className="size-4 shrink-0 fill-mpesa-600 text-white" /> : <Circle className="size-4 shrink-0 text-zinc-300" />}
                        <span className={cn('min-w-0 flex-1 truncate', c.ok ? 'text-zinc-400 line-through decoration-zinc-300' : 'font-medium text-zinc-700')}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex w-full max-w-[84px] min-w-[60px] flex-1 items-center gap-2.5" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={checks.length} aria-label={`${done} of ${checks.length} checks done`}>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/60 ring-inset">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max((done / checks.length) * 100, done ? 4 : 0)}%` }} />
                      </div>
                      <span className="shrink-0 text-xs font-bold text-brand-600 tabular-nums">
                        {done}/{checks.length}
                      </span>
                    </div>
                    {next && (
                      <Link
                        to={`/trainings/${t.id}/learn/${CHECK_TARGET[next.key] ?? ''}`}
                        className="relative z-10 inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700"
                      >
                        Finish <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <Empty icon={Hourglass} title="Nothing pending" text="Start a training to begin working towards a certificate." action={{ label: 'Browse trainings', to: '/learning' }} />
      )}
    </div>
  )
}

function Empty({ icon: Icon, title, text, action }: { icon: typeof Award; title: string; text: string; action?: { label: string; onClick?: () => void; to?: string } }) {
  const cls = 'mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700'
  return (
    <div className="grid place-items-center rounded-2xl border border-zinc-200/80 bg-white px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-8" />
      </span>
      <p className="mt-4 text-lg font-bold text-zinc-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>
      {action &&
        (action.to ? (
          <Link to={action.to} className={cls}>
            {action.label} <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button onClick={action.onClick} className={cls}>
            {action.label} <ArrowRight className="size-4" />
          </button>
        ))}
    </div>
  )
}

export function CertificateView() {
  const { id = '' } = useParams()
  const { getTraining, progress } = useStore()
  const training = getTraining(id)
  const p = progress[id]
  const eligible = training ? certificateChecks(training, p, LATE_WINDOW_MINUTES).eligible : false
  const [layout, setLayout] = useState<CertificateLayout>(defaultLayout)
  const art = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null)
  const { toast } = useFeedback()
  const run = async (kind: 'print' | 'pdf') => {
    // Snapshot the certificate itself, not the rounded preview frame around it.
    const node = art.current?.firstElementChild as HTMLElement | null
    if (!node || !training || busy) return
    setBusy(kind)
    try {
      if (kind === 'pdf') {
        await downloadCertificatePdf(node, `M-PESA Academy certificate - ${training.title}`)
        toast('Certificate downloaded')
      } else await printCertificate(node)
    } catch {
      toast('Could not prepare the certificate — please try again', { tone: 'error' })
    } finally {
      setBusy(null)
    }
  }
  const pickLayout = (l: CertificateLayout) => {
    setLayout(l)
    try {
      localStorage.setItem(LAYOUT_KEY, l)
    } catch {
      // Preference is best-effort.
    }
  }

  if (!training || !eligible) {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">Certificate not available</p>
        <p className="text-sm text-zinc-500">Check in, complete the training, pass the assessment and leave feedback first.</p>
        <Link to="/certificates" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          Back to certificates
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toolbar lines up with the design picker and the certificate below. */}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <Link to="/certificates" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-4" /> All certificates
        </Link>
        <div className="flex gap-2">
          <button onClick={() => run('print')} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border disabled:opacity-60 border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
            {busy === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} Print
          </button>
          <button onClick={() => run('pdf')} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700">
            {busy === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
          </button>
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-2.5 print:hidden">
        <SegmentTabs label="Certificate design" items={CERTIFICATE_LAYOUTS.map((l, i) => ({ value: l.value, label: l.label, badge: i + 1 }))} value={layout} onChange={pickLayout} />
        <span className="hidden pr-2 text-xs text-zinc-500 sm:block">{CERTIFICATE_LAYOUTS.find((l) => l.value === layout)?.hint}</span>
      </div>
      <div ref={art} className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-zinc-200 shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <CertificateArt training={training} progress={p} layout={layout} />
      </div>
    </div>
  )
}
