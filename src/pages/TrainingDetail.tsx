import { ArrowRight, Award, BookOpen, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronRight, Circle, Clock, FileText, GraduationCap, Home, Info, Layers, Lightbulb, ListChecks, Lock, LockOpen, MapPin, MessageSquare, Play, PlayCircle, SquareCheckBig, Star, Target, Users, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useFeedback } from '../components/Feedback'
import { Banner } from '../components/Banner'
import { PASS_MARK, LATE_WINDOW_MINUTES } from '../data/trainings'
import { downloadIcs } from '../lib/ics'
import { cn, certificateChecks, durationMinutes, formatDate, isPassed, nextModuleIndex, progressPercent, progressStatus, sessionStatus, timeRange } from '../lib/utils'
import { useStore } from '../store/AppStore'
import { learnPath } from './learn/outline'
import { UserAvatar } from '../components/UserAvatar'
import { useDialogFocus } from '../lib/useDialogFocus'

const tabs = [
  { id: 'about', label: 'About', icon: Info },
  { id: 'modules', label: 'Modules', icon: Layers },
  { id: 'assessment', label: 'Assessment', icon: FileText },
] as const

type TabId = (typeof tabs)[number]['id']

// App header (64px) + section tab row + breathing room.
const STICKY_OFFSET = 64 + 64 + 16

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
  const { getTraining, progress, checkIn } = useStore()
  const training = getTraining(id)
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const heroCta = useRef<HTMLDivElement>(null)
  const stickyBar = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('about')
  const [watching, setWatching] = useState(false)

  // On scroll: show the CTA in the sticky tab row once the hero button is hidden,
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

  const p = training ? progress[training.id] : undefined

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

  const status = progressStatus(training, p)
  const session = sessionStatus(training)
  const percent = progressPercent(training, p)
  const nextIdx = nextModuleIndex(training, p)
  const modulesDone = nextIdx === training.modules.length
  const doneCount = nextIdx
  const { checks: certChecks, eligible, mark } = certificateChecks(training, p, LATE_WINDOW_MINUTES)
  const isTeams = !!training.teamsJoinUrl
  const isOnlineOnly = training.venue === 'ONLINE'

  const learn = (item?: string) => navigate(learnPath(training.id, item))

  const join = () => {
    checkIn(training.id, 'teams')
    if (training.teamsJoinUrl!.includes('DEMO')) toast('Demo meeting — in production this opens Microsoft Teams', { tone: 'info' })
    else window.open(training.teamsJoinUrl, '_blank', 'noopener')
  }

  const doCheckIn = () => {
    checkIn(training.id, 'manual')
    toast('Checked in — attendance recorded')
  }

  // One clear primary action, chosen by where the learner is in the training.
  const primary: { label: string; onClick?: () => void; to?: string; icon: typeof Clock; teams?: boolean; disabled?: boolean } =
    status === 'Completed' && eligible
      ? { label: 'View certificate', to: `/certificates/${training.id}`, icon: Award }
      : session === 'Active' && isTeams
        ? { label: p?.attended ? 'Rejoin Live Training' : 'Join Live Training', onClick: join, icon: Video, teams: true }
        : session === 'Active' && !p?.checkInAt
          ? { label: 'Check in', onClick: doCheckIn, icon: MapPin }
          : !modulesDone
            ? { label: doneCount ? 'Continue learning' : 'Start learning', to: learnPath(training.id), icon: Play }
            : !isPassed(p)
              ? { label: 'Take assessment', to: learnPath(training.id, 'assessment'), icon: FileText }
              : !p?.feedback
                ? { label: 'Give feedback', to: learnPath(training.id, 'feedback'), icon: MessageSquare }
                : eligible
                  ? { label: 'View certificate', to: `/certificates/${training.id}`, icon: Award }
                  : { label: 'Check in', onClick: doCheckIn, icon: MapPin, disabled: session !== 'Active' }

  const primaryButton = (small = false) => {
    const cls = cn(
      'group inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-white shadow-sm transition',
      small ? 'px-4 py-2 text-sm' : 'w-full py-3 pr-6 pl-3 text-base sm:w-auto sm:min-w-[240px]',
      primary.teams
        ? 'bg-[#5b5fc7] hover:bg-[#4b4fb5]'
        : status === 'Completed'
          ? 'bg-mpesa-600 shadow-mpesa-600/25 hover:bg-mpesa-700'
          : 'bg-brand-600 shadow-brand-600/25 hover:bg-brand-700',
      !small && 'shadow-lg',
      primary.disabled && 'opacity-50',
    )
    const content = (
      <>
        {small ? (
          status === 'Completed' && eligible ? <CheckCircle2 className="size-4" /> : <primary.icon className="size-4" />
        ) : (
          <span className={cn('grid size-7 place-items-center rounded-full bg-white', primary.teams ? 'text-[#5b5fc7]' : status === 'Completed' ? 'text-mpesa-600' : 'text-brand-600')}>
            {status === 'Completed' && eligible ? <Check className="size-4" strokeWidth={3} /> : <primary.icon className="size-4 fill-current" />}
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
      <button onClick={primary.onClick} disabled={primary.disabled} className={cls}>
        {content}
      </button>
    )
  }

  const stats: { icon: typeof Clock; title: string; sub: string; tile: string; dot: string; onClick?: () => void }[] = [
    {
      icon: isTeams ? Users : MapPin,
      title: isTeams ? 'Live on Teams' : 'In person',
      sub: isOnlineOnly ? 'Join from anywhere' : training.venue,
      tile: 'bg-brand-50',
      dot: 'text-brand-600',
      onClick: () => scrollToSection('about'),
    },
    {
      icon: CalendarDays,
      title: formatDate(training.date, { month: 'short', day: 'numeric', year: 'numeric' }),
      sub: timeRange(training),
      tile: 'bg-zinc-100',
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
      tile: 'bg-mpesa-500/10',
      dot: 'text-mpesa-600',
      onClick: () => learn(training.modules[Math.min(nextIdx, training.modules.length - 1)].id),
    },
    {
      icon: SquareCheckBig,
      title: `${percent}% complete`,
      sub: `${doneCount}/${training.modules.length} modules done`,
      tile: 'bg-amber-500/10',
      dot: 'text-amber-600',
      onClick: () => learn(),
    },
  ]

  const callout: { title: string; text: string; action: { label: string; to: string } | { label: string; onClick: () => void } } =
    status === 'Completed' && eligible
      ? { title: 'Your certificate is ready', text: 'Great work — you completed every module, passed the assessment and left feedback.', action: { label: 'View certificate', to: `/certificates/${training.id}` } }
      : !modulesDone
        ? { title: 'Ready to apply what you learned?', text: 'Complete all modules and the assessment to get your certificate.', action: { label: doneCount ? 'Continue learning' : 'Start learning', to: learnPath(training.id) } }
        : !isPassed(p)
          ? { title: 'Ready to prove what you learned?', text: `Take the assessment and score ${PASS_MARK}% or more to get your certificate.`, action: { label: 'Take assessment', to: learnPath(training.id, 'assessment') } }
          : { title: 'One last step', text: 'Share your feedback to complete this training and unlock your certificate.', action: { label: 'Give feedback', to: learnPath(training.id, 'feedback') } }

  const card = 'rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-7'

  const markTone =
    mark === 'Present' ? 'bg-mpesa-500/10 text-mpesa-700' : mark === 'Late' ? 'bg-amber-500/10 text-amber-700' : mark === 'Absent' ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-zinc-600'

  return (
    <div className="-m-4 bg-[#fafafa] pb-16 sm:-m-6">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-white to-[#fdf3f4]">
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-4 pt-8 pb-24 sm:px-8 sm:pt-12 sm:pb-28 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-12">
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
              <span className="font-medium text-zinc-700">{training.category}</span>
            </nav>

            <h1 className="mt-6 max-w-xl text-3xl leading-[1.1] font-bold tracking-tight text-zinc-900 sm:text-[2.6rem]">{training.title}</h1>
            <div className="mt-4 flex items-center gap-2.5 text-[15px] text-zinc-500">
              <UserAvatar name={training.trainer} className="size-9" />
              Trainer:
              <button onClick={() => scrollToSection('trainer')} className="font-medium text-zinc-900 hover:text-brand-600">
                {training.trainer}
              </button>
            </div>

            <div ref={heroCta} className="mt-7">
              {primaryButton()}
            </div>

            <div className="mt-5 space-y-2.5 text-sm text-zinc-600">
              {(status !== 'Not Started' || mark !== 'Not yet') && (
                <p className="flex flex-wrap items-center gap-2.5">
                  {status === 'Completed' ? (
                    <CheckCircle2 className="size-5 fill-mpesa-600 text-white" />
                  ) : (
                    <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden>
                      <circle cx="10" cy="10" r="8" fill="none" stroke="#e4e4e7" strokeWidth="3" />
                      <circle cx="10" cy="10" r="8" fill="none" stroke="#d03c3b" strokeWidth="3" strokeDasharray={`${(percent / 100) * 50.3} 50.3`} strokeLinecap="round" />
                    </svg>
                  )}
                  <span className="font-medium text-zinc-900">{status === 'Completed' ? 'Completed' : `${percent}% complete`}</span>
                  {mark !== 'Not yet' && (
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', markTone)}>{mark}</span>
                  )}
                </p>
              )}
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
                    {training.recording ? (
                      <button onClick={() => setWatching(true)} className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-zinc-900 hover:text-brand-600">
                        <PlayCircle className="size-4 text-brand-600" /> Watch recording
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-500">
                        <PlayCircle className="size-4 text-zinc-400" /> Recording not shared yet
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Course cover in a rounded frame with a gradient overlay */}
          <div className="relative order-first aspect-[16/9] w-full overflow-hidden rounded-3xl bg-zinc-200 shadow-[0_18px_50px_rgba(0,0,0,0.14)] ring-1 ring-black/5 lg:order-none lg:aspect-[16/9] lg:w-[460px] xl:w-[500px]">
            {training.cover ? (
              <img src={training.cover} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <Banner training={training} className="absolute inset-0 size-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/25 via-transparent to-transparent" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 sm:p-5">
              <p className="min-w-0 truncate text-xs font-semibold tracking-wide text-white/85 uppercase">{training.category}</p>
              <span className="shrink-0 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-900 backdrop-blur">
                {session === 'Active' ? 'Live today' : session === 'Upcoming' ? 'Upcoming' : 'Session held'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Floating stats tiles */}
      <div className="relative mx-auto -mt-16 max-w-6xl px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <button key={s.title} onClick={s.onClick} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-card transition hover:border-zinc-300 sm:gap-3.5">
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full sm:size-11', s.tile, s.dot)}>
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
          <div className="flex items-center gap-4 border-b border-zinc-200">
          <nav className="scrollbar-none flex min-w-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden" aria-label="Sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => scrollToSection(t.id)}
                aria-current={activeTab === t.id ? 'true' : undefined}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-2 py-[18px] text-sm font-semibold transition',
                  activeTab === t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-zinc-600 hover:text-zinc-900',
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </nav>
          {/* Compact CTA slides into the tab row once the hero button scrolls away. */}
          <div className={cn('shrink-0 transition duration-200', compact ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0')} aria-hidden={!compact} inert={!compact}>
            {primaryButton(true)}
          </div>
          </div>
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
                <DetailItem icon={Award} title="Shareable certificate" sub={`Earned when you check in, pass the assessment (${PASS_MARK}%+) and leave feedback`} />
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
                  <p className="text-sm text-zinc-500">Modules unlock in order — finish each one to unlock the next.</p>
                </div>
              </div>
              <span className="text-sm text-zinc-500">
                {doneCount} of {training.modules.length} completed
              </span>
            </div>
            <ol className="mt-5">
              {training.modules.map((m, i) => {
                const done = i < nextIdx
                const locked = i > nextIdx
                const last = i === training.modules.length - 1
                return (
                  <li key={m.id} className="relative">
                    {!last && <span className="absolute top-10 bottom-[-6px] left-[19px] border-l-2 border-dotted border-brand-200" aria-hidden />}
                    <div
                      className={cn('group flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left transition', !locked && !done && 'hover:bg-zinc-50', !last && 'border-b border-zinc-100')}
                    >
                      <span
                        className={cn(
                          'relative grid size-6 shrink-0 translate-x-[4px] place-items-center rounded-full text-xs font-bold text-white',
                          done ? 'bg-mpesa-600' : locked ? 'bg-zinc-300' : 'bg-brand-600',
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : locked ? <Lock className="size-3.5" /> : i + 1}
                      </span>
                      {locked ? (
                        <span className="flex-1 cursor-not-allowed pl-1 text-left text-[15px] text-zinc-800">
                          {m.title} <span className="text-zinc-500">({m.minutes} min{m.kind === 'video' ? ' · video' : ''})</span>
                          <span className="block text-xs text-zinc-400">Finish module {nextIdx} first</span>
                        </span>
                      ) : (
                        <Link to={learnPath(training.id, m.id)} className={cn('flex-1 pl-1 text-left text-[15px] hover:text-brand-600', done ? 'text-zinc-400' : 'text-zinc-800')}>
                          {m.title} <span className="text-zinc-500">({m.minutes} min{m.kind === 'video' ? ' · video' : ''})</span>
                        </Link>
                      )}
                      {done ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-mpesa-600">
                          <CheckCircle2 className="size-5" /> <span className="hidden sm:inline">Completed</span>
                        </span>
                      ) : locked ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <Lock className="size-4" /> <span className="hidden sm:inline">Locked</span>
                        </span>
                      ) : (
                        <Link to={learnPath(training.id, m.id)} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                          <PlayCircle className="size-5" />
                          <span className="hidden sm:inline">{i === 0 && !doneCount ? 'Start' : 'Resume'}</span>
                        </Link>
                      )}
                    </div>
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

          <aside className={cn(card)}>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Award className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Certificate checklist</h2>
                <p className="text-sm text-zinc-500">All three are needed to earn your certificate.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {certChecks.map((c) => (
                <li key={c.key} className="flex items-start gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2.5">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mpesa-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-zinc-300" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-medium', c.ok ? 'text-zinc-900' : 'text-zinc-600')}>{c.label}</span>
                    <span className="block text-xs text-zinc-500">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {eligible ? (
              <Link to={`/certificates/${training.id}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-mpesa-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mpesa-700">
                <Award className="size-4" /> View certificate
              </Link>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">
                Complete the checks above — the certificate unlocks automatically.
              </p>
            )}
          </aside>

          <aside id="trainer" className={cn(card, 'scroll-mt-48')}>
            <h2 className="text-lg font-bold text-zinc-900">Trainer</h2>
            <div className="mt-4 flex items-center gap-3.5 border-b border-zinc-100 pb-5">
              <UserAvatar name={training.trainer} className="size-14" />
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
              <p className="leading-tight font-semibold text-zinc-900">
                M-PESA
                <span className="block text-sm font-medium text-zinc-500">Ethiopia</span>
              </p>
            </div>
          </aside>

          <aside id="assessment" className={cn(card, 'scroll-mt-48')}>
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
              onClick={() => learn(modulesDone ? 'assessment' : undefined)}
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

      {watching && training.recording && <RecordingPlayer title={training.title} src={training.recording} onClose={() => setWatching(false)} />}
    </div>
  )
}

/** Session recording in a lightbox; streamed only (no download), closes with Esc or the backdrop. */
function RecordingPlayer({ title, src, onClose }: { title: string; src: string; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useDialogFocus(panel, onClose)
  return (
    <div role="dialog" aria-modal="true" aria-label={`Recording: ${title}`} className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={panel} className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4 text-white">
          <p className="min-w-0 truncate text-sm font-semibold">
            <span className="text-white/60">Recording · </span>
            {title}
          </p>
          <button onClick={onClose} aria-label="Close recording" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
            <X className="size-4" />
          </button>
        </div>
        <video src={src} controls autoPlay controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} className="aspect-video w-full rounded-2xl bg-black shadow-2xl" />
      </div>
    </div>
  )
}
