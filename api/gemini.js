const { verifyToken, readCookie, signingSecret } = require("./_gate-shared");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 256 * 1024;
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 20;

// Browsers must present a valid wcc_gate or wcc_mfg_gate cookie before
// burning Gemini quota. Server-to-server callers bypass via SERVER_API_SECRET.
function browserGateOk(req) {
  const secret = signingSecret();
  if (!secret) return false;
  const a = readCookie(req, "wcc_gate");
  if (a && verifyToken(a, secret)) return true;
  const b = readCookie(req, "wcc_mfg_gate");
  if (b && verifyToken(b, secret)) return true;
  return false;
}

// In-memory fallback (used when UPSTASH_* env vars aren't configured).
// Keyed by user-token (cookie) when available, else IP.
const memHits = new Map();
// Hard cap on entries: if Upstash is missing and traffic spikes during the
// tournament window, this prevents the Map from growing without bound and
// OOM'ing the function. Tuned for a ~1000-active-user worst case.
const MEM_HARD_CAP = 2000;
let _memLastSweep = 0;

function memSweep(now) {
  // Drop anything outside the active rate-limit window, then if we're still
  // over the cap, evict oldest entries until we fit.
  for (const [k, v] of memHits) {
    if (now - v.start > RATE_LIMIT_WINDOW_SEC * 1000) memHits.delete(k);
  }
  if (memHits.size > MEM_HARD_CAP) {
    const sorted = [...memHits.entries()].sort(
      (a, b) => a[1].start - b[1].start,
    );
    const toDrop = memHits.size - MEM_HARD_CAP;
    for (let i = 0; i < toDrop; i++) memHits.delete(sorted[i][0]);
  }
}

function memRateLimit(key) {
  const now = Date.now();
  // Cheap periodic sweep (at most every 5s) keeps the Map honest even when
  // no single request is large enough to trip the hard cap check below.
  if (now - _memLastSweep > 5000) {
    _memLastSweep = now;
    memSweep(now);
  }
  const entry = memHits.get(key);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_SEC * 1000) {
    memHits.set(key, { start: now, count: 1 });
    return { ok: true, count: 1 };
  }
  entry.count += 1;
  if (memHits.size > MEM_HARD_CAP) memSweep(now);
  return { ok: entry.count <= RATE_LIMIT_MAX, count: entry.count };
}

// Persistent rate-limit via Upstash REST. Survives cold starts and works
// across all serverless instances. Falls back to in-memory if not configured.
async function upstashRateLimit(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const k = "wcc_rl:" + key;
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
    return { ok: count <= RATE_LIMIT_MAX, count };
  } catch (e) {
    return null;
  }
}

async function rateLimited(key) {
  const remote = await upstashRateLimit(key);
  if (remote) return !remote.ok;
  return !memRateLimit(key).ok;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// Per-user token via cookie: lets the limiter scope to a single browser
// instead of a shared NAT'd IP. Issued + read on the same response cycle.
function getOrIssueUserKey(req, res) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "wcc_uid") return rest.join("=") || null;
  }
  // Fall back to IP for unauthenticated server-to-server callers.
  return null;
}

function issueUserCookie(res) {
  const id = require("crypto").randomBytes(12).toString("hex");
  res.setHeader(
    "Set-Cookie",
    [
      "wcc_uid=" + id,
      "Path=/",
      "Secure",
      "SameSite=Lax",
      "Max-Age=" + 60 * 60 * 24 * 90,
      "HttpOnly",
    ].join("; "),
  );
  return id;
}

function originAllowed(req) {
  if (!ALLOWED_ORIGINS.length) return true;
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  return ALLOWED_ORIGINS.some((o) => origin === o || referer.startsWith(o));
}

// Server-to-server bypass for trusted callers (e.g. the daily-refresh routine).
// Caller sends `x-mfg-server-secret: <value>`; if it matches SERVER_API_SECRET
// (timing-safe compare) we skip the browser origin check.
function serverAuthorized(req) {
  const expected = process.env.SERVER_API_SECRET;
  if (!expected) return false;
  const provided = req.headers["x-mfg-server-secret"];
  if (typeof provided !== "string" || provided.length === 0) return false;
  if (provided.length !== expected.length) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    return require("crypto").timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function validShape(body) {
  if (!body || typeof body !== "object") return false;
  if (!Array.isArray(body.contents)) return false;
  if (body.contents.length === 0 || body.contents.length > 32) return false;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isServer = serverAuthorized(req);
  if (!isServer) {
    if (!originAllowed(req)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    if (!browserGateOk(req)) {
      return res.status(401).json({ error: "Gate cookie required" });
    }
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  // Per-user cookie key. Server-to-server callers get IP-based bucketing.
  let rlKey;
  if (isServer) {
    rlKey = "srv:" + clientIp(req);
  } else {
    let uid = getOrIssueUserKey(req);
    if (!uid) uid = issueUserCookie(res);
    rlKey = "u:" + uid;
  }
  if (await rateLimited(rlKey)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests" });
  }

  const size = Number(req.headers["content-length"] || 0);
  if (size && size > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Payload too large" });
  }

  if (!validShape(req.body)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(req.body),
      },
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error(
        "Gemini upstream error",
        upstream.status,
        JSON.stringify(data).slice(0, 500),
      );
      return res.status(upstream.status).json({
        error: { message: "Upstream request failed", status: upstream.status },
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    console.error("Gemini proxy exception", e);
    return res.status(502).json({ error: { message: "Upstream unavailable" } });
  }
};

module.exports.config = { maxDuration: 60 };

// (The SSE pass-through to gemini-3.5-flash:streamGenerateContent that lived
// here was never wired up on the client because Vercel's Node serverless
// runtime buffers responses, breaking SSE. Removed in favor of the non-
// streaming path above; bring it back behind Edge runtime if a real streaming
// need shows up.)
