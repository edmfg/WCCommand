# MFG World Cup HQ — project notes for Claude

A two-page static site that ships as a Vercel deployment, plus three small serverless functions and a Supabase project for shared state. Audience is the MFG strategy team running reactive Instagram content during the 2026 FIFA World Cup (June 11 – July 19, 2026, hosted by Canada / Mexico / USA).

There is no build step. Edit the HTML / JS files directly and push to `main`; Vercel auto-deploys on push.

---

## Pages

### `index.html` — public dashboard
A single-file HTML/JS app. Everything below lives inside it unless noted.

- **Password gate** — full-screen overlay shown until the user authenticates. Calls `POST /api/gate` with `{ password, remember }`; on success the body's `gated` class is removed and the dashboard boots. Remember-me persists locally for ~7 days so returning users never see the gate flash.
- **Stadium-flyover intro animation** — runs on the 1st, 4th, 7th… visit (every third). The `WORLD CUP HQ` title in the intro animates into the header brand position; that target is `.brand > span:not(.beta-badge)` so the landing position lines up with the actual text, not the logo image.
- **Live tab** — three carousels:
  - **Breaking News ticker** — top of page, infinite scroll. Items live in `DASHBOARD_DATA.ticker[]` plus the most recent news headlines.
  - **Fun Fact ticker** — bottom of page, scrolls at the same px/sec as the breaking ticker (auto-derived from the breaking duration).
  - **News carousel** — `DASHBOARD_DATA.news[]`. Each item has `id, headline, source, timestamp, summary, url, tag`. `tag` is one of `Canada / USA / Germany / UK / Macro / Global` and drives the market filter pills.
  - **Social Trends carousel** — `DASHBOARD_DATA.social[]`. Each item has `id, topic, category, volume, sentiment, summary, sampleQuote, quotes[], platforms[], sourceUrl`. `category` is one of `game / food / music / fashion / fandom / memes`. `platforms` is REQUIRED — the renderer crashes if missing (calls `s.platforms.map`). Always include it on new items.
  - **Filter pills** above the carousels: All / RECENT (last 72h) / Canada / Germany / UK / USA / Game / Culture.
- **Fixtures tab** — `DASHBOARD_DATA.matches[]` (104 matches across all groups + knockouts). Schema per match: `id, date, kickoff, stage, home: {name, code, flag}, away: {name, code, flag}, venue, status, score`. `status` is `"upcoming" | "live" | <anything else = final>`. `score` is `null` until played, then `{home, away}` integers. Standings table is computed off the `score` field.
- **Creative tab** — three sub-tabs (⚽ WC Engine, ▶️ YT x Genius, 📺 Fox S2). Asset cards come from two sources merged together:
  - `DASHBOARD_DATA.assets[]` (hard-coded in the file)
  - Supabase `creative_assets` table (the live source for MFG Creative Uploads — see below)
  - Cards filter by market (split on commas — multi-market cards surface under each pill).
  - Drive-link cards have a play badge; clicking them opens a fullscreen overlay with `https://drive.google.com/file/d/<id>/preview` in an iframe (videos play inline). Click X / outside / Esc to close.
- **Floating UI** at the bottom-right:
  - **Gemini button** — opens a slide-in panel that calls `POST /api/gemini`. Gemini system prompt is mode-aware (Live Dashboard vs MFG mode), brand-safe (refuses politics / war / religion / explicit / harassment, redirects off-topic asks to a WC angle), and bullet-only (3–5 bullets default, no prose paragraphs). Three randomized prepopulated chips show above the input.
  - **Coach mark** — first-visit tooltip pointing at the Gemini button. Dismissed via × / clicking the button / 12s timeout. Persists dismissal in localStorage.
- **Floating countdown pill** at the top-center — drag to reposition (position persisted to localStorage). Shows days/hours/minutes to kickoff (June 11, 2026 18:00 UTC). Lives in `countdown.js`.

### `mfg.html` — MFG production cockpit
Password-gated separately (password literal `mfg`). Two-tab layout:

