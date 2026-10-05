// Server events. A new event rolls every few minutes (see worldclock.js),
// and tokens/bots can start extra ones. Effects use the same format as
// items: { stat: { mult } }. `at` restricts the strong effects to shores
// with a tag (or the rift's shore); `enableMods` lets modifiers spawn that
// normally can't; `modMult` multiplies modifier chances; `tierMult`
// multiplies tier odds.

export const EVENTS = [
  {
    id: 'meteor', name: 'Meteor Shower', color: '#ff80ab', icon: 'meteor', weight: 14, dur: 210,
    desc: '2× Luck everywhere, 3× Meteor Shards, Starforged minerals can fall from the sky.',
    effects: { luck: { mult: 2 } }, shardMult: 3,
    enableMods: { starforged: 1 / 150 },
  },
  {
    id: 'rapids', name: 'River Rapids', color: '#4fc3f7', icon: 'wave', weight: 10, dur: 210,
    desc: '1.5× items per pan on river shores. 1.15× everywhere else.',
    effects: { items: { mult: 1.15 } }, at: { tag: 'river', effects: { items: { mult: 1.5 } } },
  },
  {
    id: 'solar', name: 'Solar Flare', color: '#ffb300', icon: 'sun', weight: 10, dur: 210,
    desc: '1.5× size and 2× modifiers. Scorching minerals appear on every shore.',
    effects: { sizeBoost: { mult: 1.5 }, modBoost: { mult: 2 } },
    enableMods: { scorching: 1 / 50 },
  },
  {
    id: 'blizzard', name: 'Blizzard', color: '#b3e5fc', icon: 'snow', weight: 7, dur: 210,
    desc: 'Frozen minerals everywhere. Snowy shores get 1.5× Luck and 1.5× items.',
    enableMods: { frozen: 1 / 50 }, modMult: { frozen: 3 },
    at: { tag: 'snow', effects: { luck: { mult: 1.5 }, items: { mult: 1.5 } } },
  },
  {
    id: 'eruption', name: 'Volcanic Eruption', color: '#ff5722', icon: 'flame', weight: 7, dur: 210,
    desc: 'Scorching minerals everywhere. Volcanic shores get 2× size and 1.5× items.',
    enableMods: { scorching: 1 / 60 },
    at: { tag: 'volcanic', effects: { sizeBoost: { mult: 2 }, items: { mult: 1.5 } } },
  },
  {
    id: 'rift', name: 'Mythic Rift', color: '#ff4f8b', icon: 'rift', weight: 8, dur: 210,
    desc: 'A rift tears open at one shore: 5× Mythic+ odds and Voidtorn minerals there.',
    rift: true,
    at: { rift: true, tierMult: { mythic: 5, exotic: 5, celestial: 5 }, enableMods: { voidtorn: 1 / 200 } },
  },
  {
    id: 'goldrush', name: 'Gold Rush', color: '#ffd54f', icon: 'coin', weight: 9, dur: 180,
    desc: 'Merchants pay double! 2× sell value for everything.',
    effects: { sellBoost: { mult: 2 } },
  },
  {
    id: 'aurora', name: 'Aurora Night', color: '#64ffda', icon: 'sparkle', weight: 7, dur: 210, night: true,
    desc: 'The sky lights up: 1.25× Luck and 5× Iridescent minerals.',
    effects: { luck: { mult: 1.25 } }, modMult: { iridescent: 5 },
  },
  {
    id: 'storm', name: 'Thunderstorm', color: '#9fa8da', icon: 'bolt', weight: 8, dur: 210,
    desc: 'Mud slows digging (-15% Dig Speed) but lightning charges minerals: Electrified + 1.2× items.',
    effects: { digSpeed: { mult: 0.85 }, items: { mult: 1.2 } },
    enableMods: { electrified: 1 / 30 }, mixed: true,
  },
  {
    id: 'fog', name: 'Spectral Fog', color: '#b0bec5', icon: 'eye', weight: 5, dur: 180,
    desc: 'Hard to see (-20% Luck)… but Cursed minerals are 4× more common.',
    effects: { luck: { mult: 0.8 } }, modMult: { cursed: 4 }, mixed: true,
  },
  {
    id: 'drought', name: 'Drought', color: '#d7a26b', icon: 'sun', weight: 5, dur: 180,
    desc: 'Low water (-25% items) exposes old riverbeds: Ancient minerals everywhere.',
    effects: { items: { mult: 0.75 } }, enableMods: { ancient: 1 / 80 }, mixed: true,
  },
  {
    id: 'blessing', name: "Prospector's Blessing", color: '#fff176', icon: 'star', weight: 2.5, dur: 120,
    desc: 'The old prospectors smile on you: 3× Luck!',
    effects: { luck: { mult: 3 } },
  },
  {
    id: 'convergence', name: 'Celestial Convergence', color: '#ffffff', icon: 'crown', weight: 0.8, dur: 180,
    desc: 'The heavens align: 5× Luck and Celestial minerals can appear on any shore.',
    effects: { luck: { mult: 5 } }, celestial: true, tierMult: { celestial: 10 },
  },
];

export const EVENT = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const QUIET_WEIGHT = 9; // chance of a calm slot with no event
