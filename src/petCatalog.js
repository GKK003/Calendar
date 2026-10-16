export const PETS = [
  { id: "cat", name: "Cat", emoji: "🐱", personality: "Curious little explorer", color: "#f4b8a5" },
  { id: "dog", name: "Puppy", emoji: "🐶", personality: "Loyal sunshine machine", color: "#f2c277" },
  { id: "bunny", name: "Bunny", emoji: "🐰", personality: "Gentle and a little bouncy", color: "#e9b9d2" },
  { id: "fox", name: "Fox", emoji: "🦊", personality: "Clever, playful, and quick", color: "#ed9f72" },
  { id: "panda", name: "Panda", emoji: "🐼", personality: "A calm professional napper", color: "#a9c5bd" },
  { id: "frog", name: "Frog", emoji: "🐸", personality: "Small pond, enormous opinions", color: "#93c989" },
  { id: "capybara", name: "Capybara", emoji: "🦫", personality: "Unbothered by absolutely everything", color: "#c99570" },
  { id: "otter", name: "Otter", emoji: "🦦", personality: "Social, silly, and loves a splash", color: "#bd9a78" },
  { id: "dragon", name: "Baby dragon", emoji: "🐲", personality: "Brave heart, tiny fire sneezes", color: "#a28dd9" },
  { id: "penguin", name: "Penguin", emoji: "🐧", personality: "A devoted hand-holding friend", color: "#91b8d9" },
  { id: "turtle", name: "Turtle", emoji: "🐢", personality: "Slow days, steady affection", color: "#8dbd93" },
  { id: "hamster", name: "Hamster", emoji: "🐹", personality: "Stores snacks and big feelings", color: "#e6b783" },
  { id: "hedgehog", name: "Hedgehog", emoji: "🦔", personality: "Spiky outside, soft inside", color: "#c9a78d" },
  { id: "duckling", name: "Duckling", emoji: "🐤", personality: "Follows you everywhere", color: "#f1d36f" },
  { id: "unicorn", name: "Unicorn", emoji: "🦄", personality: "Turns ordinary days magical", color: "#d9a8e4" },
  { id: "koala", name: "Koala", emoji: "🐨", personality: "Needs a hug, then another hug", color: "#a9b5c5" },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", personality: "Night-shift snack detective", color: "#aab3bd" },
  { id: "butterfly", name: "Butterfly", emoji: "🦋", personality: "A tiny, colorful daydream", color: "#a99ae8" },
];

export const PET_BY_ID = Object.fromEntries(PETS.map((pet) => [pet.id, pet]));

export const ROOM_THEMES = [
  { id: "sunrise", name: "Peach sunrise", emoji: "🌅", wall: "#fff1e8", floor: "#efd7ca", accent: "#f2b69e" },
  { id: "cloud", name: "Cloud cottage", emoji: "☁️", wall: "#eef5ff", floor: "#d7e3f1", accent: "#adc8e7" },
  { id: "meadow", name: "Meadow room", emoji: "🌿", wall: "#eff7e9", floor: "#d7e4c4", accent: "#a7c98e" },
  { id: "lavender", name: "Lavender dusk", emoji: "🌙", wall: "#f1edff", floor: "#d9d0ed", accent: "#b8a6e9" },
  { id: "ocean", name: "Little ocean", emoji: "🌊", wall: "#e9f7fb", floor: "#cde5e9", accent: "#8bc8d3" },
  { id: "candy", name: "Candy cloud", emoji: "🍬", wall: "#fff0f7", floor: "#efd4e2", accent: "#e4a7ca" },
  { id: "woodland", name: "Woodland nook", emoji: "🍄", wall: "#f3f1e7", floor: "#dfd6bb", accent: "#b4a57b" },
  { id: "starlight", name: "Starlight loft", emoji: "✨", wall: "#ebeafa", floor: "#cbcce2", accent: "#9c9ad3" },
];

