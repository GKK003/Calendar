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
  { id: "sunrise", name: "Peach sunrise", emoji: "🌅", price: 0, wall: "#fff1e8", floor: "#efd7ca", accent: "#f2b69e" },
  { id: "cloud", name: "Cloud cottage", emoji: "☁️", price: 90, wall: "#eef5ff", floor: "#d7e3f1", accent: "#adc8e7" },
  { id: "meadow", name: "Meadow room", emoji: "🌿", price: 120, wall: "#eff7e9", floor: "#d7e4c4", accent: "#a7c98e" },
  { id: "lavender", name: "Lavender dusk", emoji: "🌙", price: 130, wall: "#f1edff", floor: "#d9d0ed", accent: "#b8a6e9" },
  { id: "ocean", name: "Little ocean", emoji: "🌊", price: 150, wall: "#e9f7fb", floor: "#cde5e9", accent: "#8bc8d3" },
  { id: "candy", name: "Candy cloud", emoji: "🍬", price: 170, wall: "#fff0f7", floor: "#efd4e2", accent: "#e4a7ca" },
  { id: "woodland", name: "Woodland nook", emoji: "🍄", price: 190, wall: "#f3f1e7", floor: "#dfd6bb", accent: "#b4a57b" },
  { id: "starlight", name: "Starlight loft", emoji: "✨", price: 220, wall: "#ebeafa", floor: "#cbcce2", accent: "#9c9ad3" },
];

export const DECOR_CATEGORIES = ["All", "Beds", "Chairs", "Rugs", "Plants", "Lighting", "Wall art", "Tables", "Toys", "Wearables"];

