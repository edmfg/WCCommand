# MFG World Cup HQ — project notes for Claude

A two-page static site that ships as a Vercel deployment, plus five small serverless functions and a Supabase project for shared state. Audience is the MFG strategy team running reactive Instagram content during the 2026 FIFA World Cup (June 11 – July 19, 2026, hosted by Canada / Mexico / USA).

There is no build step. Edit the HTML / JS / data files directly and push to `main`; Vercel auto-deploys on push.

**Important — content lives in `data.js`, not `index.html`.** The `DASHBOARD_DATA` literal (news, social, ticker, fixtures, hardcoded assets) was extracted into a separate `data.js` file. `index.html` loads `<script src="data.js">` synchronously at the top of `<body>` before the inline init script, then reads `window.DASHBOARD_DATA`. **Daily refreshes edit `data.js`; never paste the literal back into `index.html`.**

---

## Repo layout at a glance

```
index.html                              public dashboard (Live / Fixtures / Creative)
mfg.html                                MFG production cockpit (Triage / Creative Uploads)
formation.html                          Today's Reactive surface (per-market daily briefings + storyboards)
data.js                                 window.DASHBOARD_DATA — all dashboard content
formation-data.js                       window.FORMATION_DATA — per-market briefings for formation.html
countdown.js                            floating WC2026 countdown pill (both pages)
gemini-assistant.js                     shared Gemini button + panel for MFG mode
api/gate.js                             dashboard password gate (GATE_PASSWORD env)
api/creative-gate.js                    Creative-tab view gate (GATE_PASSWORD env)
api/mfg-gate.js                         MFG-mode password gate (GATE_PASSWORD env)
api/gemini.js                           Gemini API proxy with rate-limit + streaming
api/health.js                           liveness probe + env-var presence reporter
supabase-*.sql                          one-shot SQL migrations (run in Supabase editor)
vercel.json                             rewrites for /api/* endpoints
CLAUDE.md                               this file
```

---

## Pages

### `index.html` — public dashboard

A single-file HTML/JS app. Everything below lives inside it unless noted.

**Auth flow on load**

- Body starts with classes `dashboard-hidden gated`. The gate overlay is the only thing visible until the password gate clears.
- `bootDashboard()` (intro animation + data render) is held back until either an existing `wcc_gate` cookie verifies via GET `/api/gate`, or the user submits the password via POST. A localStorage hint (`wcc_gate_remember_until`) lets the page skip the gate flash entirely when the user previously checked Remember-me-for-7-days.
- Stadium-flyover intro animates `WORLD CUP HQ` from the centre of the screen into the header brand. The animation targets `.brand > span:not(.beta-badge)` so the landing position lines up with the actual text, not the logo image.

**Live tab**

- **Bookmarks bar** at the top — `★ Pinned` chips for whatever cards the user has starred. Clicking a chip scrolls and flashes the source card. `×` per chip to unpin. Hidden when nothing is pinned.
- **Sentiment heatmap** (volume × sentiment by market). Auto-flashes open ~600ms after first load and collapses again ~1s later (one-time, persisted via `wcc_heatmap_flash_seen_v1`).
- **Filter pills (multi-select).** All / RECENT (last 72h) / Canada / Germany / UK / USA / Game / Culture. Click multiple — items pass with OR semantics. Click `🌐 All` to reset; clicking an active pill again deselects it; falls back to `All` when nothing is selected.
- **News carousel** — `DASHBOARD_DATA.news[]`. Each item has `id, headline, source, timestamp, summary, url, tag`. `tag` is one of `Canada / USA / Germany / UK / Macro / Global` and drives the country filter pills.
- **Social Trends carousel** — `DASHBOARD_DATA.social[]`. Each item has `id, topic, category, volume, sentiment, summary, sampleQuote, quotes[], platforms[], sourceUrl`. `category` is one of `game / food / music / fashion / fandom / memes`.
- **Auto-link entities** — known coach / player / team / venue mentions inside news headlines + summaries and social topics + summaries are wrapped in clickable `.entity-link` spans. Click → drops the entity into the global search box, applies the filter across all surfaces, and switches to Live. Keyboard-accessible (Enter / Space on focus). The list lives in `ENTITY_LIST` in `index.html`.
- **Tab badges (`.whats-new-badge`)** — small gold-red pills next to the tab labels showing items added since the user last visited that tab (per-tab last-visit timestamps in localStorage `wcc_last_tab_visit_v1`). Clearing by clicking the tab.
- **Breaking News ticker** at top + **Fun Fact ticker** at bottom. Items live in `DASHBOARD_DATA.ticker[]` plus the most recent news headlines. Both scroll at the same px/sec (the fact ticker derives its duration from the breaking ticker).

