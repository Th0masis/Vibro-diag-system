# UX Audit Remediation — Handover

**Date:** 2026-07-20
**Source:** [docs/ux-audit-vibro-diag-system.md](./ux-audit-vibro-diag-system.md) + [docs/ux-pravidla-pro-ai-agenty.md](./ux-pravidla-pro-ai-agenty.md)
**Status:** Frontend polish + one backend feature (soft-delete) implemented across 3 rounds in a single day. Not yet rebuilt/deployed — user rebuilds Docker containers manually.

Use this file to pick up where the previous session left off. It supersedes any older mental model of "what's still open" from the audit doc itself — check the tables below first.

---

## 1. What's done

### Round 1 — P0 critical + quick P1 wins
- **Notification system**: new [`frontend/src/components/ToastProvider.jsx`](../frontend/src/components/ToastProvider.jsx) (`useToast()` hook: `.success/.error/.warning/.info/.undo`), mounted in [`main.jsx`](../frontend/src/main.jsx) wrapping `<App/>`. All native `alert()` calls replaced with toasts; `window.confirm()` in `MlSector.jsx` replaced with `ConfirmModal` for the production-deploy action.
- **WCAG contrast fixes**: `#94A3B8`/`#9CA3AF` → `var(--neutral-gray)` everywhere (focus rings, muted text, dots). AI banner "good" color `#059669`→`#047857`. Fixed a red-instead-of-orange `rgba(228,0,43,...)` bug on `.custom-select:focus`.
- **Typography scale tokens** added (`--text-xs`…`--text-4xl` at the time).
- Machine card spacing nudged onto the 4/8px grid; graph:note ratio moved toward golden ratio; AI banner margin symmetrized (proximity fix).
- Dashboard: skeleton-card loading state instead of a spinner; empty state got a "+ Add machine" CTA; inline hex status colors replaced with CSS classes.
- `MachineDetail.jsx` tabs: full ARIA tabs pattern (`role=tablist/tab/tabpanel`, `aria-selected`, roving `tabIndex`, arrow/Home/End keyboard nav).

