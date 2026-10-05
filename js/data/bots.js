// Name parts and chat lines for the simulated players ("bots") that make
// each server feel busy.

export const NAME_PREFIX = ['', '', '', '', '', 'xX_', 'Its', 'The', 'Mr', 'Lil', 'Big', 'Pro', 'Not', 'iAm', 'Real', 'Super', 'Captain', 'Sir', 'Dr', 'Mega'];
export const NAME_A = [
  'Gold', 'Panny', 'Digger', 'Nugget', 'Rocky', 'Shiny', 'Lucky', 'Sandy', 'Pebble', 'Gem', 'Crystal', 'Ore', 'Miner',
  'Prospect', 'River', 'Creek', 'Dusty', 'Muddy', 'Sparkle', 'Quartz', 'Ruby', 'Opal', 'Jade', 'Nova', 'Shadow', 'Blox',
  'Noob', 'Epic', 'Turbo', 'Cosmic', 'Pixel', 'Frost', 'Blaze', 'Storm', 'Moon', 'Star', 'Void', 'Bacon', 'Toast',
  'Panda', 'Kitty', 'Doggo', 'Ninja', 'Wizard', 'Pirate', 'Cowboy', 'Bandit', 'Ranger', 'Hunter', 'Pickle', 'Nacho',
  'Waffle', 'Mochi', 'Boba', 'Cookie', 'Taco', 'Sushi', 'Biscuit', 'Pumpkin', 'Comet', 'Aurora', 'Glitch', 'Sonic',
];
export const NAME_B = [
  'Hunter', 'Digger', 'King', 'Queen', 'Master', 'Lord', 'Boss', 'Kid', 'Gamer', 'Pro', 'Fan', 'Man', 'Girl', 'Boy',
  'Dude', 'Panner', 'Miner', 'Seeker', 'Finder', 'Grinder', 'Collector', 'Ace', 'Zone', 'Rush', 'Fever', 'Bro', 'Cat',
  'Fox', 'Wolf', 'Bear', 'Dragon', 'Bunny', 'Frog', 'Duck', 'Gaming', 'Plays', 'Builds', 'Vibes',
];
export const NAME_SUFFIX = ['', '', '', '', '_Xx', 'YT', 'TTV', '_RBX', '2', '7', '99', '123', '_alt', 'x', 'xd', '_YT'];

export const SKINS = ['#f5cd30', '#f5cd30', '#ffcc99', '#e8b48a', '#c68642', '#8d5524', '#f1c27d', '#ffdbac', '#a0785a'];
export const SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#3949ab', '#d81b60', '#6d4c41', '#546e7a', '#ffffff', '#212121', '#7cb342', '#f06292', '#26a69a'];
export const PANTS = ['#1565c0', '#263238', '#4e342e', '#37474f', '#5d4037', '#283593', '#1b5e20', '#424242', '#6a1b9a', '#3e2723'];
export const HATS = ['none', 'none', 'cap', 'cap', 'cowboy', 'hardhat', 'beanie', 'tophat', 'headphones', 'bandana', 'wizard', 'crown', 'hair', 'hair', 'hair', 'bucket'];

