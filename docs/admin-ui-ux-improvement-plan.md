# Admin UI/UX Improvement Plan

Status: draft for review · Scope: `/admin` shell and all admin/trainer screens (`src/admin/**`)
Baseline commit: `fbefbb4` + working tree (13 Oct 2026)

> **Progress (13 Oct):** the learner visual language is now applied to the admin shell and
> shared primitives — rounded-2xl cards with soft shadows, pill badges/inputs/search,
> learner-style red pill `Tabs` (with `role="tablist"` + arrow keys), full modal focus
> lifecycle (trap/restore/`aria-labelledby`), brand-tinted sidebar nav, gradient sidebar
> promo card (learner `KeepLearningCard` parity), rounded-full header controls with
> platform-aware `⌘/Ctrl K`, Escape on all popovers + mobile drawer, `scope="col"` tables,
> tinted `Empty` states, accessible dashboard chart, and a mobile card fallback for the
> Trainings list. Remaining: Phase 0.1 (nav registry), 0.7 (shared chips), Phase 1 (IA
> grouping), 2.2–2.7, 3.1–3.6 beyond Trainings, 4.x, 5.x.

## 1. Purpose

The admin console already has a solid foundation (shared primitives, dark mode, command
palette, breadcrumbs, print styles). This plan lists the concrete UI/UX gaps found by
reviewing the code, ordered so that cheap, high-impact fixes land first and structural
work follows without breaking what exists.

Everything here stays inside the current stack: React 19 + React Router 7 + Tailwind v4 +
lucide-react, no new dependencies (see `package.json`).

## 2. What already works (keep, don't rewrite)

| Area | Where |
| --- | --- |
| Shared primitives: Card, Button, Badge, Modal, Table, Tabs, Field/Input, Empty, PageHeader, SearchInput, downloadCsv | `src/admin/ui.tsx` |
| Collapsible sidebar + mobile drawer + breadcrumbs + dark mode | `src/admin/AdminLayout.tsx` |
| Ctrl/⌘+K palette across pages, trainings, journeys, materials, people | `src/admin/CommandPalette.tsx` |
| Toasts + async confirm dialogs | `src/components/Feedback.tsx` |
| Empty states, status tones, conflict detection, audit trail with field-level diffs | `Trainings.tsx`, `ui.tsx`, `store.tsx` |
| Print-ready reports/certificates | `print:` classes across admin + learner |
| Learner-side accessible tabs (`role="tablist"`) and reusable RowMenu | `src/components/SegmentTabs.tsx`, `src/components/RowMenu.tsx` |

## 3. Findings (with evidence)

### 3.1 Information architecture & navigation

- **F1 · Three parallel navigation sources of truth.** The sidebar (`AdminLayout.tsx:42-88`),
  the command palette page list (`CommandPalette.tsx:9-29`) and the breadcrumb label map
  (`AdminLayout.tsx:210-232`) are hand-maintained duplicates. They have already drifted:
  `/admin/certificates` is in the sidebar but missing from the palette, and every new page
  currently requires edits in up to three files.
- **F2 · Flat, oversized sidebar.** 16 leaf items + 5 groups in one column; only 5 are
  grouped. "Training Content", "Feedback", "Assessments" are grouped while "Certificates"
  and "Certificate Templates" sit as separate top-level entries. High cognitive load on
  first login.
- **F3 · Icon collisions.** `GraduationCap` is used both for "Trainings" and the
  "Training Content" group; icons don't reinforce labels.
- **F4 · Shortcut label is not platform aware.** Header shows `Ctrl K` always
  (`AdminLayout.tsx:411`), which is wrong on macOS.

### 3.2 Accessibility

- **F5 · Admin `Tabs` lack tab semantics.** `ui.tsx:181-196` renders plain buttons, while
  the learner `SegmentTabs` correctly uses `role="tablist"` / `role="tab"` /
  `aria-selected`. Screen-reader users get an inconsistent experience between the two.
- **F6 · Table headers have no `scope="col"`.** `Table` (`ui.tsx:162-179`) also caps
  `min-width`, so on narrow screens every list becomes a horizontal scroll with no
  indication and no list/card fallback.
