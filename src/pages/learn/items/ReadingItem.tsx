import { BookOpen, Check, Download, FileText, Presentation, Timer } from "lucide-react";
import { PptxViewer } from "../../../components/PptxViewer";
import { useEffect, useState } from "react";
import { canDownload, DOCUMENT_MIN_SECONDS } from "../../../data/trainings";
import { cn } from "../../../lib/utils";
import type { Module } from "../../../types";
import {
  CompletionRow,
  ItemTitle,
  Watermark,
  btnPrimary,
  clock,
} from "./shared";

type Props = {
  module: Module;
  index: number;
  total: number;
  done: boolean;
  canUndo: boolean;
  watermark: string;
  onComplete: () => void;
  onUndo: () => void;
};

/**
 * Document lesson shown as a reading. A minimum reading time must pass before it
 * can be marked complete (TE-3.1); the source deck stays downloadable (D4).
 */
export function ReadingItem({
  module: m,
  index,
  total,
  done,
  canUndo,
  watermark,
  onComplete,
  onUndo,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [showDeck, setShowDeck] = useState(false);
  const slides = m.slides ?? [];

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(
      () => setElapsed((e) => Math.min(e + 1, DOCUMENT_MIN_SECONDS)),
      1000,
    );
    return () => window.clearInterval(t);
  }, [done]);

  // Highlights the section currently near the top of the reading pane.
  const [active, setActive] = useState(0);
  useEffect(() => {
    const sections = [
      ...document.querySelectorAll<HTMLElement>("[data-section]"),
    ];
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0])
          setActive(Number((visible[0].target as HTMLElement).dataset.section));
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [m.id]);

  const ready = done || elapsed >= DOCUMENT_MIN_SECONDS;
  const pct = done ? 100 : (elapsed / DOCUMENT_MIN_SECONDS) * 100;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-6 sm:px-8 sm:py-10 xl:grid-cols-[minmax(0,1fr)_220px] 2xl:gap-10">
      <article className="relative min-w-0">
        <Watermark text={watermark} />
        <ItemTitle
          eyebrow={
            <>
              <BookOpen className="size-4 text-brand-600" /> Module {index + 1}{" "}
              of {total} • {m.minutes} min
            </>
          }
          title={m.title}
        />

        {/* Reading-time bar: status on the left, progress, time on the right */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-zinc-100/80 px-3 py-3 sm:gap-5 sm:px-4">
          <span className="flex shrink-0 items-center gap-2.5">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                ready
                  ? "bg-mpesa-600 text-white"
                  : "bg-white text-brand-600 shadow-sm",
              )}
            >
              {ready ? (
                <Check className="size-4" strokeWidth={3} />
              ) : (
                <Timer className="size-4" />
              )}
            </span>
            <span
              className={cn(
                "hidden text-xs font-semibold sm:inline",
                ready ? "text-mpesa-700" : "text-zinc-700",
              )}
            >
              {done ? "Completed" : ready ? "Ready to complete" : "Reading…"}
            </span>
          </span>
          <span className="relative h-1.5 flex-1 rounded-full bg-zinc-300/70">
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear",
                ready ? "bg-mpesa-600" : "bg-zinc-900",
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="shrink-0 text-xs font-semibold text-zinc-700 tabular-nums">
            {clock(done ? DOCUMENT_MIN_SECONDS : elapsed)} /{" "}
            {clock(DOCUMENT_MIN_SECONDS)}
          </span>
        </div>

        {/* Narrower screens: the "On this page" list becomes a jump menu. */}
        {slides.length > 1 && (
          <label className="mt-5 flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 xl:hidden">
            <span className="shrink-0 text-xs font-semibold text-zinc-500">Jump to</span>
            <select
              value=""
              onChange={(e) => {
                const i = Number(e.target.value);
                if (!Number.isNaN(i)) document.getElementById(sectionId(i))?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-900 outline-none"
              aria-label="Jump to section"
            >
              <option value="" disabled>
                {String(active + 1).padStart(2, "0")} · {slides[active]?.title}
              </option>
              {slides.map((sl, i) => (
                <option key={sl.title} value={i}>
                  {String(i + 1).padStart(2, "0")} · {sl.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-9 space-y-8 text-[15px] leading-relaxed text-zinc-700">
          <section>
            <p>Hello,</p>
            <p className="mt-3">
              This reading walks you through{" "}
              <span className="font-semibold text-zinc-900">
                {m.title.toLowerCase()}
              </span>
              . Take your time — the next lesson unlocks once you mark this one
              complete.
            </p>
            {slides.length > 0 && (
              <>
                <h2 className="mt-6 font-bold text-zinc-900">
                  What this reading covers
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-6 marker:text-brand-600">
                  {slides.map((s) => (
                    <li key={s.title}>{s.title}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {slides.map((s, i) => (
            <section
              key={s.title}
              id={sectionId(i)}
              data-section={i}
              className={cn(
                "scroll-mt-6",
                i === 0 && "border-t border-zinc-200/80 pt-8",
              )}
            >
              <h2 className="flex items-center gap-3 text-lg font-bold text-zinc-900">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-3">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-zinc-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!slides.length && (
            <p className="text-zinc-500">
              The trainer hasn't attached the reading for this module yet.
            </p>
          )}

          {m.deck && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900">
                  Presentation slides
                </p>
                <p className="text-xs text-zinc-500">
                  {canDownload(m)
                    ? "PowerPoint • downloadable for your group"
                    : "View in the portal • downloads are limited to other groups"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeck((v) => !v)}
                aria-expanded={showDeck}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                <Presentation className="size-3.5" /> {showDeck ? "Hide slides" : "View slides"}
              </button>
              {canDownload(m) ? (
                <a
                  href={m.deck}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  <Download className="size-3.5" /> Download
                </a>
              ) : (
                <span className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-500">
                  View only
                </span>
              )}
            </div>
          )}
          {m.deck && showDeck && <PptxViewer url={m.deck} title={m.title} />}
        </div>

        <CompletionRow done={done} canUndo={canUndo} onUndo={onUndo}>
          <p className="text-sm text-zinc-600">
            {ready
              ? "Finished reading? Mark it complete to unlock the next lesson."
              : `Keep reading — you can complete this in ${DOCUMENT_MIN_SECONDS - elapsed}s.`}
          </p>
          <button onClick={onComplete} disabled={!ready} className={btnPrimary}>
            <Check className="size-4" strokeWidth={3} /> Mark as complete
          </button>
        </CompletionRow>
      </article>

      {slides.length > 1 && (
        <aside className="hidden xl:block">
          <nav
            aria-label="On this page"
            className="sticky top-6 rounded-2xl border border-zinc-200/80 bg-white p-3"
          >
            <p className="px-2 pt-1 pb-2 text-sm font-semibold text-zinc-900">
              On this page
            </p>
            <ol className="space-y-0.5">
              {slides.map((s, i) => (
                <li key={s.title}>
                  <button
                    onClick={() =>
                      document
                        .getElementById(sectionId(i))
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    aria-current={active === i ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border-l-2 px-2.5 py-2 text-left text-xs transition",
                      active === i
                        ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                        : "border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                    )}
                  >
                    <span className="tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 truncate">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      )}
    </div>
  );
}

const sectionId = (i: number) => `reading-section-${i + 1}`;
