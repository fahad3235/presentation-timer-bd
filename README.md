# Presentation Timer BD

A free, fully offline bilingual (English / বাংলা) speaker timer for talks,
class presentations, and demos — with a green–amber–red phase light, overtime
counting, and a talk log that records planned vs. actual time.

## Problem

Student and conference talks overrun because the speaker cannot see how much
time is left. A phone stopwatch shows elapsed time only; it does not warn you
at the "wrap up" point, and it keeps no record of how long your past talks
actually took.

## Features

1. **Speaker phase light** — Green while under 75% of the planned time, Amber
   from 75–90% ("wrap up soon"), Red from 90–100% ("finish now"), and a
   dark-red Overtime mode that counts up past zero with a `+MM:SS` display.
2. **Flexible setup** — 3 / 5 / 10 / 15 / 20-minute presets or any custom
   duration from 1 to 180 minutes, with the three phase thresholds shown
   as clock times before you start.
3. **Start / Pause / Resume / Reset** — pausing freezes elapsed time exactly;
   validation blocks starting with an empty title or an out-of-range duration.
4. **Phase-change beeps** — a short Web Audio tone when the light turns
   Amber, Red, or Overtime (mutable; silent in automated tests).
5. **Talk log** — Finish & log records title, planned time, actual time, and
   over/under result; a summary shows talks logged, % over time, and total
   planned vs. actual time. Entries can be deleted one by one.
6. **Export / Import / Clear** — JSON export and strictly validated import
   (malformed files are rejected with the data intact); clear-all asks for
   confirmation. Everything persists in `localStorage`.
7. **Bilingual UI** — EN/বাংলা toggle persisted across visits; Bengali-digit
   rendering in BN mode; responsive down to 390 px; zero network requests.

## Stack

Vanilla HTML / CSS / JavaScript — no build step, no dependencies, no server.
Tests use Node's built-in test runner and a dependency-free raw-CDP
headless-Chrome smoke script.

## Prerequisites

Any modern browser. For tests: Node.js 20+ and a Chromium binary at
`/opt/meta-chromium/chrome` (the smoke script's path; edit `tests/smoke.js`
if your Chromium lives elsewhere).

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

## Testing

```sh
node --test tests/logic.test.js   # 19 unit tests
node tests/smoke.js               # 23 headless-Chrome checks
```

## Deployment

Static hosting only: publish the folder as-is (e.g. GitHub Pages, main/root).
There is no backend, no API key, and no environment variable.

## Limitations

- Times are measured by the browser clock on one device; pausing the tab or
  suspending the device pauses the wall-clock measurement accordingly.
- Beeps require a user gesture first (browser autoplay policy); the Start
  click provides it.
- The log lives in this browser's `localStorage` only — clearing site data
  erases it. Use Export JSON for a durable copy.
- This is a timing aid, not an official timing or judging system.

## Status

MVP complete and tested (see `TEST_RESULTS.md`). No demo/fake talks ship
with the app — the log starts empty.
