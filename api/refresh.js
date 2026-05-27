// POST /api/refresh — Gemini 2.5 Flash with Google Search grounding.
//
// Two callers:
//
//   1. The MFG "Refresh Content" button (browser, wcc_mfg_gate cookie).
//      Behaviour unchanged: parses Gemini's JSON, returns it, the client
//      then writes rows into Supabase `live_updates` via /api/sb-write.
//
//   2. Vercel Cron (Authorization: Bearer ${CRON_SECRET}). No browser,
//      no cookie, so the endpoint normalises the Gemini payload AND
//      inserts rows into `live_updates` itself using the service-role
//      key (same path /api/sb-write uses). Cron-sourced rows get
//      payload.source = "cron" so the activity feed can distinguish them.
//
// Configured via vercel.json `crons` at 0 9,16,22 * * * (UTC) = 5am / 12pm
// / 6pm New York during EDT — fires three times a day so the dashboard
// stays fresh through the WC2026 window (Jun 11 – Jul 19).

const crypto = require("crypto");
const {
  verifyToken,
  readCookie,
  signingSecret,
  rateLimit,
  clientIp,
} = require("./_gate-shared");

const MODEL = "gemini-2.5-flash";
// Manual button path only: cap Gemini-grounded refreshes per IP per window.
// One refresh consumes ~12 Google Search queries + a Gemini generation, so
// even a leaked MFG cookie can only burn so much quota.
const MANUAL_RL_MAX = 6;
const MANUAL_RL_WINDOW_SEC = 60;
const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  MODEL +
  ":generateContent";

function mfgGateOk(req) {
  const secret = signingSecret();
  if (!secret) return false;
  const cookie = readCookie(req, "wcc_mfg_gate");
  return !!(cookie && verifyToken(cookie, secret));
}

function cronAuthOk(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers["authorization"] || "";
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  const provided = header.slice(7).trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function buildPrompt() {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const niceDate = today.toUTCString().slice(0, 16);

  return [
    "You are a sports-content scout for the 2026 FIFA World Cup",
    "(June 11 – July 19, 2026; hosts Canada / Mexico / USA).",
    "Today is " + niceDate + " (" + isoDate + ").",
    "",
    "Use Google Search aggressively. Run AT LEAST 12 distinct search queries",
    "before drafting your output. Mix categories — do not over-index on one.",
    "Cover ALL of these angles with at least one query each:",
    "  1.  Squad / preliminary list announcements (USA, Canada, England, Germany,",
    "      Argentina, Brazil, France, Spain, Portugal, Netherlands, Mexico, etc.)",
    "  2.  Player injuries and recovery timelines (last 48h)",
    "  3.  Friendly results + tactical takeaways from May 2026 friendlies",
    "  4.  Ticket pricing, resale market, FIFA pricing controversy",
    "  5.  Host-city updates: Fan Festivals, fan-zone tickets (Toronto, Vancouver,",
    "      LA, NY, Atlanta, Philly, Dallas, Houston, KC, Miami, CDMX, GDL, MTY)",
    "  6.  Music / anthem / opening + halftime ceremony lineups",
    "  7.  Kits, sponsor activations, brand campaigns (PUMA, Nike, adidas, Coke,",
    "      Visa, McDonald's, Michelob, Hisense, BYD, Mondelez)",
    "  8.  Broadcast / streaming deals (Fox, Telemundo, Peacock, ITV, BBC, CCTV)",
    "  9.  Visa & travel friction (US travel ban, $15K bond, Iran, Mexico cartel)",
    "  10. Reddit / X / TikTok chatter (search 'site:reddit.com r/soccer WC2026',",
    "      'site:reddit.com r/worldcup', 'site:reddit.com r/USMNT',",
    "      'site:reddit.com r/MLS', 'site:reddit.com r/futebol',",
    "      'site:reddit.com r/MexicoSoccer', 'site:reddit.com r/Canada')",
    "  11. Memes, fan culture, Panini stickers, fashion / kit drops",
    "  12. Politics / regulatory / Congress coverage of the tournament",
    "",
    "Prioritise stories from the LAST 24–48 HOURS. If a result is older than",
    "72 hours, skip it unless it just had a major update today.",
    "",
    "Return ONLY a single JSON object (no prose, no markdown, no code fences)",
    "matching this exact schema:",
    "{",
    '  "news": [',
    "    {",
    '      "headline": "string (<=100 chars, optional leading flag/emoji)",',
    '      "source": "string (publication name)",',
    '      "summary": "2–3 sentence summary, useful detail at end",',
    '      "url": "string (full URL)",',
    '      "tag": "Canada" | "USA" | "Germany" | "Brazil" | "Macro" | "Global"',
    "    }",
    "  ],",
    '  "social": [',
    "    {",
    '      "topic": "string (<=120 chars, optional leading emoji)",',
    '      "category": "game" | "food" | "music" | "fashion" | "fandom" | "memes",',
    '      "volume": "🔥🔥🔥" | "🔥🔥🔥🔥" | "🔥🔥🔥🔥🔥",',
    '      "sentiment": "positive" | "negative" | "mixed" | "caution" | "neutral",',
    '      "summary": "2–3 sentence summary of the chatter",',
    '      "sampleQuote": "one short representative quote",',
    '      "quotes": [{ "platform": "X|TikTok|IG|Reddit", "text": "string" }],',
    '      "platforms": ["X"|"TikTok"|"IG"|"Reddit", ...],',
    '      "sourceUrl": "string"',
    "    }",
    "  ],",
    '  "ticker": [',
    '    "short flag-led one-liner ending with (Mon DD), <=110 chars"',
    "  ]",
    "}",
    "",
    "Counts: 12–18 news, 6–10 social, 10–15 ticker. Skip generic / stale items.",
    "Every news item MUST have a working URL. Every social item MUST have a",
    "non-empty platforms array. Do not invent quotes; only use ones Google found.",
    "Spread `tag` across all six values — do not let any one market dominate.",
  ].join("\n");
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  // Strip code fences if present.
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // Find first { ... last }.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first < 0 || last < 0 || last < first) return null;
  const slice = t.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    // Last-ditch: some models return trailing-comma'd JSON. Try a soft fix.
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
    } catch (e2) {
      return null;
    }
  }
}