export const DECOR = [
  { id: "starter-bed", name: "Pillow-pile bed", category: "Beds", emoji: "🛏️", slot: "bed", price: 0, description: "A soft first home for your new friend." },
  { id: "cloud-bed", name: "Cloud daybed", category: "Beds", emoji: "☁️", slot: "bed", price: 145, description: "Nap somewhere above the clouds." },
  { id: "mushroom-bed", name: "Mushroom nook", category: "Beds", emoji: "🍄", slot: "bed", price: 165, description: "A tiny woodland hideaway." },
  { id: "berry-bed", name: "Berry patch bed", category: "Beds", emoji: "🍓", slot: "bed", price: 180, description: "Sweet dreams, extra sweet." },
  { id: "moon-bed", name: "Moonbeam pod", category: "Beds", emoji: "🌙", slot: "bed", price: 210, description: "A quiet place for starry naps." },
  { id: "leaf-bed", name: "Monstera hammock", category: "Beds", emoji: "🌿", slot: "bed", price: 130, description: "A leafy little nest." },
  { id: "stargazer-bed", name: "Stargazer nest", category: "Beds", emoji: "🌠", slot: "bed", price: 195, description: "Fall asleep under a sky of tiny lights." },
  { id: "starter-chair", name: "Puddle chair", category: "Chairs", emoji: "🪑", slot: "chair", price: 0, description: "Perfect for watching the room." },
  { id: "cloud-chair", name: "Cloud lounge chair", category: "Chairs", emoji: "☁️", slot: "chair", price: 105, description: "Soft enough to disappear into." },
  { id: "mushroom-stool", name: "Mushroom stool", category: "Chairs", emoji: "🍄", slot: "chair", price: 85, description: "A little seat with big forest energy." },
  { id: "love-seat", name: "Two-friend loveseat", category: "Chairs", emoji: "🛋️", slot: "chair", price: 220, description: "Room for the whole cuddle crew." },
  { id: "beanbag", name: "Star beanbag", category: "Chairs", emoji: "🟣", slot: "chair", price: 115, description: "A squishy landing spot." },
  { id: "rocker", name: "Daisy rocking chair", category: "Chairs", emoji: "🌼", slot: "chair", price: 155, description: "Rock gently into nap time." },
  { id: "reading-chair", name: "Book-nook chair", category: "Chairs", emoji: "📖", slot: "chair", price: 135, description: "The coziest seat for a very small reader." },
  { id: "shell-chair", name: "Seashell lounger", category: "Chairs", emoji: "🐚", slot: "chair", price: 175, description: "A breezy spot for ocean daydreams." },
  { id: "starter-rug", name: "First-footsteps rug", category: "Rugs", emoji: "🟠", slot: "rug", price: 0, description: "A warm patch for the middle of the room." },
  { id: "flower-rug", name: "Flower garden rug", category: "Rugs", emoji: "🌸", slot: "rug", price: 95, description: "A tiny garden that never wilts." },
  { id: "rainbow-rug", name: "Rainbow loop rug", category: "Rugs", emoji: "🌈", slot: "rug", price: 125, description: "A rainbow to curl up on." },
  { id: "checker-rug", name: "Picnic-check rug", category: "Rugs", emoji: "🧺", slot: "rug", price: 100, description: "A picnic, even on rainy days." },
  { id: "ocean-rug", name: "Tide-pool rug", category: "Rugs", emoji: "🐚", slot: "rug", price: 135, description: "A soft little beach at home." },
  { id: "sunset-rug", name: "Sunset swirl rug", category: "Rugs", emoji: "🌅", slot: "rug", price: 145, description: "A warm sunset for slow afternoons." },
  { id: "starter-plant", name: "Happy little fern", category: "Plants", emoji: "🪴", slot: "plant-left", price: 0, description: "A leafy friend for your leafy friend." },
  { id: "monstera", name: "Monstera plant", category: "Plants", emoji: "🌿", slot: "plant-left", price: 75, description: "Big leaves, calm energy." },
  { id: "sunflower", name: "Pocket sunflower", category: "Plants", emoji: "🌻", slot: "plant-right", price: 80, description: "A little sunshine that stays." },
  { id: "cactus", name: "Round cactus", category: "Plants", emoji: "🌵", slot: "plant-right", price: 70, description: "Low-maintenance and very proud." },
  { id: "bonsai", name: "Tiny bonsai", category: "Plants", emoji: "🌳", slot: "plant-left", price: 145, description: "A whole forest in one pot." },
  { id: "flower-pot", name: "Wildflower pot", category: "Plants", emoji: "💐", slot: "plant-right", price: 120, description: "A cheerful bunch in bloom." },
  { id: "starter-lamp", name: "Moon lamp", category: "Lighting", emoji: "🏮", slot: "light", price: 0, description: "A cozy glow for late-night cuddles." },
  { id: "mushroom-lamp", name: "Glowcap lamp", category: "Lighting", emoji: "🍄", slot: "light", price: 110, description: "A warm woodland glow." },
  { id: "star-lamp", name: "Pocket star lamp", category: "Lighting", emoji: "⭐", slot: "light", price: 145, description: "A little star, right at home." },
  { id: "paper-lantern", name: "Paper lantern", category: "Lighting", emoji: "🏮", slot: "light", price: 95, description: "Soft light, softer evenings." },
  { id: "crystal-lamp", name: "Dream crystal", category: "Lighting", emoji: "🔮", slot: "light", price: 190, description: "Shimmers when the room gets quiet." },
  { id: "starter-window", name: "Cloud-window", category: "Wall art", emoji: "🪟", slot: "wall-center", price: 0, description: "A sunny view for daydreaming." },
  { id: "starter-picture", name: "Our first picture", category: "Wall art", emoji: "🖼️", slot: "wall-left", price: 0, description: "A little art for a little home." },
  { id: "rainbow-art", name: "After-rain rainbow", category: "Wall art", emoji: "🌈", slot: "wall-right", price: 90, description: "A bright spot for gray days." },
  { id: "star-map", name: "Tiny star map", category: "Wall art", emoji: "🌌", slot: "wall-center", price: 155, description: "A whole sky inside your room." },
  { id: "flower-frame", name: "Pressed-flower frame", category: "Wall art", emoji: "🌷", slot: "wall-left", price: 75, description: "A spring day that lasts." },
  { id: "sun-clock", name: "Smiley sun clock", category: "Wall art", emoji: "🌞", slot: "wall-right", price: 105, description: "The happiest timekeeper." },
  { id: "moon-art", name: "Sleepy moon print", category: "Wall art", emoji: "🌙", slot: "wall-left", price: 115, description: "A goodnight for the whole room." },
  { id: "butterfly-frame", name: "Butterfly gallery", category: "Wall art", emoji: "🦋", slot: "wall-right", price: 125, description: "Colorful visitors that never fly away." },
  { id: "star-garland", name: "Little star garland", category: "Wall art", emoji: "✨", slot: "wall-center", price: 100, description: "A sprinkle of stars above the room." },
  { id: "starter-table", name: "Tea-time table", category: "Tables", emoji: "🫖", slot: "table", price: 0, description: "A place for treats and tiny treasures." },
  { id: "acorn-table", name: "Acorn side table", category: "Tables", emoji: "🌰", slot: "table", price: 85, description: "Small, sturdy, and woodland-made." },
  { id: "book-shelf", name: "Storybook shelf", category: "Tables", emoji: "📚", slot: "table", price: 125, description: "All the best stories in one place." },
  { id: "tea-cart", name: "Berry tea cart", category: "Tables", emoji: "🍵", slot: "table", price: 145, description: "Rolling out cozy little breaks." },
  { id: "starter-toy", name: "Bouncy ball", category: "Toys", emoji: "🎾", slot: "toy", price: 0, description: "The classic never gets old." },
  { id: "yarn-ball", name: "Rainbow yarn", category: "Toys", emoji: "🧶", slot: "toy", price: 55, description: "One more roll. Then one more." },
  { id: "teddy-toy", name: "Pocket teddy", category: "Toys", emoji: "🧸", slot: "toy", price: 85, description: "A tiny best friend for your best friend." },
  { id: "rocket-toy", name: "Moon-landing rocket", category: "Toys", emoji: "🚀", slot: "toy", price: 135, description: "For very important living-room missions." },
  { id: "bubble-toy", name: "Bubble wand", category: "Toys", emoji: "🫧", slot: "toy", price: 75, description: "Bubbles to chase, none to clean up." },
  { id: "music-box", name: "Dancing music box", category: "Toys", emoji: "🎵", slot: "toy", price: 165, description: "Plays the pet's favorite little tune." },
  { id: "flower-crown", name: "Daisy crown", category: "Wearables", emoji: "🌼", slot: "pet", price: 95, description: "A garden-party look." },
  { id: "star-crown", name: "Sleepy star crown", category: "Wearables", emoji: "👑", slot: "pet", price: 180, description: "For the ruler of this room." },
  { id: "soft-scarf", name: "Cloud-knit scarf", category: "Wearables", emoji: "🧣", slot: "pet", price: 110, description: "A warm hug to wear." },
  { id: "party-bow", name: "Party bow", category: "Wearables", emoji: "🎀", slot: "pet", price: 80, description: "Ready for absolutely anything." },
  { id: "wizard-hat", name: "Tiny wizard hat", category: "Wearables", emoji: "🪄", slot: "pet", price: 155, description: "Casts one spell: make today magical." },
  { id: "space-helmet", name: "Cloud explorer helmet", category: "Wearables", emoji: "🪐", slot: "pet", price: 210, description: "One small step for a very small pet." },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((item) => [item.id, item]));
export const STARTER_ITEMS = DECOR.filter((item) => item.price === 0).map((item) => item.id);
export const STARTER_PLACED = Object.fromEntries(
  DECOR.filter((item) => item.price === 0).map((item) => [item.slot, item.id]),
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
  { id: "feed", name: "Breakfast together", emoji: "🍓", reward: 10 },
  { id: "play", name: "Play for a while", emoji: "🎾", reward: 10 },
  { id: "clean", name: "Freshen the room", emoji: "🫧", reward: 10 },
  { id: "cuddle", name: "Give a cuddle", emoji: "🫶", reward: 10 },
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
