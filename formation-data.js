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
      date: "May 28, 2026",
      market: "Canada",
      window: "Last 24h",
    },
    cultural: {
      agentName: "Cultural Conversation Reader",
      agentId: "ccr",
      flag: "🇨🇦",
      watermark: "01",
      headline:
        "Diaspora communities are driving the cultural conversation — fusing music, fashion, and national pride ahead of the World Cup.",
      spikes: [
        {
          title: "Drake × Canada Soccer Kit Fusion",
          type: "Kit Fashion",
          signal:
            "Sudden, high-velocity X (Twitter) spike around a potential Drake × Canada Soccer collaboration on the 2026 World Cup kits.",
          context:
            "The integration of homegrown streetwear aesthetic with national sports identity has electrified local fans, who see the crossover as the ultimate cultural fusion.",
          voice:
            "The crossover between Canadian music, streetwear, and football is getting insane — having Drake design for the World Cup is the ultimate cultural fusion.",
          volume: 38,
          sentiment: 85,
          tone: "positive",
        },
        {
          title: "Francophone Diaspora Anthems & Base-Camp Pride",
          type: "Cultural Pride",
          signal:
            "Massive surge in volume across Francophone Canadian channels, driven by Montreal's large Haitian and West African diaspora communities.",
          context:
            "Following announcements that Senegal and Haiti are establishing nearby training camps, major cultural music drops have resonated deeply — diaspora fans are scripting a “home tournament” feel for Montreal.",
          voice:
            "These anthems bring our deep cultural heritage straight to the pitch — the diaspora in Montreal is going to make this feel like a home tournament.",
          volume: 42,
          sentiment: 91,
          tone: "positive",
        },
        {
          title: "African Kit Aesthetics as Premium Streetwear",
          type: "Kit Aesthetics",
          signal:
            "Reveal of new kits for the DRC Leopards and Nigeria has shifted the conversation from athletic wear to high-fashion appreciation.",
          context:
            "High engagement and emotional aesthetic appreciation — fans are celebrating the jerseys as “pure wearable art” that puts culture “right in your face rather than playing it safe.”",
          voice:
            "Pure wearable art — right in your face rather than playing it safe.",
          volume: 28,
          sentiment: 88,
          tone: "positive",
        },
      ],
      flags: [
        {
          tag: "Sensitive Territory",
          color: "red",
          note: "FIFA ticket-pricing investigation — NY and NJ prosecutors have issued subpoenas regarding “unprecedented” ticket pricing. Avoid referencing ticket availability, pricing, or official purchasing channels in campaign creative.",
        },
        {
          tag: "Player IP",
          color: "amber",
          note: "Diaspora selection drama — high-tension debates around player exclusions are dividing diaspora communities. Avoid framing campaigns around specific national-team squad selections that trigger this friction.",
        },
      ],
    },
    match: {
      agentName: "Match Event Reader",
      agentId: "mer",
      flag: "🇨🇦",
      watermark: "02",
      headline:
        "A multi-sport crossover dominates — a 4–0 hockey rout of the US ignites national pride and reshapes expectations for Canada's June 12 opener.",
      spikes: [
        {
          title: "Moïse Bombito's “100%” Fitness Declaration",
          type: "Player Narrative",
          signal:
            "Twitter/X, high magnitude, positive trajectory — hot-topic volume up 20% in early hours, sustaining 85–90% optimistic sentiment across the 24-hour cycle.",
          context:
            "After missing eight months with a broken leg, defender Moïse Bombito declared himself “100%” ready for Canada's June 12 opener against Bosnia and Herzegovina in an interview with Kristian Jack on TSN. The declaration injected confidence into tactical discussion of Jesse Marsch's defensive structure — even as reports surface that Bombito, Ali Ahmed, and Richie Laryea are on managed training loads in the 32-degree Charlotte heat.",
          voice:
            "Seeing Bombito back and declaring himself 100% is the absolute physical boost we needed — he is the prototype CB for a Jesse Marsch high-pressing system.",
          hook: "Will Bombito's aggressive recovery timeline pay off, or will the heat-management protocols in North Carolina force Marsch to hold his star defender back until the final whistle?",
          volume: 20,
          sentiment: 87,
          tone: "positive",
        },
        {
          title: "Estadio Vancouver Rebrand & BMO Field's Digital Debut",
          type: "Venue & Atmosphere",
          signal:
            "Twitter/X and Reddit, moderate magnitude, upward growth — content count change factor +1.2 at 16:00 UTC on May 28.",
          context:
            "Double-wave venue spike: BC Place was officially rebranded to “Estadio Vancouver” for the tournament, immediately followed by the viral announcement that Toronto's BMO Field is launching in EA Sports FC 26's upcoming World Cup update. Supporters are fiercely correcting users who mislabel BMO Field as “BMO Stadium,” asserting the distinct local identity of the Toronto landmark.",
          voice:
            "BMO Field finally getting its proper rebrand in EAFC makes this home-soil tournament feel incredibly real — time to win the World Cup in our own backyard.",
          hook: "Can a virtual stadium rendering spark a real-world ticket rush as fans scramble to see Les Rouges play in the concrete versions of their favorite digital arenas?",
          volume: 22,
          sentiment: 78,
          tone: "positive",
        },
        {
          title: "The 4–0 USA Shutout Sparking Soccer Rivalry",
          type: "Multi-Sport Crossover",
          signal:
            "Twitter/X, massive magnitude, peak positive sentiment — sentiment value hit 100 at 17:00 UTC on May 28.",
          context:
            "Canada's dominant 4–0 hockey victory over the United States in the IIHF World Championship quarterfinals ignited intense national pride. Soccer fans immediately hijacked the celebration to draw comparisons to upcoming soccer matchups, demanding that the Men's National Team bring that exact clinical, “no-mercy” energy to the pitch when facing regional Concacaf rivals.",
          voice:
            "We just absolutely embarrassed the US on ice — now it's time to do the same on turf. Canada is becoming a multi-sport powerhouse.",
          hook: "How will this wave of anti-USA sporting bravado translate to digital fan engagement when the soccer tournament officially kicks off on home soil?",
          volume: 48,
          sentiment: 100,
          tone: "positive",
        },
        {
          title: "Vancouver Fan Festival Ticket Price Backlash",
          type: "Supporter Group Activity",
          signal:
            "Twitter/X, moderate magnitude, negative/anxious direction — sentiment value dropped to 30 on May 27 at 21:00 UTC under the “World Cup Ticket Pricing” trend.",
          context:
            "Members of #LesRouges and general Canadian soccer supporters are voicing intense frustration with ticket pricing. While Vancouver's FIFA Fan Festival is largely free to enter, fans discovered it costs $126.95 to watch the Canada vs. Bosnia match on the big screens at the local Amphitheatre. Supporter groups are actively contrasting this cost against “free” viewings in other host cities, raising concerns about corporate exclusion.",
          voice:
            "Charging fans over $120 just to sit in a park and watch Canada vs. Bosnia on a screen is absolute madness — it completely ruins the organic, working-class supporter culture we are trying to build here.",
          hook: "Will these premium price tags alienate the loud, passionate local supporters needed to fuel the city's tournament atmosphere?",
          volume: 18,
          sentiment: 30,
          tone: "caution",
        },
      ],
      flags: [
        {
          tag: "Sensitive Territory",
          color: "red",
          note: "Public spending vs. housing-crisis backlash — a highly viral, politically charged conversation is developing (sentiment dropped to 0 at 02:00 UTC on May 28 under #cdnpoli) criticizing Canada for spending an estimated $82M per World Cup match while failing to address the national housing crisis.",
        },
        {
          tag: "Sensitive Territory",
          color: "red",
          note: "FIFA ticketing investigations — news that the attorneys general of New York and New Jersey have subpoenaed FIFA over World Cup ticketing practices is fueling domestic anger about Canadian pricing. Keep ticket and price messaging out of campaign creative.",
        },
      ],
    },
    storyboards: [
      {
        number: "01",
        title: "Wearing the Diaspora",
        sourceSignal: "Cultural Conversation",
        sourceDetail:
          "African kit aesthetics as premium streetwear — DRC Leopards reveal",
        audienceCut: "Diaspora Fan",
        bucket: "Cultural Pride + Team Lore",
        prompt:
          "My family is from DR Congo, how can I use the new national team jersey to explain our culture to my Canadian friends?",
        whyPrompt:
          "Transforms a piece of merchandise into a tool for cultural storytelling — taps directly into the “Be a Fan of the World” strategy and the emotional need for connection felt by diaspora communities.",
        ipCheck: {
          status: "clear",
          note: "Prompt avoids the Umbro brand and the official team crest. Execution focuses on abstracted cultural patterns and human connection, not the specific licensed product.",
        },
        footage:
          "Close-ups of vibrant, abstract textile patterns inspired by Congolese art. Quick cuts of a family in a Canadian living room looking at a tablet together, smiling. Shots of bright fabrics and ingredients in a bustling market.",
      },
      {
        number: "02",
        title: "Not Broken Anymore",
        sourceSignal: "Match Event",
        sourceDetail:
          "Moïse Bombito's “100%” fitness declaration on TSN",
        audienceCut: "Core Fan",
        bucket: "Soccer Fandom + Canadian Fan Preparedness",
        prompt:
          "What's the science behind getting a professional soccer player from a broken leg to World Cup ready in just eight months?",
        whyPrompt:
          "Channels the massive fan optimism around a player's comeback into a fascinating, complex question about sports science and human resilience that AI Mode is perfectly suited to answer.",
        ipCheck: {
          status: "clear",
          note: "Prompt is generic and focuses on the science of athletic recovery — no mention of Moïse Bombito, his club, or specific medical details.",
        },
        footage:
          "Stylized, abstract animations of bone and muscle healing. A player doing underwater treadmill training. A physical therapist stretching an athlete's leg. A shot of a pristine, empty soccer pitch at dawn.",
      },
      {
        number: "03",
        title: "Better Than Brooklyn",
        sourceSignal: "Match Event",
        sourceDetail:
          "BMO Field's EA Sports FC 26 debut & supporters defending the Toronto landmark identity",
        audienceCut: "Bandwagon Fan",
        bucket: "Cultural Pride + Team Lore",
        prompt:
          "I'm visiting for a World Cup match, help me plan a food tour of Toronto that proves its immigrant kitchens are better than New York's.",
        whyPrompt:
          "Captures the viral, competitive pride of a city on the global stage and turns it into a fun, multi-layered planning query that expands the mental model of search.",
        ipCheck: {
          status: "clear",
          note: "Prompt avoids naming any specific restaurants or food brands. The comparison to New York is a broad cultural rivalry, not a targeted attack on a specific entity.",
        },
        footage:
          "Mouth-watering, slow-motion shots of diverse street food: a flame-grilled sausage in a bun, steam rising from dumplings, fresh toppings being added to a taco. Quick cuts of vibrant, multicultural Toronto neighborhoods.",
      },
    ],
  },

  brazil: null,
  de: null,
  usa: null,
};
