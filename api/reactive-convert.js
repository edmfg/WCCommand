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
// Single source of truth for the payload shape, shared with the unit test and
// kept in lock-step with social.html's renderer + isNewShape guard.
const {
  MARKET_FLAGS,
  todayLabel,
  normalizePayload,
} = require("./_reactive-shape.js");

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
        "volume": "integer — 1..100 (share of conversation)",
        "sentiment": "integer — 1..100 (% positive)",
        "tone": "string — 'positive' or 'neutral' or 'caution'",
        "hook": "string — optional one-line curiosity question",
        "quotes": [
          {
            "text": "string — verbatim-style direct quote",
            "platform": "string — e.g. 'X' / 'TikTok' / 'Reddit' / 'r/soccer' / outlet name",
            "url": "string — link ONLY if that exact URL appears in the raw input; omit otherwise"
          }
        ],
        "sources": [
          {
            "label": "string — platform or outlet backing the spike",
            "url": "string — link ONLY if that exact URL appears in the raw input; omit otherwise"
          }
        ]
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
      "sourceSignal": "string — short label e.g. 'Cultural Conversation' or 'Match Event'",
      "sourceDetail": "string — one short line on the underlying signal",
      "audienceCut": "string — short audience descriptor",
      "bucket": "string — short content-bucket label",
      "unmetNeed": "string — the fan's unmet info need, phrased in their own voice (one or two sentences)",
      "prompts": [
        { "key": "A", "type": "Observational", "text": "string — lowercase conversational search query" },
        { "key": "B", "type": "Participatory", "text": "string — lowercase conversational search query" },
        { "key": "C", "type": "Fusion/Planning", "text": "string — lowercase conversational search query" }
      ],
      "whyPrompt": "string — ONE sharp sentence (max ~25 words) justifying the prompt trio against the cultural signal / conversation it rides",
      "ipCheck": {
        "status": "string — 'clear' or 'watch' or 'block'",
        "note": "string — brief IP / brand-safety note"
      },
      "verdict": "string — optional Fan Agent verdict on fit (omit if the input has none)",
      "footage": "string — creative direction for the storyboard's footage frame (what B-roll/visuals pair with the on-screen queries)"
    }
  ],
  "assetElevations": [
    {
      "lane": "string — 'fan' (culture / fandom / ritual asset) or 'game' (match / tactical / player asset)",
      "momentum": "boolean — true ONLY if the input flags this asset as surging / trending / spiking right now; omit otherwise",
      "prompt": "string — the approved library query VERBATIM from the input, in the fan's lowercase voice",
      "rationale": "string — the strategist's case for why this already-approved asset is ready to put into market today (copy it from the input; tie it to a signal above if the input does)"
    }
  ]
}

Return exactly:
- 2 cultural spikes and 2 match spikes (or as many as the input clearly supports, up to 4 each)
- 2-3 "quotes" per spike (verbatim-style, each tagged with its platform) plus a few "sources" backing it
- exactly 3 storyboards
- exactly 3 "prompts" per storyboard — A (Observational) / B (Participatory) / C (Fusion/Planning)
- a vivid one-to-two-sentence "footage" direction for every storyboard (never omit it)

Asset elevations rule: if the input contains an "elevations" / "elevation recommendations" / "approved prompts to elevate" list (ranked prompts each with a rationale), transcribe EVERY item into "assetElevations" VERBATIM — copy the prompt and rationale word-for-word (fix only obvious mechanical typos), and KEEP THE INPUT'S RANKING as the array order (index 0 = top pick). Tag each item's "lane" as "game" (match / tactical / player asset) or "fan" (culture / fandom / ritual asset); when unsure, use "fan". Set "momentum": true only for items the input marks as surging / trending. Do NOT invent elevation prompts or rationales — if the input has no such list, return "assetElevations": [].

Citations rule: include a "url" on a quote or source ONLY when that exact link is present in the raw input. NEVER invent URLs, and never cite a named outlet that does not appear in the input — synthesize platform tags (X / TikTok / Reddit / etc.) instead.

Do not include the markets or flag for any market other than ${market}.

Live date: ${dateLabel}.

Raw input:
${rawInput}`;
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
      .json({
        error: "market must be Canada / Brazil / Germany / USA / Global",
      });
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
