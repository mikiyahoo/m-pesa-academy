import { ArrowRight, Award, BookOpen, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronRight, Circle, Clock, FileText, GraduationCap, Home, Info, Layers, Lightbulb, ListChecks, Lock, LockOpen, MapPin, Play, PlayCircle, RotateCcw, SquareCheckBig, Star, Target, Users, Video } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { HeroIllustration } from '../components/HeroIllustration'
import { progressColor } from '../components/TrainingCard'
import { PASS_MARK } from '../data/trainings'
import { cn, durationMinutes, formatDate, initials, isPassed, progressPercent, progressStatus, sessionStatus, timeRange } from '../lib/utils'
import { useStore } from '../store/AppStore'
import type { Training } from '../types'

function downloadIcs(t: Training) {
  const stamp = (time: string) => `${t.date.replaceAll('-', '')}T${time.replace(':', '')}00`
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//M-PESA Learning//EN',
    'BEGIN:VEVENT',
    `UID:${t.id}@mpesa-learning`,
    `DTSTART:${stamp(t.startTime)}`,
    `DTEND:${stamp(t.endTime)}`,
    `SUMMARY:${t.title}`,
    `LOCATION:${t.venue}`,
    `DESCRIPTION:Trainer: ${t.trainer}${t.teamsJoinUrl ? `\nJoin on Microsoft Teams: ${t.teamsJoinUrl}` : ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${t.id}.ics` })
  a.click()
  URL.revokeObjectURL(url)
}

