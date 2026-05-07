// MFG-mode gate. Same shape as api/gate.js. Cookie wcc_mfg_gate, 7-day TTL.

const {
  GATE_RL_MAX,
  GATE_RL_LOCK_SEC,
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
  signingSecret,
} = require("./_gate-shared");

const COOKIE_NAME = "wcc_mfg_gate";
const SCOPE = "mfg";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

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

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const password = process.env.GATE_PASSWORD;
  if (!password) {
    return res
      .status(500)
      .json({ error: "GATE_PASSWORD env var not configured" });
  }
  const secret = signingSecret();

  if (req.method === "GET") {
    const token = readCookie(req, COOKIE_NAME);
    return res.status(200).json({ ok: verifyToken(token, secret) });
  }

  if (req.method === "POST") {
    const ip = clientIp(req);
    if (await isLockedOut(SCOPE, ip)) {
      res.setHeader("Retry-After", String(GATE_RL_LOCK_SEC));
      return res
        .status(429)
        .json({ ok: false, error: "Too many attempts — try again later." });
    }
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
      const count = await recordFailure(SCOPE, ip);
      if (count >= GATE_RL_MAX) await setLockout(SCOPE, ip);
      return res.status(401).json({ ok: false, error: "wrong password" });
    }
    await clearFailures(SCOPE, ip);
    setCookie(res, makeToken(secret, SESSION_MS));
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    clearCookie(res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "method not allowed" });
};
