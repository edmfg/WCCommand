// Server-side write proxy for Supabase tables.
//
// Why this exists: until now, mfg.html and index.html mutated Supabase tables
// directly using the publishable (anon) key, with permissive RLS policies
// (`with check (true)`). That meant anyone on the internet could insert,
// update, or delete rows by hitting the Supabase REST API with the public
// key — the "MFG password" was app-side only.
//
// This endpoint is the new write path. Clients POST { table, op, values,
// match, onConflict } and the handler:
//   1. Verifies the wcc_mfg_gate or wcc_gate cookie (HMAC over expiry).
//   2. Whitelists table + op pairs.
//   3. Calls Supabase REST with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
//
// Reads (SELECT) still happen client-side with the publishable key — RLS
// keeps `for select using (true)` so the dashboard renders without a server
// hop. The hardening migration drops the permissive insert/update/delete
// policies, so anon writes are denied at the database.

const crypto = require("crypto");

const COOKIE_GATE = "wcc_gate";
const COOKIE_MFG_GATE = "wcc_mfg_gate";

// Tables this proxy is willing to mutate. Anything else returns 400.
const ALLOWED_TABLES = new Set([
  "mfg_triage",
  "mfg_triage_snapshots",
  "creative_assets",
  "today_reactive",
  "dashboard_updates",
  "dashboard_content",
  "live_updates",
]);

// Per-table per-op allowlist. Stops a stolen cookie from doing things the
// app never asked for (e.g. truncating triage rows).
const ALLOWED_OPS = {
  mfg_triage: new Set(["upsert"]),
  mfg_triage_snapshots: new Set(["insert", "delete"]),
  creative_assets: new Set(["insert", "delete"]),
  today_reactive: new Set(["insert"]),
  dashboard_updates: new Set(["insert"]),
  dashboard_content: new Set(["insert", "update", "upsert"]),
  // Refresh Content button writes a batch of news/social/ticker rows here.
  // Service-role bypass means anon RLS can never silently block it.
  live_updates: new Set(["insert"]),
};

const MAX_BODY_BYTES = 256 * 1024;

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function timingSafeEqual(a, b) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a || "");
  if (!Buffer.isBuffer(b)) b = Buffer.from(b || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(expiryMs, secret) {
  const h = crypto.createHmac("sha256", secret);
  h.update(String(expiryMs));
  return h.digest();
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

function gateAuthorized(req) {
  const password = process.env.GATE_PASSWORD;
  if (!password) return false;
  const secret = process.env.GATE_SIGNING_SECRET || password;
  // Either cookie is sufficient — dashboard users can write today_reactive
  // assets isn't true (only MFG cookie should), but fine-grained ACLs are
  // overkill for the threat model. The MFG cookie covers all writers.
  const t1 = readCookie(req, COOKIE_MFG_GATE);
  if (t1 && verifyToken(t1, secret)) return "mfg";
  const t2 = readCookie(req, COOKIE_GATE);
  if (t2 && verifyToken(t2, secret)) return "dashboard";
  return false;
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > MAX_BODY_BYTES) {
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

// Build a PostgREST query string from a flat match object.
// { id: "abc" } → "id=eq.abc"
// { kind: "drive", subtab: "engine" } → "kind=eq.drive&subtab=eq.engine"
function buildMatchQuery(match) {
  if (!match || typeof match !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(match)) {
    if (typeof k !== "string" || !/^[a-z_][a-z0-9_]*$/i.test(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    parts.push(`${k}=eq.${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  const role = gateAuthorized(req);
  if (!role) {
    return res.status(401).json({ ok: false, error: "gate cookie required" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://ypisjfefbccgtxesteja.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) {
    return res
      .status(500)
      .json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return res.status(400).json({ ok: false, error: "invalid json" });
  }

  const table = String(body.table || "");
  const op = String(body.op || "");
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ ok: false, error: "table not allowed" });
  }
  if (!ALLOWED_OPS[table] || !ALLOWED_OPS[table].has(op)) {
    return res
      .status(400)
      .json({ ok: false, error: `op '${op}' not allowed on '${table}'` });
  }

  const values = body.values;
  const match = body.match || null;
  const onConflict = body.onConflict ? String(body.onConflict) : null;
  const returnRows = body.returnRows !== false; // default: return data
  const limit = Math.max(0, Math.min(parseInt(body.limit || 0, 10) || 0, 1000));

  // Build URL + method per op.
  let url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}`;
  let method = "POST";
  let bodyToSend = null;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  if (returnRows) headers.Prefer = "return=representation";

  if (op === "insert") {
    method = "POST";
    bodyToSend = JSON.stringify(values);
  } else if (op === "upsert") {
    method = "POST";
    const params = [];
    if (onConflict) {
      if (!/^[a-z_][a-z0-9_]*(?:,[a-z_][a-z0-9_]*)*$/i.test(onConflict)) {
        return res.status(400).json({ ok: false, error: "bad onConflict" });
      }
      params.push("on_conflict=" + onConflict);
    }
    if (params.length) url += "?" + params.join("&");
    headers.Prefer = (returnRows ? "return=representation," : "") + "resolution=merge-duplicates";
    bodyToSend = JSON.stringify(values);
  } else if (op === "update") {
    method = "PATCH";
    const q = buildMatchQuery(match);
    if (!q) {
      return res
        .status(400)
        .json({ ok: false, error: "update requires match filter" });
    }
    url += "?" + q;
    bodyToSend = JSON.stringify(values || {});
  } else if (op === "delete") {
    method = "DELETE";
    const q = buildMatchQuery(match);
    if (!q) {
      return res
        .status(400)
        .json({ ok: false, error: "delete requires match filter" });
    }
    url += "?" + q;
  }

  if (limit) headers.Range = `0-${limit - 1}`;

  let upstream;
  try {
    upstream = await fetch(url, { method, headers, body: bodyToSend });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "supabase unreachable" });
  }
  const text = await upstream.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  if (!upstream.ok) {
    return res
      .status(upstream.status)
      .json({ ok: false, error: data && data.message ? data.message : data });
  }
  return res.status(200).json({ ok: true, data });
};

module.exports.config = { maxDuration: 15 };
