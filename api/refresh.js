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
// Scheduling (for reliability — Vercel Hobby cron skips ~1 day in 4, no SLA):
//   * Primary:  GitHub Actions (.github/workflows/refresh-cron.yml), TWICE a
//     day during the tournament — 09:00 + 23:00 UTC (~5am + 7pm New York).
//     Reliable. (Hobby caps a cron at one run/day, so the 2nd run is GH-only.)
//   * Backup:   Vercel Cron (vercel.json `crons`, 0 9 * * * UTC) for the
//     morning run only. Free, but best-effort.
// All send Authorization: Bearer ${CRON_SECRET}. The cronRanRecently() guard
// below collapses same-slot doubles (GH run + Vercel backup) while letting the
// two intended daily runs land — so the dashboard refreshes morning + evening.

const crypto = require("crypto");
const {
  verifyToken,
  readCookie,
  signingSecret,
  rateLimit,
  clientIp,
} = require("./_gate-shared");

const MODEL = "gemini-3.5-flash";
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
    "Use Google Search aggressively. Run AT LEAST 20 distinct search queries",
    "before drafting your output. Mix categories — do not over-index on one.",
    "",
    "DIG DEEPER — do not stop at the first page of the obvious outlets. For the",
    "biggest stories, run a SECOND, more specific follow-up query to pull detail",
    "(quotes, numbers, reactions) the headline skips. Cast a wide source net:",
    "  • beyond ESPN / BBC / Reuters — pull in local & host-city press (Toronto",
    "    Star, LA Times, Dallas Morning News, AS / Marca, Kicker, L'Équipe, CBC),",
    "    team/club channels, and player social posts",
    "  • non-English sources are welcome (translate the gist) — Spanish, Portuguese,",
    "    French, German, Japanese coverage surfaces angles the US press misses",
    "  • go past r/soccer into team & nation subs and the replies/quote-tweets,",
    "    TikTok / YouTube creators, and fan-account threads for the social read",
    "  • prefer the under-covered second-day angle over the same wire story",
    "    everyone already ran; avoid duplicating two items about the same event",
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
    "  10. Reddit / X / TikTok chatter — go BROAD and into the threads, not just",
    "      the post titles. Search 'site:reddit.com r/soccer WC2026',",
    "      'site:reddit.com r/worldcup', 'site:reddit.com r/USMNT',",
    "      'site:reddit.com r/MLS', 'site:reddit.com r/futebol',",
    "      'site:reddit.com r/MexicoSoccer', 'site:reddit.com r/Canada',",
    "      'site:reddit.com r/3lions', 'site:reddit.com r/dutchsoccer',",
    "      'site:reddit.com r/seleccionargentina', 'site:reddit.com r/CanadaSoccer',",
    "      plus TikTok / YouTube ('World Cup 2026 TikTok viral') and X hashtags",
    "  11. Memes, fan culture, Panini stickers, fashion / kit drops",
    "  12. Politics / regulatory / Congress coverage of the tournament",
    "  13. WHOLESOME / VIRAL FAN BEHAVIOUR — actively hunt the heart-warming,",
    "      meme-able fan moments that travel on TikTok / X / Reddit. Examples of",
    "      the GENRE (find the 2026 equivalents, do NOT reuse old ones verbatim):",
    "        • fans cleaning up their stand / picking up garbage after the match",
    "          (the classic Japan + Senegal + Morocco moment)",
    "        • choreographed tifos, viral chants, drum lines, fan-zone singalongs",
    "        • cross-rival fan friendships, shirt swaps, away-fan hospitality",
    "        • host-city locals welcoming travelling supporters; random kindness",
    "        • fan fashion / costumes / face-paint going viral; grandma-superfans;",
    "          kids' reactions; emotional first-World-Cup-trip stories",
    "      Queries to try: 'World Cup 2026 fans cleaning stadium',",
    "      'WC2026 fans viral TikTok wholesome', 'World Cup 2026 fan chant viral',",
    "      'site:reddit.com r/soccer wholesome fans 2026',",
    "      'World Cup 2026 away fans hospitality'.",
    "  14. STANDOUT INDIVIDUAL PERFORMANCES & NAMED-PLAYER NEWS — the single-",
    "      player stories that drive the news cycle. Hunt BOTH:",
    "        • breakout / hero performances: a goalkeeper masterclass or wonder-",
    "          save (e.g. Cape Verde's Vozinha shutting out Spain), a hat-trick,",
    "          a teenager's first World Cup goal, an unlikely Man of the Match",
    "        • star-player storylines: injuries, fitness races, returns, captaincy,",
    "          milestones, benchings, viral moments — for the names casual fans",
    "          follow (Mbappé, Messi, Pulisic, Alphonso Davies, Bellingham, Yamal,",
    "          Haaland, Vinícius, Musiala, Son, Olmo, plus each market's talisman)",
    "      Queries to try: 'World Cup 2026 player of the match', 'WC2026 wonderkid",
    "      breakout', 'Alphonso Davies injury return Canada', 'WC2026 star player",
    "      injury update', 'World Cup 2026 goalkeeper heroics'.",
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
    "Counts: 16–24 news, 8–14 social, 12–18 ticker. Skip generic / stale items,",
    "and never pad — a deeper SEARCH should yield more REAL stories, not filler.",
    "At least 2 of the social items MUST be wholesome / viral FAN-BEHAVIOUR",
    'moments (category "fandom" or "memes") of the kind described in angle 13 —',
    "e.g. fans cleaning the stadium, choreographed tifos, cross-rival kindness,",
    "viral fan outfits/chants. Prefer real 2026 moments; if genuinely none have",
    "surfaced yet, surface the closest pre-tournament fan-culture chatter instead.",
    "At least 2 of the NEWS items MUST be standout individual-performance or",
    "named-player stories (angle 14) — a breakout/hero display or a star player's",
    "injury / fitness / return / milestone. Use the player's name in the headline.",
    "Every news item MUST have a working URL. Every social item MUST have a",
    "non-empty platforms array. Do not invent quotes; only use ones Google found.",
    "Spread `tag` across all six values — do not let any one market dominate.",
    "EMOJI: in headlines/topics use only widely-supported emoji. NEVER use",
    "subdivision/regional 'tag' flags such as the England, Scotland or Wales",
    "flags (🏴󠁧󠁢󠁥󠁮󠁧󠁿 / 🏴󠁧󠁢󠁳󠁣󠁴󠁿 / 🏴󠁧󠁢󠁷󠁬󠁳󠁿) — they render as a black box on most",
    "devices. Use 🦁 for England, a generic ⚽/🏟️/🎉, or the country's national",
    "flag emoji (🇬🇧) instead. National-flag emoji are fine.",
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
// Also strip subdivision/regional "tag" flag sequences (England/Scotland/Wales
// etc. = U+1F3F4 + tag chars + cancel) which render as a black box on most
// devices — a backstop in case the prompt's no-tag-flags rule is ignored.
function safeText(s) {
  return String(s == null ? "" : s)
    .replace(/\u{1F3F4}[\u{E0020}-\u{E007F}]+/gu, "")
    .replace(/[<>]/g, "");
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

// De-dupe window for the cron. The tournament schedule fires the refresh
// twice a day (~09:00 + ~23:00 UTC), so we can't gate on "once per UTC day"
// any more — the evening run is the same calendar day as the morning one and
// would be wrongly skipped. Instead we suppress only a *recent* prior cron
// write, which still collapses same-slot doubles (GitHub Actions run + Vercel
// backup fire within ~1h) while letting the two intended runs (14h / 10h
// apart) both land. FAIL-OPEN: any error or missing key returns false, so a
// bug here can only cause a harmless double-write — never a skipped run.
const RECENT_REFRESH_HOURS = 6;
async function cronRanRecently() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || "https://ypisjfefbccgtxesteja.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) return false;
  const cutoff = new Date(
    Date.now() - RECENT_REFRESH_HOURS * 3600 * 1000,
  ).toISOString();
  const url =
    SUPABASE_URL +
    "/rest/v1/live_updates?select=id&payload->>source_kind=eq.cron" +
    "&created_at=gte." +
    encodeURIComponent(cutoff) +
    "&limit=1";
  const resp = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY },
  });
  if (!resp.ok) return false;
  const rows = await resp.json();
  return Array.isArray(rows) && rows.length > 0;
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