export const DECOR_CATEGORIES = ["All", "Beds", "Chairs", "Rugs", "Plants", "Lighting", "Wall art", "Tables", "Toys", "Wearables"];

export const DECOR = [
  { id: "starter-bed", starter: true, name: "Pillow-pile bed", category: "Beds", emoji: "🛏️", slot: "bed", description: "A soft first home for your new friend." },
  { id: "cloud-bed", name: "Cloud daybed", category: "Beds", emoji: "☁️", slot: "bed", description: "Nap somewhere above the clouds." },
  { id: "mushroom-bed", name: "Mushroom nook", category: "Beds", emoji: "🍄", slot: "bed", description: "A tiny woodland hideaway." },
  { id: "berry-bed", name: "Berry patch bed", category: "Beds", emoji: "🍓", slot: "bed", description: "Sweet dreams, extra sweet." },
  { id: "moon-bed", name: "Moonbeam pod", category: "Beds", emoji: "🌙", slot: "bed", description: "A quiet place for starry naps." },
  { id: "leaf-bed", name: "Monstera hammock", category: "Beds", emoji: "🌿", slot: "bed", description: "A leafy little nest." },
  { id: "stargazer-bed", name: "Stargazer nest", category: "Beds", emoji: "🌠", slot: "bed", description: "Fall asleep under a sky of tiny lights." },
  { id: "starter-chair", starter: true, name: "Puddle chair", category: "Chairs", emoji: "🪑", slot: "chair", description: "Perfect for watching the room." },
  { id: "cloud-chair", name: "Cloud lounge chair", category: "Chairs", emoji: "☁️", slot: "chair", description: "Soft enough to disappear into." },
  { id: "mushroom-stool", name: "Mushroom stool", category: "Chairs", emoji: "🍄", slot: "chair", description: "A little seat with big forest energy." },
  { id: "love-seat", name: "Two-friend loveseat", category: "Chairs", emoji: "🛋️", slot: "chair", description: "Room for the whole cuddle crew." },
  { id: "beanbag", name: "Star beanbag", category: "Chairs", emoji: "🟣", slot: "chair", description: "A squishy landing spot." },
  { id: "rocker", name: "Daisy rocking chair", category: "Chairs", emoji: "🌼", slot: "chair", description: "Rock gently into nap time." },
  { id: "reading-chair", name: "Book-nook chair", category: "Chairs", emoji: "📖", slot: "chair", description: "The coziest seat for a very small reader." },
  { id: "shell-chair", name: "Seashell lounger", category: "Chairs", emoji: "🐚", slot: "chair", description: "A breezy spot for ocean daydreams." },
  { id: "starter-rug", starter: true, name: "First-footsteps rug", category: "Rugs", emoji: "🟠", slot: "rug", description: "A warm patch for the middle of the room." },
  { id: "flower-rug", name: "Flower garden rug", category: "Rugs", emoji: "🌸", slot: "rug", description: "A tiny garden that never wilts." },
  { id: "rainbow-rug", name: "Rainbow loop rug", category: "Rugs", emoji: "🌈", slot: "rug", description: "A rainbow to curl up on." },
  { id: "checker-rug", name: "Picnic-check rug", category: "Rugs", emoji: "🧺", slot: "rug", description: "A picnic, even on rainy days." },
  { id: "ocean-rug", name: "Tide-pool rug", category: "Rugs", emoji: "🐚", slot: "rug", description: "A soft little beach at home." },
  { id: "sunset-rug", name: "Sunset swirl rug", category: "Rugs", emoji: "🌅", slot: "rug", description: "A warm sunset for slow afternoons." },
  { id: "starter-plant", starter: true, name: "Happy little fern", category: "Plants", emoji: "🪴", slot: "plant-left", description: "A leafy friend for your leafy friend." },
  { id: "monstera", name: "Monstera plant", category: "Plants", emoji: "🌿", slot: "plant-left", description: "Big leaves, calm energy." },
  { id: "sunflower", name: "Pocket sunflower", category: "Plants", emoji: "🌻", slot: "plant-right", description: "A little sunshine that stays." },
  { id: "cactus", name: "Round cactus", category: "Plants", emoji: "🌵", slot: "plant-right", description: "Low-maintenance and very proud." },
  { id: "bonsai", name: "Tiny bonsai", category: "Plants", emoji: "🌳", slot: "plant-left", description: "A whole forest in one pot." },
  { id: "flower-pot", name: "Wildflower pot", category: "Plants", emoji: "💐", slot: "plant-right", description: "A cheerful bunch in bloom." },
  { id: "starter-lamp", starter: true, name: "Moon lamp", category: "Lighting", emoji: "🏮", slot: "light", description: "A cozy glow for late-night cuddles." },
  { id: "mushroom-lamp", name: "Glowcap lamp", category: "Lighting", emoji: "🍄", slot: "light", description: "A warm woodland glow." },
  { id: "star-lamp", name: "Pocket star lamp", category: "Lighting", emoji: "⭐", slot: "light", description: "A little star, right at home." },
  { id: "paper-lantern", name: "Paper lantern", category: "Lighting", emoji: "🏮", slot: "light", description: "Soft light, softer evenings." },
  { id: "crystal-lamp", name: "Dream crystal", category: "Lighting", emoji: "🔮", slot: "light", description: "Shimmers when the room gets quiet." },
  { id: "starter-window", starter: true, name: "Cloud-window", category: "Wall art", emoji: "🪟", slot: "wall-center", description: "A sunny view for daydreaming." },
  { id: "starter-picture", starter: true, name: "Our first picture", category: "Wall art", emoji: "🖼️", slot: "wall-left", description: "A little art for a little home." },
  { id: "rainbow-art", name: "After-rain rainbow", category: "Wall art", emoji: "🌈", slot: "wall-right", description: "A bright spot for gray days." },
  { id: "star-map", name: "Tiny star map", category: "Wall art", emoji: "🌌", slot: "wall-center", description: "A whole sky inside your room." },
  { id: "flower-frame", name: "Pressed-flower frame", category: "Wall art", emoji: "🌷", slot: "wall-left", description: "A spring day that lasts." },
  { id: "sun-clock", name: "Smiley sun clock", category: "Wall art", emoji: "🌞", slot: "wall-right", description: "The happiest timekeeper." },
  { id: "moon-art", name: "Sleepy moon print", category: "Wall art", emoji: "🌙", slot: "wall-left", description: "A goodnight for the whole room." },
  { id: "butterfly-frame", name: "Butterfly gallery", category: "Wall art", emoji: "🦋", slot: "wall-right", description: "Colorful visitors that never fly away." },
  { id: "star-garland", name: "Little star garland", category: "Wall art", emoji: "✨", slot: "wall-center", description: "A sprinkle of stars above the room." },
  { id: "starter-table", starter: true, name: "Tea-time table", category: "Tables", emoji: "🫖", slot: "table", description: "A place for treats and tiny treasures." },
  { id: "acorn-table", name: "Acorn side table", category: "Tables", emoji: "🌰", slot: "table", description: "Small, sturdy, and woodland-made." },
  { id: "book-shelf", name: "Storybook shelf", category: "Tables", emoji: "📚", slot: "table", description: "All the best stories in one place." },
  { id: "tea-cart", name: "Berry tea cart", category: "Tables", emoji: "🍵", slot: "table", description: "Rolling out cozy little breaks." },
  { id: "starter-toy", starter: true, name: "Bouncy ball", category: "Toys", emoji: "🎾", slot: "toy", description: "The classic never gets old." },
  { id: "yarn-ball", name: "Rainbow yarn", category: "Toys", emoji: "🧶", slot: "toy", description: "One more roll. Then one more." },
  { id: "teddy-toy", name: "Pocket teddy", category: "Toys", emoji: "🧸", slot: "toy", description: "A tiny best friend for your best friend." },
  { id: "rocket-toy", name: "Moon-landing rocket", category: "Toys", emoji: "🚀", slot: "toy", description: "For very important living-room missions." },
  { id: "bubble-toy", name: "Bubble wand", category: "Toys", emoji: "🫧", slot: "toy", description: "Bubbles to chase, none to clean up." },
  { id: "music-box", name: "Dancing music box", category: "Toys", emoji: "🎵", slot: "toy", description: "Plays the pet's favorite little tune." },
  { id: "flower-crown", name: "Daisy crown", category: "Wearables", emoji: "🌼", slot: "pet", description: "A garden-party look." },
  { id: "star-crown", name: "Sleepy star crown", category: "Wearables", emoji: "👑", slot: "pet", description: "For the ruler of this room." },
  { id: "soft-scarf", name: "Cloud-knit scarf", category: "Wearables", emoji: "🧣", slot: "pet", description: "A warm hug to wear." },
  { id: "party-bow", name: "Party bow", category: "Wearables", emoji: "🎀", slot: "pet", description: "Ready for absolutely anything." },
  { id: "wizard-hat", name: "Tiny wizard hat", category: "Wearables", emoji: "🪄", slot: "pet", description: "Casts one spell: make today magical." },
  { id: "space-helmet", name: "Cloud explorer helmet", category: "Wearables", emoji: "🪐", slot: "pet", description: "One small step for a very small pet." },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((item) => [item.id, item]));
