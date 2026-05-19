// Shared helpers for the three password gates (gate.js, mfg-gate.js,
// creative-gate.js). Lives outside the routed `api/*.js` files because
// only top-level `api/*.js` files become endpoints — anything starting
// with `_` is ignored by Vercel's file-based router but is requireable.

const crypto = require("crypto");

const GATE_RL_WINDOW_SEC = 15 * 60; // 15 minutes
const GATE_RL_MAX = 10; // 10 failed attempts per window
const GATE_RL_LOCK_SEC = 30 * 60; // 30 minute lockout once tripped

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}
function sign(expiryMs, secret) {
  const h = crypto.createHmac("sha256", secret);
  h.update(String(expiryMs));
  return h.digest();
}
function timingSafeEqual(a, b) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a || "");
  if (!Buffer.isBuffer(b)) b = Buffer.from(b || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function makeToken(secret, ttlMs) {
  const expiry = Date.now() + ttlMs;
  return b64url(String(expiry)) + "." + b64url(sign(expiry, secret));
}
function verifyToken(token, secret) {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  let expiry, sig;
  try {
    expiry = parseInt(b64urlDecode(token.slice(0, dot)).toString("utf8"), 10);
    sig = b64urlDecode(token.slice(dot + 1));
  } catch (e) {
    return false;
  }
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  return timingSafeEqual(sign(expiry, secret), sig);
}
function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
async function readJson(req, maxBytes = 4096) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > maxBytes) {
        req.destroy();
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// Per-IP attempt counter. Survives cold starts when Upstash is configured;
// otherwise falls back to an in-memory map (per serverless instance).
const memHits = new Map();

async function upstashIncr(key, ttlSec) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(url + "/pipeline", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, ttlSec, "NX"],
        ["TTL", key],
      ]),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const count = Number((data && data[0] && data[0].result) || 0);
    const ttl = Number((data && data[2] && data[2].result) || 0);
    return { count, ttl };
  } catch (e) {
    return null;
  }
}

async function recordFailure(scope, ip) {
  const key = `wcc_gate_fail:${scope}:${ip}`;
  const remote = await upstashIncr(key, GATE_RL_WINDOW_SEC);
  if (remote) return remote.count;
  // memory fallback
  const now = Date.now();
  const e = memHits.get(key);
  if (!e || now - e.start > GATE_RL_WINDOW_SEC * 1000) {
    memHits.set(key, { start: now, count: 1 });
    return 1;
  }
  e.count += 1;
  return e.count;
}

async function isLockedOut(scope, ip) {
  const lockKey = `wcc_gate_lock:${scope}:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const res = await fetch(url + "/get/" + encodeURIComponent(lockKey), {
        headers: { Authorization: "Bearer " + token },
      });
      const data = res.ok ? await res.json() : null;
      if (data && data.result) return true;
    } catch (_) {}
  }
  // memory fallback
  const e = memHits.get(lockKey);
  if (e && Date.now() < e.until) return true;
  return false;
}

async function setLockout(scope, ip) {
  const lockKey = `wcc_gate_lock:${scope}:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      await fetch(
        url +
          "/setex/" +
          encodeURIComponent(lockKey) +
          "/" +
          GATE_RL_LOCK_SEC +
          "/1",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
        },
      );
      return;
    } catch (_) {}
  }
  memHits.set(lockKey, { until: Date.now() + GATE_RL_LOCK_SEC * 1000 });
}

// Generic per-IP rate limit. Returns { ok, count, retryAfter }. Use for
// authenticated routes where the gate cookie alone isn't enough to bound
// blast radius if it leaks (e.g. /api/sb-write, manual /api/refresh).
async function rateLimit(scope, ip, max, windowSec) {
  const key = `wcc_rl:${scope}:${ip}`;
  const remote = await upstashIncr(key, windowSec);
  let count, ttl;
  if (remote) {
    count = remote.count;
    ttl = remote.ttl > 0 ? remote.ttl : windowSec;
  } else {
    const now = Date.now();
    const e = memHits.get(key);
    if (!e || now - e.start > windowSec * 1000) {
      memHits.set(key, { start: now, count: 1 });
      count = 1;
    } else {
      e.count += 1;
      count = e.count;
    }
    ttl = Math.max(
      1,
      windowSec - Math.floor((now - (memHits.get(key).start || now)) / 1000),
    );
  }
  return { ok: count <= max, count, retryAfter: ttl };
}

async function clearFailures(scope, ip) {
  const key = `wcc_gate_fail:${scope}:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      await fetch(url + "/del/" + encodeURIComponent(key), {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
    } catch (_) {}
  }
  memHits.delete(key);
}

// Resolve the HMAC signing secret. Prefer GATE_SIGNING_SECRET so cookie
// forgery isn't trivially possible if the password ever leaks. Falls back
// to GATE_PASSWORD for back-compat with already-deployed sessions.
function signingSecret() {
  return process.env.GATE_SIGNING_SECRET || process.env.GATE_PASSWORD || "";
}

module.exports = {
  GATE_RL_MAX,
  GATE_RL_LOCK_SEC,
  b64url,
  b64urlDecode,
  sign,
  timingSafeEqual,
  makeToken,
  verifyToken,
  readCookie,
  readJson,
  clientIp,
  recordFailure,
  isLockedOut,
  setLockout,
  clearFailures,
  rateLimit,
  signingSecret,
};
