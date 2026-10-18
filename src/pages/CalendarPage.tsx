import {
  ArrowRight,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DateTile,
  EventChip,
  Legend,
  StatusPill,
  type Tone,
} from "../components/CalendarParts";
import {
  cn,
  formatDate,
  parseDate,
  progressStatus,
  sessionStatus,
  timeRange,
  todayISO,
} from "../lib/utils";
import { useStore } from "../store/AppStore";
import type { Training, TrainingProgress } from "../types";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Kind = "Active" | "Upcoming" | "Completed" | "In Progress";
const KIND_TONE: Record<Kind, Tone> = {
  Active: "red",
  Upcoming: "amber",
  Completed: "green",
  "In Progress": "blue",
};

/** Live today = Active; future = Upcoming; past sessions are Completed or still In Progress for this learner. */
function kindOf(t: Training, p?: TrainingProgress): Kind {
  const s = sessionStatus(t);
  if (s === "Active") return "Active";
  if (s === "Upcoming")
    return progressStatus(t, p) === "In Progress" ? "In Progress" : "Upcoming";
  return progressStatus(t, p) === "Completed" ? "Completed" : "In Progress";
}

/** Month calendar of trainings; shown as the Calendar view on the Trainings page, using its filters. */
export function CalendarView({ trainings }: { trainings: Training[] }) {
  const { progress } = useStore();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const d = parseDate(today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);

  const days = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(1 - start.getDay());
    // Only as many weeks as the month needs (5 or 6).
    const weeks = Math.ceil(
      (start.getDay() +
        new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() +
        cursor.getDay()) /
        7,
    );
    return Array.from(
      { length: Math.max(5, Math.min(6, weeks)) * 7 },
      (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      },
    );
  }, [cursor]);

  const byDate = useMemo(() => {
    const map: Record<string, Training[]> = {};
    trainings.forEach((t) => (map[t.date] ??= []).push(t));
    return map;
  }, [trainings]);

  const shift = (n: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const goToday = () => {
    const d = parseDate(today);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(today);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <h2 className="text-lg font-bold text-zinc-900">
                {cursor.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToday}
                  className="rounded-xl border border-zinc-200 px-3.5 py-1.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                >
                  Today
                </button>
                <div className="flex rounded-xl border border-zinc-200">
                  <button
                    onClick={() => shift(-1)}
                    className="grid size-8 place-items-center rounded-l-xl text-zinc-600 hover:bg-zinc-50"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    onClick={() => shift(1)}
                    className="grid size-8 place-items-center rounded-r-xl border-l border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    aria-label="Next month"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 border-y border-zinc-100 text-left text-xs font-medium text-zinc-500">
              {weekdays.map((d) => (
                <div key={d} className="px-2.5 py-2.5 sm:px-4">
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = iso(d);
                const items = byDate[key] ?? [];
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = key === today;
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(key)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      (e.preventDefault(), setSelected(key))
                    }
                    aria-label={`${formatDate(key)}, ${items.length} session${items.length === 1 ? "" : "s"}`}
                    aria-pressed={selected === key}
                    className={cn(
                      "relative flex min-h-20 cursor-pointer flex-col gap-1.5 border-r border-b border-zinc-100 p-1.5 text-left transition sm:min-h-32 sm:p-3 [&:nth-child(7n)]:border-r-0",
                      // Today: soft pink cell with a red outline; other selected day: light grey.
                      isToday
                        ? "z-10 rounded-xl bg-brand-50/80 ring-1 ring-brand-300 ring-inset"
                        : selected === key
                          ? "bg-zinc-50"
                          : "hover:bg-zinc-50/70",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-sm sm:size-8 sm:text-[15px]",
                        isToday
                          ? "bg-brand-600 font-bold text-white"
                          : inMonth
                            ? "font-medium text-zinc-800"
                            : "text-zinc-400",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {items.slice(0, 2).map((t) => (
                      <EventChip
                        key={t.id}
                        tone={KIND_TONE[kindOf(t, progress[t.id])]}
                        title={t.title}
                        time={timeRange(t)}
                        to={`/trainings/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                    {items.length > 2 && (
                      <span className="px-1 text-[10px] font-medium text-zinc-500">
                        +{items.length - 2} more
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3.5 sm:px-5">
              <Legend
                items={(Object.keys(KIND_TONE) as Kind[]).map((k) => ({
                  label: k,
                  tone: KIND_TONE[k],
                }))}
              />
            </div>
          </section>
        </div>

        <CalendarSidebar
          trainings={trainings}
          selected={selected}
          onToday={goToday}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-1 2xl:content-start"
        />
      </div>
    </div>
  );
}

/**
 * The day panel (sessions on the selected day, or "all caught up") and "Coming up" list.
 * Used beside the month calendar and beside the grid / list views on Trainings.
 */
export function CalendarSidebar({
  trainings,
  selected,
  onToday,
  className,
}: {
  trainings: Training[];
  selected: string;
  onToday?: () => void;
  className?: string;
}) {
  const { progress } = useStore();
  const today = todayISO();
  const goToday = onToday ?? (() => undefined);
  const selectedSessions = trainings.filter((t) => t.date === selected);
  const upcoming = trainings
    .filter((t) => t.date >= today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    );
  return (
    <aside className={className}>
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-zinc-900">
            {formatDate(selected, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {selected !== today && (
            <button
              onClick={goToday}
              className="rounded-xl border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Today
            </button>
          )}
        </div>
        {selectedSessions.length ? (
          <ul className="mt-4 space-y-2.5">
            {selectedSessions.map((t) => {
              const kind = kindOf(t, progress[t.id]);
              return (
                <li key={t.id}>
                  <Link
                    to={`/trainings/${t.id}`}
                    className="group block overflow-hidden rounded-xl border border-zinc-200 transition hover:border-zinc-300 hover:shadow-sm"
                  >
                    {t.cover && (
                      <img
                        src={t.cover}
                        alt=""
                        className="h-24 w-full object-cover"
                      />
                    )}
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900">
                          {t.title}
                        </p>
                        <StatusPill tone={KIND_TONE[kind]}>{kind}</StatusPill>
                      </div>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="size-3.5" /> {timeRange(t)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        {t.teamsJoinUrl ? (
                          <Video className="size-3.5" />
                        ) : (
                          <MapPin className="size-3.5" />
                        )}{" "}
                        {t.teamsJoinUrl ? "Microsoft Teams" : t.venue}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-1.5">
                        {kind === "Active"
                          ? "Join or check in"
                          : kind === "Completed"
                            ? "View training"
                            : "Open training"}{" "}
                        <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-2xl bg-brand-50/60 px-5 py-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
              <CalendarCheck2 className="size-7" />
            </span>
            <p className="mt-3 font-bold text-zinc-900">
              {selected === today
                ? "You’re all caught up!"
                : "Nothing on this day"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {selected === today
                ? "No training sessions scheduled for today. Explore available courses to keep learning."
                : "Pick another day, or browse trainings to plan ahead."}
            </p>
            <Link
              to="/learning?tab=Upcoming"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
            >
              Browse trainings <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-zinc-900">Coming up</h3>
          <Link
            to="/learning?tab=Upcoming"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {upcoming.length ? (
          <ul className="mt-3 divide-y divide-zinc-100">
            {upcoming.slice(0, 4).map((t) => {
              const kind = kindOf(t, progress[t.id]);
              return (
                <li key={t.id}>
                  <Link
                    to={`/trainings/${t.id}`}
                    className="group flex items-center gap-3 py-3"
                  >
                    <DateTile date={t.date} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold text-zinc-900">
                        {t.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="size-3.5" /> {timeRange(t)}
                      </span>
                      <span className="mt-1.5 block">
                        <StatusPill tone={KIND_TONE[kind]}>{kind}</StatusPill>
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No upcoming sessions.</p>
        )}
      </section>
    </aside>
  );
}
