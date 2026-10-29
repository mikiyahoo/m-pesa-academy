import { GuestNotice } from "../components/GuestNotice";
import {
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  SearchX,
  X,
} from "lucide-react";
import type { Material } from "../admin/types";
import { AssignmentReader, AssignmentRow } from "../components/Assignments";
import { useLearnerAssignments } from "../lib/assignments";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarSidebar, CalendarView } from "./CalendarPage";
import { SegmentTabs } from "../components/SegmentTabs";
import { journeys } from "../data/journeys";
import { TrainingCard, useFavourites } from "../components/TrainingCard";
import { cn, sessionStatus, todayISO } from "../lib/utils";
import { useStore } from "../store/AppStore";
import { LearningPathsTracker } from "../components/LearningPathsTracker";
import type { SessionStatus } from "../types";

type Tab = "All" | SessionStatus | "Favourites" | "Assigned" | "Paths";
const statusTabs: { value: Tab; label: string }[] = [
  { value: "All", label: "All Trainings" },
  { value: "Active", label: "Active" },
  { value: "Upcoming", label: "Upcoming" },
  { value: "Completed", label: "Completed" },
];
/** Saved and assigned items sit in their own group, apart from the status tabs. */
const savedTabs: { value: Tab; label: string }[] = [
  { value: "Paths", label: "Learning Paths" },
  { value: "Favourites", label: "Favourites" },
  { value: "Assigned", label: "Assigned" },
];
const tabs = [...statusTabs, ...savedTabs];

const VIEW_KEY = "mpesa-learning:trainings-view";

/** Grid or list, remembered per browser; shared with the home page's latest trainings. */
export type TrainingsView = "grid" | "list" | "calendar";