- **F7 · Modal focus management.** `Modal` (`ui.tsx:122-149`) closes on Escape but does
  not trap focus, does not restore focus to the trigger, and the title is not linked via
  `aria-labelledby`.
- **F8 · Popovers are mouse-only.** Alerts bell (`AdminLayout.tsx:268+`), user footer menu
  and mobile drawer close on outside click only — no Escape handling, no focus move into
  the panel, no return focus.
- **F9 · Colour/contrast to verify.** `text-brand-600` (`#d03c3b`) on white for 11–12px
  links/badges is borderline WCAG AA (≈4.5:1); dark theme remaps the whole zinc scale
  (`src/index.css:28-46`), so every `focus:ring-brand-100` and `text-zinc-500` pairing
  needs a pass in dark mode.
- **F10 · Dashboard chart has no text alternative.** The sessions-per-month bars
  (`Dashboard.tsx:36-49`) are visual only; no table/`aria-label` fallback.

### 3.3 Consistency & interaction patterns

- **F11 · Two pagination models.** Only `AdminUsers` paginates
  (`People.tsx:13,131-133,279+`); Trainings, Requests, Materials, Responses, Audit logs
  render every row at once.
- **F12 · Two row-menu implementations.** `People.tsx` hand-rolls a `menu` state dropdown
  while the learner Report uses the robust shared `RowMenu` (`src/components/RowMenu.tsx`,
  which already handles clipping inside scrolling tables, Escape, scroll and resize).
- **F13 · Empty states are inconsistent.** Some pages use `<Empty>` (`Trainings.tsx:107`),
  others inline copy (`Dashboard.tsx:165` "Nothing scheduled.", `Requests`, `People`).
- **F14 · Duplicated inline badges.** The Series/Conflict chips are copy-pasted markup
  (`Trainings.tsx:64-76`) instead of a shared component; `title=` tooltips are used instead
  of an accessible tooltip pattern.
- **F15 · Two theme toggles.** Header (`AdminLayout.tsx:417`) and user footer
  (`AdminLayout.tsx:154`) both toggle dark mode with different visual treatments.
- **F16 · Primary/danger semantics.** `danger` buttons render as brand-tinted outline
  (`ui.tsx:32`), which reads like a secondary action; destructive confirms rely on copy
  alone.

### 3.4 Performance & code health

- **F17 · No route-level code splitting.** `App.tsx` eagerly imports every admin page;
  the largest files are `Evaluation.tsx` (57 KB), `Reports.tsx` (36 KB), `Content.tsx`
  (31 KB), `TemporaryAccess.tsx` (25 KB), `People.tsx` (23 KB). One admin bundle for all
  roles, including learners who never see it.
- **F18 · Lint baseline: 30 warnings, 0 errors** (`npm run lint`, oxlint). Notable
  UX-relevant ones: `set-state-in-effect` in `CommandPalette.tsx:41` (palette resets state
  in an effect instead of on open) and impure `new Date()` during render in
  `Reports.tsx:75` / `Settings.tsx:33`, which can produce unstable print timestamps.
- **F19 · Trainer nav duplicates admin nav.** `trainerNav` (`AdminLayout.tsx:91-99`) is a
  second hard-coded list that must be kept in sync manually with routes and permissions.

### 3.5 Responsive & mobile

- **F20 · Tables are the mobile experience.** With F6, every management screen scrolls
  horizontally on a phone; the training request queue is unusable one-handed.
- **F21 · Mobile drawer** (`AdminLayout.tsx:380-390`) lacks Escape close and focus
  management (ties into F8).

## 4. The plan

Phases are ordered by impact/cost. Each phase is independently shippable; nothing requires
a redesign of the visual language.

### Phase 0 — Quick wins (0.5–1 day)

