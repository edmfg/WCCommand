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

if (failures) {
  console.error("\n" + failures + " check(s) FAILED");
  process.exit(1);
}
console.log("\nAll checks passed.");