// Strip raw "<" / ">" from text rendered as HTML on the public dashboard.
// Defense-in-depth: the client renderer already runs escapeHtml, but with
// Gemini-generated content this is cheap insurance.
function safeText(s) {
  return String(s == null ? "" : s).replace(/[<>]/g, "");
}

// Mirror of the client-side normalizers in mfg.html so the cron path
// can produce identical row shapes without going through the browser.
function normalizeNews(it, now) {
  if (!it || typeof it !== "object") return null;
  const validTags = ["Canada", "USA", "Germany", "Brazil", "Macro", "Global"];
  const tag = validTags.indexOf(it.tag) >= 0 ? it.tag : "Global";
  if (!it.headline || !it.summary) return null;
  return {
    id: "ai-n-" + now + "-" + Math.random().toString(36).slice(2, 8),
    headline: safeText(it.headline).slice(0, 160),
    source: safeText(it.source || "AI").slice(0, 80),
    timestamp: new Date().toISOString(),
    summary: safeText(it.summary).slice(0, 900),
    url: String(it.url || "").slice(0, 500),
    tag: tag,
  };
}
function normalizeSocial(it, now) {
  if (!it || typeof it !== "object") return null;
  const validCats = ["game", "food", "music", "fashion", "fandom", "memes"];
  const cat = validCats.indexOf(it.category) >= 0 ? it.category : "fandom";
  const validSent = ["positive", "negative", "mixed", "caution", "neutral"];
  const sentiment =
    validSent.indexOf(it.sentiment) >= 0 ? it.sentiment : "neutral";
  const validPlatforms = ["X", "TikTok", "IG", "Reddit", "YouTube"];
  let platforms = Array.isArray(it.platforms)
    ? it.platforms.filter((p) => validPlatforms.indexOf(p) >= 0)
    : [];
  if (platforms.length === 0) platforms = ["Reddit", "X"];
  if (!it.topic || !it.summary) return null;
  const quotes = Array.isArray(it.quotes)
    ? it.quotes.filter((q) => q && q.platform && q.text).slice(0, 6)
    : [];
  return {
    id: "ai-s-" + now + "-" + Math.random().toString(36).slice(2, 8),
    topic: safeText(it.topic).slice(0, 160),
    category: cat,
    volume:
      typeof it.volume === "string" && it.volume.length ? it.volume : "🔥🔥🔥",
    sentiment: sentiment,
    summary: safeText(it.summary).slice(0, 900),
    sampleQuote: safeText(it.sampleQuote || "").slice(0, 280),
    quotes: quotes.map((q) =>
      q && typeof q.text === "string" ? { ...q, text: safeText(q.text) } : q,
    ),
    platforms: platforms,
    sourceUrl: String(it.sourceUrl || it.url || "").slice(0, 500),
    timestamp: new Date().toISOString(),
  };
}
function normalizeTicker(it) {
  if (typeof it !== "string") return null;
  const trimmed = it.trim();
  if (!trimmed) return null;
  return safeText(trimmed).slice(0, 200);
}

// Server-side insert into Supabase live_updates using the service-role key.
// Mirrors what /api/sb-write does for the manual button — same RLS bypass,
// same payload shape — so cron-written rows render identically in the UI.
async function insertLiveUpdates(rows) {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || "https://ypisjfefbccgtxesteja.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  const url = SUPABASE_URL + "/rest/v1/live_updates";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      "Supabase insert failed: " + resp.status + " " + text.slice(0, 300),
    );
  }
}

