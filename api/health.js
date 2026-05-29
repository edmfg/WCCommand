// GET /api/health — quick liveness probe.
//
// Public response is intentionally bare: { ok, time }. Detailed env-var
// presence + upstream Gemini ping are gated on a valid wcc_gate or
// wcc_mfg_gate cookie so anonymous probes can't enumerate which secrets
// are wired.

const { verifyToken, readCookie, signingSecret } = require("./_gate-shared");

function gateOk(req) {
  const secret = signingSecret();
  if (!secret) return false;
  const a = readCookie(req, "wcc_gate");
  if (a && verifyToken(a, secret)) return true;
  const b = readCookie(req, "wcc_mfg_gate");
  if (b && verifyToken(b, secret)) return true;
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  const baseOk = !!process.env.GEMINI_API_KEY && !!process.env.GATE_PASSWORD;
  const result = {
    ok: baseOk,
    time: new Date().toISOString(),
  };

  if (!gateOk(req)) {
    return res.status(200).json(result);
  }

  // Authenticated callers get the detail block.
  const env = {
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GATE_PASSWORD: !!process.env.GATE_PASSWORD,
    GATE_SIGNING_SECRET: !!process.env.GATE_SIGNING_SECRET,
    SERVER_API_SECRET: !!process.env.SERVER_API_SECRET,
    ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  result.env = env;
  result.upstream = null;

  const wantUpstream =
    typeof req.url === "string" && req.url.includes("upstream=1");
  if (wantUpstream && env.GEMINI_API_KEY) {
    try {
      const t0 = Date.now();
      const upstream = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
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
