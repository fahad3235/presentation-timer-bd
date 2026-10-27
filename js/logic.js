"use strict";
// Pure logic for Presentation Timer BD — no DOM, unit-testable in Node.
// Phase model (fractions of the planned duration):
//   green:  elapsed < 75%  | amber: 75%..90% | red: 90%..100% | overtime: > 100%
var GREEN_END = 0.75;
var AMBER_END = 0.90;

function phaseFor(elapsedSec, totalSec) {
  if (!(totalSec > 0)) return "green";
  if (elapsedSec < 0) elapsedSec = 0;
  var frac = elapsedSec / totalSec;
  if (frac < GREEN_END) return "green";
  if (frac < AMBER_END) return "amber";
  if (frac <= 1) return "red";
  return "overtime";
}

// Seconds at which each phase boundary is crossed (for the threshold display).
function phaseBoundaries(totalSec) {
  return {
    greenUntil: Math.floor(totalSec * GREEN_END),
    amberUntil: Math.floor(totalSec * AMBER_END),
    redUntil: totalSec
  };
}

function progressPct(elapsedSec, totalSec) {
  if (!(totalSec > 0)) return 0;
  if (elapsedSec < 0) elapsedSec = 0;
  return Math.min(100, (elapsedSec / totalSec) * 100);
}

// Remaining time: positive while time is left, negative once overtime.
function remainingSec(elapsedSec, totalSec) {
  return totalSec - elapsedSec;
}

// Clock display: "MM:SS" for a non-negative count; overtime renders "+MM:SS".
function formatClock(sec) {
  var neg = sec < 0;
  var abs = Math.abs(Math.floor(sec));
  var m = Math.floor(abs / 60);
  var s = abs % 60;
  var out = (m < 10 ? "0" + m : "" + m) + ":" + (s < 10 ? "0" + s : "" + s);
  return neg ? "+" + out : out;
}

var BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function toBnDigits(str) {
  return String(str).replace(/[0-9]/g, function (d) { return BN_DIGITS[Number(d)]; });
}

function validateDuration(minutes) {
  if (minutes === "" || minutes === null || minutes === undefined) return "Duration is required.";
  var n = Number(minutes);
  if (!isFinite(n) || Math.floor(n) !== n) return "Duration must be a whole number of minutes.";
  if (n < 1) return "Duration must be at least 1 minute.";
  if (n > 180) return "Duration must be at most 180 minutes.";
  return null;
}

function validateTitle(title) {
  if (!title || !String(title).trim()) return "Talk title is required.";
  if (String(title).trim().length > 80) return "Talk title must be 80 characters or fewer.";
  return null;
}

// A finished talk record: { title, plannedSec, actualSec, finishedAt (ISO) }
function talkDelta(entry) {
  return entry.actualSec - entry.plannedSec; // >0 = over time
}

function formatDelta(entry) {
  var d = talkDelta(entry);
  if (d === 0) return "on time";
  var sign = d > 0 ? "+" : "-";
  return sign + formatClock(Math.abs(d));
}

function summarizeLog(entries) {
  var total = entries.length;
  var over = 0, planned = 0, actual = 0;
  entries.forEach(function (e) {
    planned += e.plannedSec; actual += e.actualSec;
    if (e.actualSec > e.plannedSec) over++;
  });
  return {
    total: total,
    overCount: over,
    plannedSec: planned,
    actualSec: actual,
    overPct: total === 0 ? 0 : Math.round((over / total) * 100)
  };
}

// Strict import validation: returns { entries } or { error }.
function validateImport(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.entries)) {
    return { error: "Import must be an object with an entries array." };
  }
  if (data.entries.length > 500) return { error: "Import has too many entries (max 500)." };
  for (var i = 0; i < data.entries.length; i++) {
    var e = data.entries[i];
    if (!e || typeof e !== "object") return { error: "Entry " + (i + 1) + " is not an object." };
    if (validateTitle(e.title)) return { error: "Entry " + (i + 1) + ": " + validateTitle(e.title) };
    if (!isFinite(e.plannedSec) || e.plannedSec < 60 || e.plannedSec > 180 * 60 || Math.floor(e.plannedSec) !== e.plannedSec)
      return { error: "Entry " + (i + 1) + ": plannedSec must be a whole number of seconds between 60 and 10800." };
    if (!isFinite(e.actualSec) || e.actualSec < 0 || e.actualSec > 24 * 3600 || Math.floor(e.actualSec) !== e.actualSec)
      return { error: "Entry " + (i + 1) + ": actualSec must be a whole number of seconds between 0 and 86400." };
    if (typeof e.finishedAt !== "string" || isNaN(Date.parse(e.finishedAt)))
      return { error: "Entry " + (i + 1) + ": finishedAt must be an ISO date string." };
  }
  return { entries: data.entries };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GREEN_END: GREEN_END, AMBER_END: AMBER_END, phaseFor: phaseFor,
    phaseBoundaries: phaseBoundaries, progressPct: progressPct,
    remainingSec: remainingSec, formatClock: formatClock,
    toBnDigits: toBnDigits, validateDuration: validateDuration,
    validateTitle: validateTitle, talkDelta: talkDelta,
    formatDelta: formatDelta, summarizeLog: summarizeLog,
    validateImport: validateImport
  };
} else if (typeof window !== "undefined") {
  window.PTLogic = {
    GREEN_END: GREEN_END, AMBER_END: AMBER_END, phaseFor: phaseFor,
    phaseBoundaries: phaseBoundaries, progressPct: progressPct,
    remainingSec: remainingSec, formatClock: formatClock,
    toBnDigits: toBnDigits, validateDuration: validateDuration,
    validateTitle: validateTitle, talkDelta: talkDelta,
    formatDelta: formatDelta, summarizeLog: summarizeLog,
    validateImport: validateImport
  };
}
