// ============================================================================
//  FORMATION DATA — per-market daily briefings for the Today's Reactive surface.
//
//  Edit this file each morning. formation.html reads window.FORMATION_DATA[market]
//  based on the ?market= query param (defaults to ca).
//
//  Each market entry contains:
//    formation        { date, market, window }
//    cultural         briefing { agentName, agentId, flag, watermark, headline, spikes[], flags[] }
//    match            briefing (same shape)
//    storyboards[]    storyboard {
//                       number, title, sourceSignal, sourceDetail, audienceCut, bucket,
//                       prompt,        // the daily query — also drives frame 3
//                       whyPrompt,
//                       ipCheck: { status, note },
//                       footage        // creative direction for frame 3's footage popup
//                     }
//
//  Frames 1, 2, 4 are static brand visuals defined in formation.html
//  (STORYBOARD_BEATS). Only frame 3 is data-driven per storyboard.
//
//  Brazil / DE / USA are intentionally null — the market chooser disables them
//  until briefings are wired up. Add the same shape as `ca` to enable.
// ============================================================================

window.FORMATION_DATA = {
  ca: {
    formation: {
      date: "May 29, 2026",
      market: "Canada",
      window: "Last 24h",
    },
    cultural: {
      agentName: "Cultural Conversation Reader",
      agentId: "ccr",
      flag: "🇨🇦",
      watermark: "01",
      headline:
        "A legal investigation into FIFA's 2026 ticket prices is shifting fan conversation from excitement to anger — while localized pride spikes in Montreal and other host cities.",
      spikes: [
        {
          title: "Montreal Playoff Energy & Anthem Harmonization",
          type: "Cultural Pride",
          signal:
            "Volume + positive sentiment spike around the Montreal Canadiens' NHL playoff run, with the in-arena atmosphere — harmonized national anthems and organic crowd chants — at the centre.",
          context:
            "Viral “four-women-harmony” anthem moments and intense crowd chants out of the Bell Centre are being framed by fans as the cultural ceiling Canada can aim for during the World Cup home-soil run.",
          voice:
            "The playoff atmosphere in Montreal is unmatched right now. Hearing four women flawlessly harmonize the national anthem gave me absolute goosebumps, and the crowd chants are incredibly intense.",
          volume: 35,
          sentiment: 92,
          tone: "positive",
        },
        {
          title: "Legal Investigation Into FIFA 2026 Ticket Prices",
          type: "Ticket Pricing",
          signal:
            "Velocity spike around French-language keywords like “coupe du monde” — driven by news of a legal investigation into FIFA's 2026 World Cup ticket pricing.",
          context:
            "Sentiment is angry. Fans in host cities like Toronto and Vancouver are venting frustration about being priced out of what they're calling an “absolute joke” of a tournament ticketing structure.",
          voice:
            "It is about time authorities stepped in. The ticket pricing for the 2026 World Cup is an absolute joke and completely locks out actual football fans.",
          volume: 40,
          sentiment: 18,
          tone: "caution",
        },
        {
          title: "Host City Showcase & Cultural Pride",
          type: "Host City Pride",
          signal:
            "Emergent friendly-rivalry theme between Canadian host cities — Vancouver and Toronto in particular — with high engagement and emoji usage (🇨🇦, 🍵).",
          context:
            "Fans are sharing scenic stadium shots and local cultural anthems to showcase each city's unique vibe. BMO Field's lakeside setting + skyline backdrop is becoming a hero visual.",
          voice:
            "Toronto is going to look stunning during the World Cup. Imagine BMO Field sitting right on the lake with the city skyline behind it — the soccer culture here is going to blow people away.",
          volume: 28,
          sentiment: 88,
          tone: "positive",
        },
      ],
      flags: [
        {
          tag: "Sensitive Territory",
          color: "red",
          note: "Tragic passing of NHL legend Claude Lemieux is driving a significant negative sentiment shift, heavily entangled with the Canadiens, Devils, and Avalanche. Pause any aggressive or “gritty” hockey-related ad creative and avoid any association with this news.",
        },
      ],
    },
    match: {
      agentName: "Match Event Reader",
      agentId: "mer",
      flag: "🇨🇦",
      watermark: "02",
      headline:
        "A standoff between Canada Soccer and Bayern Munich over Alphonso Davies' World Cup fitness dominates a day of otherwise positive news.",
      spikes: [
        {
          title: "Club vs. Country — The Davies / Bayern Battle",
          type: "Club vs. Country",
          signal:
            "High-velocity growth on Twitter/X — 10% of total tournament-related hot topics.",
          context:
            "Manager Jesse Marsch confidently confirmed captain Alphonso Davies will play in the World Cup. Bayern Munich issued a sharp warning claiming they — not Canada Soccer — will make the final call on his recovery timeline. Ignited a passionate “home soil” debate about player autonomy and national pride.",
          voice:
            "Marsch says Phonzie is playing, but Bayern is acting like they own him. He's our captain — they can't lock him in a closet for Canada's biggest moment in history.",
          hook: "Will Bayern actually try to legally block Davies on the eve of the tournament, or will Marsch's diplomatic “Maple Pressing” keep our captain on the pitch?",
          volume: 10,
          sentiment: 55,
          tone: "neutral",
        },
        {
          title: "The Cleared Slate — Buchanan's Appeal Triumph",
          type: "Player Eligibility",
          signal:
            "Explosive positive trajectory on Twitter/X — primary driver behind the day's 90% positive sentiment score.",
          context:
            "Canada Soccer successfully appealed Tajon Buchanan's three-game “violent misconduct” red card. Because he served his suspension during the Tunisia match, he is officially cleared to play against Uzbekistan.",
          voice:
            "Absolute masterclass by Canada Soccer's legal team. Getting Tajon cleared for Uzbekistan completely changes our group stage math — we have a real shot.",
          hook: "What specific evidence did Canada Soccer present to FIFA to get a violent-misconduct red card overturned so quickly?",
          volume: 32,
          sentiment: 90,
          tone: "positive",
        },
        {
          title: "The Defensive Anchor — Moïse Bombito Declares “100% Fitness”",
          type: "Player Narrative",
          signal:
            "#1 Hot Topic of the last 24 hours, capturing 12% of overall conversation volume.",
          context:
            "Center-back Moïse Bombito declared himself 100% fit and ready for the June 12 opener against Bosnia. Analysts and fans note Bombito's recovery is the linchpin of Jesse Marsch's high-energy, high-pressing defensive transition system.",
          voice:
            "Our defense did okay without him, but Bombito is literally built for a Jesse Marsch system. Knowing he's 100% ready for Bosnia is a massive relief.",
          hook: "Can Bombito jump straight into Marsch's high-octane press for a full 90 minutes without risking a re-injury?",
          volume: 12,
          sentiment: 88,
          tone: "positive",
        },
        {
          title: "Digital Home Soil — BMO Field's EA Sports Debut",
          type: "Venue & Digital",
          signal:
            "Steady volume growth across gaming and soccer sub-communities.",
          context:
            "EA Sports FC 26 announced that Toronto's BMO Field (expanded to 45,000 capacity) will be officially included in the upcoming World Cup update. Intense local pride — fans sharing the lakeside venue, the skyline view, and how Toronto's multicultural soccer culture translates both digitally and physically.",
          voice:
            "Playing at BMO Field right on the shore of Lake Ontario with the CN Tower in the background is going to look unreal on global TV and in-game. Toronto is ready.",
          hook: "How will BMO Field's digital likeness compare to the real-world atmosphere when the tournament officially kicks off on June 12?",
          volume: 22,
          sentiment: 82,
          tone: "positive",
        },
      ],
      flags: [
        {
          tag: "Sensitive Territory",
          color: "red",
          note: "Alphonso Davies / Bayern Munich likeness — HIGH risk. Avoid creative that explicitly guarantees Davies' start or mocks club-level medical decisions.",
        },
        {
          tag: "Likeness",
          color: "amber",
          note: "Tajon Buchanan incident imagery — MEDIUM risk. Avoid using any broadcast footage, still images, or direct text references to the physical elbow incident against Iceland.",
        },
        {
          tag: "Trademarks",
          color: "amber",
          note: "EA Sports / FIFA intellectual property — LOW-MEDIUM risk. Do not use “EA Sports FC 26” or “FIFA” trademarks in promotional headlines without proper co-branding clearance.",
        },
      ],
    },
    storyboards: [
      {
        number: "01",
        title: "The Loudest Anthem",
        sourceSignal: "Cultural Conversation",
        sourceDetail:
          "Montreal Playoff Energy & Anthem Harmonization — viral four-women harmony at the Bell Centre",
        audienceCut: "Diaspora Fan",
        bucket: "Cultural Pride + Team Lore",
        prompt:
          "My family came to Canada in the 90s — what role do diaspora communities play in making a national anthem actually feel national?",
        whyPrompt:
          "Channels the viral Montreal anthem-harmony moment into a question about how Canada's diaspora communities literally shape what “home soil” sounds like — inverts the usual outsider framing of diaspora fandom into authorship of the tournament's atmosphere.",
        ipCheck: {
          status: "clear",
          note: "No specific players, songs, or league trademarks. Focuses on cultural ritual and community.",
        },
        footage:
          "Slow montage — community-hall choirs (Filipino, Haitian, Punjabi, Polish), hands on hearts in stadium light, an anthem rehearsal at a Montreal high school. Audio crossfades layered languages resolving into a single chorus.",
      },
      {
        number: "02",
        title: "Clean Slate",
        sourceSignal: "Match Event",
        sourceDetail:
          "Buchanan's appeal triumph — the first violent-misconduct red card overturned this cycle",
        audienceCut: "Core Fan",
        bucket: "Soccer Fandom + Canadian Fan Preparedness",
        prompt:
          "What's the actual standard a national federation has to meet to get a violent-misconduct red card overturned on appeal?",
        whyPrompt:
          "Turns the wave of optimism around the Buchanan clearance into a procedural curiosity question — lets core fans appreciate the legal masterclass without re-litigating the incident itself.",
        ipCheck: {
          status: "clear",
          note: "Avoids the elbow-incident imagery and doesn't name the opponent. Procedural framing on disciplinary process, not the play that triggered it.",
        },
        footage:
          "Animated disciplinary timeline. Close-ups on stamped paperwork, a legal team's whiteboard, redacted match-report excerpts. Final beat: a tactics whiteboard with the full 26-man squad back in play, one name slotted into a starting XI.",
      },
      {
        number: "03",
        title: "On the Lake",
        sourceSignal: "Cultural Conversation + Match Event",
        sourceDetail:
          "Host City Showcase rivalry + BMO Field's lakeside Toronto identity",
        audienceCut: "Bandwagon Fan",
        bucket: "Cultural Pride + Team Lore",
        prompt:
          "I'm flying into Toronto for a match — what's the one detail about BMO Field that locals brag about that no one outside the city knows?",
        whyPrompt:
          "Channels the host-city friendly-rivalry surge into a curiosity-driven question that hands bandwagon fans local talking points and sets up Toronto's lakeside identity as a feature, not just a venue.",
        ipCheck: {
          status: "clear",
          note: "Names BMO Field (the public venue name) but avoids EA Sports / FIFA trademarks and avoids direct host-city comparisons.",
        },
        footage:
          "Drone shot rising from Lake Ontario toward BMO Field with the CN Tower and skyline behind. Cut to ferry commuters watching the stadium light up at sunset. Quick cut to a street-corner sandwich shop's match-day chalkboard. End on the grass field meeting the water.",
      },
    ],
  },

  brazil: null,
  de: null,
  usa: null,
};
