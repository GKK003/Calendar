export const PETS = [
  { id: "cat", name: "Cat", image: "/pets/cat.jpg", personality: "Curious little explorer", color: "#b78c66" },
  { id: "dog", name: "Puppy", image: "/pets/dog.jpg", personality: "Loyal and always glad you’re home", color: "#c08a55" },
  { id: "bunny", name: "Bunny", image: "/pets/bunny.jpg", personality: "Gentle and a little bouncy", color: "#89735f" },
  { id: "fox", name: "Fox", image: "/pets/fox.jpg", personality: "Clever, playful, and quick", color: "#b56735" },
  { id: "panda", name: "Red panda", image: "/pets/panda.jpg", personality: "A calm professional napper", color: "#aa6648" },
  { id: "frog", name: "Frog", image: "/pets/frog.jpg", personality: "A curious visitor from the garden", color: "#72834b" },
  { id: "capybara", name: "Capybara", image: "/pets/capybara.jpg", personality: "Unbothered by absolutely everything", color: "#9b7358" },
  { id: "otter", name: "Otter", image: "/pets/otter.jpg", personality: "Social, silly, and loves a splash", color: "#80614e" },
  { id: "dragon", name: "Bearded dragon", image: "/pets/dragon.jpg", personality: "A sun-loving little reptile", color: "#aa9068" },
  { id: "penguin", name: "Penguin", image: "/pets/penguin.jpg", personality: "A devoted, curious companion", color: "#53677a" },
  { id: "turtle", name: "Turtle", image: "/pets/turtle.jpg", personality: "Slow days, steady affection", color: "#67805b" },
  { id: "hamster", name: "Hamster", image: "/pets/hamster.jpg", personality: "A tiny explorer with busy paws", color: "#b58a58" },
  { id: "hedgehog", name: "Hedgehog", image: "/pets/hedgehog.jpg", personality: "Shy at first, then very curious", color: "#80684f" },
  { id: "duckling", name: "Duckling", image: "/pets/duckling.jpg", personality: "Follows you everywhere", color: "#b89b52" },
  { id: "unicorn", name: "Horse", image: "/pets/unicorn.jpg", personality: "Steady, gentle, and happiest outdoors", color: "#8c6649" },
  { id: "koala", name: "Koala", image: "/pets/koala.jpg", personality: "A relaxed tree-climbing friend", color: "#85817c" },
  { id: "raccoon", name: "Raccoon", image: "/pets/raccoon.jpg", personality: "A curious little night explorer", color: "#74716b" },
  { id: "butterfly", name: "Butterfly", image: "/pets/butterfly.jpg", personality: "A bright visitor for the windowsill", color: "#8463a3" },
];

export const PET_BY_ID = Object.fromEntries(PETS.map((pet) => [pet.id, pet]));

export const ROOM_THEMES = [
  { id: "sunrise", name: "Warm oak", wall: "#eee8df", floor: "#b88d68", accent: "#d7c2a4" },
  { id: "cloud", name: "Soft linen", wall: "#e9e7e1", floor: "#c2b39f", accent: "#cbbda7" },
  { id: "meadow", name: "Sage and oak", wall: "#e4e8de", floor: "#aa916e", accent: "#98a18a" },
  { id: "lavender", name: "Muted mauve", wall: "#e9e3e5", floor: "#a88d82", accent: "#aa8f98" },
  { id: "ocean", name: "Coastal light", wall: "#e4e9e8", floor: "#a9b6ae", accent: "#92aaa8" },
  { id: "candy", name: "Clay and cream", wall: "#eee4dc", floor: "#b27f68", accent: "#c69580" },
  { id: "woodland", name: "Walnut study", wall: "#e5e0d5", floor: "#896d53", accent: "#a28d71" },
  { id: "starlight", name: "Evening blue", wall: "#dce1e3", floor: "#827c74", accent: "#8293a0" },
];

export const DECOR_CATEGORIES = ["All", "Beds", "Chairs", "Rugs", "Plants", "Lighting", "Wall art", "Tables", "Toys", "Wearables"];

