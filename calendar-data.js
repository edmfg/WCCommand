// Per-market content calendar. Sourced from the MM Calendar View PDF.
// Rows are channels (Social Ad #1..#13, Digital OOH #1..#2). Entries span a
// date range and carry a phase + type + prompt.
//
// Date range: 2026-06-04 (Thu) → 2026-07-19 (Sun) = 46 days.
//
// Tournament phases for header banding:
//   lead-up    Jun 4 – Jun 10
//   group      Jun 11 – Jun 27
//   r32        Jun 28 – Jul 3
//   r16        Jul 4  – Jul 7
//   rest       Jul 8
//   qf         Jul 9  – Jul 11
//   rest       Jul 12 – Jul 13
//   sf         Jul 14 – Jul 15
//   rest       Jul 16 – Jul 18
//   final      Jul 19
//
// Canada Group F matches:
//   Jun 12 (Fri): CA vs Bosnia @ BMO Field, Toronto
//   Jun 18 (Thu): CA vs Qatar  @ BC Place, Vancouver
//   Jun 24 (Wed): CA vs Switzerland @ BC Place, Vancouver
//
// Per note [1] on the PDF: CA-match creatives run for 1 week and launch
// (in most cases) at least 2 days before each match.
// Per note [2]: first Reactive ads are planned to be ready for paid
// promotion on July 2.