| # | Change | Files |
| --- | --- | --- |
| 0.1 | Single navigation registry: one exported `adminNav` structure (label, icon, to, children, palette keywords) consumed by sidebar, breadcrumbs and palette — deletes `crumbLabels` and `pages` duplication | new `src/admin/nav.ts`, `AdminLayout.tsx`, `CommandPalette.tsx` |
| 0.2 | Platform-aware shortcut label (`⌘ K` on Mac, `Ctrl K` otherwise) + `aria-keyshortcuts` on the search button | `AdminLayout.tsx` |
| 0.3 | Add tab semantics to admin `Tabs` (`role="tablist"`, `role="tab"`, `aria-selected`, arrow-key navigation) — mirror `SegmentTabs` | `src/admin/ui.tsx` |
| 0.4 | `scope="col"` on `Table` headers; visually-hidden caption support | `src/admin/ui.tsx` |
| 0.5 | Escape closes alerts popover, user footer menu, mobile drawer; move focus in on open and restore on close | `AdminLayout.tsx` |
| 0.6 | Standardise empty states on `<Empty>` everywhere (dashboard "Nothing scheduled.", requests, people, responses) | `Dashboard.tsx`, `Requests.tsx`, `People.tsx`, `Evaluation.tsx` |
| 0.7 | Extract `SeriesChip` / `ConflictChip` into `ui.tsx` and reuse; conflict tooltip gets an accessible label instead of `title` only | `Trainings.tsx`, `TrainingDetail.tsx`, `Calendar.tsx` |
| 0.8 | Accessible dashboard chart: `role="img"` + `aria-label` summary, plus a visually-hidden data table | `Dashboard.tsx` |

**Acceptance:** `npm run lint` warnings ≤ baseline; palette and sidebar can no longer
drift (one source); keyboard-only pass over every popover and tab list.

### Phase 1 — Navigation & IA (2–3 days)

| # | Change | Detail |
| --- | --- | --- |
| 1.1 | Group the sidebar into sections | **Deliver** (Dashboard, Trainings, Calendar, Requests), **Content** (Journeys, Materials, Categories, Training Types), **Evaluate** (Feedback, Assessments, Submissions), **People** (Users, Temporary access, Groups), **Govern** (Certificates, Templates, Audit logs, Reports). Section labels, not just nesting. |
| 1.2 | Merge related top-level items | "Certificates" + "Certificate Templates" become one page with tabs; "All Types" + "By Category" exposed as tabs, not two nav entries. |
| 1.3 | Distinct icon per group | fix F3 (e.g. Library for content, ClipboardCheck for evaluation). |
| 1.4 | Derive trainer nav from the registry | one registry with `roles: ['admin','trainer']` flags instead of `trainerNav` (F19). |
| 1.5 | Palette actions | add verbs: "New training", "Invite user", "Open pending requests", "Reset demo data" — the palette currently only navigates (F1 scope). |
| 1.6 | Persist sidebar collapse + last-open groups per user | same localStorage pattern as `THEME_KEY` (`AdminLayout.tsx:265`). |

**Acceptance:** top-level nav ≤ 8 entries; every nav entry reachable and correctly
labelled from the palette; trainer sees only their destinations.

### Phase 2 — Accessibility hardening (2 days)

| # | Change | Detail |
| --- | --- | --- |
| 2.1 | Modal focus lifecycle | focus first field on open, trap Tab inside, restore focus to trigger, `aria-labelledby`/`aria-describedby` (`ui.tsx:122`). |
| 2.2 | Skip-to-content link + landmark in `AdminLayout` | `<main>` gets an id; link is the first focusable element. |
| 2.3 | Contrast audit light + dark | verify `brand-600` small text, `zinc-500` on `canvas`, badge tones, focus rings; adjust tokens in `src/index.css` where below 4.5:1 (F9). |
| 2.4 | Touch targets ≥ 40×40 on mobile | header icon buttons are `p-1.5` (~32px); add hit padding. |
| 2.5 | Reduced motion | honour `prefers-reduced-motion` for the sidebar width transition and animated rings. |
| 2.6 | Form validation pattern | keep inline errors (`People.tsx:80-81`) but add `aria-invalid` + `aria-describedby` and a summary on submit for multi-field modals. |
| 2.7 | Keyboard table actions | row menus reachable via Tab, open with Enter/Space (shared `RowMenu`, F12). |

**Acceptance:** manual keyboard walkthrough of Dashboard → Trainings → New training →
Save with zero traps; axe/Lighthouse a11y ≥ 95 on `/admin` in both themes.

### Phase 3 — List & table experience (3 days)

