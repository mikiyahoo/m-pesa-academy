import { ArrowLeft, ArrowRight, Award, CalendarDays, Check, CheckCircle2, Circle, Copy, Download, ExternalLink, Hourglass, Loader2, Printer, Share2, Star, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFeedback } from '../components/Feedback'
import { downloadCertificatePdf, printCertificate } from '../lib/certificateExport'
import { downloadPdfBytes, fillCertificatePdf, printPdfBytes } from '../lib/fillableCertificate'
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
  return defaultTemplate()?.layout ?? 'border'
}

function defaultTemplate(training?: Training) {
  const data = loadAdminData()
  const adminTraining = training && data.trainings.find((item) => item.id === training.id || item.name === training.title)
  const assigned = adminTraining && data.templates.find((item) => item.assignedTypeIds?.includes(adminTraining.typeId))
  if (assigned) return assigned
  return data.templates.find((t) => t.isDefault) ?? data.templates[0]
}

export function CertificateArt({ training, progress, layout }: { training: Training; progress: TrainingProgress; small?: boolean; layout?: CertificateLayout }) {
  const { user } = useAuth()
  const template = defaultTemplate(training)
  return (
    <CertificateDesign
      layout={layout ?? defaultLayout()}
      pdfTemplate={template?.pdfTemplateData}
      fields={{
        name: user.name,
        email: user.email,
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

      <div className="w-full rounded-2xl border border-zinc-200/80 bg-white p-2.5">
        <SegmentTabs
          label="Certificates"
          items={[
            { value: 'earned' as const, label: 'Earned', badge: earned.length },
            { value: 'almost' as const, label: 'Almost there', badge: almostThere.length },
          ]}
          value={tab}
          onChange={setTab}
          className="w-full"
        />
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

function ShareCertificateMenu({ title, certId }: { title: string; certId: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useFeedback()
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/${certId}` : `/verify/${certId}`

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast('Verification link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Could not copy link to clipboard', { tone: 'error' })
    }
  }

  const shareWhatsApp = () => {
    const text = `🎓 I earned my official certificate for "${title}" at M-PESA Academy!\nVerify my credential here: ${shareUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const shareLinkedInPost = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer')
  }

  const addLinkedInCert = () => {
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(title)}&organizationName=${encodeURIComponent('M-PESA Academy')}&certUrl=${encodeURIComponent(shareUrl)}&certId=${encodeURIComponent(certId)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const tryNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `M-PESA Academy Certificate - ${title}`,
          text: `Check out my certificate for ${title} on M-PESA Academy!`,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback to dropdown
      }
    }
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={tryNativeShare}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        <Share2 className="size-4 text-zinc-600" /> Share
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95">
          <div className="border-b border-zinc-100 px-3 py-2">
            <p className="text-xs font-semibold text-zinc-900">Share your credential</p>
            <p className="text-[11px] text-zinc-500">Publicly share or add to your professional profiles</p>
          </div>

          <div className="space-y-1 p-1">
            <button
              onClick={copy}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition"
            >
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-zinc-500" />}
              <span className="flex-1 text-left">{copied ? 'Link copied!' : 'Copy verification link'}</span>
            </button>

            <button
              onClick={shareWhatsApp}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-emerald-50 hover:text-emerald-800 transition"
            >
              <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white shrink-0">
                <svg className="size-3 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.057-1.02-.083-.72-.261-1.616-.92-2.348-1.652-.731-.732-1.391-1.628-1.652-2.348-.14-.386-.128-.708-.083-1.02.05-.333.419-1.026.824-1.17.133-.048.28-.023.384.072l.747 1.157c.088.136.077.31-.027.436l-.372.453c-.09.11-.107.26-.04.389.28.539.81 1.07 1.35 1.35.129.067.279.05.389-.04l.453-.372c.126-.104.3-.115.436-.027l1.157.747c.095.104.12.251.072.384z" />
                </svg>
              </span>
              <span className="flex-1 text-left">Share to WhatsApp</span>
            </button>

            <button
              onClick={shareLinkedInPost}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-sky-50 hover:text-sky-800 transition"
            >
              <span className="grid size-5 place-items-center rounded-full bg-[#0a66c2] text-white shrink-0">
                <svg className="size-3 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.53 1.53 0 1 0 0-3.06 1.53 1.53 0 0 0 0 3.06m1.4 9.74V9.93H5.05v8.57h2.81z" />
                </svg>
              </span>
              <span className="flex-1 text-left">Share on LinkedIn Feed</span>
            </button>

            <button
              onClick={addLinkedInCert}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-[#0a66c2]/10 hover:text-[#0a66c2] transition"
            >
              <span className="grid size-5 place-items-center rounded-full bg-zinc-100 text-[#0a66c2] shrink-0 font-bold text-[10px]">
                in
              </span>
              <span className="flex-1 text-left">Add to LinkedIn Profile</span>
              <ExternalLink className="size-3 text-zinc-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CertificateView() {
  const { id = '' } = useParams()
  const { getTraining, progress } = useStore()
  const training = getTraining(id)
  const p = progress[id]
  const { user } = useAuth()
  const importedTemplate = defaultTemplate(training)?.pdfTemplateData
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
      const template = defaultTemplate(training)
      if (template?.pdfTemplateData) {
        const bytes = await fillCertificatePdf(template.pdfTemplateData, {
          name: user.name,
          email: user.email,
          training: training.title,
          date: formatDate(p?.completedAt ?? training.date),
          code: certificateId(training),
        })
        if (kind === 'pdf') {
          downloadPdfBytes(bytes, `M-PESA Academy certificate - ${training.title}`)
          toast('Certificate downloaded')
        } else printPdfBytes(bytes)
      } else if (kind === 'pdf') {
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
        <div className="flex flex-wrap items-center gap-2">
          <ShareCertificateMenu title={training.title} certId={certificateId(training)} />
          <button onClick={() => run('print')} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border disabled:opacity-60 border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50">
            {busy === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} Print
          </button>
          <button onClick={() => run('pdf')} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700">
            {busy === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download PDF
          </button>
        </div>
      </div>
      {importedTemplate ? (
        <div className="mx-auto max-w-4xl rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 print:hidden">
          This certificate uses the organization’s imported fillable PDF template.
        </div>
      ) : (
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-2.5 print:hidden">
          <SegmentTabs label="Certificate design" items={CERTIFICATE_LAYOUTS.map((l, i) => ({ value: l.value, label: l.label, badge: i + 1 }))} value={layout} onChange={pickLayout} />
          <span className="hidden pr-2 text-xs text-zinc-500 sm:block">{CERTIFICATE_LAYOUTS.find((l) => l.value === layout)?.hint}</span>
        </div>
      )}
      <div ref={art} className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-zinc-200 shadow-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <CertificateArt training={training} progress={p} layout={layout} />
      </div>
    </div>
  )
}
