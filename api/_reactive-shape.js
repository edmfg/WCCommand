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

// Coerce whatever Gemini returns into the exact shape social.html expects,
// filling missing fields with safe defaults so the renderer never shows
// `undefined` and never drops the payload as "old-shape".
function normalizePayload(raw, market, liveDate) {
  const flag = MARKET_FLAGS[market] || "🌍";
  const dateLabel = liveDate || todayLabel();
  const rs = raw && typeof raw === "object" ? raw : {};

  function spike(x, fallbackType) {
    const o = x && typeof x === "object" ? x : {};
    const out = {
      title: s(o.title) || "Untitled signal",
      type: s(o.type) || fallbackType,
      signal: s(o.signal),
      context: s(o.context),
      voice: s(o.voice),
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
  function story(o, idx) {
    const x = o && typeof o === "object" ? o : {};
    return {
      number: s(x.number) || String(idx + 1).padStart(2, "0"),
      title: s(x.title) || "Untitled storyboard",
      sourceSignal: s(x.sourceSignal) || "Cultural Conversation",
      sourceDetail: s(x.sourceDetail),
      audienceCut: s(x.audienceCut) || "Core fan",
      bucket: s(x.bucket) || "Reactive",
      prompt: s(x.prompt),
      whyPrompt: s(x.whyPrompt),
      ipCheck: ip(x.ipCheck),
      // `footage` is REQUIRED by social.html's isNewShape guard. Never emit a
      // storyboard without it, or the whole payload is dropped on render.
      footage:
        s(x.footage) ||
        "On-screen search-query animation over B-roll matching the storyboard theme.",
    };
  }

  return {
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
}

module.exports = {
  MARKET_FLAGS,
  todayLabel,
  clampVolume,
  validTone,
  ipStatus,
  normalizePayload,
};