- **🧯 Global Triage** — drag-and-drop kanban-style board for tracking work across markets. Auto-grouping by tag (creative / strategy / macro / activation / media / production / talent / partnerships / legal / else). Each tag has its own color. Snapshots saved to Supabase `mfg_triage_snapshots` and `mfg_triage` tables. Snapshot history panel is collapsed by default.
- **🎬 Creative Uploads** — form for posting Drive-hosted creative assets to the public Creative tab. Files are NOT uploaded to Supabase — only the link is stored. Form fields:
  - Markets (multi-select, required) — Canada / USA / Germany / UK / Global. Stored comma-joined.
  - Bento (single-select, optional) — `BENTO 1: Long/Results/16` / `BENTO 2: Query/Result/Query/23` / `BENTO 3: Query/Query/16` / `ELSE`.
  - Title (optional) — auto-generated as `Creative — <markets>` if blank (the `headline` column is NOT NULL).
  - Live-from + Live-until date range (optional).
  - Channel (optional, defaults `IG`) — IG / TT / YT / FB / X / DOOH / ELSE.
  - Drive link (required) — extracts file id via regex on common patterns (`/file/d/<id>`, `?id=<id>`, `/d/<id>`).
  - Submits go live immediately on the public Creative tab.
- **Recent uploads** grid (last 12) and **All uploads** archive (up to 500) below the form. Hover any card → ✕ button → arms ("Delete?") for 3 seconds → click again to delete from Supabase + both lists + the public Creative tab.

---

## Serverless functions (`api/`)

### `api/gemini.js`
Proxies POSTs to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, injecting the `GEMINI_API_KEY` env var. Request shape mirrors Gemini's REST API.

Two access paths:
1. **Browser (default)** — `Origin` / `Referer` header check against `ALLOWED_ORIGINS`.
2. **Server-to-server** — `x-mfg-server-secret` header (timing-safe compared to `SERVER_API_SECRET` env var). Lets the daily-refresh routine call the proxy without an `Origin`.

Rate limit: 20 req/min per IP. Body cap: 256 KB.

### `api/gate.js`
Password gate for the public dashboard.
- `POST /api/gate` with `{ password, remember }` — verifies against `GATE_PASSWORD` env var (constant-time compare). On success sets a signed httpOnly cookie `wcc_gate=<base64url(expiry)>.<base64url(hmac)>` (HMAC-SHA-256 keyed with the password). TTL is 8h or 7d depending on `remember`.
- `GET /api/gate` — verifies the cookie's HMAC + expiry, returns `{ ok: true|false }`.
- `DELETE /api/gate` — clears the cookie.

Cookie attrs: `HttpOnly; Secure; SameSite=Lax; Path=/`.

---

## Static JS files

### `countdown.js`
Self-contained floating pill. Auto-injects on load. Counts down to `Date.UTC(2026, 5, 11, 18, 0, 0)` in days/hours/minutes. Drag with mouse or touch; position persisted to localStorage `wcc_countdown_pos_v1`. Wired on both `index.html` and `mfg.html`.

### `gemini-assistant.js`
Shared Gemini panel logic. URL-based mode detection (`mfg.html` → MFG mode; otherwise → Dashboard mode). Two paths:
- If `#geminiPanel` exists (the dashboard already has its own inline panel) → only inject prepopulated chips above its input field.
- Otherwise (MFG mode) → inject the full button + slide-in panel + chips.

Mode-aware system instruction. Google Search grounding always on. Three randomized chips per session (out of a 5-prompt pool per mode). Sticky-bottom autoscroll while responses stream.

---

## Supabase

Project: `https://ypisjfefbccgtxesteja.supabase.co` (URL is hard-coded in both pages; only the publishable key is shipped client-side; service-role keys never leave Vercel env).

Tables in use:
- `mfg_triage` — single row keyed by `id='global'`, jsonb data column. Live state of the Triage board. See `supabase-mfg-triage.sql`.
- `mfg_triage_snapshots` — saved snapshots. See same SQL file.
- `dashboard_updates` — Daily Update history (legacy from a removed tab). See `supabase-dashboard-updates.sql`.
- `creative_assets` — Creative tab uploads. Columns include the original `headline, market, format, status, deploy_date, subtab, kind, youtube_url, image_url, uploaded_by, created_at` plus extensions added by the MFG Creative Uploads tab:
  - `drive_url`, `drive_file_id` (`supabase-creative-assets-extend.sql`)
  - `live_end_date`, `channel` (same migration)
  - `bento` (`supabase-creative-assets-bento.sql`)
  - The `kind_check` constraint accepts `'youtube'`, `'image'`, or `'drive'` (`supabase-creative-assets-kind.sql`).

Row-level security is permissive on every table — the app-level password gates are the actual access control.

When changing schema, write a new `supabase-<topic>.sql` file at the repo root and tell the user to run it in the Supabase SQL editor. Use `if not exists` / `drop constraint if exists` so migrations are idempotent.

---

