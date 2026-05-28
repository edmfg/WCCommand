// ============================================================================
//  FORMATION DATA — per-market daily briefings for the Today's Reactive surface.
//
//  Edit this file each morning. formation.html reads window.FORMATION_DATA[market]
//  based on the ?market= query param (defaults to ca).
//
//  Each market entry contains:
//    formation        { date, market, window }
//    cultural         briefing { agentName, agentId, flag, watermark, headline, spikes[], watchlist[], flags[] }
//    match            briefing (same shape)
//    storyboards[]    storyboard { number, title, revised, sourceSignal, sourceDetail, audienceCut, bucket, prompt, whyPrompt, ipCheck, beats[] }
//
//  Brazil / DE / USA are intentionally null — the market chooser disables them
//  until briefings are wired up. Add the same shape as `ca` to enable.
// ============================================================================

window.FORMATION_DATA = {
  ca: {
    formation: {
      date: "May 6, 2026",
      market: "Canada",
      window: "Last 24h",
    },
    cultural: {
      agentName: "Cultural Conversation Reader",
      agentId: "ccr",
      flag: "🇨🇦",
      watermark: "01",
      headline:
        "Diaspora pride and localized kit fashion define the 2026 countdown as Montreal and Vancouver solidify distinct cultural identities.",
      spikes: [
        {
          title: "The “Grenadiers” Glow-Up in Montreal",
          type: "Cultural Pride",
          signal:
            "Volume up sharply, with “Haitian Culture” accounting for 16% of hot topics and maintaining a 92% sentiment score.",
          context:
            "A viral piece of digital art by Lyne Lucien, featured by FOX Soccer, has triggered a massive wave of pride within the Haitian diaspora in Quebec — celebrating the community's integral role in Montreal's cultural fabric.",
          voice:
            "Haitian diaspora is such an integral component of Montreal culture; this needs to be a season-long show.",
          volume: 16,
          sentiment: 92,
          tone: "positive",
        },
        {
          title: "Vancouver “After Dark” Kit Fever",
          type: "Kit Fashion",
          signal:
            "“Jersey” is the top keyword (48% of mentions) with a 3x baseline spike in Vancouver-specific fashion conversation over the last 12 hours.",
          context:
            "The “Vancouver Rise 2026 After Dark” jersey has entered “Best Kit” brackets, coinciding with high engagement around packed local theaters and merch sell-outs.",
          voice:
            "The merch flew again… the energy, the love, the way you all showed up was unforgettable.",
          volume: 48,
          sentiment: 86,
          tone: "positive",
        },
        {
          title: "Moroccan Diaspora Travel Mapping",
          type: "Diaspora Mobilization",
          signal:
            "Massive emoji usage (🇲🇦 at 18.4%) and “Coupe du Monde” keywords (40.7%) trending among Canadian-Moroccan accounts.",
          context:
            "Following the announcement of Morocco's training base in New Jersey, Canadian fans are already mapping out cross-border travel plans and “base camp” watch parties.",
          voice:
            "The FRMF chose an elite base; the diaspora is ready to show up for the Atlas Lions across the border.",
          volume: 40,
          sentiment: 88,
          tone: "positive",
        },
      ],
      watchlist: [
        {
          title: "Poutine Staples",
          note: "Growing interest in “Comptoir Poutine” and the perfecting of Montreal street food specifically for match-day hosting.",
        },
        {
          title: "Toronto's “Transplant” Divide",
          note: "Early-stage debates regarding whether Toronto's fan zones will be dominated by “overachieving transplants” or “legacy families.”",
        },
        {
          title: "Draft Lottery Superstitions",
          note: "Fans are starting to link NHL lottery luck (Canucks/Leafs) to their cities' general “sporting energy” ahead of the World Cup.",
        },
      ],
      flags: [
        {
          tag: "Brand IP",
          color: "amber",
          note: "High engagement with “Vancouver Rise” and “Puma King” kits; ensure campaign creative avoids direct replication of these trademarked designs.",
        },
        {
          tag: "Sensitive Territory",
          color: "red",
          note: "Avoid the “immigrant gang” and “extortion crime” discourse appearing in localized Toronto/Edmonton threads — politically charged and violates the campaign's neutral-to-positive filter.",
        },
        {
          tag: "Player IP",
          color: "blue",
          note: "Discussion of the “McKenna” jersey in Vancouver involves personal fan sentiment — exercise caution with name-and-likeness in user-generated content features.",
        },
      ],
    },
    match: {
      agentName: "Match Event Reader",
      agentId: "mer",
      flag: "🇨🇦",
      watermark: "02",
      headline:
        "The Trionda match-ball reveal marks the 40-day countdown — generating significant fan excitement and fresh discussion around host-nation pride.",
      spikes: [
        {
          title: "The “Trionda” Unveiling",
          type: "Equipment Reveal",
          signal:
            "High interest (10% of total volume) with a 70% sentiment value. Significant visual engagement across social platforms following Adidas's reveal of the official match ball.",
          context:
            "Adidas unveiled the Trionda (Tri-wave), the official ball for the 2026 FIFA World Cup. The four-panel wave structure represents the host trio (Canada, Mexico, USA). Canadian fans are specifically latching onto the “host soil” narrative.",
          voice:
            "The thermal-bonded design looks sleek, but the wave patterns finally make the 2026 tournament feel like it's actually arriving on our home soil.",
          hook: "Will the unique four-panel “wave” design create unpredictable flight paths for keepers like Crepeau at BMO Field?",
          volume: 10,
          sentiment: 70,
          tone: "positive",
        },
        {
          title: "“Gaucho” at BMO Field (Nostalgia Spike)",
          type: "Venue / Nostalgia",
          signal:
            "Peak sentiment spike (90% positive). Massive engagement regarding venue atmosphere and “legend” status.",
          context:
            "Announcement of Ronaldinho playing at BMO Field for a Brazil Legends vs. Toronto FC Legends clash on May 8. This has hijacked the local conversation, blending TFC history with World Cup fever.",
          voice:
            "Seeing Ronaldinho at BMO is the perfect appetizer for the World Cup. The atmosphere in Toronto is finally reaching a boiling point.",
          hook: "Can the “Legends” energy translate into ticket momentum for the younger generation of Voyageurs this summer?",
          volume: 18,
          sentiment: 90,
          tone: "positive",
        },
        {
          title: "The 40-Day Countdown & Logo Backlash",
          type: "Countdown",
          signal:
            "Volume spike (35% of hot topics). High emotion (Joy/Optimism) mixed with aesthetic criticism.",
          context:
            "Today marks the sub-40-day countdown to the World Cup. While excitement is high, a secondary spike of “design criticism” has emerged with fans mocking the official logo's simplicity.",
          voice:
            "I can't believe this is the logo we're stuck with; it looks like it was made in Paint. But J-37… we are almost there!",
          hook: "Will the “ugly logo” become a meme that defines the fan-made kit and merch for the Voyageurs this summer?",
          volume: 35,
          sentiment: 58,
          tone: "neutral",
        },
      ],
      watchlist: [
        {
          title: "CanChamp Fever",
          note: "Jonathan Osorio and Richie Laryea trending in Southern Ontario as fans discuss the importance of the TELUS Canadian Championship to the domestic game.",
        },
        {
          title: "BC Place Logistics",
          note: "Discussions regarding end-zone lengths and venue modifications at BC Place and BMO Field surfacing among “stadium nerds” and long-time fans.",
        },
        {
          title: "The “Italy” Hypothetical",
          note: "Nostalgic conversation about the massive Italian population in Ontario and what an Italy vs. Canada match would have done to the streets of Little Italy.",
        },
      ],
      flags: [
        {
          tag: "Likeness",
          color: "amber",
          note: "High usage of Ronaldinho's likeness in unofficial promotional “hype” edits.",
        },
        {
          tag: "Trademarks",
          color: "amber",
          note: "Rapidly increasing use of the Adidas “Trionda” name and “FIFA World Cup” official marks in fan-generated content; monitor for brand infringement in digital ads.",
        },
        {
          tag: "Sensitivity",
          color: "red",
          note: "Minor fan frustration (though low volume) regarding FIFA's meeting with the Iranian Federation in Zurich; ensure ad placement avoids political commentary threads.",
        },
      ],
    },
    storyboards: [
      {
        number: "01",
        title: "The Art of Pride",
        revised: true,
        sourceSignal: "Cultural Conversation",
        sourceDetail: "Viral Haitian digital art in Quebec",
        audienceCut: "Diaspora Fan",
        bucket: "Cultural Pride + Team Lore",
        prompt:
          "What's the story behind the Haitian pride art I'm seeing all over Montreal for the World Cup?",
        whyPrompt:
          "Connects a specific, emotional digital trend to a real-world community — showing how fandom is expressed beyond the stadium.",
        ipCheck: {
          status: "clear",
          note: "Avoids naming the specific artist or artwork. Visuals will be authentic and licensed.",
        },
        beats: [
          {
            name: "Intro Sequence",
            body: "Quick cuts of vibrant Montreal street scenes, murals, and people wearing soccer jerseys of various nations — focusing on the blue and red of the Haitian flag.",
          },
          {
            name: "Initial Prompt",
            body: "The prompt is typed over a shot of a phone screen, with a colourful, abstract piece of digital art glowing on it, held up against a backdrop of a bustling Montreal market.",
          },
          {
            name: "Results",
            body: "AI Mode returns a visually rich result — a carousel of images showing the original artwork, user-generated content inspired by it, and a map highlighting Haitian community hubs in Montreal, with text explaining the symbolism in the art.",
          },
          {
            name: "Visual Payoff",
            body: "A montage of commissioned, licensed work from Haitian-Canadian artists — showing them creating their art and celebrating in their communities.",
          },
        ],
      },
      {
        number: "02",
        title: "Speaking the Local Game",
        revised: true,
        sourceSignal: "Cultural Conversation",
        sourceDetail: "Debate on Quebecois vs. Parisian French",
        audienceCut: "Bandwagon Fan",
        bucket: "Soccer Fandom + Canadian Fan Preparedness",
        prompt:
          "I'm heading to Toronto for the game. What are the key 'Les Rouges' chants I need to know in French and English?",
        whyPrompt:
          "Relatable, slightly vulnerable prompt that turns a divisive linguistic debate into a practical tool for inclusion and participation.",
        ipCheck: {
          status: "clear",
          note: "No specific team or player names are used. Focus is on the general fan experience.",
        },
        beats: [
          {
            name: "Intro Sequence",
            body: "A first-person POV shot of someone packing a suitcase with a Quebec flag and a red jersey.",
          },
          {
            name: "Initial Prompt",
            body: "The prompt is typed over a shot of a train ticket from Montreal to Toronto.",
          },
          {
            name: "Results",
            body: "AI Mode generates a clean, useful list — a few key Quebecois fan chants, with phonetic spellings and simple English translations, and a small audio clip icon next to each.",
          },
          {
            name: "Visual Payoff",
            body: "A sequence of shots showing the fan arriving in Toronto, meeting up with other fans at the Fan Festival, and confidently joining in the chants.",
          },
        ],
      },
      {
        number: "03",
        title: "Decoding the Ball",
        revised: false,
        sourceSignal: "Match Event",
        sourceDetail: "Unveiling of the Trionda match ball",
        audienceCut: "Core Fan",
        bucket: "Predictions & Reactions",
        prompt:
          "Why does the new World Cup ball have those weird little dimples and ridges all over it?",
        whyPrompt:
          "Takes a major piece of tournament news and flips it to a childlike, tactile curiosity — making complex aerodynamics feel accessible.",
        ipCheck: {
          status: "clear",
          note: "Avoids the official name “Trionda” and focuses on the generic physical characteristics of a new ball.",
        },
        beats: [
          {
            name: "Intro Sequence",
            body: "Slow-motion, detailed macro shots of a soccer ball spinning. We see the texture, the seams, the panels.",
          },
          {
            name: "Initial Prompt",
            body: "The prompt is typed over a shot of a new, unbranded soccer ball with a unique texture sitting on pristine grass in the centre circle of an empty stadium.",
          },
          {
            name: "Results",
            body: "AI Mode delivers a breakdown with diagrams. It shows how the texture affects airflow — comparing it to a golf ball and explaining concepts like “knuckleball effect” and “true flight” with simple animations.",
          },
          {
            name: "Visual Payoff",
            body: "A dynamic montage created with Veo/Gemini — an animated visualization of wind flowing over the textured ball, contrasted with a smooth ball, followed by a shot of a ball curving perfectly into the top corner of a goal in a generic, non-IP stadium.",
          },
        ],
      },
    ],
  },

  brazil: null,
  de: null,
  usa: null,
};