function Quiz({ training, onSubmit, lastScore }: { training: Training; onSubmit: (score: number) => void; lastScore?: number }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<number | null>(null)

  const submit = () => {
    const correct = training.quiz.filter((q) => answers[q.id] === q.answer).length
    const score = Math.round((correct / training.quiz.length) * 100)
    setResult(score)
    onSubmit(score)
  }

  return (
    <div className="space-y-5">
      {training.quiz.map((q, qi) => (
        <fieldset key={q.id}>
          <legend className="text-sm font-medium">
            {qi + 1}. {q.question}
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {q.options.map((opt, oi) => {
              const chosen = answers[q.id] === oi
              const reveal = result !== null
              return (
                <label
                  key={oi}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                    reveal && oi === q.answer
                      ? 'border-mpesa-500 bg-mpesa-500/10'
                      : reveal && chosen
                        ? 'border-brand-500 bg-brand-50'
                        : chosen
                          ? 'border-brand-500 bg-brand-50/60'
                          : 'border-zinc-200 hover:bg-zinc-50',
                  )}
                >
                  <input
                    type="radio"
                    name={q.id}
                    disabled={reveal}
                    checked={chosen}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className="accent-brand-600"
                  />
                  {opt}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}

      {result === null ? (
        <button
          onClick={submit}
          disabled={Object.keys(answers).length < training.quiz.length}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Submit answers
        </button>
      ) : (
        <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg p-4', result >= PASS_MARK ? 'bg-mpesa-500/10' : 'bg-brand-50')}>
          <div>
            <p className="text-sm font-semibold">
              You scored {result}% — {result >= PASS_MARK ? 'Passed 🎉' : `Not passed (need ${PASS_MARK}%)`}
            </p>
            {lastScore !== undefined && <p className="text-xs text-zinc-500">Your best score is kept: {Math.max(lastScore, result)}%</p>}
          </div>
          <button
            onClick={() => {
              setAnswers({})
              setResult(null)
            }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            <RotateCcw className="size-3.5" /> Retake
          </button>
        </div>
      )}
    </div>
  )
}

const tabs = [
  { id: 'about', label: 'About', icon: Info },
  { id: 'modules', label: 'Modules', icon: Layers },
  { id: 'assessment', label: 'Assessment', icon: FileText },
] as const

type TabId = (typeof tabs)[number]['id']

// App header (64px) + section bar in its compact state (title row + tabs) + breathing room.
const STICKY_OFFSET = 64 + 112 + 16

/** Scrolls a section into view below the sticky app header + section nav. */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET, behavior: 'smooth' })
}

function DetailItem({ icon: Icon, title, sub }: { icon: typeof Clock; title: string; sub: string }) {
  return (
    <div className="flex gap-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-800">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, children, small = false, solid = false }: { icon: typeof Clock; children: React.ReactNode; small?: boolean; solid?: boolean }) {
  return (
    <h2 className={cn('flex items-center gap-2.5 font-bold text-zinc-900', small ? 'text-lg' : 'text-xl')}>
      {solid ? (
        <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-white">
          <Icon className="size-4" />
        </span>
      ) : (
        <Icon className="size-6 text-brand-600" />
      )}
      {children}
    </h2>
  )
}

export function TrainingDetail() {
  const { id = '' } = useParams()
  const { getTraining, progress, toggleModule, markAttended, submitQuiz } = useStore()
  const training = getTraining(id)
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const heroCta = useRef<HTMLDivElement>(null)
  const stickyBar = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('about')

  // On scroll: show the title + CTA in the sticky bar once the hero button is hidden,
  // and highlight the last section whose heading has passed under the sticky bar.
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const cta = heroCta.current?.getBoundingClientRect()
        setCompact(!!cta && cta.bottom < 64)
        const line = (stickyBar.current?.getBoundingClientRect().bottom ?? 0) + 48
        let current: TabId = tabs[0].id
        for (const t of tabs) {
          const el = document.getElementById(t.id)
          if (el && el.getBoundingClientRect().top <= line) current = t.id
        }
        // At the very bottom the last section may be too short to reach the bar.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = tabs[tabs.length - 1].id
        setActiveTab(current)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [training?.id])

  if (!training) {
    return (
      <div className="py-24 text-center">
        <p className="font-semibold">Training not found</p>
        <Link to="/trainings" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
          Back to trainings
        </Link>
      </div>
    )
  }

  const p = progress[training.id]
  const status = progressStatus(training, p)
  const session = sessionStatus(training)
  const percent = progressPercent(training, p)
  const modulesDone = training.modules.every((m) => p?.completedModules.includes(m.id))
  const doneCount = p?.completedModules.filter((mid) => training.modules.some((m) => m.id === mid)).length ?? 0
  const isTeams = !!training.teamsJoinUrl
  const isOnlineOnly = training.venue === 'ONLINE'

  const onToggleModule = (moduleId: string) => {
    const wasDone = p?.completedModules.includes(moduleId)
    toggleModule(training.id, moduleId)
    const remaining = training.modules.filter((m) => m.id !== moduleId && !p?.completedModules.includes(m.id)).length
    if (!wasDone && remaining === 0) toast('All modules done — the assessment is unlocked')
  }

  const onQuiz = (score: number) => {
    submitQuiz(training.id, score)
    if (score >= PASS_MARK && modulesDone)
      toast('Training completed — certificate earned! 🎉', { action: { label: 'View', onClick: () => navigate(`/certificates/${training.id}`) } })
    else if (score < PASS_MARK) toast(`You scored ${score}%. Review the modules and try again.`, { tone: 'info' })
  }

  const join = () => {
    markAttended(training.id)
    if (training.teamsJoinUrl!.includes('DEMO')) toast('Demo meeting — in production this opens Microsoft Teams', { tone: 'info' })
    else window.open(training.teamsJoinUrl, '_blank', 'noopener')
  }

  // One clear primary action, chosen by where the learner is in the training.
  const primary: { label: string; onClick?: () => void; to?: string; icon: typeof Clock; teams?: boolean; disabled?: boolean } =
    status === 'Completed'
      ? { label: 'View certificate', to: `/certificates/${training.id}`, icon: Award }
      : session === 'Active' && isTeams
        ? { label: p?.attended ? 'Rejoin Live Training' : 'Join Live Training', onClick: join, icon: Video, teams: true }
        : session === 'Active' && !p?.attended
          ? { label: 'Check in', onClick: () => (markAttended(training.id), toast('Checked in — attendance recorded')), icon: MapPin }
          : modulesDone
            ? { label: 'Take assessment', onClick: () => scrollToSection('assessment'), icon: Award }
            : { label: doneCount ? 'Continue learning' : 'Start learning', onClick: () => scrollToSection('modules'), icon: Play }

  const primaryButton = (small = false) => {
    const cls = cn(
      'group inline-flex items-center justify-center gap-2.5 rounded-full font-semibold text-white shadow-sm transition',
      small ? 'px-4 py-2 text-sm' : 'w-full py-3 pr-6 pl-3 text-base sm:w-auto sm:min-w-[240px]',
      primary.teams
        ? 'bg-[#5b5fc7] hover:bg-[#4b4fb5]'
        : status === 'Completed'
          ? 'bg-mpesa-600 shadow-mpesa-600/25 hover:bg-mpesa-700'
          : 'bg-brand-600 shadow-brand-600/25 hover:bg-brand-700',
      !small && 'shadow-lg',
    )
    const content = (
      <>
        {small ? (
          status === 'Completed' ? <CheckCircle2 className="size-4" /> : <primary.icon className="size-4" />
        ) : (
          <span className={cn('grid size-7 place-items-center rounded-full bg-white', primary.teams ? 'text-[#5b5fc7]' : status === 'Completed' ? 'text-mpesa-600' : 'text-brand-600')}>
            {status === 'Completed' ? <Check className="size-4" strokeWidth={3} /> : <primary.icon className="size-4 fill-current" />}
          </span>
        )}
        <span className="flex-1 text-left sm:flex-none">{primary.label}</span>
        {!small && <ChevronRight className="size-5 transition group-hover:translate-x-0.5" />}
      </>
    )
    return primary.to ? (
      <Link to={primary.to} className={cls}>
        {content}
      </Link>
    ) : (
      <button onClick={primary.onClick} className={cls}>
        {content}
      </button>
    )
  }

  const stats: { icon: typeof Clock; title: string; sub: string; tile: string; dot: string; onClick?: () => void }[] = [
    {
      icon: isTeams ? Users : MapPin,
      title: isTeams ? 'Live on Teams' : 'In person',
      sub: isOnlineOnly ? 'Join from anywhere' : training.venue,
      tile: 'bg-brand-50/80 hover:bg-brand-50',
      dot: 'text-brand-600',
      onClick: () => scrollToSection('about'),
    },
    {
      icon: CalendarDays,
      title: formatDate(training.date, { month: 'short', day: 'numeric', year: 'numeric' }),
      sub: timeRange(training),
      tile: 'bg-zinc-100/80 hover:bg-zinc-100',
      dot: 'text-zinc-800',
      onClick:
        session === 'Upcoming'
          ? () => {
              downloadIcs(training)
              toast('Calendar invite downloaded')
            }
          : () => scrollToSection('about'),
    },
    {
      icon: GraduationCap,
      title: `${training.modules.length} modules`,
      sub: `${durationMinutes(training)} min of content`,
      tile: 'bg-mpesa-500/[0.08] hover:bg-mpesa-500/[0.12]',
      dot: 'text-mpesa-600',
      onClick: () => scrollToSection('modules'),
    },
    {
      icon: SquareCheckBig,
      title: `${percent}% complete`,
      sub: `${doneCount}/${training.modules.length} modules done`,
      tile: 'bg-brand-50/50 hover:bg-brand-50/80',
      dot: 'text-brand-600',
      onClick: () => scrollToSection(modulesDone ? 'assessment' : 'modules'),
    },
  ]

  const callout: { title: string; text: string; action: { label: string; to: string } | { label: string; onClick: () => void } } =
    status === 'Completed'
      ? { title: 'Your certificate is ready', text: 'Great work — you completed every module and passed the assessment.', action: { label: 'View certificate', to: `/certificates/${training.id}` } }
      : modulesDone
        ? { title: 'Ready to prove what you learned?', text: `Take the assessment and score ${PASS_MARK}% or more to get your certificate.`, action: { label: 'Take assessment', onClick: () => scrollToSection('assessment') } }
        : { title: 'Ready to apply what you learned?', text: 'Complete all modules and the assessment to get your certificate.', action: { label: doneCount ? 'Continue learning' : 'Start learning', onClick: () => scrollToSection('modules') } }

  const card = 'rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] sm:p-7'

  return (
    <div className="-m-4 bg-[#fafafa] pb-16 sm:-m-6">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-white to-[#fdf3f4]">
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-4 pt-6 pb-24 sm:px-8 sm:pb-28 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
              <Link to="/trainings" className="rounded p-0.5 text-zinc-700 hover:text-zinc-900" aria-label="Trainings home">
                <Home className="size-4" />
              </Link>
              <ChevronRight className="size-4 text-zinc-300" />
              <Link to="/trainings" className="hover:text-zinc-900 hover:underline">
                Trainings
              </Link>
              <ChevronRight className="size-4 text-zinc-300" />
              <span>{training.category}</span>
              <ChevronRight className="size-4 text-zinc-300" />
              <span className="max-w-[16rem] truncate font-semibold text-zinc-900">{training.title}</span>
            </nav>

            <img src="/M-PESA-red-logo.svg" alt="M-PESA" className="mt-6 h-7 w-auto" />
            <h1 className="mt-3 max-w-xl text-3xl leading-[1.1] font-bold tracking-tight text-zinc-900 sm:text-[2.6rem]">{training.title}</h1>
            <div className="mt-4 flex items-center gap-2.5 text-[15px] text-zinc-500">
              <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{initials(training.trainer)}</span>
              Trainer:
              <button onClick={() => scrollToSection('trainer')} className="font-medium text-zinc-900 hover:text-brand-600">
                {training.trainer}
              </button>
            </div>

            <div ref={heroCta} className="mt-7">
              {primaryButton()}
            </div>

            <div className="mt-5 space-y-2.5 text-sm text-zinc-600">
              <p className="flex flex-wrap items-center gap-2.5">
                {status === 'Completed' ? (
                  <CheckCircle2 className="size-5 fill-mpesa-600 text-white" />
                ) : (
                  <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
                    <circle cx="10" cy="10" r="8" fill="none" stroke="#e4e4e7" strokeWidth="3" />
                    <circle cx="10" cy="10" r="8" fill="none" stroke="#e60a2a" strokeWidth="3" strokeDasharray={`${(percent / 100) * 50.3} 50.3`} strokeLinecap="round" />
                  </svg>
                )}
                <span className="font-medium text-zinc-900">{percent}% complete</span>
                <span className="text-zinc-300">•</span>
                <span className={cn('inline-flex items-center gap-1.5 font-semibold', progressColor[status])}>
                  <span className={cn('size-2 rounded-full', status === 'Completed' ? 'bg-mpesa-500' : status === 'In Progress' ? 'bg-amber-500' : 'bg-zinc-300')} />
                  {status}
                </span>
              </p>
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <CalendarDays className="size-5 text-zinc-700" />
                {session === 'Upcoming' ? (
                  <>
                    Starts {formatDate(training.date, { weekday: 'long', month: 'long', day: 'numeric' })}
                    <span className="text-zinc-300">•</span>
                    <button
                      onClick={() => {
                        downloadIcs(training)
                        toast('Calendar invite downloaded')
                      }}
                      className="inline-flex items-center gap-1.5 font-medium text-zinc-900 hover:text-brand-600"
                    >
                      <CalendarPlus className="size-4 text-brand-600" /> Add to calendar
                    </button>
                  </>
                ) : session === 'Active' ? (
                  <>
                    Live today · {timeRange(training)}
                    {isTeams && <span className="text-zinc-500">· attendance is recorded automatically by Teams</span>}
                  </>
                ) : (
                  <>
                    Session held {formatDate(training.date)}
                    <span className="text-zinc-300">•</span>
                    <button className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-zinc-900 hover:text-brand-600">
                      <PlayCircle className="size-[18px] fill-charcoal text-white" /> Watch recording
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-6 lg:flex">
            <HeroIllustration className="w-[320px] xl:w-[370px]" />
            <blockquote className="hidden w-48 xl:block">
              <p className="text-xl leading-snug font-bold text-zinc-900">“Better skills. Stronger teams. Greater impact.”</p>
              <span className="mt-4 block h-1 w-14 rounded-full bg-brand-600" />
            </blockquote>
          </div>
        </div>
      </section>

      {/* Floating stats tiles */}
      <div className="relative mx-auto -mt-16 max-w-6xl px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-100 bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.07)] sm:gap-3 sm:p-3 lg:grid-cols-4">
          {stats.map((s) => (
            <button key={s.title} onClick={s.onClick} className={cn('group flex items-center gap-3 rounded-xl px-3 py-3 text-left transition sm:gap-4 sm:px-4 sm:py-4', s.tile)}>
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-sm sm:size-11', s.dot)}>
                <s.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-semibold text-zinc-900 sm:truncate sm:text-base">{s.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-zinc-500 sm:truncate">{s.sub}</span>
              </span>
              <ChevronRight className={cn('hidden size-4 shrink-0 transition group-hover:translate-x-0.5 sm:block', s.dot)} />
            </button>
          ))}
        </div>
      </div>

      {/* Sticky section nav (gains title + CTA once the hero button is off-screen) */}
      <div ref={stickyBar} className={cn('sticky top-16 z-10 mt-8 bg-[#fafafa]/95 backdrop-blur transition-shadow', compact && 'shadow-[0_4px_12px_rgba(0,0,0,0.06)]')}>
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          {compact && (
            <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2.5">
              <p className="min-w-0 truncate text-sm font-semibold text-zinc-900">{training.title}</p>
              <div className="shrink-0">{primaryButton(true)}</div>
            </div>
          )}
          <nav className="scrollbar-none flex gap-4 overflow-x-auto overflow-y-hidden border-b border-zinc-200" aria-label="Sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => scrollToSection(t.id)}
                aria-current={activeTab === t.id ? 'true' : undefined}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-2 py-3.5 text-sm font-semibold transition',
                  activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-600 hover:text-zinc-900',
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <section id="about" className={cn(card, 'scroll-mt-48')}>
            <SectionTitle icon={Target}>What you'll learn</SectionTitle>
            <ul className="mt-5 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
              {training.modules.map((m) => (
                <li key={m.id} className="flex gap-3 text-[15px] text-zinc-700">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand-600" strokeWidth={2.5} /> {m.title}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-zinc-100 pt-6 leading-relaxed text-zinc-600">{training.description}</p>

            <div className="mt-6 border-t border-zinc-100 pt-6">
              <SectionTitle icon={GraduationCap} small>
                Skills you'll practice
              </SectionTitle>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-700">{training.category}</span>
                <span className="rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-700">M-PESA</span>
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-6">
              <SectionTitle icon={Info} small solid>
                Details to know
              </SectionTitle>
              <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                <DetailItem icon={Award} title="Shareable certificate" sub={`Earned when you pass the assessment (${PASS_MARK}%+)`} />
                <DetailItem icon={isTeams ? Video : MapPin} title={isTeams ? 'Live on Microsoft Teams' : 'In-person session'} sub={isTeams ? (isOnlineOnly ? 'No travel needed' : `Or attend at ${training.venue}`) : training.venue} />
                <DetailItem icon={CalendarDays} title={formatDate(training.date, { weekday: 'long', month: 'long', day: 'numeric' })} sub={timeRange(training)} />
                <DetailItem icon={ListChecks} title={`${training.quiz.length}-question assessment`} sub="Unlocks after you finish all modules" />
              </div>
            </div>
          </section>

          <section id="modules" className={cn(card, 'scroll-mt-48')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <BookOpen className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Learn step-by-step</h2>
                  <p className="text-sm text-zinc-500">Work through each module, then mark it complete to track your progress.</p>
                </div>
              </div>
              <span className="text-sm text-zinc-500">
                {doneCount} of {training.modules.length} completed
              </span>
            </div>
            <ol className="mt-5">
              {training.modules.map((m, i) => {
                const done = p?.completedModules.includes(m.id) ?? false
                const last = i === training.modules.length - 1
                return (
                  <li key={m.id} className="relative">
                    {!last && <span className="absolute top-10 bottom-[-6px] left-[19px] border-l-2 border-dotted border-brand-200" aria-hidden />}
                    <button
                      onClick={() => onToggleModule(m.id)}
                      aria-pressed={done}
                      className={cn('group flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition hover:bg-zinc-50', !last && 'border-b border-zinc-100')}
                    >
                      <span
                        className={cn(
                          'relative grid size-6 shrink-0 translate-x-[4px] place-items-center rounded-full text-xs font-bold text-white',
                          done ? 'bg-mpesa-600' : 'bg-brand-600',
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={cn('flex-1 pl-1 text-[15px]', done ? 'text-zinc-400 line-through' : 'text-zinc-800')}>
                        {m.title} <span className="text-zinc-500 no-underline">({m.minutes} min)</span>
                      </span>
                      {done ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-mpesa-600">
                          <CheckCircle2 className="size-5" /> <span className="hidden sm:inline">Completed</span>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-500 group-hover:text-brand-600">
                          <Circle className="size-5 text-zinc-300 group-hover:text-brand-600" />
                          <span className="hidden sm:inline">Mark complete</span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>

            <div className="mt-5 flex gap-3 rounded-xl bg-zinc-50 p-4">
              <Star className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Recommended experience</h3>
                <p className="mt-0.5 text-sm text-zinc-500">Basic familiarity with M-PESA services and a smartphone.</p>
              </div>
            </div>
          </section>

          {modulesDone && (
            <section id="assessment" className={cn(card, 'scroll-mt-48')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <SectionTitle icon={FileText}>Assessment</SectionTitle>
                {p?.quizScore !== undefined && (
                  <span className={cn('text-sm font-medium', isPassed(p) ? 'text-mpesa-600' : 'text-brand-600')}>Best score: {p.quizScore}%</span>
                )}
              </div>
              <p className="mt-1 mb-5 text-sm text-zinc-500">Score at least {PASS_MARK}% to complete this training and earn your certificate.</p>
              <Quiz key={training.id} training={training} lastScore={p?.quizScore} onSubmit={onQuiz} />
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <aside className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 via-[#fff5f6] to-brand-100/60 p-7 text-center">
            <span className="absolute -top-10 -right-10 size-28 rounded-full bg-brand-200/50" aria-hidden />
            <span className="absolute -bottom-12 -left-8 size-28 rounded-full bg-brand-600/15" aria-hidden />
            <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
              {status === 'Completed' ? <Award className="size-7" /> : <Lightbulb className="size-7" />}
            </span>
            <h3 className="relative mt-4 text-lg font-bold text-zinc-900">{callout.title}</h3>
            <p className="relative mt-1.5 text-sm text-zinc-600">{callout.text}</p>
            {'to' in callout.action ? (
              <Link
                to={callout.action.to}
                className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mpesa-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-mpesa-700"
              >
                {callout.action.label} <ArrowRight className="size-4" />
              </Link>
            ) : (
              <button
                onClick={callout.action.onClick}
                className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700"
              >
                {callout.action.label} <ArrowRight className="size-4" />
              </button>
            )}
          </aside>

          <aside id="trainer" className={cn(card, 'scroll-mt-48')}>
            <h2 className="text-lg font-bold text-zinc-900">Trainer</h2>
            <div className="mt-4 flex items-center gap-3.5 border-b border-zinc-100 pb-5">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-zinc-100 text-base font-bold text-zinc-800">{initials(training.trainer)}</span>
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">{training.trainer}</p>
                <p className="text-sm text-zinc-500">M-PESA Learning &amp; Development</p>
              </div>
            </div>
            <h2 className="mt-5 text-lg font-bold text-zinc-900">Offered by</h2>
            <div className="mt-3 flex items-center gap-3.5">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white p-2">
                <img src="/M-PESA-red-logo.svg" alt="" className="w-full" />
              </span>
              <p className="font-semibold text-zinc-900">M-PESA Learning</p>
            </div>
          </aside>

          <aside id={modulesDone ? undefined : 'assessment'} className={cn(card, 'scroll-mt-48')}>
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <FileText className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Assessment</h2>
                <p className="text-sm text-zinc-500">
                  Score at least {PASS_MARK}% to complete this training and earn your certificate.
                </p>
              </div>
            </div>
            <button
              onClick={() => scrollToSection(modulesDone ? 'assessment' : 'modules')}
              className="mt-5 flex w-full items-center gap-3 rounded-xl bg-zinc-50 p-4 text-left text-sm text-zinc-600 transition hover:bg-zinc-100"
            >
              {status === 'Completed' ? (
                <CheckCircle2 className="size-5 shrink-0 text-mpesa-600" />
              ) : modulesDone ? (
                <LockOpen className="size-5 shrink-0 text-brand-600" />
              ) : (
                <Lock className="size-5 shrink-0 text-zinc-700" />
              )}
              <span className="flex-1">
                {status === 'Completed'
                  ? `Passed with ${p?.quizScore}%`
                  : modulesDone
                    ? p?.quizScore !== undefined
                      ? `Best score ${p.quizScore}% — try again`
                      : 'Unlocked — start the assessment'
                    : `Complete all ${training.modules.length} modules to unlock the assessment.`}
              </span>
              <ChevronRight className="size-4 shrink-0 text-zinc-700" />
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
