(function () {
  "use strict";

  // World Cup 2026 opener: Mexico vs South Africa, Estadio Azteca, June 11, 2026.
  // Approximating kickoff at 18:00 UTC (1pm ET / noon CT / 12pm CDMX).
  var KICKOFF_UTC = Date.UTC(2026, 5, 11, 18, 0, 0); // month is 0-indexed: 5 = June

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function fmt(ms) {
    if (ms <= 0) {
      return { kickedOff: true, text: "KICK OFF! ⚽" };
    }
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    s -= d * 86400;
    var h = Math.floor(s / 3600);
    s -= h * 3600;
    var m = Math.floor(s / 60);
    s -= m * 60;
    return { kickedOff: false, d: d, h: h, m: m, s: s };
  }

  function injectStyles() {
    if (document.getElementById("wcc-countdown-style")) return;
    // Pinned to the bottom-right corner directly under the Gemini pill,
    // which lives at `bottom: 62px; right: 24px`. The countdown sits at
    // `bottom: 14px; right: 24px` so its top edge clears the Gemini pill's
    // bottom by ~16px. Not draggable.
    var css =
      "" +
      ".wcc-countdown-pill{" +
      "position:fixed;bottom:14px;right:24px;" +
      "z-index:2147483600;" +
      "display:inline-flex;align-items:center;gap:10px;" +
      "padding:9px 16px 9px 14px;" +
      "font-family:'Inter','Helvetica Neue',Arial,sans-serif;" +
      "font-size:13px;font-weight:600;letter-spacing:0.3px;" +
      "color:#fff;" +
      "background:linear-gradient(135deg,rgba(204,0,0,0.92),rgba(138,11,68,0.92));" +
      "backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);" +
      "border:1px solid rgba(255,255,255,0.18);" +
      "border-radius:999px;" +
      "box-shadow:0 6px 22px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.04) inset;" +
      "user-select:none;-webkit-user-select:none;" +
      "pointer-events:none;" +
      "}" +
      ".wcc-countdown-pill .wcc-emoji{font-size:15px;line-height:1}" +
      ".wcc-countdown-pill .wcc-label{opacity:0.78;font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:0.8px;margin-right:2px}" +
      ".wcc-countdown-pill .wcc-num{font-variant-numeric:tabular-nums;font-weight:700}" +
      ".wcc-countdown-pill .wcc-unit{opacity:0.65;font-size:10px;font-weight:500;text-transform:uppercase;margin-left:2px;margin-right:6px}" +
      ".wcc-countdown-pill .wcc-unit:last-child{margin-right:0}" +
      "@media (max-width: 520px){" +
      ".wcc-countdown-pill{font-size:11px;padding:7px 12px;right:14px;bottom:10px}" +
      ".wcc-countdown-pill .wcc-label{display:none}" +
      "}" +
      // When the Gemini side panel is open (either the inline dashboard panel
      // `.gemini-panel.open` or the injected shared panel `.gemini-panel-shared.open`),
      // drop the countdown behind it and fade it out so it doesn't overlap the
      // input field or message list.
      "body:has(.gemini-panel.open) .wcc-countdown-pill," +
      "body:has(.gemini-panel-shared.open) .wcc-countdown-pill{" +
      "z-index:1;opacity:0;pointer-events:none;" +
      "transition:opacity 0.2s ease;" +
      "}";
    var style = document.createElement("style");
    style.id = "wcc-countdown-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildPill() {
    var pill = document.createElement("div");
    pill.className = "wcc-countdown-pill";
    pill.id = "wcc-countdown-pill";
    pill.setAttribute("role", "timer");
    pill.setAttribute("aria-label", "Countdown to World Cup 2026 kickoff");
    pill.title = "Countdown to WC 2026 kickoff";
    pill.innerHTML =
      "" +
      '<span class="wcc-emoji" aria-hidden="true">🕐</span>' +
      '<span class="wcc-label">WC 2026</span>' +
      '<span class="wcc-num" data-d>--</span><span class="wcc-unit">d</span>' +
      '<span class="wcc-num" data-h>--</span><span class="wcc-unit">h</span>' +
      '<span class="wcc-num" data-m>--</span><span class="wcc-unit">m</span>';
    return pill;
  }

  function tick(pill) {
    var els = {
      d: pill.querySelector("[data-d]"),
      h: pill.querySelector("[data-h]"),
      m: pill.querySelector("[data-m]"),
    };
    function update() {
      var f = fmt(KICKOFF_UTC - Date.now());
      if (f.kickedOff) {
        pill.innerHTML =
          '<span class="wcc-emoji" aria-hidden="true">⚽</span><span class="wcc-num">' +
          f.text +
          "</span>";
        return;
      }
      els.d.textContent = f.d;
      els.h.textContent = pad(f.h);
      els.m.textContent = pad(f.m);
    }
    update();
    // Tick once per minute since seconds are no longer displayed.
    setInterval(update, 30 * 1000);
  }

  function init() {
    if (document.getElementById("wcc-countdown-pill")) return;
    injectStyles();
    var pill = buildPill();
    document.body.appendChild(pill);
    tick(pill);
    // Clean up the stale saved position from the old draggable version so
    // nothing else can resurrect it if we ever reintroduce drag.
    try {
      localStorage.removeItem("wcc_countdown_pos_v1");
    } catch (e) {}
  }

  function lazyInit() {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(init, { timeout: 1500 });
    } else {
      setTimeout(init, 200);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lazyInit);
  } else {
    lazyInit();
  }
})();