module.exports = async function handler(req, res) {
  // Vercel Cron invokes the path as GET; manual button uses POST. Accept both.
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const isCron = cronAuthOk(req);
  if (!isCron && !mfgGateOk(req)) {
    return res
      .status(401)
      .json({ error: "MFG gate cookie or CRON_SECRET required" });
  }
  // Manual browser path only: rate-limit so an MFG cookie can't be used to
  // mass-burn Gemini + Google Search quota. Cron path is trusted (and
  // fires once a day) so it skips this check.
  if (!isCron) {
    const rl = await rateLimit(
      "refresh-manual",
      clientIp(req),
      MANUAL_RL_MAX,
      MANUAL_RL_WINDOW_SEC,
    );
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfter));
      return res
        .status(429)
        .json({ error: "rate limited", retryAfter: rl.retryAfter });
    }
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: buildPrompt() }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 24576,
    },
  };

  try {
    const upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error(
        "refresh upstream error",
        upstream.status,
        JSON.stringify(data).slice(0, 600),
      );
      return res.status(upstream.status).json({
        error:
          (data && data.error && data.error.message) ||
          "Upstream request failed",
      });
    }

    const parts =
      (data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts) ||
      [];
    const text = parts
      .map((p) => p.text || "")
      .join("")
      .trim();
    const payload = extractJson(text);
    if (!payload) {
      return res.status(502).json({
        error: "Could not parse Gemini JSON",
        sample: text.slice(0, 400),
      });
    }

    const groundingMeta =
      (data.candidates &&
        data.candidates[0] &&
        data.candidates[0].groundingMetadata) ||
      null;

    // Flatten groundingChunks into a UI-friendly array of { uri, title, domain }.
    const chunks = (groundingMeta && groundingMeta.groundingChunks) || [];
    const sources = chunks
      .map((c) => {
        const w = c && c.web;
        if (!w || !w.uri) return null;
        let domain = "";
        try {
          domain = new URL(w.uri).hostname.replace(/^www\./, "");
        } catch (e) {}
        return { uri: w.uri, title: w.title || "", domain: domain };
      })
      .filter(Boolean);

    const queries = (groundingMeta && groundingMeta.webSearchQueries) || [];

    // Cron path: normalise + insert into live_updates ourselves, then
    // return a compact summary. No browser is listening; the response
    // body is only read by Vercel's cron log viewer.
    if (isCron) {
      const now = Date.now();
      const rawNews = Array.isArray(payload.news) ? payload.news : [];
      const rawSocial = Array.isArray(payload.social) ? payload.social : [];
      const rawTicker = Array.isArray(payload.ticker) ? payload.ticker : [];
      const news = rawNews.map((it) => normalizeNews(it, now)).filter(Boolean);
      const social = rawSocial
        .map((it) => normalizeSocial(it, now))
        .filter(Boolean);
      const ticker = rawTicker.map(normalizeTicker).filter(Boolean);

      const rows = [];
      news.forEach((n) => {
        rows.push({
          id: n.id,
          kind: "news",
          payload: { ...n, source_kind: "cron" },
        });
      });
      social.forEach((s) => {
        rows.push({
          id: s.id,
          kind: "social",
          payload: { ...s, source_kind: "cron" },
        });
      });
      ticker.forEach((t) => {
        rows.push({
          id: "ai-t-" + now + "-" + Math.random().toString(36).slice(2, 8),
          kind: "ticker",
          payload: { text: t, source_kind: "cron" },
        });
      });

      if (rows.length === 0) {
        console.warn("refresh cron: Gemini returned 0 usable rows");
        return res.status(200).json({
          ok: true,
          mode: "cron",
          inserted: 0,
          news: 0,
          social: 0,
          ticker: 0,
        });
      }

      try {
        await insertLiveUpdates(rows);
      } catch (e) {
        console.error("refresh cron insert error", e);
        return res.status(502).json({
          ok: false,
          mode: "cron",
          error: e.message || "insert failed",
        });
      }

      return res.status(200).json({
        ok: true,
        mode: "cron",
        inserted: rows.length,
        news: news.length,
        social: social.length,
        ticker: ticker.length,
        sourceCount: sources.length,
      });
    }

    // Manual button path: hand the parsed payload back to the browser,
    // which writes to Supabase via /api/sb-write.
    return res.status(200).json({
      ok: true,
      payload: payload,
      sources: sources,
      queries: queries,
      sourceCount: sources.length,
    });
  } catch (e) {
    console.error("refresh exception", e);
    return res.status(502).json({ error: "Upstream unavailable" });
  }
};