// ── Scores: cron-scraped World Cup results → Supabase match_results ──
// A second, focused Gemini+Google-Search call that pulls the final / live
// score of every match that has kicked off, keyed by FIFA tricode so the
// client can stamp it onto the matching fixture. Independent + best-effort:
// any failure here is logged and swallowed so it never blocks the news refresh.
function buildScoresPrompt() {
  const isoDate = new Date().toISOString().slice(0, 10);
  return [
    "You are a results scraper for the 2026 FIFA World Cup",
    "(June 11 – July 19, 2026; hosts Canada / Mexico / USA).",
    "Today is " + isoDate + ".",
    "",
    "Use Google Search to find the FINAL or current LIVE score of EVERY 2026",
    "World Cup match that has kicked off from 2026-06-11 through today (" +
      isoDate +
      ").",
    "Check reliable live sources (FIFA, ESPN, BBC Sport, Google's match cards).",
    "Do NOT include matches that have not kicked off yet.",
    "",
    "Return ONLY a single JSON object (no prose, no markdown, no code fences):",
    "{",
    '  "results": [',
    "    {",
    '      "date": "YYYY-MM-DD (the match kickoff date)",',
    '      "homeCode": "FIFA 3-letter tricode of the home team",',
    '      "awayCode": "FIFA 3-letter tricode of the away team",',
    '      "home": "home team common English name",',
    '      "away": "away team common English name",',
    '      "homeScore": <integer goals, home>,',
    '      "awayScore": <integer goals, away>,',
    '      "status": "final" (match over) | "live" (in progress)',
    "    }",
    "  ]",
    "}",
    "",
    "Use standard FIFA tricodes — e.g. Saudi Arabia=KSA, South Korea=KOR,",
    "Czechia=CZE, Curaçao=CUW, DR Congo=COD, Ivory Coast=CIV, Cape Verde=CPV,",
    "Bosnia & Herzegovina=BIH, South Africa=RSA, United States=USA.",
    "homeScore/awayScore MUST be non-negative integers. Keep home/away in the",
    "actual fixture order. If you cannot confirm a score, OMIT that match.",
  ].join("\n");
}

