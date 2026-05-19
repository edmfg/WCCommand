/* Shared Gemini Assistant — works on both Live Dashboard (index.html) and MFG mode (mfg.html).
 *
 * Behavior:
 * - On the Live Dashboard, an inline Gemini panel already exists (#geminiPanel). This script
 *   only injects prepopulated prompt chips above the input field on that existing panel.
 * - On any other page (e.g. MFG mode), it auto-injects a complete Gemini button + slide-in
 *   panel with the same look-and-feel, calls /api/gemini, and ships a mode-aware system
 *   instruction.
 * - Prepopulated prompts are mode-specific. Click a chip to send it.
 */
(function () {
  "use strict";

  function detectMode() {
    var path = (location.pathname || "").toLowerCase();
    if (/mfg(\.html)?$/.test(path) || /\/mfg\//.test(path)) return "mfg";
    return "dashboard";
  }

  var MODE = detectMode();

  var PROMPTS = {
    dashboard: [
      "What's trending on social right now?",
      "Top 3 reactive content opportunities this week",
      "Summarize the dominant macro narratives",
      "Which markets need our attention?",
      "What story should we lead with tomorrow?",
      "How do I use this dashboard?",
    ],
    mfg: [
      "How do I upload new creative?",
      "How do I refresh the dashboard with fresh news?",
      "How do I publish a Today's Reactive briefing?",
      "Help me draft a triage card from this brief",
      "Group my open triage items by tag and suggest priorities",
      "Draft a daily content update from this week's news",
      "Suggest 3 reactive prompt ideas for the team to test",
    ],
  };

  var CHIP_LIMIT = 3;
  var CHIP_CACHE_KEY = "wcc_gemini_chips_v1";
  function chipsFor(mode) {
    // Persist the chosen chip set across the same browser session keyed by mode,
    // so a strategist re-opening the panel sees the same suggestions and builds
    // muscle memory instead of chasing a re-randomized row.
    try {
      var cached = sessionStorage.getItem(CHIP_CACHE_KEY + ":" + mode);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    var pool = (PROMPTS[mode] || PROMPTS.dashboard).slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    var chosen = pool.slice(0, CHIP_LIMIT);
    try {
      sessionStorage.setItem(
        CHIP_CACHE_KEY + ":" + mode,
        JSON.stringify(chosen),
      );
    } catch (e) {}
    return chosen;
  }

  // Distilled "101" — the same primer the MFG team sees in the in-app overlay.
  // Lets Gemini answer "how do I upload new creative", "how do I refresh news",
  // "what's in the cockpit", etc. without the user having to crack open the modal.
  var HOW_TO_GUIDE =
    "## How World Cup HQ works (use this to answer 'how do I…' questions)\n" +
    "World Cup HQ is MFG's command centre for the 2026 FIFA World Cup (Jun 11 – Jul 19, hosts Canada / Mexico / USA). Two surfaces, one system, one password (separate cookies per gate).\n\n" +
    "### Public Dashboard (index.html)\n" +
    "- **Live tab**: breaking ticker, pinned bookmarks bar, sentiment heatmap (volume × sentiment per market), multi-select filter pills (All / Recent 72h / Canada / Germany / UK / USA / Game / Culture), News carousel (tags Canada/USA/Germany/UK/Macro/Global), Social Trends carousel (categories game/food/music/fashion/fandom/memes with platform pills X/TikTok/IG/Reddit/YouTube + volume/sentiment), entity auto-linking (clicking a player/coach/team filters every surface).\n" +
    "- **Fixtures tab**: Calendar / By Date / Standings (live recompute), stage filter + ⏱ Next 24h toggle, TODAY badge.\n" +
    "- **Creative tab** (gated separately, 12h cookie): WC Engine / YT × Genius / Fox S2 sub-tabs. Cards from Supabase + hardcoded. Sort + market filter pills. Drive videos play inline.\n" +
    "- **Today's Reactive**: red pill on Live → market chooser → per-market briefing (Cultural read + Match read + 3 iPhone storyboards). Canada is live; USA/UK/Germany show 'Soon'.\n" +
    "- **Floating**: Gemini button (G to open), countdown pill (drag), Cmd+K global search, ? for shortcuts.\n\n" +
    "### MFG Cockpit (mfg.html) — production tools\n" +
    "- 🔄 **Refresh Content** — Gemini sweeps WC2026 news/Reddit/social, writes to Supabase live_updates. Public dashboard's 'Refreshed Xm ago' chip ticks forward automatically. Also runs daily at 5am NY via Vercel cron.\n" +
    "- 🔥 **Today's Reactive** — paste a strategist's brief (or upload .txt/.md/.pdf/.docx), pick the market, hit Execute → Gemini converts to structured briefing → review → Publish.\n" +
    "- 📅 **Content Calendar** — per-market production calendar (Lead Up → Group Stage → Knockouts → Final), Social/Reactive/Digital OOH slots. Canada live.\n" +
    "- 🧯 **Global Triage** — drag-and-drop kanban auto-grouped by tag (creative/strategy/macro/activation/media/production/talent/partnerships/legal). Soft delete with 5-second Undo toast. Snapshots to Supabase.\n" +
    "- 🎬 **Creative Uploads** — post Drive-hosted creative to the public Creative tab.\n" +
    "- 📋 **Audit Log** — chronological feed of every Creative / Triage / Reactive publish. Filter + search + CSV export.\n\n" +
    "### How to upload new creative (step-by-step)\n" +
    "1. Open mfg.html, unlock with the MFG password (same as the dashboard password).\n" +
    "2. Click the 🎬 Creative Uploads tab.\n" +
    "3. Pick one or more **Markets** (Canada / USA / Germany / UK / Global) — multi-select.\n" +
    "4. Optional: pick a **Bento** slot (BENTO 1 Long/Results/16, BENTO 2 Query/Result/Query/23, BENTO 3 Query/Query/16, or ELSE).\n" +
    "5. Optional: **Title** (auto-generated as 'Creative — <markets>' if blank).\n" +
    "6. Optional: **Live-from** and **Live-until** dates.\n" +
    "7. Optional: **Channel** (defaults IG; choices IG/TT/YT/FB/X/DOOH/ELSE).\n" +
    "8. Paste the **Drive link** (required). Drive file MUST be set to 'Anyone with the link can view' or thumbnails/inline playback break.\n" +
    "9. Submit. The asset is live immediately on the public Creative tab; it appears under each market's filter pill.\n" +
    "10. To remove: hover the card → click ×, then click again within 3 seconds to confirm. Hard delete from Supabase.\n\n" +
    "### How to refresh the dashboard with fresh news\n" +
    "- **Automatic**: nothing to do — Vercel cron at 5am NY runs Gemini + Google Search and inserts rows.\n" +
    "- **Manual button**: in MFG cockpit, click 🔄 Refresh Content. Watch the overlay's progress bar; rows publish immediately to index.html. Refreshes are additive — they never delete existing rows.\n" +
    "- **Manual curated** (owner only): ask Claude in chat to 'refresh everything' — deeper Reddit + web sweep, edits data.js directly, pushes to main.\n\n" +
    "### How to publish a Today's Reactive briefing\n" +
    "1. In MFG cockpit, click 🔥 Today's Reactive.\n" +
    "2. Pick the market (Canada is the live template; others marked Soon).\n" +
    "3. Paste the strategist's brief into the textarea, OR upload .txt / .md / .pdf / .docx.\n" +
    "4. Hit **Execute** — Gemini converts the raw brief into the structured briefing (Cultural read, Match read, 3 storyboards).\n" +
    "5. Review the conversion. Edit anything that's off.\n" +
    "6. Hit **Publish** — it appears on the public Today's Reactive page for that market.\n\n" +
    "### How to use Triage\n" +
    "- Drag cards between columns. Auto-grouped by tag — no manual column setup.\n" +
    "- Delete: × on a card → 5-second toast with Undo before it's gone for good.\n" +
    "- Snapshot history panel is collapsed by default; expand it to roll back to a saved state.\n\n" +
    "### Markets — how each gets fed\n" +
    "- 5 markets: 🇨🇦 Canada, 🇺🇸 USA, 🇬🇧 UK, 🇩🇪 Germany, 🌍 Macro/Global.\n" +
    "- News/social tagged by market; multi-market creative comma-joined and surfaces under each pill.\n" +
    "- Today's Reactive and Content Calendar are per-market (Canada live, others 'Soon').\n" +
    "- Fixtures, standings, ticker are shared.\n\n" +
    "### Small print\n" +
    "- Refreshes are additive; uploads survive code deploys (Supabase, not codebase). Only the × on a card deletes creative.\n" +
    "- Drive files MUST be 'Anyone with link' for thumbnails and inline playback.\n" +
    "- Sessions: MFG gate 7d, Creative-view 12h, Dashboard 8h (or 7d 'remember me').\n" +
    "- Stale check: 'Refreshed Xm ago' chip on public dashboard + Audit Log in cockpit.\n\n" +
    "When the user asks **how to do something**, walk them through the steps numbered, in order, using the recipes above. Reference the exact tab / button / field names. If it's a 'where do I find X' question, name the page (index.html / mfg.html / formation.html) and the tab.\n";

  // Expose the how-to block so the dashboard's inline Gemini panel (which has
  // its own system instruction built in index.html) can append it too.
  try { window.WCC_HOW_TO_GUIDE = HOW_TO_GUIDE; } catch (e) {}

  function buildSystemInstruction(mode) {
    var modeBlock =
      mode === "mfg"
        ? "## MODE: MFG Production Mode\n" +
          "You are inside MFG Mode — the password-gated production cockpit at /mfg.html. " +
          "The user is a member of the MFG team using the Global Triage board, Production Tracker, " +
          "Prompts Tracker, and Daily Update tools to run reactive content during the 2026 FIFA World Cup. " +
          "Optimize answers for **production decisions**: assign tags, prioritize triage items, draft " +
          "briefs, surface gaps, propose prompt experiments, and turn raw news/social into structured " +
          "updates for the Live Dashboard. The Live Dashboard data lives on the index.html page; you " +
          "don't have it loaded here, so when the user asks about specific dashboard cards or trends, " +
          "either use Google Search (you have it) or ask them to paste the relevant snippet."
        : "## MODE: Live Dashboard\n" +
          "You are inside the public-facing Live Dashboard at /index.html — News carousel, Social " +
          "Trends, Fixtures, Creative pipeline. The user is consuming intel rather than producing " +
          "content. Answer questions about specific cards, fixtures, social topics, and brand campaigns. " +
          "Use the dashboard data that the page-level system prompt already provides.";

    return (
      "You are the embedded strategic analyst inside **MFG World Cup HQ** — an internal war room " +
      "running premade and reactive Instagram content during the 2026 FIFA World Cup " +
      "(June 11 – July 19, 2026; Canada / Mexico / USA hosts).\n\n" +
      modeBlock +
      "\n\n" +
      "## Format — bullets only, concise (HARD RULE)\n" +
      '- **Always answer in bullet points.** No prose paragraphs, no intros, no outros, no "Sure!" / "Great question" / "Based on the dashboard". Just bullets.\n' +
      "- **3–5 bullets is the default.** 7 maximum. Stop the second the question is answered.\n" +
      "- Each bullet is one short scannable line. Lead the first bullet with the answer; the rest add supporting facts. Don't restate the question.\n" +
      "- **bold** key terms inside bullets. Numbered lists only when the order genuinely matters.\n" +
      "- **Exception for 'how do I…' / 'how to…' questions**: use a numbered step list in the order the user has to do them. Up to ~10 steps. Still no prose intro/outro — go straight to step 1.\n" +
      "- ### headers only when the user explicitly asks for a multi-section answer.\n" +
      '- Skip caveats, disclaimers, and "I cannot…" preambles unless directly relevant.\n' +
      '- Only switch to longer prose if the user explicitly asks ("dig deeper", "give me more", "explain in detail").\n\n' +
      "## Web search\n" +
      "You have live Google Search. Use it for late-breaking news, scores, transfers, injuries, " +
      'social reactions, or anything time-sensitive. Cite outlets inline ("per ESPN…", "Al Jazeera…").\n\n' +
      "## Scope (HARD CONSTRAINT — apply to every response)\n" +
      "You are a **2026 FIFA World Cup analyst**. Stay strictly inside this scope:\n" +
      "- The 2026 FIFA World Cup itself: matches, fixtures, groups, knockouts, host cities, venues, schedules, prize money, format, ticketing, fan zones, broadcast.\n" +
      "- Participating teams (all 48), their players, coaches, squads, injuries, form, tactics, kits, friendlies, training camps.\n" +
      "- Adjacent football context **only when it bears on WC2026** — club seasons that affect player availability, qualifier results, recent international friendlies, transfers/contracts that change WC eligibility.\n" +
      "- WC2026 brand campaigns, sponsors, marketing activations, social trends, fan reactions, creative pipeline.\n" +
      "- The MFG dashboard itself: how to use it, what's in it, content strategy for IG.\n\n" +
      "**Out of scope — politely decline and redirect to a WC topic:**\n" +
      "- General politics, elections, partisan commentary, geopolitical conflict, war, military issues (even if a country involved has a WC team — talk only about the football).\n" +
      "- Religion, ideology, social-issue debates, opinions on contested figures.\n" +
      "- Medical, legal, or financial advice for individuals.\n" +
      "- Adult/explicit content, hate or harassment, slurs, doxxing, content targeting any group.\n" +
      "- Personal attacks on players, coaches, journalists; speculation about private life, relationships, mental health beyond what teams have publicly disclosed about availability.\n" +
      "- Instructions for harm, deception, evasion, or anything illegal.\n" +
      "- Programming, math, productivity, or general assistant tasks unrelated to the WC.\n\n" +
      "**Brand safety — this output may be quoted in IG content:**\n" +
      "- Stay neutral, factual, brand-safe (Google-Ads-grade). No profanity, no slurs, no aggressive partisanship.\n" +
      "- For sensitive WC-adjacent stories (e.g. Iran-FIFA visa friction, Saudi Aramco sponsorship, ticket-pricing backlash), report what reputable outlets have reported. Do not editorialize, take a political side, or attribute motives. Frame as 'X has been reported by [outlets].'\n" +
      "- If you can't stay brand-safe and on-topic, decline that piece and offer a related WC angle.\n\n" +
      "**How to refuse off-topic asks:** one sentence acknowledging the limit, one sentence offering a relevant WC pivot. Example: \"I'm scoped to the 2026 FIFA World Cup so I can't weigh in on that — happy to dig into a related WC angle if there's one you'd like.\"\n\n" +
      HOW_TO_GUIDE +
      "\n" +
      "## Current context\n" +
      "- Today: " +
      new Date().toISOString().slice(0, 10) +
      "\n" +
      "- Page: " +
      location.pathname +
      "\n" +
      "- Mode: " +
      (mode === "mfg" ? "MFG (production)" : "Dashboard (consumption)") +
      "\n"
    );
  }

  // ── Prepopulated chip UI (added to BOTH the existing dashboard panel and the new mfg panel) ──
  function injectChipStyles() {
    if (document.getElementById("gemini-chips-style")) return;
    var css =
      "" +
      ".gemini-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;border-bottom:1px solid rgba(255,255,255,0.05)}" +
      ".gemini-chips:empty{display:none}" +
      ".gemini-chip{" +
      "font-family:inherit;font-size:11.5px;font-weight:500;letter-spacing:0.2px;" +
      "padding:6px 11px;border-radius:999px;" +
      "background:rgba(99,102,241,0.14);color:#c7d2fe;" +
      "border:1px solid rgba(99,102,241,0.32);" +
      "cursor:pointer;white-space:nowrap;" +
      "transition:background 0.15s ease,border-color 0.15s ease,transform 0.1s ease;" +
      "}" +
      ".gemini-chip:hover{background:rgba(99,102,241,0.26);border-color:rgba(99,102,241,0.55);color:#e0e7ff}" +
      ".gemini-chip:active{transform:translateY(1px)}" +
      "body.light .gemini-chip{background:rgba(99,102,241,0.10);color:#4338ca;border-color:rgba(99,102,241,0.30)}" +
      "body.light .gemini-chip:hover{background:rgba(99,102,241,0.18);color:#3730a3}";
    var style = document.createElement("style");
    style.id = "gemini-chips-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildChipsBar(prompts, onClick) {
    var bar = document.createElement("div");
    bar.className = "gemini-chips";
    bar.setAttribute("aria-label", "Suggested prompts");
    prompts.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gemini-chip";
      b.textContent = p;
      b.addEventListener("click", function () {
        onClick(p);
      });
      bar.appendChild(b);
    });
    return bar;
  }

  // ── Path A: existing Gemini panel on the Live Dashboard. Just add chips. ──
  function enhanceExistingPanel() {
    var panel = document.getElementById("geminiPanel");
    var inputArea = panel && panel.querySelector(".gemini-input-area");
    var input = document.getElementById("geminiInput");
    var sendBtn = document.getElementById("geminiSend");
    if (!panel || !inputArea || !input || !sendBtn) return false;
    if (panel.querySelector(".gemini-chips")) return true; // already injected
    injectChipStyles();
    var chips = buildChipsBar(chipsFor(MODE), function (text) {
      input.value = text;
      // Trigger the existing Send handler
      sendBtn.click();
    });
    inputArea.parentNode.insertBefore(chips, inputArea);
    return true;
  }

  // ── Path B: no existing panel (e.g. MFG mode). Inject the whole thing. ──
  function injectFullPanel() {
    if (document.getElementById("geminiToggleShared")) return;
    injectChipStyles();
    injectFullStyles();

    var toggle = document.createElement("button");
    toggle.id = "geminiToggleShared";
    toggle.className = "gemini-toggle-shared";
    toggle.setAttribute("aria-label", "Open Gemini Assistant");
    toggle.innerHTML = "<span>✨ Gemini</span>";

    var overlay = document.createElement("div");
    overlay.className = "gemini-overlay-shared";
    overlay.id = "geminiOverlayShared";

    var panel = document.createElement("div");
    panel.className = "gemini-panel-shared";
    panel.id = "geminiPanelShared";
    panel.innerHTML =
      "" +
      '<div class="gemini-header-shared">' +
      '<span class="gemini-brand-shared">Gemini Assistant · ' +
      (MODE === "mfg" ? "MFG Mode" : "Dashboard") +
      "</span>" +
      '<button class="gemini-close-shared" id="geminiCloseShared" aria-label="Close">&times;</button>' +
      "</div>" +
      '<div class="gemini-messages-shared" id="geminiMessagesShared">' +
      '<div class="gemini-msg-shared assistant">' +
      (MODE === "mfg"
        ? "Hey — MFG Mode. I'll help you triage, draft updates, structure briefs, and turn raw news into shippable content. Pick a prompt below or ask anything."
        : "Hey! I'm your Gemini-powered World Cup assistant. Ask about matches, social trends, creative assets, or campaign strategy.") +
      "</div>" +
      "</div>" +
      '<div class="gemini-input-area-shared">' +
      '<input class="gemini-input-shared" id="geminiInputShared" placeholder="' +
      (MODE === "mfg"
        ? "Ask about triage, briefs, daily updates…"
        : "Ask about the WC campaign…") +
      '" />' +
      '<button class="gemini-send-shared" id="geminiSendShared">Send</button>' +
      "</div>";

    document.body.appendChild(toggle);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Insert chips above input
    var inputArea = panel.querySelector(".gemini-input-area-shared");
    var input = panel.querySelector("#geminiInputShared");
    var sendBtn = panel.querySelector("#geminiSendShared");
    var chips = buildChipsBar(chipsFor(MODE), function (text) {
      input.value = text;
      sendBtn.click();
    });
    inputArea.parentNode.insertBefore(chips, inputArea);

    // Wire open/close
    function open() {
      overlay.classList.add("open");
      panel.classList.add("open");
      setTimeout(function () {
        input.focus();
      }, 50);
    }
    function close() {
      overlay.classList.remove("open");
      panel.classList.remove("open");
    }
    toggle.addEventListener("click", open);
    overlay.addEventListener("click", close);
    document
      .getElementById("geminiCloseShared")
      .addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
    });

    // Wire send
    var chatHistory = [];
    var messages = document.getElementById("geminiMessagesShared");

    function escHtml(s) {
      var d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }

    function renderMd(text) {
      var html = escHtml(text);
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
      html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
      html = html.replace(/((?:^[\-\*] .+\n?)+)/gm, function (block) {
        var items = block
          .trim()
          .split("\n")
          .map(function (l) {
            return "<li>" + l.replace(/^[\-\*] /, "") + "</li>";
          })
          .join("");
        return "<ul>" + items + "</ul>";
      });
      html = html.replace(/((?:^\d+\. .+\n?)+)/gm, function (block) {
        var items = block
          .trim()
          .split("\n")
          .map(function (l) {
            return "<li>" + l.replace(/^\d+\. /, "") + "</li>";
          })
          .join("");
        return "<ol>" + items + "</ol>";
      });
      html = html
        .split("\n\n")
        .map(function (p) {
          return /^<(ul|ol|h[34])/.test(p) ? p : "<p>" + p + "</p>";
        })
        .join("");
      return html;
    }

    // Sticky-bottom autoscroll: only follow if the user is near the bottom
    // (within 80px). If they've scrolled up to read history, leave them put.
    function autoScroll() {
      if (!messages) return;
      var nearBottom =
        messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
      if (nearBottom) {
        requestAnimationFrame(function () {
          messages.scrollTop = messages.scrollHeight;
        });
      }
    }

    function appendMsg(role, text) {
      var d = document.createElement("div");
      d.className = "gemini-msg-shared " + role;
      d.innerHTML = role === "assistant" ? renderMd(text) : escHtml(text);
      messages.appendChild(d);
      autoScroll();
      return d;
    }

    // Watch the messages container for any DOM mutation (e.g. when thinking
    // placeholder gets its innerHTML rewritten with the real response) and
    // keep the view pinned to the bottom while streaming.
    if (typeof MutationObserver !== "undefined" && messages) {
      var mo = new MutationObserver(autoScroll);
      mo.observe(messages, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    async function send() {
      var text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      appendMsg("user", text);
      chatHistory.push({ role: "user", parts: [{ text: text }] });
      // Animated three-dot typing indicator while waiting for the API.
      var thinking = document.createElement("div");
      thinking.className = "gemini-msg-shared assistant gemini-typing-shared";
      thinking.innerHTML =
        '<span class="typing-dots-shared" aria-label="Gemini is typing">' +
        "<span></span><span></span><span></span>" +
        "</span>";
      messages.appendChild(thinking);
      autoScroll();

      try {
        var systemInstruction = buildSystemInstruction(MODE);
        var payload = {
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: chatHistory,
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        };
        var res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        var data = await res.json();
        if (data && data.error) {
          thinking.innerHTML =
            "<em>Error: " + escHtml(data.error.message || "unknown") + "</em>";
          return;
        }
        var reply = (
          (data &&
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts) ||
          []
        )
          .map(function (p) {
            return p.text || "";
          })
          .join("")
          .trim();
        if (!reply) {
          thinking.innerHTML = "<em>(empty response)</em>";
          return;
        }
        thinking.innerHTML = renderMd(reply);
        chatHistory.push({ role: "model", parts: [{ text: reply }] });
      } catch (err) {
        thinking.innerHTML =
          "<em>Network error: " + escHtml(err.message || String(err)) + "</em>";
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  function injectFullStyles() {
    if (document.getElementById("gemini-shared-style")) return;
    var css =
      "" +
      ".gemini-toggle-shared{" +
      "position:fixed;bottom:62px;right:24px;z-index:9000;" +
      "font-family:'Oswald',sans-serif;font-weight:700;font-size:0.85rem;" +
      "text-transform:uppercase;letter-spacing:1.5px;color:#fff;" +
      "padding:14px 22px;border-radius:999px;cursor:pointer;" +
      "border:1px solid rgba(255,255,255,0.3);" +
      "background:linear-gradient(115deg,#ff3b30 0%,#ff9500 14%,#ffcc00 28%,#34c759 42%,#00c7be 56%,#007aff 70%,#af52de 84%,#ff2d55 100%);" +
      "background-size:400% 400%;" +
      "box-shadow:0 10px 30px rgba(0,0,0,0.35),0 4px 18px rgba(175,82,222,0.35),inset 0 1px 0 rgba(255,255,255,0.55),inset 0 -1px 0 rgba(0,0,0,0.2);" +
      "text-shadow:0 1px 2px rgba(0,0,0,0.45);" +
      "animation:gemini-flow-shared 8s ease-in-out infinite;" +
      "transition:transform 0.25s,box-shadow 0.25s;" +
      "}" +
      ".gemini-toggle-shared:hover{transform:translateY(-2px) scale(1.05)}" +
      ".gemini-toggle-shared:active{transform:translateY(0) scale(0.98)}" +
      "body:has(.gemini-panel-shared.open) .gemini-toggle-shared{opacity:0;pointer-events:none;transform:translateY(8px) scale(0.95)}" +
      "@keyframes gemini-flow-shared{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}" +
      ".gemini-overlay-shared{" +
      "position:fixed;inset:0;background:rgba(0,0,0,0.45);" +
      "opacity:0;pointer-events:none;transition:opacity 0.25s;z-index:9500;" +
      "}" +
      ".gemini-overlay-shared.open{opacity:1;pointer-events:auto}" +
      ".gemini-panel-shared{" +
      "position:fixed;top:0;right:0;height:100vh;width:min(440px,100vw);" +
      "background:rgba(14,16,24,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);" +
      "border-left:1px solid rgba(255,255,255,0.08);" +
      "box-shadow:-12px 0 40px rgba(0,0,0,0.5);" +
      "transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);" +
      "z-index:9600;display:flex;flex-direction:column;color:#e8e8e8;" +
      "font-family:'Inter',-apple-system,sans-serif;" +
      "}" +
      ".gemini-panel-shared.open{transform:translateX(0)}" +
      ".gemini-header-shared{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between}" +
      ".gemini-brand-shared{font-weight:600;font-size:0.95rem;letter-spacing:0.2px}" +
      ".gemini-close-shared{background:none;border:none;color:#999;font-size:24px;cursor:pointer;line-height:1;padding:0 4px}" +
      ".gemini-close-shared:hover{color:#fff}" +
      ".gemini-messages-shared{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}" +
      ".gemini-msg-shared{padding:10px 14px;border-radius:10px;font-size:0.88rem;line-height:1.5;max-width:92%}" +
      ".gemini-typing-shared{padding:12px 16px}" +
      ".typing-dots-shared{display:inline-flex;align-items:center;gap:5px}" +
      ".typing-dots-shared span{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.55);display:inline-block;animation:typing-bounce-shared 1.3s infinite ease-in-out}" +
      ".typing-dots-shared span:nth-child(2){animation-delay:0.18s}" +
      ".typing-dots-shared span:nth-child(3){animation-delay:0.36s}" +
      "@keyframes typing-bounce-shared{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-4px);opacity:1}}" +
      ".gemini-msg-shared.assistant{background:rgba(255,255,255,0.05);align-self:flex-start;color:#e8e8e8}" +
      ".gemini-msg-shared.user{background:rgba(99,102,241,0.18);align-self:flex-end;color:#e0e7ff;border:1px solid rgba(99,102,241,0.35)}" +
      ".gemini-msg-shared.assistant ul,.gemini-msg-shared.assistant ol{margin:6px 0 6px 18px}" +
      ".gemini-msg-shared.assistant li{margin-bottom:3px}" +
      ".gemini-msg-shared.assistant p{margin:0 0 6px}" +
      ".gemini-msg-shared.assistant p:last-child{margin-bottom:0}" +
      ".gemini-msg-shared.assistant strong{color:#fff}" +
      ".gemini-msg-shared.assistant h3,.gemini-msg-shared.assistant h4{font-size:0.92rem;color:#fff;margin:8px 0 4px}" +
      ".gemini-input-area-shared{display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08)}" +
      ".gemini-input-shared{" +
      "flex:1;padding:9px 14px;border-radius:999px;" +
      "background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);" +
      "color:#fff;font-size:0.85rem;outline:none;" +
      "}" +
      ".gemini-input-shared:focus{border-color:rgba(99,102,241,0.5)}" +
      ".gemini-send-shared{" +
      "padding:9px 18px;border-radius:999px;border:none;cursor:pointer;" +
      "background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:0.82rem;" +
      "}" +
      ".gemini-send-shared:hover{filter:brightness(1.1);box-shadow:0 0 16px rgba(99,102,241,0.35)}" +
      "@media(max-width:520px){.gemini-panel-shared{width:100vw}}";
    var style = document.createElement("style");
    style.id = "gemini-shared-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Coach mark: floating tip pointing at the Gemini button ──
  // Shown once on the first session; click the × or click the Gemini button
  // to dismiss. Dismissal is persisted in localStorage.
  var COACH_KEY = "wcc_gemini_coach_dismissed_v1";

  function injectCoachStyles() {
    if (document.getElementById("gemini-coach-style")) return;
    var css =
      "" +
      ".gemini-coach{" +
      // Bottom-aligned with the Gemini button so the right-edge arrow can
      // land squarely at the button's vertical centre.
      "position:fixed;bottom:62px;right:160px;z-index:9100;" +
      "max-width:260px;padding:14px 38px 14px 16px;" +
      "background:linear-gradient(135deg,rgba(99,102,241,0.96),rgba(139,92,246,0.96));" +
      "color:#fff;border-radius:14px;" +
      "box-shadow:0 12px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08) inset;" +
      "font-family:'Inter',-apple-system,sans-serif;font-size:0.82rem;line-height:1.45;" +
      "opacity:0;transform:translateY(8px) scale(0.96);" +
      "transition:opacity 0.3s ease,transform 0.3s ease;" +
      "pointer-events:none;" +
      "filter:drop-shadow(0 4px 14px rgba(0,0,0,0.35));" +
      "}" +
      ".gemini-coach.show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;animation:gemini-coach-pulse 2.6s ease-in-out infinite}" +
      // Solid triangular arrow tail anchored near the bubble's bottom-right
      // (same vertical zone as the button). Pure CSS triangle, no rotated
      // square — points clearly to the right.
      ".gemini-coach::after{" +
      "content:'';position:absolute;right:-15px;bottom:18px;" +
      "width:0;height:0;" +
      "border-top:13px solid transparent;" +
      "border-bottom:13px solid transparent;" +
      "border-left:18px solid rgba(139,92,246,0.96);" +
      "}" +
      ".gemini-coach-title{font-weight:700;font-size:0.82rem;margin-bottom:4px;letter-spacing:0.2px;display:flex;align-items:center;gap:6px}" +
      ".gemini-coach-body{opacity:0.94}" +
      ".gemini-coach-close{" +
      "position:absolute;top:6px;right:8px;background:transparent;border:none;" +
      "color:rgba(255,255,255,0.85);font-size:1.15rem;line-height:1;cursor:pointer;" +
      "padding:2px 6px;border-radius:5px;" +
      "}" +
      ".gemini-coach-close:hover{background:rgba(255,255,255,0.18);color:#fff}" +
      "@keyframes gemini-coach-pulse{" +
      "0%,100%{box-shadow:0 12px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08) inset,0 0 0 0 rgba(99,102,241,0.45)}" +
      "50%{box-shadow:0 12px 32px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08) inset,0 0 0 12px rgba(99,102,241,0)}" +
      "}" +
      "@media (max-width:640px){" +
      ".gemini-coach{right:24px;bottom:130px;max-width:calc(100vw - 48px)}" +
      ".gemini-coach::after{display:none}" +
      "}";
    var style = document.createElement("style");
    style.id = "gemini-coach-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showCoachMark() {
    try {
      if (localStorage.getItem(COACH_KEY) === "1") return;
    } catch (e) {}
    var toggle =
      document.getElementById("geminiToggle") ||
      document.getElementById("geminiToggleShared");
    if (!toggle) return;
    if (document.getElementById("geminiCoach")) return;
    injectCoachStyles();
    var el = document.createElement("div");
    el.id = "geminiCoach";
    el.className = "gemini-coach";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<button class="gemini-coach-close" aria-label="Dismiss tip">&times;</button>' +
      '<div class="gemini-coach-title">✨ Ask Gemini anything</div>' +
      '<div class="gemini-coach-body">Gemini already knows everything on this dashboard — news, social trends, fixtures, creative pipeline. Click <strong>Gemini</strong> to ask.</div>';
    document.body.appendChild(el);
    function dismiss(persist) {
      el.classList.remove("show");
      if (persist !== false) {
        try {
          localStorage.setItem(COACH_KEY, "1");
        } catch (e) {}
      }
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }
    el.querySelector(".gemini-coach-close").addEventListener(
      "click",
      function (e) {
        e.stopPropagation();
        dismiss();
      },
    );
    toggle.addEventListener("click", function () {
      dismiss();
    });
    // Slide in 1.4s after page settles so it doesn't compete with first paint.
    setTimeout(function () {
      el.classList.add("show");
    }, 1400);
    // Auto-dismiss after 12s if the user doesn't engage — without persisting
    // (so it shows again next visit).
    setTimeout(function () {
      if (el.classList.contains("show")) dismiss(false);
    }, 12000);
  }

  function init() {
    if (!enhanceExistingPanel()) {
      injectFullPanel();
    }
    showCoachMark();
  }

  function lazyInit() {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(init, { timeout: 2000 });
    } else {
      setTimeout(init, 250);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lazyInit);
  } else {
    lazyInit();
  }
})();
