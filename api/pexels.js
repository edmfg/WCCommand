// GET /api/pexels?t=<tileKey>
//
// Resolves a fixed per-tile search query to the best landscape photo on Pexels
// (server-side, using the PEXEL_API env var) and streams the image bytes back.
// Only the whitelisted tile keys below are allowed, so the key can never be used
// for arbitrary searches. The response is heavily cached at the edge, so each
// tile resolves once and is then served from Vercel's CDN like a static file —
// the browser never re-fetches Pexels on every visit.
//
// PEXEL_API lives only in Vercel env (it's "Encrypted" / write-only, so it can't
// be pulled to a laptop) — running the search here is how we actually use it.

const TILE_QUERIES = {
  hero: "packed soccer stadium crowd floodlights night",
  culture: "diverse soccer fans flags faces celebration",
  gemini: "abstract glowing gradient light blue purple",
  ocr: "phone filming soccer match social media",
  agentic: "sunrise over empty stadium",
  reactive: "soccer goal celebration crowd eruption",
  dashboard: "analytics dashboard screen dark",
  halo: "data visualization glowing network",
  markets: "world map glowing connections night",
};

function readTileKey(req) {
  if (req.query && req.query.t) return req.query.t;
  try {
    const u = new URL(req.url, "http://localhost");
    return u.searchParams.get("t") || "";
  } catch (_) {
    return "";
  }
}

module.exports = async function handler(req, res) {
  const t = readTileKey(req);
  const query = TILE_QUERIES[t];

  if (!query) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ error: "unknown tile key" });
  }

  const key = process.env.PEXEL_API;
  if (!key) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "PEXEL_API not configured" });
  }

  try {
    const searchRes = await fetch(
      "https://api.pexels.com/v1/search?orientation=landscape&per_page=1&query=" +
        encodeURIComponent(query),
      { headers: { Authorization: key } }
    );
    if (!searchRes.ok) throw new Error("pexels search " + searchRes.status);

    const data = await searchRes.json();
    const photo = data.photos && data.photos[0];
    const src =
      photo && (photo.src.large2x || photo.src.large || photo.src.original);
    if (!src) throw new Error("no photo for " + t);

    const imgRes = await fetch(src);
    if (!imgRes.ok) throw new Error("image fetch " + imgRes.status);
    const buf = Buffer.from(await imgRes.arrayBuffer());

    res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    // cache hard: 1d in the browser, 30d at the edge
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400"
    );
    if (photo && photo.photographer) {
      res.setHeader("X-Photo-Credit", String(photo.photographer).slice(0, 60));
    }
    return res.status(200).send(buf);
  } catch (err) {
    // On any failure the <img> onerror handler shows the gradient fallback.
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: String((err && err.message) || err) });
  }
};
