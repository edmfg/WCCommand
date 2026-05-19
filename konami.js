/* Konami-code easter egg.
 *
 * Listen for ↑ ↑ ↓ ↓ ← → ← → on any page that loads this script. On match,
 * fetch /api/secret-passwords (which requires a valid gate cookie) and pop
 * a modal listing the active password(s) and what each unlocks. ESC or
 * outside-click to close.
 *
 * No bypass: the endpoint only responds for already-authenticated callers,
 * so the Konami code is a convenience for teammates who forgot the password,
 * not a way in.
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

  document.addEventListener("keydown", function (e) {
    // Ignore when the user is typing in an input / textarea / contenteditable.
    var t = e.target;
    if (
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable)
    ) {
      return;
    }
    var now = Date.now();
    if (now - lastKeyAt > RESET_MS) progress = 0;
    lastKeyAt = now;

    if (e.key === SEQUENCE[progress]) {
      progress += 1;
      if (progress === SEQUENCE.length) {
        progress = 0;
        trigger();
      }
    } else {
      // Allow a fresh start on this key if it matches step 0.
      progress = e.key === SEQUENCE[0] ? 1 : 0;
    }
  });

  function trigger() {
    fetch("/api/secret-passwords", { method: "GET", credentials: "same-origin" })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.status === 401) {
          showModal({ locked: true });
          return;
        }
        if (!r.data || !r.data.ok) {
          showModal({ error: (r.data && r.data.error) || "unknown error" });
          return;
        }
        showModal({ payload: r.data });
      })
      .catch(function (err) {
        showModal({ error: err && err.message ? err.message : String(err) });
      });
  }

  function injectStyles() {
    if (document.getElementById("wcc-konami-style")) return;
    var css =
      "" +
      ".wcc-konami-overlay{" +
      "position:fixed;inset:0;background:rgba(0,0,0,0.72);" +
      "z-index:2147483640;display:flex;align-items:center;justify-content:center;" +
      "opacity:0;pointer-events:none;transition:opacity 0.2s ease;" +
      "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);" +
      "}" +
      ".wcc-konami-overlay.open{opacity:1;pointer-events:auto}" +
      ".wcc-konami-modal{" +
      "max-width:min(520px,92vw);max-height:88vh;overflow-y:auto;" +
      "background:linear-gradient(160deg,#14181f 0%,#0d1018 100%);" +
      "border:1px solid rgba(255,255,255,0.08);" +
      "border-radius:16px;padding:28px;color:#e8e8e8;" +
      "font-family:'Inter',-apple-system,sans-serif;" +
      "box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04) inset;" +
      "transform:translateY(8px) scale(0.98);transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);" +
      "position:relative;" +
      "}" +
      ".wcc-konami-overlay.open .wcc-konami-modal{transform:translateY(0) scale(1)}" +
      ".wcc-konami-title{" +
      "font-family:'Oswald',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;" +
      "font-size:0.95rem;margin:0 0 4px;" +
      "background:linear-gradient(115deg,#ff3b30,#ff9500,#ffcc00,#34c759,#00c7be,#007aff,#af52de,#ff2d55);" +
      "-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;" +
      "}" +
      ".wcc-konami-sub{font-size:0.78rem;color:#8b95a8;margin:0 0 22px;letter-spacing:0.3px}" +
      ".wcc-konami-close{" +
      "position:absolute;top:14px;right:14px;background:transparent;border:none;" +
      "color:#999;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px;" +
      "}" +
      ".wcc-konami-close:hover{background:rgba(255,255,255,0.08);color:#fff}" +
      ".wcc-konami-gate{" +
      "padding:14px 16px;margin-bottom:10px;border-radius:12px;" +
      "background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);" +
      "}" +
      ".wcc-konami-gate-name{font-weight:600;font-size:0.92rem;color:#fff;margin-bottom:4px;display:flex;align-items:center;gap:8px}" +
      ".wcc-konami-gate-meta{font-size:0.72rem;color:#7a8497;margin-bottom:10px;letter-spacing:0.2px}" +
      ".wcc-konami-pw{" +
      "display:flex;align-items:center;gap:10px;" +
      "padding:9px 12px;border-radius:8px;" +
      "background:rgba(99,102,241,0.14);border:1px solid rgba(99,102,241,0.3);" +
      "font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:0.88rem;color:#e0e7ff;" +
      "word-break:break-all;" +
      "}" +
      ".wcc-konami-copy{" +
      "margin-left:auto;flex:none;background:rgba(255,255,255,0.08);border:none;color:#c7d2fe;" +
      "padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.72rem;font-weight:600;letter-spacing:0.4px;" +
      "text-transform:uppercase;font-family:inherit;" +
      "}" +
      ".wcc-konami-copy:hover{background:rgba(99,102,241,0.3);color:#fff}" +
      ".wcc-konami-copy.copied{background:rgba(52,199,89,0.3);color:#fff}" +
      ".wcc-konami-note{margin-top:14px;font-size:0.78rem;color:#8b95a8;line-height:1.5;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.08)}" +
      ".wcc-konami-msg{font-size:0.88rem;line-height:1.5;color:#e8e8e8}" +
      ".wcc-konami-msg.error{color:#ffb4b4}";
    var style = document.createElement("style");
    style.id = "wcc-konami-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function buildBody(state) {
    if (state.locked) {
      return (
        '<div class="wcc-konami-msg">' +
        "🔒 You're not signed in. Unlock the dashboard or MFG cockpit first, then try again." +
        "</div>"
      );
    }
    if (state.error) {
      return (
        '<div class="wcc-konami-msg error">' +
        "⚠️ " +
        escapeHtml(state.error) +
        "</div>"
      );
    }
    var p = state.payload;
    var html = "";
    p.gates.forEach(function (g) {
      var meta =
        g.page +
        " · cookie <code>" +
        escapeHtml(g.cookie) +
        "</code> · session " +
        escapeHtml(g.ttl) +
        (g.env ? " · " + escapeHtml(g.env) : "");
      html +=
        '<div class="wcc-konami-gate">' +
        '<div class="wcc-konami-gate-name">' +
        escapeHtml(g.name) +
        "</div>" +
        '<div class="wcc-konami-gate-meta">' +
        meta +
        "</div>" +
        '<div class="wcc-konami-pw">' +
        '<span class="wcc-konami-pw-val">' +
        escapeHtml(g.password) +
        "</span>" +
        '<button type="button" class="wcc-konami-copy" data-pw="' +
        escapeHtml(g.password) +
        '">Copy</button>' +
        "</div>" +
        "</div>";
    });
    if (p.note) {
      html += '<div class="wcc-konami-note">' + escapeHtml(p.note) + "</div>";
    }
    return html;
  }

  var openOverlay = null;

  function showModal(state) {
    injectStyles();
    if (openOverlay) close();
    var overlay = document.createElement("div");
    overlay.className = "wcc-konami-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<div class="wcc-konami-modal" role="document">' +
      '<button class="wcc-konami-close" aria-label="Close">&times;</button>' +
      '<h2 class="wcc-konami-title">🎮 Konami unlock</h2>' +
      '<p class="wcc-konami-sub">Active passwords for this deploy</p>' +
      '<div class="wcc-konami-body">' +
      buildBody(state) +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    openOverlay = overlay;
    // Trigger transition
    requestAnimationFrame(function () {
      overlay.classList.add("open");
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".wcc-konami-close").addEventListener("click", close);
    overlay.addEventListener("keydown", escClose);
    document.addEventListener("keydown", escClose);
    overlay.querySelectorAll(".wcc-konami-copy").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pw = btn.getAttribute("data-pw") || "";
        try {
          navigator.clipboard.writeText(pw);
          btn.classList.add("copied");
          btn.textContent = "Copied";
          setTimeout(function () {
            btn.classList.remove("copied");
            btn.textContent = "Copy";
          }, 1400);
        } catch (e) {}
      });
    });
  }

  function escClose(e) {
    if (e.key === "Escape") close();
  }

  function close() {
    if (!openOverlay) return;
    var o = openOverlay;
    openOverlay = null;
    o.classList.remove("open");
    document.removeEventListener("keydown", escClose);
    setTimeout(function () {
      if (o.parentNode) o.parentNode.removeChild(o);
    }, 220);
  }
})();
