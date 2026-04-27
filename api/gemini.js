const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (now - v.start > RATE_LIMIT_WINDOW_MS) hits.delete(k);
    }
  }
  return entry.count > RATE_LIMIT_MAX;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function originAllowed(req) {
  if (!ALLOWED_ORIGINS.length) return true;
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  return ALLOWED_ORIGINS.some(o => origin === o || referer.startsWith(o));
}

function validShape(body) {
  if (!body || typeof body !== 'object') return false;
  if (!Array.isArray(body.contents)) return false;
  if (body.contents.length === 0 || body.contents.length > 32) return false;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!originAllowed(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests' });
  }

  const size = Number(req.headers['content-length'] || 0);
  if (size && size > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  if (!validShape(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Gemini upstream error', upstream.status, JSON.stringify(data).slice(0, 500));
      return res.status(upstream.status).json({
        error: { message: 'Upstream request failed', status: upstream.status },
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    console.error('Gemini proxy exception', e);
    return res.status(502).json({ error: { message: 'Upstream unavailable' } });
  }
};

module.exports.config = { maxDuration: 30 };