function normalizeScore(it) {
  if (!it || typeof it !== "object") return null;
  const date = String(it.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const homeCode = String(it.homeCode || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  const awayCode = String(it.awayCode || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  if (!homeCode || !awayCode) return null;
  const hs = Number(it.homeScore);
  const as = Number(it.awayScore);
  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
    return null;
  }
  return {
    match_date: date,
    home_code: homeCode,
    away_code: awayCode,
    home_team: safeText(it.home || "").slice(0, 60),
    away_team: safeText(it.away || "").slice(0, 60),
    home_score: hs,
    away_score: as,
    status: it.status === "live" ? "live" : "final",
    updated_at: new Date().toISOString(),
  };
}

// Upsert into match_results on the (match_date, home_code, away_code) key so
// re-runs overwrite the previous score in place rather than duplicating rows.
async function upsertMatchResults(rows) {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || "https://ypisjfefbccgtxesteja.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  const url =
    SUPABASE_URL +
    "/rest/v1/match_results?on_conflict=match_date,home_code,away_code";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      "match_results upsert failed: " + resp.status + " " + text.slice(0, 300),
    );
  }
}

async function refreshScores(apiKey) {
  const body = {
    contents: [{ role: "user", parts: [{ text: buildScoresPrompt() }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  };
  const upstream = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  if (!upstream.ok) {
    throw new Error(
      "scores upstream " +
        upstream.status +
        " " +
        JSON.stringify(data).slice(0, 200),
    );
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
  const parsed = extractJson(text);
  const raw =
    parsed && Array.isArray(parsed.results)
      ? parsed.results
      : Array.isArray(parsed)
        ? parsed
        : [];
  const rows = raw.map(normalizeScore).filter(Boolean);
  if (!rows.length) return { upserted: 0 };
  await upsertMatchResults(rows);
  return { upserted: rows.length };
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

  // Cron only: scrape scores on EVERY invocation, BEFORE the news dedup guard.
  // The upsert is idempotent (merge-duplicates), so a same-slot double just
  // re-writes the same scores — cheap. Decoupling it from the news guard means
  // a manual trigger (or the evening run) always refreshes scores even when the
  // news refresh is skipped as a recent duplicate. Best-effort: errors → 0.
  const scoresPromise = isCron
    ? refreshScores(GEMINI_API_KEY).catch((e) => {
        console.error("refresh cron scores error", e && e.message);
        return { upserted: 0 };
      })
    : null;

  // Cron path only: de-dupe guard. If a cron refresh landed in the last few
  // hours, no-op instead of burning Gemini/Search quota on a duplicate. The
  // manual MFG button is exempt — those refreshes are intentional and on demand.
  if (isCron) {
    try {
      if (await cronRanRecently()) {
        const scoresRes = scoresPromise ? await scoresPromise : { upserted: 0 };
        return res.status(200).json({
          ok: true,
          mode: "cron",
          skipped: "refreshed-recently",
          scores: (scoresRes && scoresRes.upserted) || 0,
        });
      }
    } catch (e) {
      console.warn(
        "refresh cron dedup check failed, proceeding:",
        e && e.message,
      );
    }
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: buildPrompt() }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.5,
      // Raised from 24576 to fit the deeper haul (16–24 news, 8–14 social,
      // 12–18 ticker). Gemini 2.5 Flash caps at 65536; 40000 leaves margin
      // while staying inside the 60s function budget.
      maxOutputTokens: 40000,
    },
  };

  // (scoresPromise was kicked off above, before the dedup guard, so it runs in
  // parallel with this news call and also covers the deduped-skip path.)
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
      // Let the parallel scores upsert finish before we respond — the function
      // can freeze after returning, abandoning the in-flight promise.
      if (scoresPromise) await scoresPromise;
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
      if (scoresPromise) await scoresPromise;
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
      const scoresRes = scoresPromise
        ? await scoresPromise
        : { upserted: 0 };
      const scoresUpserted = (scoresRes && scoresRes.upserted) || 0;
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
          scores: scoresUpserted,
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
        scores: scoresUpserted,
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
    if (scoresPromise) {
      try {
        await scoresPromise;
      } catch (_) {}
    }
    return res.status(502).json({ error: "Upstream unavailable" });
  }
};

// The grounded Gemini call (12+ Google searches + a generation) routinely
// runs well past Vercel's short default function timeout. Without this the
// cron path gets killed mid-flight on slow days — Gemini answers, but the
// function dies before insertLiveUpdates() runs, so no rows land and the
// daily refresh silently no-ops. Mirror api/gemini.js, which makes the same
// grounded call and sets the same 60s ceiling (the Hobby-plan maximum).
module.exports.config = { maxDuration: 60 };
