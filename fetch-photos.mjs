#!/usr/bin/env node
// fetch-photos.mjs — one-shot Pexels downloader for the World Cup Engine bento page.
//
// Reads PEXEL_API from .env.local (gitignored), searches Pexels once per tile,
// downloads the top landscape result into ./images/<name>.jpg, and writes a tiny
// manifest so we know which tiles got a real photo vs. need the color-block fallback.
//
// Run:  node fetch-photos.mjs           (needs PEXEL_API in .env.local)
// Re-run anytime to refresh the imagery.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

// --- load PEXEL_API from .env.local (no dotenv dep) ---------------------------
function loadEnv() {
  for (const file of [".env.local", ".env.prod", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*PEXEL_API\s*=\s*(.*)\s*$/);
      if (m) {
        let v = m[1].trim().replace(/^["']|["']$/g, "");
        if (v) return v;
      }
    }
  }
  return process.env.PEXEL_API || "";
}

const KEY = loadEnv();
if (!KEY) {
  console.error(
    "\n✗ No PEXEL_API value found.\n" +
      "  Put your Pexels key in .env.local (gitignored) like:\n" +
      "    PEXEL_API=your_key_here\n" +
      "  then re-run: node fetch-photos.mjs\n"
  );
  process.exit(1);
}

// --- tile inventory (name → search query), straight from the spec -------------
const TILES = [
  { name: "hero", query: "packed soccer stadium crowd floodlights night", big: true },
  { name: "culture", query: "diverse soccer fans flags faces celebration" },
  { name: "veo", query: "cinematic soccer action slow motion" },
  { name: "gemini", query: "abstract glowing gradient light blue purple" },
  { name: "ocr", query: "phone filming soccer match social media" },
  { name: "agentic", query: "sunrise over empty stadium" },
  { name: "reactive", query: "soccer goal celebration crowd eruption", big: true },
  { name: "dashboard", query: "analytics dashboard screen dark" },
  { name: "halo", query: "data visualization glowing network" },
  { name: "markets", query: "world map glowing connections night" },
  { name: "mbappe", query: "soccer player silhouette stadium lights" },
  { name: "food", query: "argentine asado grilled meat empanadas" },
  { name: "arabic", query: "arabic calligraphy doha qatar skyline" },
];

const OUT_DIR = "images";
mkdirSync(OUT_DIR, { recursive: true });

async function searchOne(query) {
  const url =
    "https://api.pexels.com/v1/search?orientation=landscape&per_page=1&query=" +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`Pexels ${res.status} ${res.statusText}`);
  const json = await res.json();
  const photo = json.photos && json.photos[0];
  if (!photo) return null;
  return {
    src: photo.src.large2x || photo.src.large || photo.src.original,
    credit: `${photo.photographer} / Pexels`,
    photographer_url: photo.photographer_url,
    pexels_url: photo.url,
  };
}

async function download(src, dest) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

const manifest = {};
let ok = 0;
let missing = 0;

for (const tile of TILES) {
  const dest = `${OUT_DIR}/${tile.name}.jpg`;
  try {
    const hit = await searchOne(tile.query);
    if (!hit) {
      console.warn(`• ${tile.name.padEnd(10)} — no result, will use color-block fallback`);
      manifest[tile.name] = { ok: false };
      missing++;
      continue;
    }
    const bytes = await download(hit.src, dest);
    console.log(`✓ ${tile.name.padEnd(10)} — ${(bytes / 1024).toFixed(0)}KB  (${hit.credit})`);
    manifest[tile.name] = {
      ok: true,
      credit: hit.credit,
      photographer_url: hit.photographer_url,
      pexels_url: hit.pexels_url,
    };
    ok++;
    // be polite to the free tier
    await new Promise((r) => setTimeout(r, 250));
  } catch (err) {
    console.warn(`• ${tile.name.padEnd(10)} — ${err.message}, color-block fallback`);
    manifest[tile.name] = { ok: false };
    missing++;
  }
}

writeFileSync(`${OUT_DIR}/credits.json`, JSON.stringify(manifest, null, 2));
console.log(`\nDone. ${ok} photos downloaded, ${missing} fallbacks. Credits → images/credits.json`);
