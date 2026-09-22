# QA Record — تحدي الحروف (5×5 frontend demo)

Date: 2026-09-21. Performed by: Claude (Sonnet 5), continuing from Codex handoff (`CLAUDE_HANDOFF.md`).
Server: `node server.mjs` → http://127.0.0.1:4173/ (confirmed correct `Content-Type: image/png` for the stage asset).

## Method

1. Reread the full PDF spec (`تحدي الحروف منصة.pdf`, all 13 pages) end to end and cross-checked it against the live `app.js`/`styles.css`/`index.html`, not just the prior extraction summary.
2. Read every line of `index.html`, `app.js`, `styles.css` before changing anything.
3. Live-tested in Chrome via the `claude-in-chrome` extension: visual screenshots for every screen, and **JS-driven functional testing** (calling the app's own state/functions directly, e.g. `resolveAnswer`, `findWinningPath`, dispatched clicks) for anything that needed precision or repeatability.
4. Fixed the two real defects found, then re-verified.

## Spec cross-check (PDF → implementation)

Verified matching: 25-cell board only (7×7 correctly excluded per user's explicit scope), letter shuffle/waiting-list rotation (25 + 3 waiting, next round mandatorily reinserts the 3 and draws 22 fresh, matching §7), team1 = right↔left / team2 = top↔bottom (§2), axial hex adjacency with 6 neighbors and **no corner-touch connectivity** (§11, verified empirically — see below), BFS win detection from edge-touching cells to the opposite edge (§12), cell state machine (neutral/selected/owned/winning, §10), correct-answer/wrong-answer transitions (§8–9), timer options and final-seconds alert (§13), full host toolset (§14), undo semantics incl. confirm-before-undo-after-win (§15), autosave fields (§17), and the win sequence (stop play → sequential light-up → banner → replay/new-round/settings options, §12).

**Found and fixed one real spec mismatch:** the PDF's 6th team color is "الأصفر الداكن" (dark yellow); the code had "سماوي" (cyan). Fixed in `app.js` (`COLORS` array) — replaced with a genuine dark-gold hue (`oklch(56% 0.14 92)`), distinct from both the UI's brass/amber accent and the existing orange team color.

## Bugs found and fixed

1. **Setup screen legend-to-swatch spacing (visual defect, confirmed by measurement, not assumption).**
   Root cause: `<legend>` inside a `display:grid` fieldset is excluded from the grid by all browsers, so the intended `.field{gap:11px}` never applied between the legend and the color-swatch/segmented-control row below it — only a stray `margin-block-start:3px` was providing separation. Measured gap was **2.99px** (vs. ~22px between other field groups).
   Fix: `styles.css` — `.color-options, .segmented-options { margin-block-start: 12px }`. Re-measured after fix: **11.99px**, now visually consistent with the rest of the form.

2. **Color palette mismatch vs. spec** — see above.

## Things investigated and found to be NOT bugs (with evidence)

- **"Duplicated bottom band" (flagged as unresolved in the handoff).** Reproduced it in a screenshot. Investigated via `document.querySelectorAll('.app-header').length` / `.screen` count → both **1**, confirmed a single, correctly-structured DOM. The tiling was a **screenshot-capture artifact** of the browser automation tooling in this sandboxed environment (see "Tooling limitations" below), not a rendering bug in the app.
- **Fade-to-black at the bottom of tall/scrolled screens.** `.app-atmosphere` is `position:fixed`, confirmed via `getBoundingClientRect()` to cover the full viewport (0→innerHeight) at all scroll positions. The darkening is the deliberate `linear-gradient(180deg, .../0.2 → .../0.72)` vignette over the stage photo — a stage-floor-into-shadow effect, consistent with the "dramatic lighting" brief, not a broken/cut-off background.
- **Hex board geometry.** `--hex-h: calc(var(--hex-w) * 1.1547)` with 0.75×height row spacing and a half-width shift on rows 2 and 4 (0-indexed 1 and 3) only is the standard, mathematically correct regular-hexagon tessellation — matches "shift rows 2 and 4, not every row." Confirmed visually at zoom: 25 touching, individually legible hexagons, clean seams (the outer clipped button + inset `::before` face technique from the last handoff session is working), no merged cells or glitch lines.
- **Goal-frame rail assignment.** In the RTL-inherited `.goal-frame` grid, the class named `.goal-rail-left` physically renders on the right and `.goal-rail-right` physically renders on the left (RTL grid column flip) — but since both are `var(--team-one)`, this has no visible effect. Confirmed both rails exist, correctly colored, fully within the arena bounds (no clipping) via `getBoundingClientRect()`.

## Functional test results (all via direct JS/DOM verification)

- Cell selection → disables all other cells, starts timer, clears buzzer: **pass**.
- Correct answer → assigns owner, records history, switches turn: **pass**.
- Wrong answer → cell returns to neutral and stays selectable, turn switches: **pass**.
- Undo → reverts to the pre-selection snapshot (owners, turn, timer) as the spec requires ("الدور إلى الفريق السابق"): **pass**.
- Pause/resume → disables/re-enables cell selection: **pass**.
- Sound toggle: **pass**.
- Buzzer: phone press → host screen reflects team/name → reset re-opens buzzer: **pass** *within one browser tab* (see limitation below).
- Win detection, **team 1 (right↔left)**: straight mid-row (indices 10-14) → `findWinningPath(0)` returns the full 5-cell path: **pass**.
- Win detection, **team 2 (top↔bottom)**: straight mid-column (indices 2,7,12,17,22) → `findWinningPath(1)` returns the full 5-cell path: **pass**.
- Negative case: a team-1 column touching only the left edge (never reaching the right edge) → correctly returns no path: **pass**.
- Negative case: corner-adjacent cells (index 0 and 6) are correctly **not** treated as neighbors — matches "لا يُحسب التلامس عند الزوايا اتصالًا": **pass**.
- Win UI sequence: winning move → audience screen shown immediately with `winningPath` populated → auto-transitions to the winner screen after the sequential light-up delay: **pass**.
- Persistence: team name/color changes survive `location.reload()`; screen correctly resets to home and `owners` is exactly what was saved: **pass**.
- Keyboard: hex cells and all controls are real `<button>`/`<input>` elements (confirmed `tagName === 'BUTTON'`, `type === 'button'`), Tab-focusable, and a focused cell responds to `.click()` the same way Enter/Space would via native button semantics; `:focus-visible` styles are defined for all interactive elements plus a bespoke hex-cell focus treatment; a skip-link is present. **Pass** — verified via source + one live focus/activate check; did not get a full manual Tab-order recording (see limitation below).

## Accessibility spot-check (contrast, computed via canvas-based OKLCH→sRGB resolution + WCAG relative-luminance formula)

| Pair | Ratio |
|---|---|
| Body text vs. ink-950 background | 18.41:1 |
| Muted text vs. ink-950 background | 10.10:1 |
| Primary button ink vs. amber | 8.67:1 |
| Field text vs. field background | 16.25:1 |
| Orange team bg vs. ink | 6.22:1 |
| Violet team bg vs. ink | 4.36:1 |
| Dark-yellow team bg vs. ink | 4.24:1 |
| Red team bg vs. ink | 4.12:1 |
| Blue team bg vs. ink | 3.97:1 |
| Green team bg vs. ink | 3.22:1 |

All pairs clear WCAG AA's 3:1 non-text/large-text threshold. Body/UI text pairs clear 4.5:1 comfortably. One **minor, disclosed** nuance: the small `.team-symbol` glyph (◆/●, 16.8px bold) sits just under the 18.66px "large text" cutoff, so for the blue/green team colors specifically its glyph-vs-ink ratio (3.97 / 3.22) is below the strict 4.5:1 *text* threshold, though above the 3:1 *graphical-object* threshold that arguably applies to a single decorative symbol rather than prose. Not fixed — flagging for awareness rather than re-tuning the PDF-mandated palette.

## Known limitations (disclosed honestly, not glossed over)

- **No genuine narrow-viewport (tablet/phone) live screenshots.** In this session's sandboxed browser environment, `resize_window` reports success but the real viewport stayed pinned at ~1243×555 CSS px across three different requested sizes (confirmed identical `innerWidth`/`innerHeight` for 1440×900, 1000×700, and 414×896 requests) — a tooling limitation, not an app issue. An iframe-based workaround was tried and broke the extension's frame-targeting. Given this, tablet/mobile coverage rests on **thorough static review** of the `@media (max-width: 1080px)` and `@media (max-width: 760px)` rules (fluid `clamp()` sizing throughout, single-column stacks, no fixed-pixel cliffs) rather than live rendering. **This should be re-verified with working responsive tooling (real device, DevTools, or a working automation setup) before calling mobile/tablet acceptance complete.**
- **The buzzer is a single-tab simulation**, as the working agreement required disclosing. The phone screen and host screen share the same in-memory JS `state` object and the same `localStorage` key; there is no `storage` event listener, `BroadcastChannel`, or backend, so pressing the buzzer on an actual second device/tab will **not** live-update a host screen open in a different tab/device — it only becomes visible after that other tab reloads. This matches the PDF's own v1 scope ("يتحكم مدير المسابقة من الجهاز نفسه الذي يعرض الرقعة") but should be stated plainly to the user as a demo simulation, not real cross-device sync.
- **`prefers-reduced-motion`** is correctly scoped in CSS (a single `@media (prefers-reduced-motion: reduce)` block neutralizing all animation/transition durations) but could not be live-toggled and re-screenshotted in this environment; verified by source reading only.
- Full manual keyboard Tab-order traversal across every screen was not exhaustively recorded (one representative focus/activate check was run); native semantic elements are used throughout so this is low-risk, but a manual pass is still worth doing before a client demo.

## Files changed this session

- `project/app.js` — 6th team color corrected to "أصفر داكن" per spec.
- `project/styles.css` — fixed legend→swatch spacing bug in the setup form.
- `project/QA.md` — this file (new).

---

# Session 2 — 2026-09-22: Real Playwright verification (closes the mobile/tablet gap above)

The previous session's biggest disclosed limitation was "no genuine narrow-viewport live screenshots" because the available browser-automation tooling couldn't hold a real viewport size. This session used a real, self-installed Playwright + Chromium (already present on this machine at `~/AppData/Local/ms-playwright`) driven from a standalone Node script — fully reliable, no capture artifacts, genuine 390px/768px/1440px renders. **This closes that gap**: mobile and tablet are now visually verified, not just statically reasoned about.

## Method

A single Node/Playwright script (kept in the session scratchpad, not the repo) that, for each of desktop (1440×900), tablet (768×1024), and mobile (390×844):
- Screenshots all 7 screens (home, how, setup, game, audience, phone-join, phone-buzzer, winner).
- Drives the **full gameplay loop through real UI clicks** (not JS state injection): select a cell, judge correct/wrong, undo, timer toggle, pause/resume, sound toggle, a complete win sequence.
- Drives real keyboard interaction: Tab to skip-link, type into a field, submit the setup form with Enter, activate a focused hex cell with Enter.
- Emulates `prefers-reduced-motion: reduce` and checks the glimmer animation is actually neutralized.
- Opens two pages in the **same browser context** (host + phone) to empirically prove the buzzer's cross-tab behavior instead of just asserting it from source.

Result: **19/19 automated checks pass** on a clean run (script and full log available on request; not committed to the repo since it's a throwaway harness, not a maintained test suite).

## Real bug found and fixed

**Screen navigation left the page scrolled ~125px down on narrow (mobile) viewports, hiding the header after every screen change.**

- Root cause: `setScreen()` calls `window.scrollTo({top:0, behavior:"smooth"})` and then, one animation frame later, `app.focus()`. Focusing an element runs the browser's default "scroll this element into view" behavior *unless* told not to. On mobile, `.app-header` switches from `position:sticky` to `position:relative` (by design, so the wrapping nav doesn't eat vertical space) — meaning `#app-main` starts ~125px into the document flow. The focus call's default scroll-into-view fired *while the smooth scroll-to-0 animation was still in flight* and won, leaving the page parked at the header's height instead of 0.
- Confirmed via a `scroll` event listener trace (only one event fires, landing directly on 125, never 0) and by reproducing the exact 125px figure against the measured header height.
- Fix: `app.js`, `setScreen()` — `app.focus()` → `app.focus({ preventScroll: true })`. The explicit `scrollTo` already handles scrolling; the focus call doesn't need its own.
- Verified fixed: repeated trace shows `scrollY` reliably `0` after every navigation, at 0/30/60/100/200/400/800ms checkpoints (was reliably `125` at every checkpoint before the fix). Re-confirmed visually in the fresh mobile screenshot set.

## Investigated and ruled out (false leads — verified, not assumed)

- **A second suspected scroll issue** (~33px, specifically around the phone join-form submit button on mobile) turned out to be a **Playwright test-automation artifact**, not an app bug: the submit button was genuinely partially below the fold in that viewport state, so Playwright's own pre-click "scroll target into view" behavior — which a real finger tap does not trigger — caused the scroll. Proven by dispatching a raw `click` `MouseEvent` (bypassing Playwright's actionability auto-scroll) and observing `scrollY` stay at `0`. Two speculative defensive changes made while investigating this (`overflow-anchor: none`, blurring focus before re-render) were reverted once the real cause was found, since they fixed nothing and weren't needed — kept the diff to exactly the one real fix above.
- **Suspected dark "wedge" gaps at the board's frame corners**, visible in early wide zoom crops. Precisely re-cropped screenshots centered exactly on the `board-stage` boundary (measured via `getBoundingClientRect`) show the team-colored rails meeting **cleanly with no gap** at all four corners; the earlier apparent gap was simply the arena's own outer padding included in a looser crop window, not a rendering defect.

## Honeycomb/frame geometry — re-verified visually at high zoom this session

Direct zoomed crops of the live board (desktop and mobile) confirm, by eye and not just by reading the CSS math: 25 touching, individually outlined pointy-top hexagons; rows 2 and 4 (1-indexed) shifted by exactly half a cell, rows 1/3/5 aligned — the alternating stagger the brief requires, not a diagonal parallelogram; flat rectangular outer edges with Team 1's colour on the left/right rails and Team 2's colour on the top/bottom rails; all four corners fill cleanly. No merged cells, no glitch lines, no diagonal elongation found.

## Updated verdict on previously-open items

- **Mobile/tablet responsive layout: now genuinely verified**, not just statically reasoned about. Setup form, host panel, phone mockup, and winner card all reflow cleanly at 390px and 768px — no cramped labels, clipped text, or overlapping controls found in this pass (the one real defect found was the scroll/header issue above, now fixed).
- **`prefers-reduced-motion`: now genuinely verified live** (previously source-only). Confirmed the glimmer animation's duration collapses to effectively zero under the emulated preference.
- **Buzzer cross-tab behavior: now empirically proven**, not just asserted from reading the code. Two pages in the same browser context confirm the host does *not* see a phone's buzzer press live, and *does* see it after a manual reload (localStorage persists, no live sync) — matches the documented single-device-v1 limitation exactly.
- **Keyboard**: real Tab/type/Enter interaction (not `.click()` standing in for it) confirmed working for skip-link focus, form field entry, form submission via Enter, and hex-cell activation via Enter.

## Files changed this session (Session 2)

- `project/app.js` — one-line fix: `app.focus({ preventScroll: true })` in `setScreen()`.
- `project/QA.md` — this section (appended).
