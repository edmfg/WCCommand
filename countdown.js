(function () {
  "use strict";

  // World Cup 2026 opener: Mexico vs South Africa, Estadio Azteca, June 11, 2026.
  // Approximating kickoff at 18:00 UTC (1pm ET / noon CT / 12pm CDMX).
  var KICKOFF_UTC = Date.UTC(2026, 5, 11, 18, 0, 0); // month is 0-indexed: 5 = June
  var STORAGE_KEY = "wcc_countdown_pos_v1";

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
    var css =
      "" +
      ".wcc-countdown-pill{" +
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);" +
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
      "cursor:grab;user-select:none;-webkit-user-select:none;" +
      "touch-action:none;" +
      "transition:box-shadow 0.2s ease;" +
      "}" +
      ".wcc-countdown-pill:hover{box-shadow:0 8px 28px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08) inset}" +
      ".wcc-countdown-pill.dragging{cursor:grabbing;transition:none;box-shadow:0 12px 32px rgba(0,0,0,0.55)}" +
      ".wcc-countdown-pill .wcc-emoji{font-size:15px;line-height:1}" +
      ".wcc-countdown-pill .wcc-label{opacity:0.78;font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:0.8px;margin-right:2px}" +
      ".wcc-countdown-pill .wcc-num{font-variant-numeric:tabular-nums;font-weight:700}" +
      ".wcc-countdown-pill .wcc-unit{opacity:0.65;font-size:10px;font-weight:500;text-transform:uppercase;margin-left:2px;margin-right:6px}" +
      ".wcc-countdown-pill .wcc-unit:last-child{margin-right:0}" +
      "@media (max-width: 520px){" +
      ".wcc-countdown-pill{font-size:11px;padding:7px 12px}" +
      ".wcc-countdown-pill .wcc-label{display:none}" +
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
    pill.title = "Drag to reposition · Countdown to WC 2026 kickoff";
    pill.innerHTML =
      "" +
      '<span class="wcc-emoji" aria-hidden="true">🕐</span>' +
      '<span class="wcc-label">WC 2026</span>' +
      '<span class="wcc-num" data-d>--</span><span class="wcc-unit">d</span>' +
      '<span class="wcc-num" data-h>--</span><span class="wcc-unit">h</span>' +
      '<span class="wcc-num" data-m>--</span><span class="wcc-unit">m</span>';
    return pill;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function applySavedPosition(pill) {
    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {}
    if (!saved || typeof saved.x !== "number" || typeof saved.y !== "number")
      return;
    pill.style.left = clamp(saved.x, 4, window.innerWidth - 60) + "px";
    pill.style.top = clamp(saved.y, 4, window.innerHeight - 40) + "px";
    pill.style.transform = "none";
  }

  function setupDrag(pill) {
    var dragging = false,
      startX = 0,
      startY = 0,
      originX = 0,
      originY = 0,
      moved = false;

    function onDown(e) {
      var pt = e.touches ? e.touches[0] : e;
      var rect = pill.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = pt.clientX;
      startY = pt.clientY;
      originX = rect.left;
      originY = rect.top;
      pill.classList.add("dragging");
      // Pin position to current pixel coords so transform can be cleared
      pill.style.left = originX + "px";
      pill.style.top = originY + "px";
      pill.style.transform = "none";
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - startX;
      var dy = pt.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      var w = pill.offsetWidth;
      var h = pill.offsetHeight;
      var nx = clamp(originX + dx, 4, window.innerWidth - w - 4);
      var ny = clamp(originY + dy, 4, window.innerHeight - h - 4);
      pill.style.left = nx + "px";
      pill.style.top = ny + "px";
      if (e.cancelable) e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      pill.classList.remove("dragging");
      if (moved) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              x: parseFloat(pill.style.left),
              y: parseFloat(pill.style.top),
            }),
          );
        } catch (e) {}
      }
    }

    pill.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    pill.addEventListener("touchstart", onDown, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
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
    applySavedPosition(pill);
    setupDrag(pill);
    tick(pill);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