window.CALENDAR_DATA = {
  ca: {
    market: "Canada",
    flag: "🇨🇦",
    lastUpdated: "2026-05-11T22:30:00Z",
    dateStart: "2026-06-04",
    dateEnd: "2026-07-19",
    phases: [
      { name: "Lead Up Phase", start: "2026-06-04", end: "2026-06-10", key: "lead-up" },
      { name: "Group Stage Phase", start: "2026-06-11", end: "2026-06-27", key: "group" },
      { name: "Round of 32", start: "2026-06-28", end: "2026-07-03", key: "r32" },
      { name: "Round of 16", start: "2026-07-04", end: "2026-07-07", key: "r16" },
      { name: "Rest Day", start: "2026-07-08", end: "2026-07-08", key: "rest" },
      { name: "Quarterfinals", start: "2026-07-09", end: "2026-07-11", key: "qf" },
      { name: "Rest Days", start: "2026-07-12", end: "2026-07-13", key: "rest" },
      { name: "Semifinals", start: "2026-07-14", end: "2026-07-15", key: "sf" },
      { name: "Rest Days", start: "2026-07-16", end: "2026-07-18", key: "rest" },
      { name: "Finals", start: "2026-07-19", end: "2026-07-19", key: "final" }
    ],
    rows: [
      {
        channel: "Social Ad #1",
        entries: [
          { start: "2026-06-04", end: "2026-06-10", phase: "lead-up", type: "fandom",
            label: "Fandom (Soccer/CA/General) #1",
            prompt: "why do some people call soccer the 'universal language'" },
          { start: "2026-06-16", end: "2026-06-22", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #5: Germany/Ivory Coast",
            prompt: "what are some easy ivorian street foods i can make for a watch party" },
          { start: "2026-06-26", end: "2026-07-02", phase: "group", type: "fandom", tbd: true,
            label: "Fandom (Soccer/CA/General) #10",
            prompt: "TBD as results change" },
          { start: "2026-07-04", end: "2026-07-07", phase: "r16", type: "game-altering", tbd: true,
            label: "Game Altering Moments #1",
            prompt: "TBD as results change" },
          { start: "2026-07-09", end: "2026-07-11", phase: "qf", type: "game-altering", tbd: true,
            label: "Game Altering Moments #3",
            prompt: "TBD as results change" },
          { start: "2026-07-19", end: "2026-07-19", phase: "final", type: "reactive", tbd: true,
            label: "Reactive Ad #11",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #2",
        entries: [
          { start: "2026-06-04", end: "2026-06-10", phase: "lead-up", type: "fandom",
            label: "Fandom (Soccer/CA/General) #2",
            prompt: "how do soccer players train to play in climates different than their home countries" },
          { start: "2026-06-17", end: "2026-06-23", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #6: NZ/Egypt",
            prompt: "why do egypt fans bring giant golden trumpets to soccer matches" },
          { start: "2026-06-26", end: "2026-07-02", phase: "group", type: "fandom", tbd: true,
            label: "Fandom (Soccer/CA/General) #11",
            prompt: "TBD as results change" },
          { start: "2026-07-04", end: "2026-07-07", phase: "r16", type: "game-altering", tbd: true,
            label: "Game Altering Moments #2",
            prompt: "TBD as results change" },
          { start: "2026-07-09", end: "2026-07-11", phase: "qf", type: "game-altering", tbd: true,
            label: "Game Altering Moments #4",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #3",
        entries: [
          { start: "2026-06-04", end: "2026-06-10", phase: "lead-up", type: "fandom",
            label: "Fandom (Soccer/CA/General) #3",
            prompt: "is there any science to support that superstitions actually help soccer teams win" },
          { start: "2026-06-14", end: "2026-06-20", phase: "group", type: "fandom",
            label: "Fandom (Soccer/CA/General) #7",
            prompt: "how do strikers jump so high to win headers, can i learn how" },
          { start: "2026-06-28", end: "2026-07-03", phase: "r32", type: "cultural-through", tbd: true,
            label: "Cultural (made it through) #1",
            prompt: "TBD as results change" },
          { start: "2026-07-04", end: "2026-07-07", phase: "r16", type: "cultural-through", tbd: true,
            label: "Cultural (made it through) #3",
            prompt: "TBD as results change" },
          { start: "2026-07-09", end: "2026-07-11", phase: "qf", type: "cultural-through", tbd: true,
            label: "Cultural (made it through) #5",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #4",
        entries: [
          { start: "2026-06-04", end: "2026-06-10", phase: "lead-up", type: "cultural-match",
            label: "Cultural (match in CA): CA/Bosnia",
            prompt: "what are some traditional watch party foods i can make with a bosnian flair" },
          { start: "2026-06-15", end: "2026-06-21", phase: "group", type: "fandom",
            label: "Fandom (Soccer/CA/General) #8",
            prompt: "why do some soccer fans stop shaving for the length of the tournament" },
          { start: "2026-06-28", end: "2026-07-03", phase: "r32", type: "cultural-through", tbd: true,
            label: "Cultural (made it through) #2",
            prompt: "TBD as results change" },
          { start: "2026-07-04", end: "2026-07-07", phase: "r16", type: "cultural-through", tbd: true,
            label: "Cultural (made it through) #4",
            prompt: "TBD as results change" },
          { start: "2026-07-09", end: "2026-07-11", phase: "qf", type: "cultural-through", tbd: true,
            label: "Cultural (made it through) #6",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #5",
        entries: [
          { start: "2026-06-10", end: "2026-06-16", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #1: CA/Bosnia",
            prompt: "why do bosnian soccer fans play accordions outside the stadium",
            note: "Launches 2 days before CA's June 12 opener vs Bosnia. Runs 1 week." },
          { start: "2026-06-18", end: "2026-06-24", phase: "group", type: "fandom",
            label: "Fandom (Soccer/CA/General) #9",
            prompt: "since the goalie can pick up the ball, why don't they always pick it up" },
          { start: "2026-06-26", end: "2026-07-02", phase: "group", type: "either", tbd: true,
            label: "Cultural (match in CA & made it through) #1 or Fandom (Soccer/CA/General) #12",
            prompt: "TBD as results change" },
          { start: "2026-07-04", end: "2026-07-07", phase: "r16", type: "reactive", tbd: true,
            label: "Reactive Ad #3",
            prompt: "TBD as results change" },
          { start: "2026-07-09", end: "2026-07-11", phase: "qf", type: "reactive", tbd: true,
            label: "Reactive Ad #5",
            prompt: "TBD as results change" },
          { start: "2026-07-14", end: "2026-07-15", phase: "sf", type: "reactive", tbd: true,
            label: "Reactive Ad #7",
            prompt: "TBD as results change" },
          { start: "2026-07-19", end: "2026-07-19", phase: "final", type: "reactive", tbd: true,
            label: "Reactive Ad #9",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #6",
        entries: [
          { start: "2026-06-12", end: "2026-06-18", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #2: Australia/Turkey",
            prompt: "why is an australian meatpie also called a pocket warmer" },
          { start: "2026-06-19", end: "2026-06-25", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #7: Panama/Croatia",
            prompt: "why do panama fans eat bowls of hot soup at soccer games" },
          { start: "2026-06-26", end: "2026-07-02", phase: "group", type: "either", tbd: true,
            label: "Cultural (match in CA & made it through) #2 or Fandom (Soccer/CA/General) #13",
            prompt: "TBD as results change" },
          { start: "2026-07-04", end: "2026-07-07", phase: "r16", type: "reactive", tbd: true,
            label: "Reactive Ad #4",
            prompt: "TBD as results change" },
          { start: "2026-07-09", end: "2026-07-11", phase: "qf", type: "reactive", tbd: true,
            label: "Reactive Ad #6",
            prompt: "TBD as results change" },
          { start: "2026-07-14", end: "2026-07-15", phase: "sf", type: "reactive", tbd: true,
            label: "Reactive Ad #8",
            prompt: "TBD as results change" },
          { start: "2026-07-19", end: "2026-07-19", phase: "final", type: "reactive", tbd: true,
            label: "Reactive Ad #10",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #7",
        entries: [
          { start: "2026-06-08", end: "2026-06-14", phase: "lead-up", type: "cultural-match",
            label: "Cultural (match in CA): Multiple",
            prompt: "why do Canadian fans take shots of maple syrup before a game" },
          { start: "2026-06-28", end: "2026-07-03", phase: "r32", type: "either", tbd: true,
            label: "Cultural (match in CA & made it through) #3",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #8",
        entries: [
          { start: "2026-06-15", end: "2026-06-21", phase: "group", type: "fandom",
            label: "Fandom (Soccer/CA/General) #6",
            prompt: "help me learn how to kick a ball like a pro, so it curves and dips in mid-air" },
          { start: "2026-07-02", end: "2026-07-03", phase: "r32", type: "reactive", tbd: true,
            label: "Reactive Ad #1",
            prompt: "TBD as results change",
            note: "Per plan, first reactive ads ready for paid promotion July 2." }
        ]
      },
      {
        channel: "Social Ad #9",
        entries: [
          { start: "2026-06-18", end: "2026-06-24", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #3: Ghana/Panama",
            prompt: "what do the specific patterns on the robes worn by ghanaian soccer fans mean" },
          { start: "2026-07-02", end: "2026-07-03", phase: "r32", type: "reactive", tbd: true,
            label: "Reactive Ad #2",
            prompt: "TBD as results change" }
        ]
      },
      {
        channel: "Social Ad #10",
        entries: [
          { start: "2026-06-16", end: "2026-06-22", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #4: CA/Qatar",
            prompt: "why do men perform with swords on the sidelines during qatari matches",
            note: "Launches 2 days before CA vs Qatar on June 18. Runs 1 week." }
        ]
      },
      {
        channel: "Social Ad #11",
        entries: [
          { start: "2026-06-22", end: "2026-06-28", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #8: CA/Switzerland",
            prompt: "why do swiss soccer fans always think stadiums could use more cowbell",
            note: "Launches 2 days before CA vs Switzerland on June 24. Runs 1 week." }
        ]
      },
      {
        channel: "Social Ad #12",
        entries: [
          { start: "2026-06-17", end: "2026-06-23", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #9: NZ/Belgium",
            prompt: "what are the main moves of the new zealand haka dance" }
        ]
      },
      {
        channel: "Social Ad #13",
        entries: [
          { start: "2026-06-20", end: "2026-06-26", phase: "group", type: "cultural-match",
            label: "Cultural (match in CA) #10: Senegal/Iraq",
            prompt: "whats the symbolism of the fast leg-kicking dance that senegalese fans do" }
        ]
      },
      {
        channel: "Digital OOH #1 — Sankofa Square",
        entries: [
          { start: "2026-06-04", end: "2026-06-10", phase: "lead-up", type: "dooh",
            label: "DOOH #1",
            prompt: "why do some people call soccer the 'universal language'" },
          { start: "2026-06-11", end: "2026-06-20", phase: "group", type: "dooh",
            label: "DOOH #2",
            prompt: "why do Canadian fans take shots of maple syrup before a game" },
          { start: "2026-06-21", end: "2026-07-07", phase: "group", type: "dooh",
            label: "DOOH #3",
            prompt: "is there any science to support that superstitions actually help soccer teams win" }
        ]
      },
      {
        channel: "Digital OOH #2 — Atrium",
        entries: []
      }
    ]
  },
  usa: null,
  uk:  null,
  de:  null
};
