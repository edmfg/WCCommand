// Konami-code reveal endpoint.
//
// GET /api/secret-passwords → returns the active gate password(s) plus what
// each unlocks. ONLY responds when the caller already presents a valid
// dashboard, creative, or MFG gate cookie. Anyone with a valid cookie has
// already typed the password to get it, so this is just a "remind me" for the
// team — never a bypass.
//
// Note on passwords: api/gate.js and api/creative-gate.js use GATE_PASSWORD.
// api/mfg-gate.js prefers MFG_MODE_PASSWORD and falls back to GATE_PASSWORD.
// So in practice there are either one or two distinct passwords; we surface
// both when they differ.
//
// The Konami code (↑ ↑ ↓ ↓ ← → ← →) on either page fires this endpoint and
// pops a modal with the result.

const { verifyToken, readCookie, signingSecret } = require("./_gate-shared");

const COOKIES = ["wcc_gate", "wcc_creative_view", "wcc_mfg_gate"];

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  const gatePassword = process.env.GATE_PASSWORD;
  const mfgPassword = process.env.MFG_MODE_PASSWORD || gatePassword;
  if (!gatePassword) {
    return res
      .status(500)
      .json({ error: "GATE_PASSWORD env var not configured" });
  }

  const secret = signingSecret();
  const verified = COOKIES.some((name) =>
    verifyToken(readCookie(req, name), secret),
  );
  if (!verified) {
    return res.status(401).json({ ok: false, error: "not authenticated" });
  }

  const separateMfg = mfgPassword !== gatePassword;

  return res.status(200).json({
    ok: true,
    gates: [
      {
        name: "Public Dashboard",
        page: "/index.html",
        cookie: "wcc_gate",
        ttl: "8h or 7d",
        password: gatePassword,
      },
      {
        name: "Creative tab view",
        page: "/index.html (Creative)",
        cookie: "wcc_creative_view",
        ttl: "12h",
        password: gatePassword,
      },
      {
        name: "MFG Cockpit",
        page: "/mfg.html",
        cookie: "wcc_mfg_gate",
        ttl: "7d",
        password: mfgPassword,
        env: separateMfg ? "MFG_MODE_PASSWORD" : "GATE_PASSWORD (fallback)",
      },
    ],
    note: separateMfg
      ? "MFG Cockpit uses a separate password (MFG_MODE_PASSWORD). Dashboard and Creative share GATE_PASSWORD."
      : "Single GATE_PASSWORD env var unlocks all three gates; each uses its own cookie.",
  });
};
