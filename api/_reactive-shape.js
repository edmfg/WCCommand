// Shared shape + normalizer for Today's Reactive payloads.
//
// Why this exists: api/reactive-convert.js (the Gemini → structured-JSON
// endpoint) and social.html (the renderer) MUST agree on the storyboard /
// spike shape. They drifted: social.html was migrated to a `footage`-based
// storyboard and added an `isNewShape` guard that DROPS any payload whose
// storyboards lack `footage`. The old normalizer emitted `beats[]` and no
// `footage`, so every published reactive was silently ignored on the
// dashboard. This module is the single source of truth for the new shape so
// both sides stay in lock-step, and so the shape is unit-testable in Node.
//
// CommonJS on purpose: requireable from both the (esbuild-compiled) API
// handler and a plain `node` test script.

// Markets the reactive flow supports. Mirrors mfg.html's market <select> and
// social.html's market routing. "UK" is kept as a legacy alias that maps to
// the Brazil flag — older rows were authored as "UK" before the UK→Brazil
// pivot — but new publishes use "Brazil".
const MARKET_FLAGS = {
  Canada: "🇨🇦",
  Brazil: "🇧🇷",
  UK: "🇬🇧", // legacy alias (forward-mapped to Brazil in the UI)
  Germany: "🇩🇪",
  USA: "🇺🇸",
  Global: "🌍",
};

