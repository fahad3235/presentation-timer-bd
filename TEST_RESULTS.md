# Presentation Timer BD — Test Results (2026-10-27)

## Unit tests — 19/19 pass

`node --test tests/logic.test.js`

- `phaseFor` (600 s talk): 0 s and 449 s green; 450 s (75%) amber; 539 s amber;
  540 s (90%) red; 600 s red; 601 s overtime; negative elapsed clamps to green.
- `phaseBoundaries`: 600 s talk → green until 450, amber until 540, red at 600.
- `progressPct`: 300/600 = 50; capped at 100 in overtime.
- `remainingSec`: 600 − 150 = 450; overtime remaining is negative (−100 at 700 s).
- `formatClock`: 0 → 00:00, 65 → 01:05, 600 → 10:00; negative → +01:40.
- `toBnDigits`: "10:00" → "১০:০০".
- `validateDuration`: accepts whole minutes 1–180; rejects 0, 181, 2.5, empty.
- `validateTitle`: rejects empty/whitespace and 81 chars; accepts "Demo".
- `talkDelta`/`formatDelta`: 660 − 600 = +60 → "+01:00"; equal times → "on time".
- `summarizeLog`: 2 talks (1 over) → total 2, over 1, planned 900 s, actual 900 s, 50%;
  empty log is all zeros.
- `validateImport`: accepts a well-formed entry; rejects missing array, bad
  plannedSec (30 s), bad date, and 501 entries.

## Headless-Chrome smoke tests — 23/23 pass

`node tests/smoke.js` (raw CDP, real Chromium, `file://...?test=1`)

- Title contains "Presentation"; clock renders 10:00; 5 presets; Start visible.
- Empty title shows an inline error and the timer does not start.
- Valid talk starts; advancing 449 s stays green, 450 s turns amber (badge text
  "Amber"), 540 s red, 601 s overtime with a `+` clock.
- Pause stops the timer; Finish & log records 1 entry showing "00:01 over"
  (planned 10:00, actual 10:01); timer resets; entry persists in localStorage.
- Language toggle switches `html lang` to `bn`, button reads "English",
  clock renders Bengali digits.
- 390 px viewport: no horizontal overflow; zero page console/exception errors.

## Fixes found by testing (1 app-logic/CSS bug)

- 390 px overflow: after logging a talk and switching to Bengali, the log
  table's intrinsic width stretched the grid card past 390 px
  (`scrollWidth` > 395). Fixed by adding `min-width: 0` to `.card` and
  `.table-wrap` (classic grid-item minimum-size fix). Smoke re-run green.
- 0 other app bugs; all other checks passed on first run.