### Round 2 — grid system, monospace, mobile tabs, undo/soft-delete
- **Breakpoints unified**: all 14 scattered `@media` values in `App.css` remapped onto 4 shared tiers — **639 (mobile) / 899 (tablet) / 1199 (laptop) / default (desktop)**. Don't introduce a 5th value; round to the nearest of these.
- **Sidebar widths & gutters**: new `--sidebar-width` (320px) / `--sidebar-width-compact` (280px) tokens, applied to `.ml-sector-layout` and `.service-notes-timeline-layout` (previously 340/300px and 290–360px). Gutters unified to `var(--space-6)`/`var(--space-5)`.
- **Monospace unification**: new `--font-mono` token (`'DM Mono', 'Courier New', monospace`); removed stray Consolas/Monaco/Menlo declarations.
- **Status dots are shape-differentiated**, not color-only: `--ok`=circle, `--warning`=triangle (`clip-path`), `--fault`=diamond (`rotate(45deg)`).
- **Hex→token sweep (exact duplicates only)**: `#ffffff`→`--neutral-bg-white`, `#e2e8f0`→`--neutral-border`, `#111111`→`--neutral-black`, `#6B7280`→`--neutral-gray`.
- **Mobile tabs**: `MachineDetail.jsx` now shows only 4 primary tabs (graphs/diagnostics/history/sensors) on ≤639px + a "More" button opening a real bottom sheet (`.tab-sheet*` CSS) for notes/settings. Desktop/tablet unchanged (still the full horizontal bar with edge-fade).
- **Soft-delete + Undo (P1-5)**: see [section 3](#3-soft-delete--undo-feature-details) below — this is the one backend/DB change in scope.

### Round 3 — typography & color token adoption ("focus on typography and colors")
- **Every raw `font-size` value in `App.css`** now uses a token (`--text-xs`…`--text-5xl`). Added `--text-5xl: 3rem` for one large icon-glyph case. Values were rounded to nearest token (see mapping table in session memory if you need to re-derive it).
- **Text color consolidation**: new `--text-heading` (`#0F172A`, merges `#111827`/`#1F2937`) and `--text-secondary` (`#475569`, merges `#4B5563`/`#555555`) tokens. `#1e293b`/`#334155` folded into existing `--neutral-dark-gray`; `#64748b`/`#999999` folded into existing `--neutral-gray`.
- Scoped strictly to the `color:` (text) property — `background-color`/`border-color` were not touched by this pass, except one paired `border-color` that was updated to match its sibling `color: var(--text-heading)` declaration for consistency.

---

## 2. What's still open (deliberately deferred)

| Item | Why it's not done | Recommended approach next time |
|---|---|---|
| **Full spacing 8px/4px grid sweep** (~373 raw `padding`/`margin`/`gap` px/rem declarations across `App.css`) | Unlike font-size/color, rounding a spacing value changes real visual layout (does `10px` become `8px` or `12px`?) — this needs per-instance judgment, not a safe blind regex. Only the machine-card component was done manually in round 1. | Go component-by-component (not a global sweep), decide rounding per visual context, and do a visual QA pass (browser) after each component, not after the whole file. |
| **Golden ratio elsewhere** | Only the machine-card graph:note ratio (140:86) was adjusted. Other two-panel layouts use the new `--sidebar-width` tokens but not a golden-ratio percentage split. | Optional/cosmetic — low priority per the audit itself (P3). |
| **Users page hard-delete** | Audit flags this as higher-risk (account/access changes) and explicitly recommends *keeping* the confirm dialog there — intentionally left untouched. | No action needed unless requirements change. |
| **Sensor "detach" confirm dialog** | Detach ≠ delete (sensor isn't destroyed, just unassigned; fully reversible by re-attaching) — intentionally left as a `ConfirmModal`, not converted to toast+undo. | No action needed. |

---

## 3. Soft-delete / Undo feature details

This is the only change that touches the backend and database, so it needs more care than the CSS work.

- **Schema**: `deleted_at timestamp with time zone` added to `sensors` and `service_notes` tables in [`init.sql`](../init.sql) (applies only to *fresh* DB volumes).
- **Migration for already-running DBs**: [`db/migrations/001_add_soft_delete.sql`](../db/migrations/001_add_soft_delete.sql). **This has already been applied to the current dev DB** (verified via `\d sensors` / `\d service_notes` showing the column). If you spin up a fresh/different DB volume that was cloned before this change, re-run:
  ```powershell
  Get-Content -Raw 'db\migrations\001_add_soft_delete.sql' | docker exec -i vibro-db psql -U vibro_user -d vibro_diag
  ```
  (Note: PowerShell doesn't support `<` redirection — must pipe via `Get-Content`.)
- **Backend** (`backend/main.py`): `DELETE /sensors/{id}` and `DELETE /machines/{id}/notes/{id}` now soft-delete (`UPDATE ... SET deleted_at = now()`) instead of hard `DELETE`. New endpoints: `POST /sensors/{id}/restore`, `POST /machines/{id}/notes/{id}/restore`. All read/list queries (sensor lists, machine detail, `last_note` subqueries, channel-conflict checks) now filter `deleted_at IS NULL`.
- **Frontend**: `Sensors.jsx` and `ServiceNotes.jsx` delete buttons now optimistically remove the row and show `toast.undo(message, onUndo)` (6s countdown) instead of a confirm dialog. Clicking Undo calls the `/restore` endpoint.
- **No migration framework exists** (Alembic/Flyway) — this repo relies on `init.sql` for fresh installs. Any future schema change needs the same two-part treatment (update `init.sql` + add a numbered file under `db/migrations/`).

---

## 4. Known pitfalls (read before doing more bulk CSS edits)

1. **`App.css` is UTF-8 *without* BOM** and contains Czech diacritics (e.g. "PROMĚNNÉ", "ZÁKLADNÍ"). Plain PowerShell `Get-Content -Raw | ... | Set-Content` **corrupts these into mojibake**. Always use:
   ```powershell
   $enc = New-Object System.Text.UTF8Encoding($false)
   $content = [System.IO.File]::ReadAllText($path, $enc)
   # ...modify $content...
   [System.IO.File]::WriteAllText($path, $content, $enc)
   ```
   Prefer `replace_string_in_file`/`multi_replace_string_in_file` over terminal scripting whenever the edit isn't a genuine bulk/regex sweep.
2. **PowerShell hashtables (`@{}`) are case-insensitive by default.** Using hex colors that differ only by case as hashtable keys (e.g. `'#0F172A'` and `'#0f172a'`) silently collapses/drops entries with no error you'll notice unless you check the output count. Use an array of pairs + `foreach` instead when keys can differ by case.
3. **Bulk `:root` token sweeps can create circular `var()` references.** If you regex-replace a hex value file-wide, it will also hit the token's own definition line (e.g. `--neutral-gray: #6B7280;` → `--neutral-gray: var(--neutral-gray);`). Always re-check the `:root` block after any blind hex sweep.
4. **Scoping color replacements to avoid `background-color`/`border-color` collisions**: anchor regex to start-of-line (`^\s*color:\s*#HEX;`, multiline mode) rather than a bare `color:\s*#HEX` substring match. Caveat: this misses single-line inline rules like `.sel { background: x; color: #hex; }` — always grep for leftover non-anchored matches afterward and fix those by hand (there were 3–4 each time).
5. **No local lint/build available in this environment**: `npm`/`npx`/`eslint` are blocked by PowerShell execution policy or missing from `node_modules/.bin`. Rely on the `get_errors` tool + manual review; don't try to run `npm run lint`/`build` yourself.
6. **The user runs `docker build` manually after every frontend change** — don't offer to do it yourself unless explicitly asked. None of the changes in rounds 1–3 have been rebuilt/deployed yet as of this handover.

---

## 5. Files touched (for reference)

```
backend/main.py                                  (soft-delete endpoints + query filters)
init.sql                                         (deleted_at columns)
db/migrations/001_add_soft_delete.sql            (new — manual migration for existing DBs)
frontend/src/main.jsx                             (ToastProvider wiring)
frontend/src/App.css                              (bulk of the design-token/CSS work)
frontend/src/components/ToastProvider.jsx         (new)
frontend/src/components/MachineCard.jsx
frontend/src/components/MachineDiagnostics.jsx
frontend/src/components/MachineSensors.jsx
frontend/src/components/MeasurementDetailModal.jsx
frontend/src/components/MeasurementsHistory.jsx
frontend/src/components/ModelTrainingModal.jsx
frontend/src/components/ServiceNotes.jsx           (soft-delete + undo flow)
frontend/src/pages/Dashboard.jsx
frontend/src/pages/MachineDetail.jsx               (ARIA tabs + mobile bottom sheet)
frontend/src/pages/Machines.jsx
frontend/src/pages/MlSector.jsx                    (ConfirmModal instead of window.confirm)
frontend/src/pages/Sensors.jsx                     (soft-delete + undo flow)
frontend/src/pages/UserManagement.jsx
```

---

## 6. Suggested next steps

1. **Rebuild and visually QA** in the browser (frontend + backend containers) — none of rounds 1–3 have been visually verified live yet.
2. If that looks good, tackle the **spacing grid sweep** component-by-component (see section 2), checking each in the browser before moving to the next.
3. Re-read [docs/ux-audit-vibro-diag-system.md](./ux-audit-vibro-diag-system.md) once more after the spacing pass — at that point nearly everything in the original audit will be closed out except the intentionally-skipped items (Users hard-delete, sensor detach dialog, golden-ratio elsewhere).
