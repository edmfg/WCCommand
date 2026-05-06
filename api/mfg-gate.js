// MFG mode gate. Same HMAC-cookie pattern as api/gate.js. Keyed off the
// same GATE_PASSWORD as the dashboard gate (consolidated single password),
// but uses a separate cookie name (`wcc_mfg_gate`) so MFG-mode sessions
// are independent. 7-day TTL.
//
// POST /api/mfg-gate    body: { password }    → on match, sets cookie.
// GET  /api/mfg-gate                          → returns { ok }.
// DELETE /api/mfg-gate                        → clears the cookie.

const crypto = require("crypto");

const COOKIE_NAME = "wcc_mfg_gate";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

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
function makeToken(secret) {
  const expiry = Date.now() + SESSION_MS;
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
function setCookie(res, value) {
  res.setHeader(
    "Set-Cookie",
    [
      COOKIE_NAME + "=" + value,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=" + Math.floor(SESSION_MS / 1000),
    ].join("; "),
  );
}
function clearCookie(res) {
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
}
async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 4096) {
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

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const password = process.env.GATE_PASSWORD;
  if (!password) {
    return res
      .status(500)
      .json({ error: "GATE_PASSWORD env var not configured" });
  }

  if (req.method === "GET") {
    const token = readCookie(req, COOKIE_NAME);
    return res.status(200).json({ ok: verifyToken(token, password) });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      return res.status(400).json({ error: "invalid json" });
    }
    const submitted = String(body.password || "");
    const submittedBuf = Buffer.from(submitted, "utf8");
    const expectedBuf = Buffer.from(password, "utf8");
    const ok =
      submittedBuf.length === expectedBuf.length &&
      timingSafeEqual(submittedBuf, expectedBuf);
    if (!ok) {
      return res.status(401).json({ ok: false, error: "wrong password" });
    }
    setCookie(res, makeToken(password));
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    clearCookie(res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "method not allowed" });
};
