// Convert raw text → structured Today's Reactive payload via Gemini.
// Mirrors api/gemini.js for rate-limit + origin-allowlist; the only API
// surface is a single POST that returns { payload } JSON.
//
// Body (POST):
//   { rawInput: string, market: string, liveDate?: string }
// Response:
//   200 { payload: {...} }   → structured JSON ready to write to Supabase
//   400 { error }            → invalid input
//   429 { error }            → rate-limited
//   502 { error }            → upstream Gemini error

const { verifyToken, readCookie, signingSecret } = require("./_gate-shared");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Reactive-convert is an MFG-only flow; require the wcc_mfg_gate cookie.
// (wcc_gate dashboard cookie isn't sufficient since this writes to publish.)
function mfgGateOk(req) {
  const secret = signingSecret();
  if (!secret) return false;
  const t = readCookie(req, "wcc_mfg_gate");
  return !!(t && verifyToken(t, secret));
}

const MAX_BODY_BYTES = 512 * 1024;
const MAX_INPUT_CHARS = 24_000;
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 12;
const UPSTREAM_TIMEOUT_MS = 30_000;

const memHits = new Map();
function memRateLimit(key) {
  const now = Date.now();
  const e = memHits.get(key);
  if (!e || now - e.start > RATE_LIMIT_WINDOW_SEC * 1000) {
    memHits.set(key, { start: now, count: 1 });
    return { ok: true };
  }
  e.count += 1;
  return { ok: e.count <= RATE_LIMIT_MAX };
}
async function upstashRateLimit(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const k = "wcc_rl_rconv:" + key;
  try {
    const res = await fetch(url + "/pipeline", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", k],
        ["EXPIRE", k, RATE_LIMIT_WINDOW_SEC, "NX"],
      ]),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const count = Number((data && data[0] && data[0].result) || 0);
    return { ok: count <= RATE_LIMIT_MAX };
  } catch (e) {
    return null;
  }
}
async function rateLimited(key) {
  const r = await upstashRateLimit(key);
  if (r) return !r.ok;
  return !memRateLimit(key).ok;
}

