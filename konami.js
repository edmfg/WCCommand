/* Konami-code easter egg — silent gate bypass.
 *
 * Listen for ↑ ↑ ↓ ↓ ← → ← → on any page that loads this script. On match,
 * call whichever silent-unlock hooks the page exposes:
 *
 *   - window.__wccUnlockDashboardGate  (index.html — main gate overlay)
 *   - window.__wccUnlockCreativeGate   (index.html — Creative view modal)
 *   - window.__wccUnlockMfgGate        (mfg.html  — production-cockpit gate)
 *
 * Each hook is a no-op when its gate isn't currently visible, so it's safe
 * to call all three on every match. No modal, no toast, no console output.
 *
 * No server cookie is set — Konami only manipulates UI state. API endpoints
 * that check gate cookies (sb-write, etc.) will still 401 for the unlocked
 * session. This is intentional: the easter egg is for the owner's
 * convenience, not a real auth bypass.
 *
 * Listener is bound on window in capture phase + preventDefault on arrows
 * so the focused password input / browser autocomplete dropdown can't
 * swallow keys before we see them.
 */
(function () {
  "use strict";

  var SEQUENCE = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
  ];

  var progress = 0;
  var lastKeyAt = 0;
  var RESET_MS = 3000; // 3s of inactivity resets the streak

  window.addEventListener(
    "keydown",
    function (e) {
      var now = Date.now();
      if (now - lastKeyAt > RESET_MS) progress = 0;
      lastKeyAt = now;

      if (e.key === SEQUENCE[progress]) {
        // Stop arrow keys from feeding the autocomplete dropdown or the
        // password caret so the next key still reaches us.
        if (e.key.indexOf("Arrow") === 0) e.preventDefault();
        progress += 1;
        if (progress === SEQUENCE.length) {
          progress = 0;
          unlockAll();
        }
      } else {
        progress = e.key === SEQUENCE[0] ? 1 : 0;
      }
    },
    true,
  );

  function unlockAll() {
    var t = document.activeElement;
    if (t && typeof t.blur === "function") {
      try {
        if (t.tagName === "INPUT" && t.type === "password") t.value = "";
        t.blur();
      } catch (_) {}
    }
    try {
      if (typeof window.__wccUnlockDashboardGate === "function") {
        window.__wccUnlockDashboardGate();
      }
    } catch (_) {}
    try {
      if (typeof window.__wccUnlockCreativeGate === "function") {
        window.__wccUnlockCreativeGate();
      }
    } catch (_) {}
    try {
      if (typeof window.__wccUnlockMfgGate === "function") {
        window.__wccUnlockMfgGate();
      }
    } catch (_) {}
  }
})();
