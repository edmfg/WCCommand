// GET /api/health — quick liveness probe for the dashboard.
// Reports which env vars are wired (without echoing values) and pings
// upstream Gemini in the background only if explicitly requested via
// ?upstream=1 (saves quota on routine pings).

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  const env = {
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GATE_PASSWORD: !!process.env.GATE_PASSWORD,
    CREATIVE_KEY: !!process.env.CREATIVE_KEY,
    MFG_MODE_PASSWORD: !!process.env.MFG_MODE_PASSWORD,
    MFG_KEY: !!process.env.MFG_KEY,
    SERVER_API_SECRET: !!process.env.SERVER_API_SECRET,
    ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
  };

  const wantUpstream =
    typeof req.url === "string" && req.url.includes("upstream=1");
  const result = {
    ok: env.GEMINI_API_KEY && env.GATE_PASSWORD,
    time: new Date().toISOString(),
    env,
    upstream: null,
  };

  if (wantUpstream && env.GEMINI_API_KEY) {
    try {
      const t0 = Date.now();
      const upstream = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 4 },
          }),
        },
      );
      result.upstream = {
        gemini_status: upstream.status,
        latency_ms: Date.now() - t0,
      };
    } catch (e) {
      result.upstream = { error: String(e && e.message ? e.message : e) };
    }
  }

  return res.status(200).json(result);
};