export const CHAT = {
  greet: ['hi', 'hii', 'hello everyone', 'yo', 'sup', 'hey guys', 'wsg', 'hi :)', 'hello prospectors', 'back again lol', 'heyyy', 'yo whats up'],
  newbie: [
    'how do i get money', 'how do u sell', 'whats the best pan', 'how do i get to fortune river', 'is the plastic pan worth it',
    'how do i get perfect digs', 'whats a sluice', 'wait u can enchant pans?', 'how do you get shards', 'what does luck do',
    'what does capacity do', 'how do i unlock the swamp', 'how rare is painite',
  ],
  tip: [
    'tip: release dig in the gold zone for perfect digs', 'perfect digs = more luck btw', 'sell before ur bag fills up',
    'museum gives perma boosts!!', 'save shards for luck totems', 'gold rush = sell everything rn', 'meteor shower is 2x luck go go',
    "aurorite is for enchanting, don't sell it", 'buy the gas mask before the swamp', 'sluices work while ur offline',
    'craft rings, they stack', 'use potions during events for max luck', 'stand in other ppls totems lol',
    'night time = more moonstones', 'catch the glints while panning for bonus luck', 'perfect streaks boost luck a ton',
    'huge minerals sell for way more', 'heavier minerals give better museum boosts',
  ],
  brag: [
    'just got a {mineral}!!', '{mineral} lets gooo', 'finally a {mineral}', 'omg {mineral}', 'W pan', 'got a huge {mineral} 😭',
    'my luck is insane today', 'YOOO {mineral}', 'second {mineral} today lol', '{mineral} 🤑',
  ],
  complain: [
    'my luck is so bad', '50 pans no rares bruh', 'why is everything pyrite', 'rng hates me', 'bag full again', 'i need more capacity',
    'this grind is real', 'lag?', 'missed the perfect zone again 💀', 'so close to the next pan', 'where are the mythics',
  ],
  event: ['{event} lets gooo', '{event}!!!', 'everyone pan now', 'events are so good', '{event} hype', 'who started the {event} 🙏', 'GO GO GO', 'perfect timing'],
  trade: ['trading {mineral} for shards', 'anyone trading?', 'selling {mineral} cheap jk', 'need {mineral} for crafting', 'lf aurorite', 'lf dragon bone'],
  react: ['GG {player}!', 'no wayyy {player}', 'lucky!!', '{player} share ur luck', 'how?? gg', 'W {player}', '🔥🔥', 'congrats!', 'ggs', 'insane'],
  random: [
    'lol', 'xd', 'brb', 'anyone at {shore}?', '{shore} is so pretty at night', 'how much luck u guys have', 'im at {shore}', 'afk',
    'this game is so relaxing', 'who wants to be friends', 'follow me lol', 'need 1 more for friendship totem',
    'grinding till the next pan', 'i love this game', 'whats everyones fav shore', 'anyone else here since day 1',
    'museum almost full', 'just rebirthed :D', 'my sluice is full lol',
  ],
  totem: ['placed a {totem} at {shore} come!', '{totem} up at {shore}', 'come to {shore} i placed a {totem}'],
  fragment: ['used a meteor fragment, ur welcome', 'METEOR FRAGMENT USED', 'meteor shower on me 😎'],
};

export const REPLIES = [
  { re: /\b(hi+|hey+|hello|yo|sup|hola|wsg)\b/i, lines: ['hi {player}!', 'hey!', 'yo {player}', 'hii', 'sup', 'hello :)'] },
  { re: /\b(bye|cya|gtg|gn|goodnight)\b/i, lines: ['bye!', 'cya', 'gn', 'see ya {player}'] },
  { re: /\btrade|trading\b/i, lines: ['what u got', 'no thx', 'maybe later', 'only for shards'] },
  { re: /\bluck(y)?\b/i, lines: ['luck is everything', 'potions + totems + events = max luck', 'perfect digs give luck too', 'my luck is like 2k rn'] },
  { re: /\b(gg|nice|wow|cool|lol|lmao|xd)\b/i, lines: ['ikr', 'lol', 'fr', 'gg', '😂', 'real'] },
  { re: /\b(how|what|where|why|help|best)\b|\?/i, lines: ['idk lol', 'just keep panning', 'check the shop', 'perfect digs help a lot', 'museum!!', 'go to the map', 'sell and upgrade ur pan'] },
  { re: /\b(noob|bad|trash)\b/i, lines: ['no u', 'rude', 'ok', '😐'] },
];
export const DEFAULT_REPLIES = ['fr', 'true', 'lol', 'ok', 'same', 'real', 'nice', 'haha', 'yeah'];
