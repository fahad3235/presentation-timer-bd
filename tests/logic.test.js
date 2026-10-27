"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/logic.js");

describe("phaseFor (10-minute talk, 600s)", () => {
  it("0s and 449s are green", () => {
    assert.equal(L.phaseFor(0, 600), "green");
    assert.equal(L.phaseFor(449, 600), "green");
  });
  it("450s (75%) is amber, 539s stays amber", () => {
    assert.equal(L.phaseFor(450, 600), "amber");
    assert.equal(L.phaseFor(539, 600), "amber");
  });
  it("540s (90%) is red, 600s is red", () => {
    assert.equal(L.phaseFor(540, 600), "red");
    assert.equal(L.phaseFor(600, 600), "red");
  });
  it("601s is overtime", () => { assert.equal(L.phaseFor(601, 600), "overtime"); });
  it("negative elapsed clamps to green", () => { assert.equal(L.phaseFor(-5, 600), "green"); });
});

describe("phaseBoundaries / progress / remaining", () => {
  it("600s talk: green until 450, amber until 540", () => {
    assert.deepEqual(L.phaseBoundaries(600), { greenUntil: 450, amberUntil: 540, redUntil: 600 });
  });
  it("progress 300/600 = 50, capped at 100 in overtime", () => {
    assert.equal(L.progressPct(300, 600), 50);
    assert.equal(L.progressPct(900, 600), 100);
  });
  it("remaining 600-150 = 450; overtime remaining is negative", () => {
    assert.equal(L.remainingSec(150, 600), 450);
    assert.equal(L.remainingSec(700, 600), -100);
  });
});

describe("formatClock / toBnDigits", () => {
  it("formats 0, 65, 600", () => {
    assert.equal(L.formatClock(0), "00:00");
    assert.equal(L.formatClock(65), "01:05");
    assert.equal(L.formatClock(600), "10:00");
  });
  it("overtime renders with + sign", () => { assert.equal(L.formatClock(-100), "+01:40"); });
  it("converts digits to Bengali", () => { assert.equal(L.toBnDigits("10:00"), "১০:০০"); });
});

describe("validateDuration / validateTitle", () => {
  it("accepts 1..180 whole minutes", () => {
    assert.equal(L.validateDuration(10), null);
    assert.equal(L.validateDuration(1), null);
    assert.equal(L.validateDuration(180), null);
  });
  it("rejects 0, 181, 2.5, empty", () => {
    assert.ok(L.validateDuration(0)); assert.ok(L.validateDuration(181));
    assert.ok(L.validateDuration(2.5)); assert.ok(L.validateDuration(""));
  });
  it("title required and capped at 80 chars", () => {
    assert.ok(L.validateTitle("")); assert.ok(L.validateTitle("   "));
    assert.ok(L.validateTitle("x".repeat(81)));
    assert.equal(L.validateTitle("Demo"), null);
  });
});

describe("talkDelta / summarizeLog / validateImport", () => {
  it("delta: 660-600 = +60, on-time delta 0", () => {
    assert.equal(L.talkDelta({ plannedSec: 600, actualSec: 660 }), 60);
    assert.equal(L.formatDelta({ plannedSec: 600, actualSec: 600 }), "on time");
    assert.equal(L.formatDelta({ plannedSec: 600, actualSec: 660 }), "+01:00");
  });
  it("summary counts over-time talks and totals", () => {
    const s = L.summarizeLog([
      { plannedSec: 600, actualSec: 660 },
      { plannedSec: 300, actualSec: 240 },
    ]);
    assert.equal(s.total, 2); assert.equal(s.overCount, 1);
    assert.equal(s.plannedSec, 900); assert.equal(s.actualSec, 900);
    assert.equal(s.overPct, 50);
  });
  it("empty log summary is all zeros", () => {
    assert.deepEqual(L.summarizeLog([]), { total: 0, overCount: 0, plannedSec: 0, actualSec: 0, overPct: 0 });
  });
  it("accepts a well-formed import", () => {
    const v = L.validateImport({ entries: [{ title: "Demo", plannedSec: 600, actualSec: 540, finishedAt: "2026-10-27T05:00:00.000Z" }] });
    assert.equal(v.error, undefined); assert.equal(v.entries.length, 1);
  });
  it("rejects missing array, bad plannedSec, bad date, 501 entries", () => {
    assert.ok(L.validateImport({}).error);
    assert.ok(L.validateImport({ entries: [{ title: "x", plannedSec: 30, actualSec: 10, finishedAt: "2026-10-27T05:00:00.000Z" }] }).error);
    assert.ok(L.validateImport({ entries: [{ title: "x", plannedSec: 600, actualSec: 10, finishedAt: "not-a-date" }] }).error);
    const many = Array.from({ length: 501 }, () => ({ title: "x", plannedSec: 600, actualSec: 600, finishedAt: "2026-10-27T05:00:00.000Z" }));
    assert.ok(L.validateImport({ entries: many }).error);
  });
});
