// POST /api/refresh — MFG-only. Calls Gemini 2.5 Flash with Google Search
// grounding, asks for a strict JSON payload of fresh WC2026 news / social /
// ticker items, parses it, returns to the client. The client then writes
// the rows into the Supabase `live_updates` table using the existing
// supabase-js init (RLS is permissive — auth lives in the gate cookie).

const { verifyToken, readCookie, signingSecret } = require("./_gate-shared");

const MODEL = "gemini-2.5-flash";
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

function buildPrompt() {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const niceDate = today.toUTCString().slice(0, 16);

  return [
    "You are a sports-content scout for the 2026 FIFA World Cup",
    "(June 11 – July 19, 2026; hosts Canada / Mexico / USA).",
    "Today is " + niceDate + " (" + isoDate + ").",
    "",
    "Use Google Search to find the latest WC2026 stories from the LAST 24–48 HOURS.",
    "Cover BOTH on-pitch news (squads, injuries, friendlies, manager moves) AND",
    "off-pitch culture / business (tickets, fan-fest news, sponsor activations,",
    "music / anthem / opening ceremony, kits, broadcast deals, visa & travel).",
    "Where Google has indexed Reddit threads, X posts, or TikTok chatter, surface",
    "what fans are saying — that goes in the social[] array.",
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
    '      "tag": "Canada" | "USA" | "Germany" | "UK" | "Macro" | "Global"',
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
    "Counts: 6–10 news, 3–6 social, 6–10 ticker. Skip generic / stale items.",
    "Every news item MUST have a working URL. Every social item MUST have a",
    "non-empty platforms array. Do not invent quotes; only use ones Google found.",
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!mfgGateOk(req)) {
    return res.status(401).json({ error: "MFG gate cookie required" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: buildPrompt() }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
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
      (data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts) ||
      [];
    const text = parts.map((p) => p.text || "").join("").trim();
    const payload = extractJson(text);
    if (!payload) {
      return res.status(502).json({
        error: "Could not parse Gemini JSON",
        sample: text.slice(0, 400),
      });
    }

    const groundingMeta =
      (data.candidates && data.candidates[0] &&
        data.candidates[0].groundingMetadata) || null;

    return res.status(200).json({
      ok: true,
      payload: payload,
      groundingChunks: groundingMeta && groundingMeta.groundingChunks
        ? groundingMeta.groundingChunks.length
        : 0,
    });
  } catch (e) {
    console.error("refresh exception", e);
    return res.status(502).json({ error: "Upstream unavailable" });
  }
};
