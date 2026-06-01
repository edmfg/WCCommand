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
    typeof sb.prompt === "string"
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
    { number: "01", title: "The Reveal", prompt: "What makes a roster feel national?", sourceSignal: "Cultural Conversation", footage: "Montage of federation graphics dropping." },
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
    assert(isNewShape(sb), `storyboard[${i}] failed isNewShape (footage="${sb.footage}", prompt="${sb.prompt}")`),
  );
});

check("a storyboard with footage omitted upstream still gets a footage string", () => {
  assert(typeof payload.storyboards[1].footage === "string" && payload.storyboards[1].footage.length > 0);
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

if (failures) {
  console.error("\n" + failures + " check(s) FAILED");
  process.exit(1);
}
console.log("\nAll checks passed.");