## Vercel config

`vercel.json` — only contains rewrites for `/api/gemini` and `/api/gate`. The static-file behavior is the default Vercel deploys.

Required env vars on Vercel:
- `GEMINI_API_KEY` — the Google AI Studio API key the proxy uses.
- `ALLOWED_ORIGINS` — comma-separated list of allowed `Origin` / `Referer` host prefixes.
- `GATE_PASSWORD` — the dashboard gate password (currently `mfg`).
- `SERVER_API_SECRET` — server-to-server bypass for `/api/gemini`. Used by the daily-refresh routine if/when it's reactivated.

Deployment Protection: previously enabled, currently OFF on Production (the dashboard's own gate is the access control). Re-enabling it breaks the Gemini proxy for outbound automation — see "routine status" below.

---

## Daily content-refresh routine

A scheduled remote agent was set up at one point to auto-refresh content via Gemini-via-Vercel-proxy. It's currently **disabled** because Vercel's edge consistently returned `403 host_not_allowed` for the Anthropic cloud agent's IP range, even with the protection bypass token. The owner decided to do refreshes manually in chat instead.

When the user types **"refresh everything"** (or "refresh content" / "do the daily" / "pull fresh news"):
- Search the web AND Reddit (r/soccer, r/worldcup, team-specific subs) for the past 24–48h of WC2026 news, fan reactions, and cultural moments. Reddit is a first-class source, not an afterthought.
- Edit `index.html` `DASHBOARD_DATA`:
  - `news[]` — prepend ~5–10 items, each with the right `tag` (Canada / USA / Germany / UK / Macro / Global).
  - `social[]` — prepend ~5 items, each with the right `category`, `volume`, `sentiment`, AND a non-empty `platforms` array (mandatory — the renderer crashes if it's missing).
  - `ticker[]` — prepend ~5 items.
  - Trim items older than ~14 days.
  - Bump `lastUpdated`.
- **During the tournament window (June 11 – July 19, 2026)**, also update `DASHBOARD_DATA.matches[]`:
  - For every match played in the past 24h, find by `date` + teams, set `status` to a non-`"upcoming"` value, set `score: { home, away }`. Standings recompute automatically.
  - For matches in progress: `status: "live"` plus current score.
  - Don't touch matches that haven't kicked off.
- Sanity-check the file parses (extract `<script>` blocks → `node --check`).
- Commit and push to `main`.

---

## Conventions / things to remember

- **No build step.** Edit HTML / JS directly. Push to `main` to deploy.
- **Don't run prettier as part of normal task flow** — the owner has a memory rule about this. Only run prettier when explicitly asked.
- **End every coding response with a plain-English bullet summary** of what changed (memory rule).
- **Emoji choices matter.** Avoid `🏴󠁧󠁢󠁥󠁮󠁧󠁿` (subdivision flag tag — renders as a black flag or boxes on many systems) — use `🦁` for England football decoratively. Avoid `🌍` as a generic "world" badge — pick a more specific topical emoji (`⚽ 🏟️ 🎟️ 💰 📋 🩼 🛂 🌱 🏆`). Match-data team flag fields are intentional and stay as actual flags.
- **News tags MUST be one of** `Canada / USA / Germany / UK / Macro / Global`. Anything else won't surface under the filter pills.
- **Social items MUST include** `platforms: ['X' | 'TikTok' | 'IG' | 'Reddit', ...]` — the renderer's `s.platforms.map(...)` throws otherwise, which crashes the entire `init()` and silently breaks Gemini button + everything else after it. This was a real bug in the past.
- **Multi-market creative assets** are stored as comma-joined strings in `creative_assets.market` (e.g. `"Canada,USA"`). Filter logic splits on commas so the asset surfaces under each market's pill.
- **Drive thumbnail fallback chain** for creative cards: `lh3.googleusercontent.com/d/<id>=w400` → `drive.google.com/thumbnail?id=<id>&sz=w400` → ▶ play-icon placeholder. The lh3 endpoint is more reliable than the legacy `/thumbnail` for videos.
- **Drive files must be set to "Anyone with the link can view"** for the iframe preview and the share link to work for non-MFG clients. The form copy reminds the uploader.
- **Body of `index.html` starts with classes `dashboard-hidden gated`.** Removing `gated` after auth runs `bootDashboard()` which kicks off the intro animation + data render. Don't render anything before the gate clears.
- The countdown pill ticks every 30s (no seconds segment).
- `BETA v2.x` badge in the header — bump it on meaningful releases.
