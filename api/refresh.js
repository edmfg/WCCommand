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
    "      'site:reddit.com r/MLS', 'site:reddit.com r/3lions',",
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

    const queries =
      (groundingMeta && groundingMeta.webSearchQueries) || [];

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