function originAllowed(origin) {
  if (!ALLOWED_ORIGINS.length) return true;
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

const MARKET_FLAGS = {
  Canada: "🇨🇦",
  UK: "🇬🇧",
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

function buildPrompt(rawInput, market, liveDate) {
  const flag = MARKET_FLAGS[market] || "🌍";
  const dateLabel = liveDate || todayLabel();
  return `You are a strategic editor for the World Cup HQ "Today's Reactive" daily briefing. Convert the raw input below into a JSON object exactly matching the schema. Tone: tight, declarative, cultural-strategist voice. Never invent specific named people, brands, or numbers that aren't in the input — synthesize themes if signal is missing rather than hallucinate.

Return ONLY valid JSON, no prose, no code fences.

Schema:
{
  "formation": {
    "date": "string — short calendar form like 'May 7, 2026'",
    "market": "string — exactly '${market}'",
    "window": "string — short window label e.g. 'Last 24h'"
  },
  "cultural": {
    "agentName": "Cultural Conversation Reader",
    "agentId": "ccr",
    "flag": "${flag}",
    "watermark": "01",
    "headline": "string — one sentence, cultural angle",
    "spikes": [
      {
        "title": "string — short evocative title",
        "type": "string — short category label",
        "signal": "string — quantified or directional read",
        "context": "string — why it's spiking",
        "voice": "string — verbatim-style fan quote (single short line)",
        "volume": "integer — 1..100"
      }
    ]
  },
  "match": {
    "agentName": "Match-Event Pulse Reader",
    "agentId": "mpr",
    "flag": "${flag}",
    "watermark": "02",
    "headline": "string — one sentence, match-narrative angle",
    "spikes": [ /* same shape as cultural.spikes */ ]
  },
  "storyboards": [
    {
      "number": "string — '01', '02', '03'",
      "title": "string — short evocative storyboard title",
      "prompt": "string — Reels-style first-person creative prompt for AI Mode",
      "sourceSignal": "string — short label e.g. 'Cultural Conversation' or 'Match Event'",
      "audienceCut": "string — short audience descriptor",
      "bucket": "string — short content-bucket label",
      "whyPrompt": "string — one short paragraph explaining the strategic why",
      "ipCheck": {
        "status": "string — 'CLEAR' or 'WATCH' or 'BLOCK'",
        "note": "string — brief IP / brand-safety note"
      },
      "beats": [
        { "name": "string — short beat label e.g. 'Hook', 'Reveal', 'Payoff'" }
      ]
    }
  ]
}

Return exactly:
- 2 cultural spikes and 2 match spikes (or as many as the input clearly supports, up to 4 each)
- exactly 3 storyboards
- 4 beats per storyboard

Do not include the markets or flag for any market other than ${market}.

Live date: ${dateLabel}.

Raw input:
${rawInput}`;
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

// Coerce whatever Gemini returns into the exact shape social.html expects,
// fill in missing fields with safe defaults so the renderer never crashes.
function normalizePayload(raw, market, liveDate) {
  const flag = MARKET_FLAGS[market] || "🌍";
  const dateLabel = liveDate || todayLabel();
  const rs = raw && typeof raw === "object" ? raw : {};
  function spike(x, fallbackType) {
    const o = x && typeof x === "object" ? x : {};
    return {
      title: s(o.title) || "Untitled signal",
      type: s(o.type) || fallbackType,
      signal: s(o.signal),
      context: s(o.context),
      voice: s(o.voice),
      volume: clampVolume(o.volume),
    };
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
    const status = s(x.status).toUpperCase();
    return {
      status: ["CLEAR", "WATCH", "BLOCK"].includes(status) ? status : "WATCH",
      note: s(x.note),
    };
  }
  function beat(b) {
    const o = b && typeof b === "object" ? b : {};
    return { name: s(o.name) || "Beat" };
  }
  function story(o, idx) {
    const x = o && typeof o === "object" ? o : {};
    return {
      number: s(x.number) || String(idx + 1).padStart(2, "0"),
      title: s(x.title) || "Untitled storyboard",
      prompt: s(x.prompt),
      sourceSignal: s(x.sourceSignal) || "Cultural Conversation",
      audienceCut: s(x.audienceCut) || "Core fan",
      bucket: s(x.bucket) || "Reactive",
      whyPrompt: s(x.whyPrompt),
      ipCheck: ip(x.ipCheck),
      beats: arr(x.beats).slice(0, 6).map(beat),
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

function tryParseJson(text) {
  if (typeof text !== "string") return null;
  // Strip code fences if Gemini ignored the instruction.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Try to extract the first {...} block.
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch (_) {}
    }
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const origin = req.headers.origin || req.headers.referer || "";
  if (!originAllowed(origin)) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  if (!mfgGateOk(req)) {
    res.status(401).json({ error: "MFG gate cookie required" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  body = body && typeof body === "object" ? body : {};
  const raw = String(body.rawInput || "").slice(0, MAX_INPUT_CHARS);
  const market = String(body.market || "").trim();
  const liveDate = String(body.liveDate || "").trim();
  if (!raw || raw.length < 40) {
    res.status(400).json({ error: "rawInput is required (min 40 chars)" });
    return;
  }
  if (!MARKET_FLAGS[market]) {
    res
      .status(400)
      .json({ error: "market must be Canada / UK / Germany / USA / Global" });
    return;
  }

  const ip = clientIp(req);
  if (await rateLimited(ip)) {
    res.status(429).json({ error: "Rate limited. Try again in a minute." });
    return;
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream;
  try {
    upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: ac.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(raw, market, liveDate) }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch (e) {
    clearTimeout(t);
    res.status(502).json({ error: "Upstream Gemini call failed" });
    return;
  }
  clearTimeout(t);

  if (!upstream.ok) {
    res.status(502).json({ error: "Gemini returned " + upstream.status });
    return;
  }
  const data = await upstream.json().catch(() => ({}));
  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  const parsed = tryParseJson(text);
  if (!parsed) {
    res.status(502).json({ error: "Gemini did not return valid JSON" });
    return;
  }
  const payload = normalizePayload(parsed, market, liveDate);
  res.status(200).json({ payload });
}