const DECOR_SPECS = [
  ["starter-bed", true, "Washable cotton bed", "Beds", "bed", "A padded, washable place to rest.", "#b88f73", "bolster"],
  ["cloud-bed", false, "Upholstered bolster bed", "Beds", "bed", "A soft bed with raised sides.", "#c2b1a0", "bolster"],
  ["mushroom-bed", false, "Woven basket bed", "Beds", "bed", "A sturdy natural-fiber basket with a cushion.", "#9a785b", "basket"],
  ["berry-bed", false, "Quilted cushion bed", "Beds", "bed", "A quilted floor cushion in muted rose.", "#a8787a", "cushion"],
  ["moon-bed", false, "Deep fleece nest", "Beds", "bed", "A round fleece-lined bed for curling up.", "#778394", "nest"],
  ["leaf-bed", false, "Window hammock", "Beds", "bed", "A fabric perch fixed beside the window.", "#7b876e", "hammock"],
  ["stargazer-bed", false, "Memory-foam pet mat", "Beds", "bed", "A low, supportive foam mat.", "#887c75", "mat"],
  ["starter-chair", true, "Oak armchair", "Chairs", "chair", "A compact armchair with solid wood legs.", "#9d7353", "armchair"],
  ["cloud-chair", false, "Upholstered lounge chair", "Chairs", "chair", "A broad lounge chair in natural linen.", "#b6a18e", "lounge"],
  ["mushroom-stool", false, "Round wooden stool", "Chairs", "chair", "A simple low stool made from oak.", "#a47b57", "stool"],
  ["love-seat", false, "Two-seat loveseat", "Chairs", "chair", "A small two-seat sofa in warm gray fabric.", "#8a8b80", "loveseat"],
  ["beanbag", false, "Canvas floor cushion", "Chairs", "chair", "A relaxed, washable floor seat.", "#a88473", "beanbag"],
  ["rocker", false, "Wooden rocking chair", "Chairs", "chair", "A small chair with curved wooden runners.", "#8b674c", "rocker"],
  ["reading-chair", false, "High-back reading chair", "Chairs", "chair", "A supportive chair with a tall back.", "#7f7770", "highback"],
  ["shell-chair", false, "Bentwood lounge chair", "Chairs", "chair", "A curved seat with a bentwood frame.", "#a67c56", "bentwood"],
  ["starter-rug", true, "Jute area rug", "Rugs", "rug", "A natural woven rug for the center of the room.", "#b6a07f", "oval"],
  ["flower-rug", false, "Flat-weave cotton rug", "Rugs", "rug", "A low-pile cotton rug in soft cream.", "#c3b6a4", "rect"],
  ["rainbow-rug", false, "Wool runner", "Rugs", "rug", "A durable runner with a muted stripe.", "#858c8a", "runner"],
  ["checker-rug", false, "Checked wool rug", "Rugs", "rug", "A woven checker pattern in natural tones.", "#a2957f", "check"],
  ["ocean-rug", false, "Oval woven rug", "Rugs", "rug", "A soft oval rug in slate blue.", "#829297", "oval"],
  ["sunset-rug", false, "Tufted wool rug", "Rugs", "rug", "A thick, comfortable rug in terracotta.", "#a47763", "tufted"],
  ["starter-plant", true, "Boston fern", "Plants", "plant-left", "A leafy, pet-safe fern in a clay pot.", "#68805d", "fern"],
  ["monstera", false, "Parlor palm", "Plants", "plant-left", "A small indoor palm in a ceramic planter.", "#66805d", "palm"],
  ["sunflower", false, "Spider plant", "Plants", "plant-right", "A hardy spider plant in a stoneware pot.", "#728267", "spider"],
  ["cactus", false, "Peperomia plant", "Plants", "plant-right", "A compact, pet-safe peperomia.", "#708065", "peperomia"],
  ["bonsai", false, "Calathea plant", "Plants", "plant-left", "A leafy calathea in a matte pot.", "#617b68", "calathea"],
  ["flower-pot", false, "Parlor palm", "Plants", "plant-right", "A second palm with a different pot and shape.", "#7b8665", "palm-short"],
  ["starter-lamp", true, "Ceramic table lamp", "Lighting", "light", "A ceramic base and warm fabric shade.", "#a58b6d", "tablelamp"],
  ["mushroom-lamp", false, "Rattan shade lamp", "Lighting", "light", "A woven shade with a warm, low glow.", "#ad8c63", "rattanlamp"],
  ["star-lamp", false, "Brass floor lamp", "Lighting", "light", "A slim reading lamp with a metal stem.", "#a78c64", "floorlamp"],
  ["paper-lantern", false, "Paper-shade lamp", "Lighting", "light", "A simple pleated shade on a wood base.", "#c1a884", "paperlamp"],
  ["crystal-lamp", false, "Desk lamp", "Lighting", "light", "A small adjustable lamp with a metal arm.", "#8f918b", "desklamp"],
  ["starter-window", true, "Oak-framed window", "Wall art", "wall-center", "A tall window with a simple oak frame.", "#9d795b", "window"],
  ["starter-picture", true, "Framed landscape print", "Wall art", "wall-left", "A quiet landscape in a slim wood frame.", "#88775f", "landscape"],
  ["rainbow-art", false, "Botanical print", "Wall art", "wall-right", "A pressed-leaf print in a dark frame.", "#6e7a65", "botanical"],
  ["star-map", false, "Round wall clock", "Wall art", "wall-center", "A clean, easy-to-read wall clock.", "#88785f", "clock"],
  ["flower-frame", false, "Framed garden photograph", "Wall art", "wall-left", "A small photo print in a natural wood frame.", "#8d705a", "photo"],
  ["sun-clock", false, "Oval wall mirror", "Wall art", "wall-right", "A simple oval mirror with a wood surround.", "#927659", "mirror"],
  ["moon-art", false, "Coastal photo print", "Wall art", "wall-left", "A quiet shoreline photograph in a frame.", "#667b82", "coastal"],
  ["butterfly-frame", false, "Bird study print", "Wall art", "wall-right", "A natural-history print in a slim frame.", "#71806a", "birdprint"],
  ["star-garland", false, "Floating oak shelf", "Wall art", "wall-center", "A narrow shelf for a few small keepsakes.", "#987453", "shelf"],
  ["starter-table", true, "Oak side table", "Tables", "table", "A compact side table with a lower shelf.", "#a77d57", "sidetable"],
  ["acorn-table", false, "Round coffee table", "Tables", "table", "A low, rounded coffee table.", "#986e4e", "coffee"],
  ["book-shelf", false, "Low bookcase", "Tables", "table", "A sturdy bookcase for small rooms.", "#8c694f", "bookcase"],
  ["tea-cart", false, "Rolling storage cart", "Tables", "table", "A two-tier cart on quiet casters.", "#887f70", "cart"],
  ["starter-toy", true, "Tennis ball", "Toys", "toy", "A classic rubber ball for play time.", "#b59c48", "ball"],
  ["yarn-ball", false, "Woven rope toy", "Toys", "toy", "A short, sturdy cotton rope toy.", "#ad8c72", "rope"],
  ["teddy-toy", false, "Felt mouse toy", "Toys", "toy", "A small felt toy with no hard parts.", "#81766c", "mouse"],
  ["rocket-toy", false, "Treat puzzle", "Toys", "toy", "A simple food puzzle for curious paws.", "#87938a", "puzzle"],
  ["bubble-toy", false, "Soft chew toy", "Toys", "toy", "A flexible rubber toy in a quiet color.", "#819499", "chew"],
  ["music-box", false, "Feather teaser", "Toys", "toy", "A feather teaser for supervised play.", "#b29b73", "teaser"],
  ["flower-crown", false, "Soft fabric collar", "Wearables", "pet", "A lightweight collar with a safety release.", "#87918a", "collar"],
  ["star-crown", false, "Reflective collar", "Wearables", "pet", "A visible collar with a reflective strip.", "#9f8463", "collar"],
  ["soft-scarf", false, "Cotton bandana", "Wearables", "pet", "A soft, adjustable cotton bandana.", "#a47c73", "bandana"],
  ["party-bow", false, "Bow-tie collar", "Wearables", "pet", "A small fabric bow on an adjustable collar.", "#826f79", "bow"],
  ["wizard-hat", false, "Lightweight harness", "Wearables", "pet", "A soft harness with adjustable straps.", "#778b82", "harness"],
  ["space-helmet", false, "Rain jacket", "Wearables", "pet", "A lightweight coat for rainy walks.", "#9c8062", "coat"],
];

