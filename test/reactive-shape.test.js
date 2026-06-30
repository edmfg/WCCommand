// Regression test for the "publish doesn't show on the dashboard" bug.
//
// Root cause: api/reactive-convert.js emitted storyboards with `beats[]` and
// NO `footage`. social.html's override drops any payload whose storyboards
// fail `isNewShape` (which requires `footage` + `prompt`). So every published
// reactive was silently ignored and the bundled defaults stayed on screen.
//
// Run: node test/reactive-shape.test.js   (exit 0 = pass, 1 = fail)

const assert = require("assert");
const { normalizePayload } = require("../api/_reactive-shape.js");

// EXACT copy of the predicate in social.html (the override's gate). Keep in
// sync — this is the contract the normalizer must satisfy.
function isNewShape(sb) {
  return (
    sb &&
    typeof sb === "object" &&
    typeof sb.footage === "string" &&
    Array.isArray(sb.prompts) &&
    sb.prompts.length > 0 &&
    sb.prompts.every((p) => p && typeof p.text === "string")
  );
}

// A representative Gemini response (storyboards + spikes), deliberately MISSING
// footage/sentiment/tone to mimic real upstream output.
const geminiRaw = {
  formation: { date: "June 1, 2026", window: "Last 24h" },
  cultural: {
    headline: "Squad-lock day energy.",
    spikes: [
      { title: "Roster reveal", type: "Pride", signal: "spike", context: "ctx", voice: "let's go", volume: 40 },
      { title: "Anthem talk", type: "Culture", signal: "spike", context: "ctx", voice: "goosebumps", volume: 22 },
    ],
  },
  match: {
    headline: "Fitness watch.",
    spikes: [
      { title: "Davies fitness", type: "Match", signal: "spike", context: "ctx", voice: "play him", volume: 30 },
    ],
  },
  storyboards: [
    {
      number: "01",
      title: "The Reveal",
      unmetNeed: "I want to feel like the roster is mine too.",
      prompts: [
        { key: "A", type: "Observational", text: "what makes a roster feel national" },
        { key: "B", type: "Participatory", text: "help me throw a roster-reveal watch party" },
        { key: "C", type: "Fusion/Planning", text: "fun ways to rank the 26-man squad with friends" },
      ],
      sourceSignal: "Cultural Conversation",
      footage: "Montage of federation graphics dropping.",
      verdict: "Strong Fit.",
    },
    // prompts omitted on purpose — legacy single-prompt upstream output.
    { number: "02", title: "Clean Slate", prompt: "How do appeals work?", sourceSignal: "Match Event" }, // footage omitted on purpose
    { number: "03", title: "On the Lake", prompt: "BMO Field secret?", sourceSignal: "Cultural Conversation", footage: "Drone over Lake Ontario." },
  ],
};

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("  ✓ " + name);
  } catch (e) {
    failures++;
    console.error("  ✗ " + name + "\n    " + e.message);
  }
}

console.log("normalizePayload → new shape (the fix):");

const payload = normalizePayload(geminiRaw, "Canada", "June 1, 2026");

check("every storyboard passes social.html's isNewShape guard", () => {
  assert(payload.storyboards.length === 3, "expected 3 storyboards");
  payload.storyboards.forEach((sb, i) =>
    assert(isNewShape(sb), `storyboard[${i}] failed isNewShape (footage="${sb.footage}", prompts=${JSON.stringify(sb.prompts)})`),
  );
});

check("a storyboard with footage omitted upstream still gets a footage string", () => {
  assert(typeof payload.storyboards[1].footage === "string" && payload.storyboards[1].footage.length > 0);
});

check("A/B/C prompts survive with keys + types intact", () => {
  const ps = payload.storyboards[0].prompts;
  assert(ps.length === 3, "expected 3 prompts, got " + ps.length);
  assert.deepStrictEqual(ps.map((p) => p.key), ["A", "B", "C"]);
  assert.deepStrictEqual(
    ps.map((p) => p.type),
    ["Observational", "Participatory", "Fusion/Planning"],
  );
});