**Fixtures tab (lazy-loaded)**

- `renderMatches()` is NOT called during `init()`; it runs on the first click of the Fixtures tab and caches a flag so subsequent clicks skip the work.
- Three views: Calendar / By Date / Standings. Standings recomputes off the `score` field on each match.
- Filter chips: per-stage dropdown plus a `⏱ Next 24h` toggle that filters to matches kicking off within ~24 hours (with a small grace window for in-progress matches).
- "By Date" view shows a TODAY badge + glowing left guide stripe on today's group.
- Match schema (in `data.js`): `id, date, kickoff, stage, home: {name, code, flag}, away: {name, code, flag}, venue, status, score`. `status` is `"upcoming" | "live" | <anything else = final>`. `score` is `null` until played, then `{home, away}` integers.

**Creative tab (gated)**

- Clicking the Creative pill triggers `/api/creative-gate` modal — a separate password from the dashboard gate. Gate appears only on user click (hash navigation falls back to Live silently). 12-hour session via signed httpOnly cookie. No 7-day remember-me on this gate.
- After unlock: three sub-tabs (⚽ WC Engine / ▶️ YT x Genius / 📺 Fox S2). Asset cards come from two sources merged together:
  - `DASHBOARD_DATA.assets[]` (hardcoded in `data.js`, currently empty)
  - Supabase `creative_assets` table (the live source for MFG Creative Uploads)
