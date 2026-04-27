module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const { name, email, topic, message, page, ua } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Length guards
  const safe = (s, max) => String(s).slice(0, max);
  const sName = safe(name, 200);
  const sEmail = safe(email, 200);
  const sTopic = safe(topic || 'Other', 200);
  const sMessage = safe(message, 8000);
  const sPage = safe(page || '', 500);
  const sUa = safe(ua || '', 500);

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const subject = `[World Cup HQ Support] ${sTopic} — from ${sName}`;
  const text = [
    `From: ${sName} <${sEmail}>`,
    `Topic: ${sTopic}`,
    `Page: ${sPage}`,
    `Browser: ${sUa}`,
    ``,
    `---`,
    ``,
    sMessage,
  ].join('\n');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:640px;line-height:1.55">
      <h2 style="margin:0 0 12px;font-size:18px">World Cup HQ — Support request</h2>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:4px 12px 4px 0;color:#666">From</td><td>${escapeHtml(sName)} &lt;<a href="mailto:${encodeURIComponent(sEmail)}">${escapeHtml(sEmail)}</a>&gt;</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Topic</td><td>${escapeHtml(sTopic)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Page</td><td><a href="${escapeHtml(sPage)}">${escapeHtml(sPage)}</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Browser</td><td style="font-family:monospace;font-size:11px;color:#888">${escapeHtml(sUa)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
      <div style="white-space:pre-wrap;font-size:14px">${escapeHtml(sMessage)}</div>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.SUPPORT_FROM || 'World Cup HQ <onboarding@resend.dev>',
        to: [process.env.SUPPORT_TO || 'edtsue@gmail.com'],
        reply_to: sEmail,
        subject,
        text,
        html,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend error', data);
      return res.status(502).json({ error: data?.message || 'Email send failed' });
    }
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('support handler exception', e);
    return res.status(500).json({ error: e.message });
  }
};
