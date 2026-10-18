import {
  Target,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  Lock,
  MapPin,
  MessageSquare,
  PanelLeft,
  PlayCircle,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useFeedback } from "../../components/Feedback";
import { LATE_WINDOW_MINUTES } from "../../data/trainings";
import { certificateChecks, cn, todayISO } from "../../lib/utils";
import { useAuth } from "../../store/Auth";
import { useStore } from "../../store/AppStore";
import { AssessmentItem } from "./items/AssessmentItem";
import { ReadingItem } from "./items/ReadingItem";
import { VideoItem } from "./items/VideoItem";
import {
  CertificateItem,
  FeedbackItem,
  LockedItem,
  SessionItem,
} from "./items/WrapItems";
import {
  buildOutline,
  learnPath,
  type ItemKind,
  type Outline,
  type OutlineItem,
} from "./outline";
import { UserAvatar } from "../../components/UserAvatar";

const KIND_ICON: Record<ItemKind, typeof BookOpen> = {
  session: Video,
  reading: BookOpen,
  video: PlayCircle,
  assessment: ListChecks,
  feedback: MessageSquare,
  certificate: Award,
};

/**
 * Course player: an outline of the training on the left (sections, items, locks)
 * and the open item on the right, with previous / next navigation.
 */
export function CoursePlayer() {
  const { id = "", itemId } = useParams();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const { user } = useAuth();
  const {
    getTraining,
    progress,
    completeModule,
    undoModule,
    checkIn,
    submitQuiz,
    submitFeedback,
  } = useStore();
  // True while an assessment is running: hides the prev/next footer so it can't be skipped mid-attempt.
  const [focus, setFocus] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setDrawer(false);
  }, [itemId]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const training = getTraining(id);
  if (!training) return <Navigate to="/trainings" replace />;
  const p = progress[training.id];
  const outline = buildOutline(training, p);
  const current = outline.items.find((i) => i.id === outline.currentId)!;
  const index = outline.items.findIndex((i) => i.id === itemId);
  if (!itemId || index === -1)
    return <Navigate to={learnPath(training.id, outline.currentId)} replace />;

  const item = outline.items[index];
  const prev = outline.items[index - 1];
  const next = outline.items[index + 1];
  const go = (target: string) => navigate(learnPath(training.id, target));
  const doneModules = training.modules.filter((m) =>
    p?.completedModules.includes(m.id),
  ).length;
  const percent = Math.round((outline.doneCount / outline.total) * 100);
  const watermark = `${user.name} • ${todayISO()}`;

  const onComplete = (moduleId: string) => {
    completeModule(training.id, moduleId);
    if (doneModules + 1 === training.modules.length)
      toast("All modules done — the assessment is unlocked", {
        action: { label: "Open", onClick: () => go("assessment") },
      });
    else toast("Lesson completed — the next one is unlocked");
  };
  const onUndo = () => {
    undoModule(training.id);
    toast("Lesson marked as not complete", { tone: "info" });
  };

  const renderItem = () => {
    if (item.state === "locked")
      return (
        <LockedItem
          item={item}
          training={training}
          progress={p}
          doneModules={doneModules}
          current={current}
          onGo={() => go(current.id)}
        />
      );
    switch (item.kind) {
      case "session":
        return (
          <SessionItem
            training={training}
            progress={p}
            onCheckIn={(method) => checkIn(training.id, method)}
          />
        );
      case "reading":
      case "video": {
        const i = item.moduleIndex!;
        const m = training.modules[i];
        const props = {
          module: m,
          index: i,
          total: training.modules.length,
          done: item.state === "done",
          canUndo: i === doneModules - 1 && p?.quizScore === undefined,
          watermark,
          onComplete: () => onComplete(m.id),
          onUndo,
        };
        return item.kind === "video" ? (
          <VideoItem key={m.id} {...props} />
        ) : (
          <ReadingItem key={m.id} {...props} />
        );
      }
      case "assessment":
        return (
          <AssessmentItem
            training={training}
            progress={p}
            onSubmit={(score) => submitQuiz(training.id, score)}
            onFocusChange={setFocus}
            onNext={() => go("feedback")}
            onReview={() => go(training.modules[0].id)}
          />
        );
      case "feedback":
        return (
          <FeedbackItem
            training={training}
            progress={p}
            onSubmit={(f) => {
              submitFeedback(training.id, f);
              const { eligible } = certificateChecks(
                training,
                { ...(p ?? { completedModules: [] }), feedback: f },
                LATE_WINDOW_MINUTES,
              );
              if (eligible)
                toast("Training completed — certificate earned! 🎉", {
                  action: { label: "View", onClick: () => go("certificate") },
                });
              else
                toast(
                  "Feedback saved — your attendance is still needed for the certificate",
                  { tone: "info" },
                );
            }}
            onNext={() => go("certificate")}
          />
        );
      case "certificate":
        return <CertificateItem training={training} progress={p} />;
    }
  };

  const nextLocked = !next || next.state === "locked";

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-white px-3 sm:px-5">
        <button
          onClick={() => setDrawer(true)}
          className="grid size-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 lg:hidden"
          aria-label="Open course outline"
        >
          <PanelLeft className="size-5" />
        </button>
        <Link
          to="/trainings"
          className="flex shrink-0 items-center gap-2"
          aria-label="M-PESA Academy home"
        >
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
          <span className="hidden leading-none font-bold tracking-tight text-zinc-900 sm:block">
            <span className="block text-sm leading-[1.05]">M-PESA</span>
            <span className="block text-xs leading-[1.05] font-semibold text-zinc-500">
              Academy
            </span>
          </span>
        </Link>
        <span className="hidden h-6 w-px bg-zinc-200 sm:block" />
        <Link
          to={`/trainings/${training.id}`}
          className="hidden items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline-flex"
        >
          <ArrowLeft className="size-4" /> Course overview
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-zinc-900 sm:text-left md:pl-4">
          <span className="hidden md:inline">{training.title}</span>
        </p>
        <span
          className="flex items-center gap-2 text-sm font-semibold text-zinc-700"
          title={`${outline.doneCount} of ${outline.total} items done`}
        >
          <ProgressRing percent={percent} />
          <span className="hidden sm:inline">{percent}%</span>
        </span>
        <UserAvatar name={user.name} className="size-9 ring-1 ring-zinc-200" />
      </header>

      <div className={"flex min-h-0 flex-1 gap-4 p-0 sm:p-4"}>
        {/* Outline (desktop) */}
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/70 bg-white lg:flex">
          <OutlinePanel
            trainingTitle={training.title}
            overviewTo={`/trainings/${training.id}`}
            outline={outline}
            activeId={item.id}
            onPick={go}
            current={current}
          />
        </aside>

        {/* Content */}
        <main
          className={
            "flex min-w-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-zinc-200/70"
          }
        >
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
            {renderItem()}
          </div>
          {!focus && (
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-100 px-3 py-3 sm:px-6">
              <button
                onClick={() => prev && go(prev.id)}
                disabled={!prev}
                className="flex min-w-0 max-w-[40%] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-zinc-100 disabled:invisible"
              >
                <ArrowLeft className="size-4 shrink-0 text-zinc-600" />
                {/* One line: "Previous • item title". */}
                <span className="hidden min-w-0 truncate text-xs text-zinc-500 sm:block">
                  <span className="text-sm font-semibold text-zinc-800">
                    Previous
                  </span>
                  {prev && (
                    <>
                      <span className="mx-1.5 text-zinc-300">•</span>
                      {prev.title}
                    </>
                  )}
                </span>
              </button>
              <div className="flex min-w-0 items-center gap-3">
                {next && (
                  <div className="hidden min-w-0 items-center gap-2.5 md:flex">
                    {(() => {
                      const NextIcon = KIND_ICON[next.kind];
                      return (
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">
                          <NextIcon className="size-4" />
                        </span>
                      );
                    })()}
                    {/* Next item: title and length on one line. */}
                    <p
                      className="min-w-0 truncate text-xs text-zinc-500"
                      title={nextLocked ? next.lockedReason : undefined}
                    >
                      <span className="font-semibold text-zinc-800">
                        {next.title}
                      </span>
                      <span className="mx-1.5 text-zinc-300">•</span>
                      {nextLocked && item.state !== "done"
                        ? "Finish this item first"
                        : next.meta}
                    </p>
                  </div>
                )}
                {!next && <p className="text-xs text-zinc-500">Last item</p>}
                <button
                  onClick={() => next && go(next.id)}
                  disabled={nextLocked}
                  title={nextLocked && next ? next.lockedReason : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                    item.state === "done" && !nextLocked
                      ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700"
                      : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
                  )}
                >
                  Next lesson <ArrowRight className="size-4" />
                </button>
              </div>
            </footer>
          )}
        </main>
      </div>

      {/* Outline drawer (mobile / tablet) */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label="Course outline"
            className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white shadow-2xl"
          >
            <OutlinePanel
              trainingTitle={training.title}
              overviewTo={`/trainings/${training.id}`}
              outline={outline}
              activeId={item.id}
              onPick={go}
              current={current}
              onClose={() => setDrawer(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const c = 2 * Math.PI * 8;
  return (
    <svg viewBox="0 0 20 20" className="size-6 -rotate-90" aria-hidden>
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="#e4e4e7"
        strokeWidth="3"
      />
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke={
          percent === 100 ? "var(--color-mpesa-600)" : "var(--color-brand-600)"
        }
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * c} ${c}`}
      />
    </svg>
  );
}

function OutlinePanel({
  trainingTitle,
  overviewTo,
  outline,
  activeId,
  current,
  onPick,
  onClose,
}: {
  trainingTitle: string;
  overviewTo: string;
  outline: Outline;
  activeId: string;
  current: OutlineItem;
  onPick: (id: string) => void;
  onClose?: () => void;
}) {
  const activeSection = outline.sections.find((s) =>
    s.items.some((i) => i.id === activeId),
  )?.id;
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(activeSection ? [activeSection] : []),
  );
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the open item's section expanded and in view.
  useEffect(() => {
    if (activeSection)
      setOpen((s) =>
        s.has(activeSection) ? s : new Set(s).add(activeSection),
      );
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeSection, activeId]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const pct = (outline.doneCount / outline.total) * 100;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-bold text-zinc-900">
            {trainingTitle}
          </h2>
          {onClose && (
            <Link
              to={overviewTo}
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              <ArrowLeft className="size-4" /> Course overview
            </Link>
          )}
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label="Close outline"
          >
            <X className="size-5" />
          </button>
        ) : (
          <Link
            to={overviewTo}
            className="grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label="Back to course overview"
            title="Course overview"
          >
            <X className="size-5" />
          </Link>
        )}
      </div>

      <div className="border-b border-zinc-100 px-5 py-4">
        <div>
          <p className="flex items-center justify-between text-sm">
            <span className="font-semibold text-zinc-900">Your progress</span>
            <span className="text-zinc-500">
              {outline.doneCount}/{outline.total} items
            </span>
          </p>
          <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <span
              className={cn(
                "block h-full rounded-full transition-[width]",
                pct === 100 ? "bg-mpesa-600" : "bg-brand-600",
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
          {current.id !== activeId && current.state !== "done" ? (
            <button
              onClick={() => onPick(current.id)}
              className="mt-3 flex w-full items-center gap-2 text-left text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              <Target className="size-4 shrink-0" />
              <span className="truncate">Up next: {current.title}</span>{" "}
              <ArrowRight className="size-3.5 shrink-0" />
            </button>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              {pct === 100
                ? "All done — great work!"
                : "Finish this item to unlock the next one."}
            </p>
          )}
        </div>
      </div>

      <nav
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-4"
        aria-label="Course outline"
      >
        {outline.sections.map((s) => {
          const expanded = open.has(s.id);
          const sectionDone = s.items.every((i) => i.state === "done");
          return (
            <div key={s.id} className="border-b border-zinc-100 last:border-0">
              <button
                onClick={() => toggle(s.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-zinc-50/80"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-zinc-500">
                    {s.label}
                  </span>
                  <span className="block font-semibold text-zinc-900">
                    {s.title}
                  </span>
                </span>
                {sectionDone ? (
                  <CheckCircle2 className="size-4 text-mpesa-600" />
                ) : s.locked ? (
                  <Lock className="size-4 text-zinc-400" />
                ) : null}
                <ChevronDown
                  className={cn(
                    "size-4 text-zinc-500 transition",
                    expanded && "rotate-180",
                  )}
                />
              </button>
              {expanded && (
                <ul className="space-y-1 px-3 pb-3">
                  {s.items.map((i) => {
                    const active = i.id === activeId;
                    const Icon = KIND_ICON[i.kind];
                    return (
                      <li key={i.id}>
                        <button
                          ref={active ? activeRef : undefined}
                          onClick={() => onPick(i.id)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                            active
                              ? "border-brand-500 bg-brand-50/60"
                              : "border-transparent hover:bg-zinc-50",
                          )}
                        >
                          <span className="mt-0.5 shrink-0">
                            {i.state === "done" ? (
                              <CheckCircle2 className="size-5 fill-mpesa-600 text-white" />
                            ) : i.state === "locked" ? (
                              <span className="grid size-5 place-items-center rounded-full bg-zinc-100 text-zinc-400">
                                <Lock className="size-3" />
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "block size-5 rounded-full border-2",
                                  i.id === current.id
                                    ? "border-brand-600"
                                    : "border-zinc-300",
                                )}
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-sm leading-snug",
                                active
                                  ? "font-semibold text-zinc-900"
                                  : i.state === "locked"
                                    ? "text-zinc-500"
                                    : "text-zinc-800",
                              )}
                            >
                              {i.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                              {i.kind === "session" && i.state !== "done" ? (
                                <MapPin className="size-3" />
                              ) : (
                                <Icon className="size-3" />
                              )}
                              {i.meta}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