check("legacy single-prompt storyboard becomes a one-prompt cycle", () => {
  const sb = payload.storyboards[1]; // prompts omitted upstream
  assert(sb.prompts.length === 1, "expected 1 fallback prompt");
  assert(sb.prompts[0].key === "A" && sb.prompts[0].text === "How do appeals work?");
});

check("legacy `prompt` field stays in lock-step with prompts[0]", () => {
  payload.storyboards.forEach((sb, i) =>
    assert(sb.prompt === sb.prompts[0].text, `storyboard[${i}].prompt drifted from prompts[0].text`),
  );
});

check("unmetNeed + optional verdict pass through; verdict omitted when absent", () => {
  assert(payload.storyboards[0].unmetNeed === "I want to feel like the roster is mine too.");
  assert(payload.storyboards[0].verdict === "Strong Fit.");
  assert(!("verdict" in payload.storyboards[1]), "empty verdict should be omitted");
});

check("spikes carry sentiment (int) + tone (enum) so the view isn't undefined%", () => {
  const all = [...payload.cultural.spikes, ...payload.match.spikes];
  all.forEach((s, i) => {
    assert(Number.isInteger(s.sentiment), `spike[${i}].sentiment not an int`);
    assert(["positive", "neutral", "caution"].includes(s.tone), `spike[${i}].tone invalid: ${s.tone}`);
  });
});

check("ipCheck status is lowercase (matches renderer CSS)", () => {
  payload.storyboards.forEach((sb) =>
    assert(["clear", "watch", "block"].includes(sb.ipCheck.status), `bad ip status ${sb.ipCheck.status}`),
  );
});

check("no storyboard carries the legacy beats[] field", () => {
  payload.storyboards.forEach((sb) => assert(!("beats" in sb), "beats[] should be gone"));
});

// Document the original bug: the OLD-shape storyboard (beats, no footage) is
// exactly what isNewShape rejects.
console.log("\nregression guard — the OLD shape must fail isNewShape:");
check("old-shape storyboard (beats, no footage) is rejected", () => {
  const oldShape = { number: "01", title: "x", prompt: "y", beats: [{ name: "Hook" }] };
  assert(isNewShape(oldShape) === false, "old shape unexpectedly passed — the bug guard is wrong");
});

// ── quotes[] + sources[] (citations) ──
console.log("\nspike citations — quotes[] + sources[]:");
const citePayload = normalizePayload(
  {
    cultural: {
      headline: "h",
      spikes: [
        {
          title: "Poutine wars",
          voice: "lead quote",
          quotes: [
            { text: "Quebec poutine is the only real one", platform: "X", url: "https://x.com/a/1" },
            { text: "Ontario gravy is watery", platform: "TikTok", url: "javascript:alert(1)" }, // must be stripped
            { text: "" }, // empty → dropped
          ],
          sources: [
            { label: "r/canada", url: "https://reddit.com/r/canada" },
            "TSN", // bare string → {label}
            { label: "evil", url: "data:text/html,x" }, // url stripped, label kept
          ],
        },
      ],
    },
  },
  "Canada",
  "June 1, 2026",
);
const cspike = citePayload.cultural.spikes[0];

check("quotes are normalized to {text,platform,url} and empties dropped", () => {
  assert(cspike.quotes.length === 2, "expected 2 quotes, got " + cspike.quotes.length);
  assert(cspike.quotes[0].text === "Quebec poutine is the only real one");
  assert(cspike.quotes[0].platform === "X");
});

check("non-http(s) quote/source URLs are sanitized to empty", () => {
  assert(cspike.quotes[1].url === "", "javascript: URL should be stripped");
  const evil = cspike.sources.find((s) => s.label === "evil");
  assert(evil && evil.url === "", "data: URL should be stripped");
});