export const STARTER_ITEMS = DECOR.filter((item) => item.starter).map((item) => item.id);
export const STARTER_PLACED = Object.fromEntries(
  DECOR.filter((item) => item.starter).map((item) => [item.slot, item.id]),
);

export const ROOM_SLOTS = {
  "wall-left": { left: "22%", top: "25%" },
  "wall-center": { left: "50%", top: "20%" },
  "wall-right": { left: "78%", top: "25%" },
  "plant-left": { left: "11%", top: "53%" },
  "plant-right": { left: "89%", top: "53%" },
  light: { left: "87%", top: "37%" },
  bed: { left: "22%", top: "76%" },
  table: { left: "36%", top: "72%" },
  chair: { left: "79%", top: "74%" },
  rug: { left: "50%", top: "88%" },
  toy: { left: "66%", top: "89%" },
  pet: { left: "50%", top: "62%" },
};

export const DAILY_CARE = [
  { id: "feed", name: "Breakfast together", emoji: "🍓", xp: 10 },
  { id: "play", name: "Play for a while", emoji: "🎾", xp: 10 },
  { id: "clean", name: "Freshen the room", emoji: "🫧", xp: 10 },
  { id: "cuddle", name: "Give a cuddle", emoji: "🫶", xp: 10 },
];

export const CARE_ACTIONS = {
  feed: { fullness: 30, happiness: 6, energy: 0, cleanliness: 0, message: "A very good snack. The little tail is wagging." },
  play: { fullness: -3, happiness: 25, energy: -15, cleanliness: -4, message: "Best play session ever. The room is a little messier." },
  clean: { fullness: 0, happiness: 4, energy: 0, cleanliness: 36, message: "Fresh room, fresh paws, fresh start." },
  cuddle: { fullness: 0, happiness: 17, energy: 0, cleanliness: 0, message: "Cuddle received. Cuddle returned." },
  nap: { fullness: 0, happiness: 4, energy: 32, cleanliness: 0, message: "A cozy nap restored some energy." },
};

export const NEEDS = [
  { id: "fullness", label: "Fullness", emoji: "🍓", color: "#ef9a88" },
  { id: "happiness", label: "Happiness", emoji: "💗", color: "#df8db2" },
  { id: "energy", label: "Energy", emoji: "⚡", color: "#e9bc62" },
  { id: "cleanliness", label: "Freshness", emoji: "🫧", color: "#75b9c7" },
];