- **Sort dropdown** — Newest / Oldest / Live date soonest / Live date latest. Applied across all asset sources.
- **Filter pills** — one per market. Multi-market assets (comma-joined `market` field) appear under each pill they're tagged with.
- **Market pills on cards** — flag emoji + market name, one pill per market the asset is tagged to.
- **Drive cards have a play badge** (▶) on the thumbnail. Clicking opens a fullscreen overlay with `https://drive.google.com/file/d/<id>/preview` in an iframe — videos play inline. X / outside / Esc to close (and clear the iframe so playback stops).
- **Drive thumbnails use a fallback chain.** Primary: `https://lh3.googleusercontent.com/d/<id>=w400` (Google's CDN, more reliable for videos). On error → `https://drive.google.com/thumbnail?id=<id>&sz=w400`. On second error → hide and show a centred ▶ play-icon placeholder.
- **Unlock Upload** button no longer opens an inline modal. It redirects to `mfg.html#mfg-creative` where uploads actually happen.

**Floating UI (always visible)**

- **Gemini button** — bottom-right, opens a slide-in panel that calls `POST /api/gemini`. Mode-aware system prompt (Live Dashboard vs MFG mode), brand-safe (refuses politics / war / religion / explicit / harassment, redirects off-topic asks to a WC angle), and bullet-only (3–5 bullets default, no prose paragraphs). Three randomized prepopulated chips above the input. Animated three-dot iMessage-style typing indicator while waiting. Sticky-bottom autoscroll.
- **Coach mark** — first-visit tooltip pointing at the Gemini button. Dismissed via × / clicking the button / 12s timeout. Persists dismissal in localStorage `wcc_gemini_coach_dismissed_v1`.
- **Floating countdown pill** at the top-centre — drag to reposition (position persisted to localStorage `wcc_countdown_pos_v1`). Shows days/hours/minutes to kickoff. Lives in `countdown.js`.
- **Keyboard shortcuts overlay** — press `?` to toggle a card listing 1/2/3 (tabs), G (Gemini), Cmd+K (search), Esc, ?.

### `mfg.html` — MFG production cockpit

Password-gated by `/api/mfg-gate` (env var `GATE_PASSWORD` — same single password as the dashboard and Creative gates; separate cookie). 7-day session cookie. Two-tab layout:

- **🧯 Global Triage** — drag-and-drop kanban-style board for tracking work across markets. Auto-grouping by tag (creative / strategy / **macro** / activation / media / production / talent / partnerships / legal / else) with per-tag colours. Snapshots saved to Supabase `mfg_triage_snapshots` and `mfg_triage` tables. Snapshot history panel is collapsed by default. **Item delete is soft** — a 5-second toast shows an `Undo` button; clicking it splices the item back into its original position.
- **🎬 Creative Uploads** — form for posting Drive-hosted creative assets to the public Creative tab. Files are NOT uploaded to Supabase — only the link is stored. Form fields:
  - **Markets** (multi-select, required) — Canada / USA / Germany / UK / Global. Stored comma-joined.
  - **Bento** (single-select, optional) — `BENTO 1: Long/Results/16` / `BENTO 2: Query/Result/Query/23` / `BENTO 3: Query/Query/16` / `ELSE`.
  - **Title** (optional) — auto-generated as `Creative — <markets>` if blank (the `headline` column is NOT NULL).
  - **Live-from + Live-until** date range (optional).
  - **Channel** (optional, defaults `IG`) — IG / TT / YT / FB / X / DOOH / ELSE.
  - **Drive link** (required) — extracts file id via regex on common patterns (`/file/d/<id>`, `?id=<id>`, `/d/<id>`).
  - Submits go live immediately on the public Creative tab.
- **Recent uploads** grid (last 12) and **All uploads** archive (up to 500) below the form.
- **Sort dropdown** above Recent — Newest / Oldest / Live soonest / Live latest. Applies to both grids.
- **Search filter** above All — debounced text match across title / market / channel / bento / uploaded_by.
- **Hover-armed delete** on every card — `×` arms ("Delete?") for 3 seconds, second click deletes from Supabase + both grids + the public Creative tab.

### `formation.html` — Today's Reactive

Per-market daily briefing surface, reached from the **Today's Reactive** red pill at the top of the Live tab on `index.html`. The pill opens a market chooser modal (Canada / UK / Germany / USA). Only Canada is enabled — the other three render with a `Soon` tag and are disabled until briefings exist.

- Inherits the dashboard `wcc_gate` cookie. On load `formation.html` calls `GET /api/gate`; if it doesn't return `{ ok: true }`, the page redirects to `/` (no separate password). Body starts with class `gated` and a `Verifying access…` overlay; the page renders only after the gate check resolves.
- Routing is via the `?market=<key>` query param. Defaults to `ca` if missing or unknown. Each market's data lives in `window.FORMATION_DATA[<key>]` (see `formation-data.js`). If the market key has no data, `formation.html` bounces back to `/`.
- Layout: hero ("Today's reactive."), then **Today's intelligence** (two side-by-side briefings — Cultural Conversation Reader + Match Event Reader, each with three spike cards, a watchlist accordion, and IP flags), then **Today's plays** (three storyboards rendered as iPhone-style Reels mockups, click the right side of the phone to advance frames, ←/→ keys also work).
- Spike cards open a detail modal with volume / sentiment / tone stats + signal / context / representative voice / curiosity hook.

**`formation-data.js` shape** — one entry per market key:
```js
window.FORMATION_DATA = {
  ca: {
    formation: { date, market, window },
    cultural:  { agentName, agentId: "ccr", flag, watermark, headline, spikes[], watchlist[], flags[] },
    match:     { agentName, agentId: "mer", flag, watermark, headline, spikes[], watchlist[], flags[] },
    storyboards: [{ number, title, revised, sourceSignal, sourceDetail, audienceCut, bucket, prompt, whyPrompt, ipCheck, beats[] }, ...]
  },
  uk:  null,  // disabled in market chooser
  de:  null,
  usa: null,
};
```

Spike: `{ title, type, signal, context, voice, hook?, volume, sentiment, tone: "positive" | "neutral" | "caution" }`. Storyboard beat names should contain "intro" / "prompt" / "result" / (anything else → "payoff") — drives the frame styling.

To enable UK / DE / USA, populate the matching key with the same shape and remove the `disabled` attribute from the corresponding `.market-card` button in `index.html`.

---

## Serverless functions (`api/`)

### `api/gemini.js`

Proxies POSTs to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, injecting the `GEMINI_API_KEY` env var.

**Auth paths (any of):**

1. **Browser (default)** — `Origin` / `Referer` header check against `ALLOWED_ORIGINS`.
2. **Server-to-server** — `x-mfg-server-secret` header (timing-safe compared to `SERVER_API_SECRET`). Skip the origin check.

**Rate limiting:**

- Per-user (cookie `wcc_uid`, issued on first request) for browser callers; per-IP for server-to-server callers.
- Optional Upstash Redis backing via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (REST API, no npm dep). Survives cold starts and is shared across all serverless instances. Falls back to an in-memory `Map` if env vars aren't set.
- Limit: 20 req / 60 sec.

**Streaming:**

- `?stream=1` query param activates SSE pass-through to Gemini's `streamGenerateContent` endpoint. Forwards `event: delta` chunks plus a final `event: done` carrying `finishReason` + `groundingChunks` + the full aggregated text.
- **Currently unused by clients** — Vercel's Node serverless functions buffer responses by default, so streaming wasn't reliable. Both panels now call the non-streaming JSON path. The streaming code stays in place for a future Edge-runtime upgrade.

Body cap: 256 KB. `maxDuration: 60`.

### `api/gate.js`

Dashboard password gate.

- `POST /api/gate` with `{ password, remember }` — verifies against `GATE_PASSWORD` (constant-time compare). On success sets `wcc_gate=<base64url(expiry)>.<base64url(hmac)>` cookie. TTL is 8h or 7d depending on `remember`.
- `GET /api/gate` — verifies the cookie and returns `{ ok }`.
- `DELETE /api/gate` — clears the cookie.

### `api/creative-gate.js`

Creative-tab view gate. Same shape as `gate.js`, now reads the same `GATE_PASSWORD` (consolidated single password), but uses a separate cookie `wcc_creative_view`. 12-hour session only (no 7-day option). The dashboard skips the page-load cookie pre-check and only opens the modal on a real Creative-tab click.

### `api/mfg-gate.js`

MFG-mode password gate. Same shape, reads the same `GATE_PASSWORD` (consolidated single password). Cookie `wcc_mfg_gate`, 7-day session.

### `api/health.js`

Liveness probe.

- `GET /api/health` returns `{ ok, time, env: { ... booleans only ... }, upstream }`.
- `?upstream=1` adds a one-shot Gemini ping with status + latency. Use sparingly — counts against quota.

---

## Static JS files

### `data.js`

Defines `window.DASHBOARD_DATA = { lastUpdated, ticker, news, social, matches, assets }`. Loaded synchronously at the top of `<body>` in `index.html` before the inline init script. **All daily content refreshes edit this file.**

### `countdown.js`

Self-contained floating pill. Auto-injects on load. Counts down to `Date.UTC(2026, 5, 11, 18, 0, 0)` in days/hours/minutes (no seconds — ticks every 30s). Drag with mouse or touch; position persisted to localStorage `wcc_countdown_pos_v1`. Init wrapped in `requestIdleCallback` so it doesn't block first paint. Wired on both `index.html` and `mfg.html`.

### `gemini-assistant.js`

Shared Gemini panel logic. URL-based mode detection (`mfg.html` → MFG mode; otherwise → Dashboard mode). Two paths:

- If `#geminiPanel` exists (the dashboard already has its own inline panel) → only inject prepopulated chips above its input field.
- Otherwise (MFG mode) → inject the full button + slide-in panel + chips.

Mode-aware system instruction. Three randomized chips per session (out of a 5-prompt pool per mode). Sticky-bottom autoscroll while messages append. Init wrapped in `requestIdleCallback`. Three-dot animated typing indicator.

---

## Supabase

Project: `https://ypisjfefbccgtxesteja.supabase.co`. Only the publishable key ships client-side; service-role keys never leave Vercel env.

Tables in use:

- **`mfg_triage`** — single row keyed by `id='global'`, jsonb data column. Live state of the Triage board. See `supabase-mfg-triage.sql`.
- **`mfg_triage_snapshots`** — saved snapshots. See same SQL file.
- **`dashboard_updates`** — Daily Update history (legacy from a removed tab). See `supabase-dashboard-updates.sql`.
- **`creative_assets`** — Creative tab uploads. Original columns: `id, headline (NOT NULL), market, format, status, deploy_date, subtab, kind, youtube_url, image_url, uploaded_by, created_at`. Extensions added by the MFG Creative Uploads tab:
  - `drive_url`, `drive_file_id` (`supabase-creative-assets-extend.sql`)
  - `live_end_date`, `channel` (same migration)
  - `bento` (`supabase-creative-assets-bento.sql`)
  - `kind_check` constraint accepts `'youtube'`, `'image'`, or `'drive'` (`supabase-creative-assets-kind.sql`).

Row-level security is permissive on every table — the app-level password gates are the actual access control.

When changing schema, write a new `supabase-<topic>.sql` file at the repo root and tell the user to run it in the Supabase SQL editor. Use `if not exists` / `drop constraint if exists` so migrations are idempotent.

**Important: uploads persist across code deploys.** Data lives in Supabase, not in the codebase. The only delete paths are user-triggered (the `×` button on a Creative card and the Triage snapshot delete). Pushing new HTML / JS never touches `creative_assets` rows. Don't add automated DELETE / TRUNCATE on this table for any reason — even refresh routines.

---

## Vercel config

`vercel.json` — only contains rewrites for the five `/api/*` endpoints. Static-file behavior is the Vercel default.

**Required env vars on Vercel:**

| Variable | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `api/gemini.js` | Google AI Studio API key the proxy uses. |
| `GATE_PASSWORD` | `api/gate.js`, `api/creative-gate.js`, `api/mfg-gate.js` | Single password used by all three gates. Each gate uses its own cookie name so the sessions stay independent. |
| `ALLOWED_ORIGINS` | `api/gemini.js` | Comma-separated browser-Origin / Referer allowlist. |
| `SERVER_API_SECRET` | `api/gemini.js` | Server-to-server bypass header (`x-mfg-server-secret`). |
| `UPSTASH_REDIS_REST_URL` | `api/gemini.js` (optional) | Upstash REST URL for persistent rate-limit. Falls back to in-memory. |
| `UPSTASH_REDIS_REST_TOKEN` | `api/gemini.js` (optional) | Upstash REST token. |

The legacy `CREATIVE_KEY`, `MFG_KEY`, and `MFG_MODE_PASSWORD` env vars are no longer read by the code. Safe to delete from Vercel; safe to leave (ignored).

Deployment Protection: previously enabled, **currently OFF on Production** (the dashboard's own gate is the access control). The `Protection Bypass for Automation` token from when we tried to use the Vercel proxy from a remote agent is harmless to leave or delete.

---

## The "refresh everything" workflow

A scheduled remote agent was set up at one point to auto-refresh content via Gemini-via-Vercel-proxy. It's currently **disabled** because Vercel's edge consistently returned `403 host_not_allowed` for the Anthropic cloud agent's IP range. The owner does refreshes manually in chat instead.

When the user types **"refresh everything"** (or "refresh content" / "do the daily" / "pull fresh news"):

- Search the web AND Reddit (r/soccer, r/worldcup, team-specific subs) for the past 24–48h of WC2026 news, fan reactions, and cultural moments. Reddit is a first-class source, not an afterthought.
- Edit `data.js` (the `window.DASHBOARD_DATA` object lives there now):
  - `news[]` — prepend ~5–10 items, each with the right `tag` (Canada / USA / Germany / UK / Macro / Global).
  - `social[]` — prepend ~5 items, each with the right `category`, `volume`, `sentiment`, AND a non-empty `platforms` array (mandatory — the renderer crashes if it's missing — see footguns below).
  - `ticker[]` — prepend ~5 items.
  - Trim items older than ~14 days.
  - Bump `lastUpdated`.
- **During the tournament window (June 11 – July 19, 2026)**, also update `DASHBOARD_DATA.matches[]`:
  - For every match played in the past 24h, find by `date` + teams, set `status` to a non-`"upcoming"` value, set `score: { home, away }`. Standings recompute automatically.
  - For matches in progress: `status: "live"` plus current score.
  - Don't touch matches that haven't kicked off.
- **Never touch `creative_assets` or `DASHBOARD_DATA.assets`** during a refresh — those are user-managed.
- Sanity-check the file parses (`node --check`).
- Commit and push to `main`.

---

## Conventions / footguns

- **No build step.** Edit HTML / JS / data files directly. Push to `main` to deploy.
- **Data lives in `data.js`, not `index.html`.** Refreshes edit `data.js` exclusively.
- **Don't run prettier as part of normal task flow** — owner has a memory rule. Only run when explicitly asked.
- **End every coding response with a plain-English bullet summary** of what changed (memory rule).
- **News tags MUST be one of** `Canada / USA / Germany / UK / Macro / Global`. Anything else won't surface under the filter pills.
- **Social items MUST include** `platforms: ['X' | 'TikTok' | 'IG' | 'Reddit', ...]` — the renderer's `s.platforms.map(...)` throws otherwise. There's now a defensive validator in `renderSocial` that auto-rebuilds `platforms` from `quotes[].platform` if missing, otherwise drops the item with a console warning. But the right move is still to ship every social item with `platforms` populated.
- **Multi-market creative assets** are stored as comma-joined strings in `creative_assets.market` (e.g. `"Canada,USA"`). Filter logic splits on commas so the asset surfaces under each market's pill.
- **Drive thumbnail fallback chain** for creative cards: `lh3.googleusercontent.com/d/<id>=w400` → `drive.google.com/thumbnail?id=<id>&sz=w400` → ▶ play-icon placeholder. The lh3 endpoint is more reliable than the legacy `/thumbnail` for videos.
- **Drive files must be set to "Anyone with the link can view"** for the iframe preview and the share link to work for non-MFG clients. The form copy reminds the uploader.
- **Body of `index.html` starts with classes `dashboard-hidden gated`.** Removing `gated` after auth runs `bootDashboard()` which kicks off the intro animation + data render. Don't render anything before the gate clears.
- **Emoji choices matter.** Avoid `🏴󠁧󠁢󠁥󠁮󠁧󠁿` (subdivision-flag tag — renders as a black flag or boxes on many systems) — use `🦁` for England football decoratively. Avoid `🌍` as a generic "world" badge — pick a more specific topical emoji (`⚽ 🏟️ 🎟️ 💰 📋 🩼 🛂 🌱 🏆`). Match-data team flag fields are intentional and stay as actual flags. The pages also load `Apple Color Emoji / Segoe UI Emoji / Noto Color Emoji / Twemoji Mozilla` after the Oswald font so flag glyphs render in colour.
- **`console.log` is no-op'd in prod.** A shim at the top of both pages silences it unless `?debug=1` is in the URL. `console.warn` / `console.error` still ship.
- The countdown pill ticks every 30s (no seconds segment).
- `BETA v2.x` badge in the header — bump it on meaningful releases.
- **Streaming Gemini** is implemented server-side but unused client-side. To turn it on, switch the `api/gemini.js` function to Vercel's Edge runtime (the Node runtime buffers responses and breaks streaming).
