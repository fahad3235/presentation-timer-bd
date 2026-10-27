"use strict";
(function () {
  var L = window.PTLogic;
  var STR = window.PT_STRINGS;
  var LOG_KEY = "presentation-timer-bd-log";
  var SET_KEY = "presentation-timer-bd-settings";
  var TEST_MODE = window.location.search.indexOf("test=1") !== -1;

  var lang = "en";
  var soundOn = true;
  var log = [];
  var totalSec = 600;
  var accumulatedMs = 0;
  var running = false;
  var startStamp = 0;
  var lastPhase = "green";
  var tickId = null;

  function $(id) { return document.getElementById(id); }
  function t(key) { return STR[lang][key] || STR.en[key] || key; }
  function digits(s) { return lang === "bn" ? L.toBnDigits(String(s)) : String(s); }
  function loadJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  function elapsedSec() {
    var ms = accumulatedMs + (running ? Date.now() - startStamp : 0);
    return Math.floor(ms / 1000);
  }
  function phase() { return L.phaseFor(elapsedSec(), totalSec); }

  function beep(freq) {
    if (!soundOn || TEST_MODE) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = beep.ctx || (beep.ctx = new Ctx());
      if (ctx.state === "suspended") ctx.resume();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }

  function renderTimer() {
    var el = elapsedSec(), rem = L.remainingSec(el, totalSec), ph = phase();
    $("clockBig").textContent = digits(L.formatClock(rem));
    $("remainingText").textContent = digits(L.formatClock(rem));
    $("elapsedText").textContent = digits(L.formatClock(el));
    var badge = $("phaseBadge");
    badge.textContent = t("phase" + ph.charAt(0).toUpperCase() + ph.slice(1));
    badge.className = "badge phase-" + ph;
    if ($("phaseBadgeText")) $("phaseBadgeText").textContent = badge.textContent;
    $("progressFill").style.width = L.progressPct(el, totalSec) + "%";
    $("progressFill").className = "fill phase-" + ph;
    var b = L.phaseBoundaries(totalSec);
    $("thresholdsText").textContent = t("thresholds")
      .replace("{g}", digits(L.formatClock(b.greenUntil)))
      .replace("{a}", digits(L.formatClock(b.amberUntil)))
      .replace("{r}", digits(L.formatClock(b.redUntil)));
    var st = $("statusText");
    if (!running && el === 0) st.textContent = t("statusReady");
    else if (running && ph !== "overtime") st.textContent = t("statusRunning");
    else if (running && ph === "overtime") st.textContent = t("statusDone");
    else if (!running && el > 0) st.textContent = t("statusPaused");
    $("startBtn").disabled = running;
    $("pauseBtn").disabled = el === 0 && !running;
    $("pauseBtn").textContent = running ? t("pause") : t("resume");
    $("finishBtn").disabled = el === 0;
    if (ph !== lastPhase) {
      if (ph === "amber") beep(880);
      else if (ph === "red") beep(660);
      else if (ph === "overtime") beep(440);
      lastPhase = ph;
    }
  }

  function renderStatic() {
    document.documentElement.lang = lang;
    $("langBtn").textContent = lang === "en" ? "বাংলা" : "English";
    document.title = t("title");
    ["appTitle", "tagline", "setupHeading", "titleLabel", "durationLabel", "presetsLabel",
     "soundLabel", "startBtn", "resetBtn", "finishBtn", "remainingLabel", "elapsedLabel",
     "phaseLabel", "logHeading", "logEmpty", "exportBtn", "importBtn", "clearBtn", "footerText"
    ].forEach(function (id) {
      var el = $(id); if (!el) return;
      var map = { appTitle: "title", tagline: "tagline", setupHeading: "setupHeading",
        titleLabel: "talkTitle", durationLabel: "duration", presetsLabel: "presets",
        soundLabel: "sound", startBtn: "start", resetBtn: "reset", finishBtn: "finishLog",
        remainingLabel: "remainingLabel", elapsedLabel: "elapsedLabel", phaseLabel: "phaseLabel",
        logHeading: "logHeading", logEmpty: "logEmpty", exportBtn: "exportBtn",
        importBtn: "importBtn", clearBtn: "clearBtn", footerText: "footer" };
      el.textContent = t(map[id]);
    });
    $("titleInput").placeholder = t("talkTitlePh");
    renderLog();
    renderTimer();
  }

  function renderLog() {
    var s = L.summarizeLog(log);
    $("logSummary").textContent = t("logSummary")
      .replace("{total}", digits(s.total)).replace("{over}", digits(s.overCount))
      .replace("{pct}", digits(s.overPct))
      .replace("{planned}", digits(L.formatClock(s.plannedSec)))
      .replace("{actual}", digits(L.formatClock(s.actualSec)));
    $("logEmpty").hidden = log.length !== 0;
    var tb = $("logBody"); tb.innerHTML = "";
    log.slice().reverse().forEach(function (e) {
      var origIdx = log.indexOf(e);
      var tr = document.createElement("tr");
      var d = L.talkDelta(e);
      var result = d === 0 ? t("onTime") : (d > 0 ? digits(L.formatClock(Math.abs(d))) + " " + t("overTime")
        : digits(L.formatClock(Math.abs(d))) + " " + t("underTime"));
      var td1 = document.createElement("td"); td1.textContent = e.title;
      var td2 = document.createElement("td"); td2.textContent = digits(L.formatClock(e.plannedSec));
      var td3 = document.createElement("td"); td3.textContent = digits(L.formatClock(e.actualSec));
      var td4 = document.createElement("td"); td4.textContent = result;
      var td5 = document.createElement("td");
      var btn = document.createElement("button");
      btn.className = "mini danger"; btn.textContent = t("delete");
      btn.setAttribute("data-idx", origIdx);
      btn.addEventListener("click", function () {
        log.splice(Number(btn.getAttribute("data-idx")), 1);
        saveJSON(LOG_KEY, log); renderLog();
      });
      td5.appendChild(btn);
      [td1, td2, td3, td4, td5].forEach(function (c) { tr.appendChild(c); });
      tb.appendChild(tr);
    });
  }

  function tick() { renderTimer(); }
  function startTimer() {
    var titleErr = L.validateTitle($("titleInput").value);
    var durErr = L.validateDuration($("minutesInput").value);
    $("titleError").textContent = titleErr ? t("errTitle") : "";
    $("durationError").textContent = durErr ? t("errDuration") : "";
    if (titleErr || durErr) return false;
    totalSec = Number($("minutesInput").value) * 60;
    if (!running) { startStamp = Date.now(); running = true; lastPhase = phase(); }
    if (!tickId) tickId = setInterval(tick, 250);
    renderTimer();
    return true;
  }
  function pauseTimer() {
    if (!running) {
      if (elapsedSec() === 0) return;
      startStamp = Date.now(); running = true; lastPhase = phase();
    } else {
      accumulatedMs += Date.now() - startStamp; running = false;
    }
    renderTimer();
  }
  function resetTimer() {
    running = false; accumulatedMs = 0; lastPhase = "green";
    renderTimer();
  }
  function finishTalk() {
    var el = elapsedSec();
    if (el === 0) return;
    var entry = { title: $("titleInput").value.trim(), plannedSec: totalSec,
      actualSec: el, finishedAt: new Date().toISOString() };
    log.push(entry); saveJSON(LOG_KEY, log);
    resetTimer(); renderLog();
  }

  function init() {
    var settings = loadJSON(SET_KEY, {});
    if (settings.lang === "bn" || settings.lang === "en") lang = settings.lang;
    if (typeof settings.soundOn === "boolean") soundOn = settings.soundOn;
    var imported = loadJSON(LOG_KEY, []);
    var checked = L.validateImport({ entries: Array.isArray(imported) ? imported : [] });
    log = checked.entries || [];
    $("soundChk").checked = soundOn;
    document.querySelectorAll(".preset").forEach(function (b) {
      b.addEventListener("click", function () {
        $("minutesInput").value = b.getAttribute("data-min");
        if (!running) { totalSec = Number(b.getAttribute("data-min")) * 60; renderTimer(); }
      });
    });
    $("minutesInput").addEventListener("change", function () {
      if (!L.validateDuration($("minutesInput").value) && !running) {
        totalSec = Number($("minutesInput").value) * 60; renderTimer();
      }
    });
    $("startBtn").addEventListener("click", startTimer);
    $("pauseBtn").addEventListener("click", pauseTimer);
    $("resetBtn").addEventListener("click", resetTimer);
    $("finishBtn").addEventListener("click", finishTalk);
    $("soundChk").addEventListener("change", function () {
      soundOn = $("soundChk").checked; saveJSON(SET_KEY, { lang: lang, soundOn: soundOn });
    });
    $("langBtn").addEventListener("click", function () {
      lang = lang === "en" ? "bn" : "en";
      saveJSON(SET_KEY, { lang: lang, soundOn: soundOn });
      renderStatic();
    });
    $("exportBtn").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify({ entries: log }, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "presentation-timer-log.json"; a.click();
      URL.revokeObjectURL(a.href);
    });
    $("importFile").addEventListener("change", function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var msg = $("importMsg");
        try {
          var parsed = JSON.parse(r.result);
          var v = L.validateImport(parsed);
          if (v.error) { msg.textContent = t("importBad").replace("{msg}", v.error); return; }
          log = v.entries; saveJSON(LOG_KEY, log); renderLog();
          msg.textContent = t("importOk").replace("{n}", digits(v.entries.length));
        } catch (e) { msg.textContent = t("importBad").replace("{msg}", "Invalid JSON."); }
      };
      r.readAsText(f); ev.target.value = "";
    });
    $("clearBtn").addEventListener("click", function () {
      if (window.confirm(t("clearConfirm"))) { log = []; saveJSON(LOG_KEY, log); renderLog(); }
    });
    renderStatic();
  }

  if (TEST_MODE) {
    window.__pt = {
      getState: function () {
        return { running: running, elapsedSec: elapsedSec(), totalSec: totalSec,
          phase: phase(), logCount: log.length };
      },
      advance: function (sec) { accumulatedMs += sec * 1000; renderTimer(); },
      start: startTimer, pause: pauseTimer, reset: resetTimer, finish: finishTalk,
      setDuration: function (min) { $("minutesInput").value = min; totalSec = min * 60; renderTimer(); }
    };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