| # | Change | Detail |
| --- | --- | --- |
| 3.1 | Shared toolbar pattern | search + tabs + primary action in one consistent row (`toolbar` slot on `Table` or a `Toolbar` component). |
| 3.2 | Pagination component | extract `Pagination` from `People.tsx:279-295` into `ui.tsx`; apply to Trainings, Materials, Feedback responses, Submissions, Audit logs (F11). 10–25/page, resets to page 0 when filters change. |
| 3.3 | Mobile card fallback | below `sm`, render list rows as stacked cards (title, status, key meta, overflow menu) instead of horizontal scroll (F6/F20). |
| 3.4 | Filters in the URL | keep filter + search state in the query string so refresh, back-button and sharing work (Trainings, Requests, Reports). |
| 3.5 | Bulk actions | select-all + bulk approve/reject for Training Requests and bulk status for trainings, using the existing confirm dialog pattern. |
| 3.6 | Adopt shared `RowMenu` in `People.tsx` | delete the local `menu` state (F12). |

**Acceptance:** no horizontal page scroll at 360px width on any admin list; filters survive
refresh; bulk actions write audit entries like single actions do.

### Phase 4 — Feedback & safety (1.5 days)

| # | Change | Detail |
| --- | --- | --- |
| 4.1 | Undo for destructive list actions | delete material, revoke access, cancel training get a short "Undo" in the toast on top of the confirm dialog. |
| 4.2 | Distinct danger styling | real destructive button (red fill) vs. brand primary, so "Delete" can't be confused with "Save" (F16). |
| 4.3 | Saving state | buttons show a busy state on submit (pattern in `Login.tsx`/`AcceptInvite.tsx`) for modals with simulated latency. |
| 4.4 | Alerts surface | bell popover gets "View all" leading to a filterable alerts list instead of only popover items. |
| 4.5 | First-run guidance | one-time dismissible banner for new admins (pending requests, invite temporary users). |

**Acceptance:** every destructive flow = confirm + audit log + undo/restore path.

### Phase 5 — Performance & code health (2 days, partly parallel)

| # | Change | Detail |
| --- | --- | --- |
| 5.1 | Route-level `React.lazy` + `Suspense` for admin pages in `App.tsx` | loading fallback reuses the existing spinner pattern; learners never download admin chunks (F17). |
| 5.2 | Split large pages into folder modules (pattern already used: `src/admin/reports/**`, `src/admin/checkin/**`) | `Evaluation/` (57 KB), `Content/` (31 KB), `TemporaryAccess/` (25 KB). |
| 5.3 | Drive lint warnings to 0 | fix `CommandPalette` state-in-effect (reset via key/prop), hoist `new Date()` out of render in `Reports.tsx:75` and `Settings.tsx:33` (F18). |
| 5.4 | Move shared constants out of `ui.tsx` | `trainingStatusTone`, `requestStatusTone`, `downloadCsv` to a `src/admin/status.ts` so fast refresh keeps working (`only-export-components` warnings). |

**Acceptance:** `npm run lint` → 0 warnings; admin initial JS reduced (compare
`npm run build` output before/after); learner bundle no longer contains admin pages.

## 5. Out of scope (for this plan)

- Backend/API integration and real email/SMS delivery (tracked as Y05 in
  `docs/traceability.json`) — loading skeletons and error boundaries are deferred until
  data is async; the plan keeps a slot for them (Phase 3.1 toolbar / 4.3 busy states).
- Visual rebrand: colours, typography and the M-PESA pattern stay as defined in
  `src/index.css`.
- Learner and requester apps, except where a shared primitive change (F5, F12) touches them.

## 6. Definition of done

1. `npm run lint` and `npm run build` clean.
2. One navigation registry; no duplicated route/label lists.
3. Keyboard-only walkthrough of every admin screen, including modals and popovers.
4. WCAG 2.1 AA contrast in light **and** dark theme.
5. Usable at 360px, 768px, 1280px, 1920px with no horizontal page scroll.
6. `docs/traceability.json` requirements still pass (statuses must not regress from
   `done`/`partial`).

## 7. Suggested sequence

```
Week 1:  Phase 0 (quick wins) → Phase 5.3/5.4 (lint debt)
Week 2:  Phase 1 (IA) → Phase 2 (accessibility)
Week 3:  Phase 3 (tables/lists) → Phase 4 (feedback/safety)
Week 4:  Phase 5.1/5.2 (code splitting) → full QA pass against §6
```



