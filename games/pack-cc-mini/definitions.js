/**
 * Story nodes: id -> { title, text, art (emoji scene), choices: [{ text, next, req?, effect? }] }
 * effect: { hp?, gold?, item?, flag? }
 */

/** @typedef {{ text: string; next: string; req?: { flag?: string; item?: string; gold?: number }; effect?: { hp?: number; maxHp?: number; gold?: number; item?: string; removeItem?: string; setFlag?: string; clearFlag?: string } }} Choice */

/** @typedef {{ title: string; text: string; art: string; choices: Choice[] }} NodeDef */

/** @type {Record<string, NodeDef>} */
const NODES = {
  title: {
    title: "Luminara",
    art: "✦",
    text: "A short role-play adventure for brave readers 12+. Your choices shape the story—save often.",
    choices: [{ text: "Begin the tale", next: "prologue" }],
  },
  prologue: {
    title: "Aurora Grove",
    art: "🌲",
    text: "Moon-touched mist coils between silver trees. A broken compass lies at your feet, needle spinning. Far ahead: warm lantern light to the east, and cold blue ruins to the north.",
    choices: [
      {
        text: "Follow the lanterns (cautious)",
        next: "village_gate",
        effect: { setFlag: "path_village" },
      },
      {
        text: "Brave the ruins (bold)",
        next: "ruins_steps",
        effect: { setFlag: "path_ruins" },
      },
      {
        text: "Search the grove for supplies",
        next: "grove_search",
      },
    ],
  },
  crossroads: {
    title: "Aurora Grove",
    art: "🌲",
    text: "The silver trees whisper. Lanterns glimmer east; pale ruins shimmer north.",
    choices: [
      {
        text: "Follow the lanterns",
        next: "village_gate",
        effect: { setFlag: "path_village" },
      },
      {
        text: "Brave the ruins",
        next: "ruins_steps",
        effect: { setFlag: "path_ruins" },
      },
      {
        text: "Search the undergrowth again",
        next: "grove_search",
        req: { blockedByFlag: "grove_looted" },
      },
    ],
  },
  grove_search: {
    title: "Hidden cache",
    art: "🎒",
    text: "Under mossy roots you find a wax-sealed vial glowing faintly. It steadies your nerves.",
    choices: [
      {
        text: "Drink the elixir (+2 max HP)",
        next: "crossroads",
        effect: {
          maxHp: 2,
          hp: 2,
          setFlag: "elixir_used",
          alsoSetFlags: ["grove_looted"],
        },
      },
      {
        text: "Save it for later (keep as item)",
        next: "crossroads",
        effect: { item: "glow_elixir", alsoSetFlags: ["grove_looted"] },
      },
    ],
  },
  village_gate: {
    title: "Whisperfen",
    art: "🏘️",
    text: "Wooden gates part. A guard with a star-embroidered cloak bows. \"Traveler—the Starfall Festival begins at dusk. The mayor offers a reward if you can calm the lights in the old well.\"",
    choices: [
      { text: "Accept the quest", next: "well_quest", effect: { setFlag: "quest_well" } },
      { text: "Visit the market first", next: "market" },
      { text: "Decline and rest at the inn", next: "inn_rest", effect: { gold: 5 } },
    ],
  },
  ruins_steps: {
    title: "Singing stones",
    art: "🪨",
    text: "Stairs of pale crystal hum when you step. Runes flare: \"Offer memory or courage.\" Your shadow stretches unnaturally long.",
    choices: [
      {
        text: "Offer courage (risk HP for relic)",
        next: "ruins_relic",
        effect: { hp: -3, item: "rune_shard" },
      },
      {
        text: "Offer a memory (lose 5 gold worth of supplies)",
        next: "ruins_memory",
        effect: { gold: -5 },
      },
      {
        text: "Step back and return to the grove",
        next: "crossroads",
      },
    ],
  },
  ruins_relic: {
    title: "Shard of First Light",
    art: "💎",
    text: "Pain blooms—then fades. A crystal shard floats into your palm, warm as sunrise. You feel tougher, not weaker.",
    choices: [
      { text: "Head toward the village lights", next: "village_gate", effect: { maxHp: 1, hp: 1 } },
    ],
  },
  ruins_memory: {
    title: "Fading echo",
    art: "🌫️",
    text: "You forget the name of your childhood street—but the runes dim peacefully. A hidden path opens toward the festival.",
    choices: [{ text: "Take the path", next: "festival_night" }],
  },
  market: {
    title: "Starfall Market",
    art: "🎪",
    text: "Stalls sell comet candies and maps drawn on beetle wings. A merchant winks: \"Ten gold for a lucky charm—or trade me something shiny.\"",
    choices: [
      {
        text: "Buy lucky charm (10 gold)",
        next: "market_after",
        req: { gold: 10 },
        effect: { gold: -10, item: "lucky_charm" },
      },
      {
        text: "Trade rune shard",
        next: "market_trade",
        req: { item: "rune_shard" },
        effect: { removeItem: "rune_shard", gold: 25, item: "star_cloak" },
      },
      { text: "Return to the village gate", next: "village_gate" },
      { text: "Go to the old well", next: "well_quest", req: { flag: "quest_well" } },
    ],
  },
  market_after: {
    title: "Charm secured",
    art: "🍀",
    text: "The charm hums against your skin. Crowds part a little easier.",
    choices: [
      { text: "Go to the well", next: "well_quest", req: { flag: "quest_well" } },
      { text: "Return to the village gate", next: "village_gate" },
      { text: "Back to the market", next: "market" },
    ],
  },
  market_trade: {
    title: "A fair deal",
    art: "🧥",
    text: "\"Exquisite!\" The merchant drapes you in a cloak of stitched constellations. You feel lighter, faster, luckier.",
    choices: [
      { text: "To the well", next: "well_quest", req: { flag: "quest_well" } },
      { text: "Explore the festival", next: "festival_night" },
    ],
  },
  inn_rest: {
    title: "The Sleeping Comet",
    art: "🛏️",
    text: "Straw mattresses smell of cinnamon. You dream of flying over rings of light. You wake clear-headed and strong.",
    choices: [{ text: "Return to the village", next: "village_gate", effect: { hp: 5 } }],
  },
  well_quest: {
    title: "The whispering well",
    art: "🕳️",
    text: "Blue motes spiral from the stone rim. A voice bubbles up: \"Three truths I need—one about fear, one about hope, one about you.\"",
    choices: [
      { text: "\"I fear being forgotten.\"", next: "well_riddle", effect: { setFlag: "truth_fear" } },
      { text: "\"I hope the world stays kind.\"", next: "well_riddle", effect: { setFlag: "truth_hope" } },
      { text: "Toss lucky charm (skip a hard truth)", next: "well_skip", req: { item: "lucky_charm" }, effect: { removeItem: "lucky_charm" } },
    ],
  },
  well_riddle: {
    title: "Second truth",
    art: "✨",
    text: "The water stills like glass. \"Good. Now speak of what you will sacrifice for others.\"",
    choices: [
      { text: "Offer 15 gold to the village fund", next: "well_boss", req: { gold: 15 }, effect: { gold: -15, setFlag: "sacrifice_gold" } },
      { text: "Offer 5 of your life force", next: "well_boss", effect: { hp: -5, setFlag: "sacrifice_hp" } },
      {
        text: "Use glow elixir to share its light",
        next: "well_boss",
        req: { item: "glow_elixir" },
        effect: { removeItem: "glow_elixir", setFlag: "sacrifice_elixir" },
      },
    ],
  },
  well_skip: {
    title: "Easier path",
    art: "🌠",
    text: "The charm dissolves into the well in a shower of sparks. The voice laughs kindly. \"Clever soul—you may pass.\"",
    choices: [{ text: "Descend the spiral stairs", next: "well_boss" }],
  },
  well_boss: {
    title: "Heart of the well",
    art: "🌀",
    text: "Below, a knot of shadow and starlight coils—an Echo Beast feeding on stray wishes. It lunges!",
    choices: [{ text: "Stand and fight", next: "combat_echo" }],
  },
  combat_echo: {
    title: "Clash of light",
    art: "⚔️",
    text: "Roll the dice of fate! You need a total of 6+ on 2d6 to win cleanly. Lower still wins if you have star cloak or rune shard bonuses.",
    choices: [
      { text: "Fight!", next: "__combat__" },
    ],
  },
  victory_clean: {
    title: "Echo tamed",
    art: "🌟",
    text: "The beast folds into a harmless constellation that drifts upward. The village cheers. The mayor presses a heavy coin purse into your hands.",
    choices: [
      { text: "Celebrate at the festival", next: "ending_hero", effect: { gold: 40 } },
    ],
  },
  victory_costly: {
    title: "Scarred victory",
    art: "🩹",
    text: "You drive it back, breathless. The well glows steady again—but you will carry this ache awhile.",
    choices: [{ text: "Still—a hero's welcome", next: "ending_hero", effect: { gold: 25, hp: -4 } }],
  },
  defeat_echo: {
    title: "Swallowed spark",
    art: "🌑",
    text: "Darkness floods your senses… If you carried a rune shard, it shatters in a pulse of mercy-light and throws you clear. You wake at the grove edge, shaken but breathing.",
    choices: [{ text: "Rise again", next: "ending_survivor", effect: { removeItem: "rune_shard" } }],
  },
  festival_night: {
    title: "Festival of falling stars",
    art: "🎆",
    text: "Music and paper lanterns fill the square. A storyteller offers you the mic: share a tale of the ruins or the well?",
    choices: [
      { text: "Tale of the ruins (gain fame)", next: "ending_bard", effect: { gold: 15, setFlag: "told_ruins" } },
      { text: "Tale of the well (inspire hope)", next: "ending_bard", effect: { gold: 10, setFlag: "told_well" } },
    ],
  },
  ending_hero: {
    title: "Ending: Star-Touched Hero",
    art: "👑",
    text: "Whisperfen proclaims a new friend of the festival. Somewhere above, the Echo you freed winks like a new star. Play again to see other paths!",
    choices: [{ text: "Play again", next: "__reset__" }],
  },
  ending_survivor: {
    title: "Ending: Quiet Ember",
    art: "🔥",
    text: "Not every legend ends in glory—sometimes survival is enough. You walk on, compass needle finally still.",
    choices: [{ text: "Try another path", next: "__reset__" }],
  },
  ending_bard: {
    title: "Ending: Voice of Luminara",
    art: "📜",
    text: "Crowds toss coins; children mimic your gestures. The world feels a little brighter when stories are shared.",
    choices: [{ text: "Begin anew", next: "__reset__" }],
  },
};

const START_NODE = "title";
const COMBAT_TARGET_SCORE = 6;

window.LuminaraGame = {
  NODES,
  START_NODE,
  COMBAT_TARGET_SCORE,
};