export function loadView(): "grid" | "list" {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Grid / list toggle; optional props tailor the available views for admin pages. */
export function ViewToggle<V extends TrainingsView>({
  view,
  onChange,
  calendar = false,
  grid = true,
  remember = true,
}: {
  view: V;
  onChange: (v: V) => void;
  calendar?: boolean;
  grid?: boolean;
  remember?: boolean;
}) {
  const options = [
    ...(grid ? ([["grid", LayoutGrid, "Grid view"]] as const) : []),
    ["list", List, "List view"] as const,
    ...(calendar ? ([["calendar", CalendarDays, "Calendar view"]] as const) : []),
  ] as const;
  const choose = (v: TrainingsView) => {
    onChange(v as V);
    // Grid and list can be remembered; calendar is a per-visit choice.
    if (v === "calendar" || !remember) return;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Remembering the view is a convenience only.
    }
  };
  const index = Math.max(0, options.findIndex(([v]) => v === view));
  const [, CurrentIcon, currentLabel] = options[index];
  const [nextView, , nextLabel] = options[(index + 1) % options.length];
  return (
    <>
      {/* Phones: one button showing the current view; each tap moves to the next. */}
      <button
        type="button"
        onClick={() => choose(nextView)}
        aria-label={`${currentLabel} — switch to ${nextLabel.toLowerCase()}`}
        title={`Switch to ${nextLabel.toLowerCase()}`}
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-charcoal text-white transition hover:bg-charcoal-light sm:hidden"
      >
        <CurrentIcon className="size-4" />
      </button>
      <div className="hidden rounded-xl border border-zinc-200 p-0.5 sm:flex">
        {options.map(([v, Icon, label]) => (
          <button
            key={v}
            onClick={() => choose(v)}
            aria-label={label}
            aria-pressed={view === v}
            className={cn("rounded-lg p-1.5 transition", view === v ? "bg-charcoal text-white" : "text-zinc-500 hover:bg-zinc-100")}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </>
  );
}

/** Learning tab: every training, with status tabs, category filter, search and grid / list view. */
export function Learning() {
  const { trainings, progress } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() =>
    tabs.some((x) => x.value === params.get("tab"))
      ? (params.get("tab") as Tab)
      : "All",
  );
  // Follow ?tab= links (e.g. from the notification bell) even when already on this page.
  const tabParam = params.get("tab");
  useEffect(() => {
    if (tabs.some((x) => x.value === tabParam)) setTab(tabParam as Tab);
  }, [tabParam]);
  const [category, setCategory] = useState("");
  const [view, setView] = useState<TrainingsView>(() =>
    params.get("view") === "calendar" ? "calendar" : loadView(),
  );
  const query = params.get("q")?.toLowerCase() ?? "";
  const journeyId = params.get("journey") ?? "";
  const journey = journeys.find((j) => j.id === journeyId);
  const pickJourney = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("journey", id);
    else next.delete("journey");
    setParams(next, { replace: true });
  };

  const categories = useMemo(
    () => [...new Set(trainings.map((t) => t.category))].sort(),
    [trainings],
  );
  const favourites = useFavourites();
  const assigned = useLearnerAssignments();
  const [reading, setReading] = useState<Material | null>(null);
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      All: trainings.length,
      Favourites: trainings.filter((t) => favourites.includes(t.id)).length,
      Assigned: assigned.length,
      Paths: journeys.length,
    };
    trainings.forEach(
      (t) => (c[sessionStatus(t)] = (c[sessionStatus(t)] ?? 0) + 1),
    );
    return c;
  }, [trainings, favourites, assigned]);

  const visible = trainings
    .filter(
      (t) =>
        tab === "All" ||
        (tab === "Favourites"
          ? favourites.includes(t.id)
          : sessionStatus(t) === tab),
    )
    .filter((t) => !category || t.category === category)
    .filter((t) => !journey || journey.trainingIds.includes(t.id))
    .filter(
      (t) =>
        !query ||
        [t.title, t.trainer, t.venue, t.category].some((f) =>
          f.toLowerCase().includes(query),
        ),
    )
    // Most recent first.
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    );

  return (
    <div className="space-y-6">
      <GuestNotice />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-zinc-900">
            Trainings
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {journey && (
            <button
              onClick={() => pickJourney("")}
              className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            >
              Journey: {journey.title} <X className="size-3.5" />
            </button>
          )}
          {(query || category) && (
            <button
              onClick={() => {
                setParams({});
                setCategory("");
              }}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200"
            >
              {query ? `Results for “${params.get("q")}”` : category}{" "}
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200/80 bg-white p-2.5 sm:gap-3">
        {/* Phones: status and category dropdowns plus one view button, all in a row. */}
        <label className="relative min-w-0 flex-[1.1] sm:hidden">
          <span className="sr-only">Show</span>
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="h-10 w-full appearance-none rounded-xl bg-brand-600 pr-7 pl-3 text-xs font-semibold text-white shadow-sm shadow-brand-600/30 outline-none focus:ring-2 focus:ring-brand-200"
          >
            {tabs.map((t) => (
              <option key={t.value} value={t.value} className="bg-white text-zinc-900">
                {t.label} ({counts[t.value] ?? 0})
              </option>
            ))}
          </select>
          <ChevronRight className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 rotate-90 text-white" />
        </label>
        <div className="hidden min-w-0 flex-wrap items-center gap-2 sm:flex">
          <SegmentTabs
            label="Filter trainings by status"
            items={statusTabs.map((t) => ({
              ...t,
              badge: counts[t.value] ?? 0,
            }))}
            value={tab}
            onChange={setTab}
          />
          <span className="hidden h-6 w-px bg-zinc-200 sm:block" aria-hidden />
          <SegmentTabs
            label="Saved and assigned"
            items={savedTabs.map((t) => ({
              ...t,
              badge: counts[t.value] ?? 0,
            }))}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex items-center gap-2 max-sm:contents">
          <label className="relative max-sm:min-w-0 max-sm:flex-1">
            <span className="sr-only">Category</span>
            <Filter className="pointer-events-none absolute top-1/2 left-3 hidden size-4 -translate-y-1/2 text-zinc-500 sm:block" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none rounded-xl border border-zinc-200 bg-white py-2 pr-9 pl-9 max-sm:h-10 max-sm:w-full max-sm:pr-7 max-sm:pl-3 max-sm:text-xs text-sm text-zinc-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute top-1/2 right-3 size-4 max-sm:right-2 -translate-y-1/2 rotate-90 text-zinc-500" />
          </label>
          <ViewToggle view={view} onChange={setView} calendar />
        </div>
      </div>

      {tab === "Paths" ? (
        <LearningPathsTracker />
      ) : tab === "Assigned" ? (
        assigned.length ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-2">
            <div className="divide-y divide-zinc-100">
              {assigned.map((m) => (
                <AssignmentRow key={m.id} m={m} onOpen={setReading} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid place-items-center rounded-2xl border border-zinc-200/80 bg-white px-6 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <BookOpenCheck className="size-8" />
            </span>
            <p className="mt-4 text-lg font-bold text-zinc-900">
              Nothing assigned to you
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Documents your training team sends you to read will appear here.
            </p>
          </div>
        )
      ) : view === "calendar" ? (
        <CalendarView trainings={visible} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {visible.length ? (
              <div
                className={cn(
                  "grid gap-4",
                  view === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
                    : "grid-cols-1",
                )}
              >
                {visible.map((t) => (
                  <TrainingCard
                    key={t.id}
                    training={t}
                    progress={progress[t.id]}
                    layout={view}
                  />
                ))}
              </div>
            ) : (
              <div className="grid place-items-center rounded-2xl border border-zinc-200/80 bg-white px-6 py-16 text-center">
                <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <SearchX className="size-8" />
                </span>
                <p className="mt-4 text-lg font-bold text-zinc-900">
                  {tab === "Favourites" && !query && !category
                    ? "No favourites yet"
                    : "No trainings found"}
                </p>
                <p className="mt-1 max-w-sm text-sm text-zinc-500">
                  {tab === "Favourites" && !query && !category
                    ? "Tap the heart on any training to keep it here."
                    : "Try another tab, category or search term."}
                </p>
              </div>
            )}
          </div>
          {/* Today and what's coming up, like the calendar view. */}
          <CalendarSidebar
            trainings={trainings}
            selected={todayISO()}
            className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1 xl:content-start"
          />
        </div>
      )}
      {reading && (
        <AssignmentReader m={reading} onClose={() => setReading(null)} />
      )}
    </div>
  );
}