export const DECOR = DECOR_SPECS.map(([id, starter, name, category, slot, description, color, variant]) => ({
  id, ...(starter ? { starter: true } : {}), name, category, slot, description, color, variant,
}));

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
  { id: "feed", name: "Breakfast together", xp: 10 },
  { id: "play", name: "Play for a while", xp: 10 },
  { id: "clean", name: "Freshen the room", xp: 10 },
  { id: "cuddle", name: "Give a cuddle", xp: 10 },
];

export const CARE_ACTIONS = {
  feed: { fullness: 30, happiness: 6, energy: 0, cleanliness: 0, message: "A very good snack. The little tail is wagging." },
  play: { fullness: -3, happiness: 25, energy: -15, cleanliness: -4, message: "Best play session ever. The room is a little messier." },
  clean: { fullness: 0, happiness: 4, energy: 0, cleanliness: 36, message: "Fresh room, fresh paws, fresh start." },
  cuddle: { fullness: 0, happiness: 17, energy: 0, cleanliness: 0, message: "Cuddle received. Cuddle returned." },
  nap: { fullness: 0, happiness: 4, energy: 32, cleanliness: 0, message: "A cozy nap restored some energy." },
};

export const NEEDS = [
  { id: "fullness", label: "Fullness", color: "#ef9a88" },
  { id: "happiness", label: "Happiness", color: "#df8db2" },
  { id: "energy", label: "Energy", color: "#e9bc62" },
  { id: "cleanliness", label: "Freshness", color: "#75b9c7" },
];