function todayLabel() {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function clampVolume(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return 50;
  return Math.max(1, Math.min(100, v));
}
function s(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function arr(v) {
  return Array.isArray(v) ? v : [];
}
// social.html colours the sentiment pill by tone; only these three render.
function validTone(v) {
  const t = s(v).toLowerCase();
  return ["positive", "neutral", "caution"].includes(t) ? t : "neutral";
}
// social.html keys IP styling off lowercase data-status (clear/watch/block).
function ipStatus(v) {
  const t = s(v).toLowerCase();
  return ["clear", "watch", "block"].includes(t) ? t : "watch";
}
// Only http(s) links survive — drops javascript:/data: and other injection
// vectors before a URL is ever rendered as an href.
function safeUrl(v) {
  const u = s(v).trim();
  return /^https?:\/\//i.test(u) ? u : "";
}

// Coerce whatever Gemini returns into the exact shape social.html expects,
// filling missing fields with safe defaults so the renderer never shows
// `undefined` and never drops the payload as "old-shape".
function normalizePayload(raw, market, liveDate) {
  const flag = MARKET_FLAGS[market] || "🌍";
  const dateLabel = liveDate || todayLabel();
  const rs = raw && typeof raw === "object" ? raw : {};

  function spike(x, fallbackType) {
    const o = x && typeof x === "object" ? x : {};
    // Multiple attributed direct quotes (each may carry a platform + link).
    const quotes = arr(o.quotes)
      .map((q) => {
        const qo = q && typeof q === "object" ? q : { text: q };
        return { text: s(qo.text), platform: s(qo.platform), url: safeUrl(qo.url) };
      })
      .filter((q) => q.text)
      .slice(0, 4);
    const voice = s(o.voice) || (quotes[0] && quotes[0].text) || "";
    // Guarantee the lead voice always appears in the quotes list.
    if (!quotes.length && voice) {
      quotes.push({ text: voice, platform: "", url: "" });
    }
    // Citations / sources — labels (platform or outlet), links when present.
    const sources = arr(o.sources)
      .map((src) => {
        const so = src && typeof src === "object" ? src : { label: src };
        return { label: s(so.label) || s(so.name), url: safeUrl(so.url) };
      })
      .filter((sr) => sr.label)
      .slice(0, 6);
    const out = {
      title: s(o.title) || "Untitled signal",
      type: s(o.type) || fallbackType,
      signal: s(o.signal),
      context: s(o.context),
      voice,
      quotes,
      sources,
      volume: clampVolume(o.volume),
      sentiment: clampVolume(o.sentiment),
      tone: validTone(o.tone),
    };
    // hook is optional in the renderer — only include it when present.
    const hook = s(o.hook);
    if (hook) out.hook = hook;
    return out;
  }
  function brief(o, watermark, defaultName, agentId, defaultType) {
    const b = o && typeof o === "object" ? o : {};
    return {
      agentName: s(b.agentName) || defaultName,
      agentId: s(b.agentId) || agentId,
      flag,
      watermark,
      headline: s(b.headline),
      spikes: arr(b.spikes)
        .slice(0, 4)
        .map((x) => spike(x, defaultType)),
    };
  }
  function ip(o) {
    const x = o && typeof o === "object" ? o : {};
    return { status: ipStatus(x.status), note: s(x.note) };
  }
  // Canonical prompt-type ladder for the A/B/C trio on every storyboard.
  const PROMPT_TYPES = ["Observational", "Participatory", "Fusion/Planning"];
  function prompts(x) {
    const ps = arr(x.prompts)
      .map((p, i) => {
        const po = p && typeof p === "object" ? p : { text: p };
        return {
          key: s(po.key) || String.fromCharCode(65 + i), // A / B / C
          type: s(po.type) || PROMPT_TYPES[i] || "",
          text: s(po.text),
        };
      })
      .filter((p) => p.text)
      .slice(0, 3);
    // Legacy single-prompt payloads become a one-prompt cycle. `prompts` is
    // REQUIRED by social.html's isNewShape guard, so never emit an empty list.
    if (!ps.length) {
      ps.push({ key: "A", type: PROMPT_TYPES[0], text: s(x.prompt) });
    }
    return ps;
  }
  // Asset elevations — the "03 · Elevations" lanes in social.html. Approved
  // library prompts the client uploads alongside the storyboards; transcribed
  // verbatim. Each item: { lane:'fan'|'game', momentum?:true, prompt, rationale }.
  // prompt is REQUIRED by social.html's filter; items without one are dropped.
  function elevation(o) {
    const x = o && typeof o === "object" ? o : {};
    const prompt = s(x.prompt);
    if (!prompt) return null;
    const out = {
      lane: s(x.lane).toLowerCase() === "game" ? "game" : "fan",
      prompt,
      rationale: s(x.rationale),
    };
    // momentum is optional + diff-colours a surging asset. Only emit when truthy
    // so a published payload never carries a stray `momentum:false`.
    if (x.momentum === true || s(x.momentum).toLowerCase() === "true") {
      out.momentum = true;
    }
    return out;
  }

  function story(o, idx) {
    const x = o && typeof o === "object" ? o : {};
    const ps = prompts(x);
    const out = {
      number: s(x.number) || String(idx + 1).padStart(2, "0"),
      title: s(x.title) || "Untitled storyboard",
      sourceSignal: s(x.sourceSignal) || "Cultural Conversation",
      sourceDetail: s(x.sourceDetail),
      audienceCut: s(x.audienceCut) || "Core fan",
      bucket: s(x.bucket) || "Reactive",
      unmetNeed: s(x.unmetNeed),
      prompts: ps,
      // Legacy field kept in lock-step: always the lead (A) prompt.
      prompt: ps[0].text,
      whyPrompt: s(x.whyPrompt),
      ipCheck: ip(x.ipCheck),
      // `footage` is REQUIRED by social.html's isNewShape guard. Never emit a
      // storyboard without it, or the whole payload is dropped on render.
      footage:
        s(x.footage) ||
        "On-screen search-query animation over B-roll matching the storyboard theme.",
    };
    // Fan Agent verdict is optional in the renderer — only include when present.
    const verdict = s(x.verdict);
    if (verdict) out.verdict = verdict;
    return out;
  }

  const elevations = arr(rs.assetElevations)
    .map(elevation)
    .filter(Boolean)
    .slice(0, 12);

  const out = {
    formation: {
      date: s((rs.formation || {}).date) || dateLabel,
      market,
      window: s((rs.formation || {}).window) || "Last 24h",
    },
    cultural: brief(
      rs.cultural,
      "01",
      "Cultural Conversation Reader",
      "ccr",
      "Cultural Pride",
    ),
    match: brief(rs.match, "02", "Match-Event Pulse Reader", "mpr", "Match"),
    storyboards: arr(rs.storyboards).slice(0, 3).map(story),
  };
  // Only attach the field when the input actually carried elevations. An empty
  // array would override social.html's bundled defaults with nothing (hiding the
  // section); omitting the key preserves the documented bundle fallback.
  if (elevations.length) out.assetElevations = elevations;
  return out;
}

module.exports = {
  MARKET_FLAGS,
  todayLabel,
  clampVolume,
  validTone,
  ipStatus,
  safeUrl,
  normalizePayload,
};