check("valid http(s) links survive", () => {
  assert(cspike.quotes[0].url === "https://x.com/a/1");
  assert(cspike.sources.find((s) => s.label === "r/canada").url === "https://reddit.com/r/canada");
});

check("bare-string sources become {label}", () => {
  assert(cspike.sources.some((s) => s.label === "TSN" && s.url === ""));
});

check("when no quotes given, the lead voice seeds quotes[]", () => {
  const sp = payload.cultural.spikes[0]; // from earlier geminiRaw (voice only)
  assert(sp.quotes.length >= 1 && sp.quotes[0].text === sp.voice);
});

// ── assetElevations (the "03 · Elevations" lanes) ──
// Regression: api/reactive-convert.js never asked Gemini for assetElevations and
// normalizePayload dropped the field entirely, so every published row lacked it.
// social.html then kept showing the hardcoded bundle defaults indefinitely.
console.log("\nasset elevations — assetElevations[] lanes:");
const elevPayload = normalizePayload(
  {
    cultural: { headline: "h", spikes: [] },
    storyboards: [],
    assetElevations: [
      {
        lane: "fan",
        momentum: true,
        prompt: "why do portuguese fans twirl their scarves during corner kicks",
        rationale: "Top pick — Eustáquio's heritage is the narrative spike.",
      },
      {
        lane: "GAME", // case-insensitive
        prompt: "how can I put a fun canadian twist on a croatian dish?",
        rationale: "Rides the diaspora-food conversation.",
      },
      {
        // lane omitted → defaults to fan; momentum falsey → omitted
        prompt: "why do Canadian fans take shots of maple syrup before a game",
        rationale: "Homegrown-identity angle.",
        momentum: false,
      },
      { prompt: "", rationale: "no prompt → dropped" }, // dropped
      "garbage", // non-object → dropped
    ],
  },
  "Canada",
  "June 30, 2026",
);

check("assetElevations is present and drops empty/garbage items", () => {
  assert(Array.isArray(elevPayload.assetElevations), "assetElevations missing");
  assert.strictEqual(elevPayload.assetElevations.length, 3);
});

check("prompt + rationale are carried through verbatim, in source order", () => {
  assert.strictEqual(
    elevPayload.assetElevations[0].prompt,
    "why do portuguese fans twirl their scarves during corner kicks",
  );
  assert.strictEqual(
    elevPayload.assetElevations[0].rationale,
    "Top pick — Eustáquio's heritage is the narrative spike.",
  );
});

check("lane normalizes to 'fan' | 'game' (case-insensitive, defaults fan)", () => {
  assert.strictEqual(elevPayload.assetElevations[0].lane, "fan");
  assert.strictEqual(elevPayload.assetElevations[1].lane, "game");
  assert.strictEqual(elevPayload.assetElevations[2].lane, "fan"); // omitted → fan
});

check("momentum only set when truthy; otherwise the key is omitted", () => {
  assert.strictEqual(elevPayload.assetElevations[0].momentum, true);
  assert(!("momentum" in elevPayload.assetElevations[1]), "no momentum key when absent");
  assert(!("momentum" in elevPayload.assetElevations[2]), "no momentum key when false");
});

check("no assetElevations in input → key omitted (bundle fallback preserved)", () => {
  // `payload` (from geminiRaw at the top) had no assetElevations.
  assert(
    !("assetElevations" in payload),
    "assetElevations must be omitted when the input has none, so social.html keeps the bundle",
  );
});

check("an empty assetElevations array also omits the key", () => {
  const empty = normalizePayload(
    { cultural: { spikes: [] }, storyboards: [], assetElevations: [] },
    "Canada",
    "June 30, 2026",
  );
  assert(!("assetElevations" in empty), "empty array should omit the key, not wipe the bundle");
});

if (failures) {
  console.error("\n" + failures + " check(s) FAILED");
  process.exit(1);
}
console.log("\nAll checks passed.");
