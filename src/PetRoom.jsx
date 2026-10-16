import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Heart, Home, Mic, MicOff, Package, PawPrint, Pencil, ShoppingBag,
  Sparkles, Star, Store, Trophy,
} from "lucide-react";
import { supabase } from "./supabase.js";
import AnimatedPet from "./AnimatedPet.jsx";
import {
  CARE_ACTIONS, DAILY_CARE, DECOR, DECOR_BY_ID, DECOR_CATEGORIES,
  NEEDS, PETS, PET_BY_ID, ROOM_SLOTS, ROOM_THEMES, STARTER_ITEMS,
  STARTER_PLACED,
} from "./petCatalog.js";
import "./pet.css";
import "./pet-real.css";

const TABLE = "shared_pet_rooms";
const todayKey = () => new Date().toISOString().slice(0, 10);
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const ACTION_ICONS = { feed: Heart, play: Star, clean: Sparkles, cuddle: Heart, nap: Home };
const NEED_ICONS = { fullness: Heart, happiness: Heart, energy: Star, cleanliness: Sparkles };
const PET_COAT_SWATCHES = ["#c99169", "#e9c99f", "#b9b1a6", "#544d46", "#d99b9f", "#8298ba", "#d2ae58", "#78947b"];
const TAP_REACTIONS = [
  { action: "happy", line: "You found me! Yay!" },
  { action: "curious", line: "What are you doing?" },
  { action: "surprised", line: "Oh! That tickles!" },
  { action: "shy", line: "Aww, you're sweet." },
  { action: "love", line: "I love spending time with you!" },
  { action: "silly", line: "Boop! Boop! Boop!" },
];
const CARE_LINES = {
  feed: "Mmm, that was delicious!",
  play: "Again! That was so much fun!",
  clean: "All fresh and fluffy now!",
  cuddle: "I love cuddles with you!",
  nap: "Wake me when it's snack time!",
};

function Furniture({ item }) {
  return (
    <span className={`pet-furniture furniture-slot-${item.slot} furniture-${item.variant || item.slot}`} style={{ "--furniture-color": item.color }} aria-hidden="true">
      <i className="furniture-back" /><i className="furniture-seat" /><i className="furniture-leg furniture-leg-one" />
      <i className="furniture-leg furniture-leg-two" /><i className="furniture-detail" />
    </span>
  );
}

function freshState() {
  return {
    pet: null,
    xp: 0,
    ownedItems: [...STARTER_ITEMS],
    placed: { ...STARTER_PLACED },
    equipped: null,
    theme: "sunrise",
    ownedThemes: ["sunrise"],
    needs: { fullness: 82, happiness: 82, energy: 82, cleanliness: 88, updatedAt: new Date().toISOString() },
    daily: { date: todayKey(), completed: [], streak: 0, lastCompleteDay: null, completedDay: null },
    adoptedAt: null,
  };
}

function normalizeState(value) {
  const base = freshState();
  const raw = value && typeof value === "object" ? { ...value } : {};
  delete raw.coins;
  const legacyPetChoices = {
    hamster: "cat", bunny: "cat", fox: "dog", panda: "cat", frog: "cat", capybara: "dog",
    otter: "cat", dragon: "cat", turtle: "penguin", hedgehog: "cat", duckling: "penguin",
    unicorn: "dog", koala: "cat", raccoon: "cat", butterfly: "penguin",
  };
  const legacyPetNames = {
    hamster: "Hamster", bunny: "Bunny", fox: "Fox", panda: "Panda", frog: "Frog", capybara: "Capybara", otter: "Otter",
    dragon: "Baby dragon", turtle: "Turtle", hedgehog: "Hedgehog", duckling: "Duckling", unicorn: "Unicorn",
    koala: "Koala", raccoon: "Raccoon", butterfly: "Butterfly",
  };
  const petId = PET_BY_ID[raw.pet?.id] ? raw.pet.id : legacyPetChoices[raw.pet?.id];
  const petName = String(raw.pet?.name || "");
  const pet = petId ? {
    id: petId,
    name: legacyPetNames[raw.pet?.id] === petName ? PET_BY_ID[petId].name : (petName || PET_BY_ID[petId].name).slice(0, 18),
    color: /^#[\da-f]{6}$/i.test(raw.pet?.color || "") ? raw.pet.color : PET_BY_ID[petId].color,
  } : null;
  const ownedItems = Array.isArray(raw.ownedItems)
    ? [...new Set(raw.ownedItems.filter((id) => DECOR_BY_ID[id]))]
    : base.ownedItems;
  for (const id of STARTER_ITEMS) if (!ownedItems.includes(id)) ownedItems.push(id);
  const placed = Object.fromEntries(Object.entries(raw.placed || {}).filter(([slot, id]) => ROOM_SLOTS[slot] && DECOR_BY_ID[id]?.slot === slot && ownedItems.includes(id)));
  const theme = ROOM_THEMES.some((item) => item.id === raw.theme) ? raw.theme : "sunrise";
  const ownedThemes = [...new Set(["sunrise", ...(Array.isArray(raw.ownedThemes) ? raw.ownedThemes.filter((id) => ROOM_THEMES.some((item) => item.id === id)) : [])])];
  if (!ownedThemes.includes(theme)) ownedThemes.push(theme);
  const daily = raw.daily && typeof raw.daily === "object" ? raw.daily : base.daily;
  const dailyDate = daily.date || todayKey();
  const today = todayKey();
  return {
    ...base,
    ...raw,
    pet,
    xp: Number.isFinite(raw.xp) ? Math.max(0, Math.floor(raw.xp)) : 0,
    ownedItems,
    placed,
    equipped: ownedItems.includes(raw.equipped) && DECOR_BY_ID[raw.equipped]?.slot === "pet" ? raw.equipped : null,
    theme,
    ownedThemes,
    needs: {
      ...base.needs,
      ...(raw.needs || {}),
      fullness: clamp(Number.isFinite(raw.needs?.fullness) ? raw.needs.fullness : base.needs.fullness),
      happiness: clamp(Number.isFinite(raw.needs?.happiness) ? raw.needs.happiness : base.needs.happiness),
      energy: clamp(Number.isFinite(raw.needs?.energy) ? raw.needs.energy : base.needs.energy),
      cleanliness: clamp(Number.isFinite(raw.needs?.cleanliness) ? raw.needs.cleanliness : base.needs.cleanliness),
      updatedAt: raw.needs?.updatedAt || new Date().toISOString(),
    },
    daily: {
      ...base.daily,
      ...daily,
      date: today,
      completed: dailyDate === today && Array.isArray(daily.completed) ? [...new Set(daily.completed.filter((id) => DAILY_CARE.some((task) => task.id === id)))] : [],
      streak: Number.isFinite(daily.streak) ? Math.max(0, daily.streak) : 0,
    },
  };
}

function currentNeeds(needs, now) {
  const updatedMs = Date.parse(needs.updatedAt || "");
  const elapsedHours = Number.isFinite(updatedMs) ? Math.max(0, (now - updatedMs) / 3600000) : 0;
  return {
    fullness: clamp(needs.fullness - elapsedHours * 2.1),
    happiness: clamp(needs.happiness - elapsedHours * 0.8),
    energy: clamp(needs.energy - elapsedHours * 1.2),
    cleanliness: clamp(needs.cleanliness - elapsedHours * 1),
    updatedAt: new Date(now).toISOString(),
  };
}

function levelFor(xp) {
  const level = Math.min(50, Math.floor(xp / 100) + 1);
  return { level, progress: level >= 50 ? 100 : xp % 100 };
}

function formatUpdatedBy(member, members) {
  return members.find((person) => person.user_id === member)?.display_name || "Your shared space";
}

export default function PetRoom({ space, member, members = [] }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [tab, setTab] = useState("room");
  const [category, setCategory] = useState("All");
  const [petName, setPetName] = useState("");
  const [selectedPet, setSelectedPet] = useState(PETS[0].id);
  const [changePetOpen, setChangePetOpen] = useState(false);
  const [replacementPet, setReplacementPet] = useState("");
  const [petReaction, setPetReaction] = useState("idle");
  const [petBubble, setPetBubble] = useState("");
  const [petAnimationKey, setPetAnimationKey] = useState(0);
  const [petColorDraft, setPetColorDraft] = useState(PETS[0].color);
  const [talkText, setTalkText] = useState("");
  const [listening, setListening] = useState(false);
  const [now, setNow] = useState(Date.now());
  const petReactionTimer = useRef(null);
  const recognitionRef = useRef(null);

  const speakPet = (text) => {
    if (!text || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") return false;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text.slice(0, 180));
    utterance.lang = navigator.language || "en-US";
    utterance.pitch = 1.5;
    utterance.rate = 1.08;
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const animatePet = (reaction, bubble = "Hi!", speak = false) => {
    window.clearTimeout(petReactionTimer.current);
    setPetReaction(reaction);
    setPetBubble(bubble);
    setPetAnimationKey((key) => key + 1);
    if (speak) speakPet(bubble);
    petReactionTimer.current = window.setTimeout(() => {
      setPetReaction("idle");
      setPetBubble("");
    }, reaction === "talk" ? Math.max(2600, Math.min(7000, bubble.length * 55)) : 2600);
  };

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase.from(TABLE).select("*").eq("space_id", space.id).maybeSingle();
    if (error) {
      setNotice("Pet Room needs its database setup. Run supabase/pet.sql in your Supabase SQL Editor, then refresh this page.");
    } else if (data) {
      setRecord((current) => !current || Number(data.revision) >= Number(current.revision) ? { ...data, state: normalizeState(data.state) } : current);
      setNotice("");
    } else {
      const state = freshState();
      const { data: created, error: createError } = await supabase.from(TABLE)
        .insert({ space_id: space.id, state, updated_by: member.user_id })
        .select("*").maybeSingle();
      if (created) {
        setRecord({ ...created, state: normalizeState(created.state) });
        setNotice("");
      } else {
        const { data: retry, error: retryError } = await supabase.from(TABLE).select("*").eq("space_id", space.id).maybeSingle();
        if (retry) setRecord({ ...retry, state: normalizeState(retry.state) });
        else setNotice(createError || retryError ? "Couldn't open the shared pet room. Check supabase/pet.sql and your connection, then try again." : "Couldn't create this pet room. Please refresh and try again.");
      }
    }
    setLoading(false);
  }, [space.id, member.user_id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`pet-room-${space.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `space_id=eq.${space.id}` }, ({ new: next }) => {
        if (!next?.state) return;
        setRecord((current) => !current || Number(next.revision) > Number(current.revision) ? { ...next, state: normalizeState(next.state) } : current);
      }).subscribe();
    const refresh = () => { if (document.visibilityState === "visible") load(false); };
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("focus", refresh); supabase.removeChannel(channel); };
  }, [space.id, load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => {
    window.clearTimeout(petReactionTimer.current);
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel?.();
  }, []);
  useEffect(() => {
    if (!changePetOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setChangePetOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [changePetOpen]);

  const state = record?.state ? normalizeState(record.state) : null;
  const needs = useMemo(() => state ? currentNeeds(state.needs, now) : null, [state, now]);
  const level = state ? levelFor(state.xp) : { level: 1, progress: 0 };
  const pet = state?.pet ? PET_BY_ID[state.pet.id] : null;
  const theme = ROOM_THEMES.find((item) => item.id === state?.theme) || ROOM_THEMES[0];
  const canRecognizeSpeech = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const canSpeakPet = typeof window !== "undefined" && Boolean(window.speechSynthesis) && typeof window.SpeechSynthesisUtterance === "function";
  useEffect(() => {
    if (state?.pet?.color) setPetColorDraft(state.pet.color);
  }, [state?.pet?.id, state?.pet?.color]);
  const visibleDecor = category === "All" ? DECOR : DECOR.filter((item) => item.category === category);
  const sortedDecor = [...visibleDecor].sort((a, b) => a.name.localeCompare(b.name));

  const commit = async (nextState, successMessage = "") => {
    if (!record || saving) return false;
    setSaving(true);
    setNotice("");
    const savedState = normalizeState({ ...nextState, needs: { ...nextState.needs, updatedAt: new Date().toISOString() } });
    const { data, error } = await supabase.from(TABLE)
      .update({ state: savedState, revision: Number(record.revision || 0) + 1, updated_by: member.user_id, updated_at: new Date().toISOString() })
      .eq("id", record.id).eq("revision", Number(record.revision || 0)).select("*").maybeSingle();
    if (error || !data) {
      await load(false);
      setNotice(error ? "That change didn't save. Check your connection and try again." : "The room changed on another device. It has been refreshed; please try your action again.");
      setSaving(false);
      return false;
    }
    setRecord({ ...data, state: normalizeState(data.state) });
    if (successMessage) setLastAction(successMessage);
    setSaving(false);
    return true;
  };

  const adopt = async () => {
    if (!state || state.pet) return;
    const name = petName.trim().slice(0, 18) || PET_BY_ID[selectedPet].name;
    const adopted = await commit({ ...state, pet: { id: selectedPet, name, color: PET_BY_ID[selectedPet].color }, adoptedAt: new Date().toISOString() }, `${name} has joined your home!`);
    if (adopted) animatePet("happy");
  };

  const reactToTouch = () => {
    const options = TAP_REACTIONS.filter((reaction) => reaction.action !== petReaction);
    const reaction = options[Math.floor(Math.random() * options.length)] || TAP_REACTIONS[0];
    animatePet(reaction.action, reaction.line, true);
  };

  const savePetColor = async () => {
    if (!state?.pet || !/^#[\da-f]{6}$/i.test(petColorDraft)) return;
    const saved = await commit({ ...state, pet: { ...state.pet, color: petColorDraft } }, "Your pet has a fresh new coat color!");
    if (saved) animatePet("happy", "I love my new look!", true);
  };

  const talkToPet = (event) => {
    event.preventDefault();
    const message = talkText.trim().slice(0, 180);
    if (!message) return;
    setTalkText("");
    animatePet("talk", message, true);
  };

  const listenAndRepeat = () => {
    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("Voice input isn't available in this browser. Type a message and your pet will say it aloud.");
      return;
    }
    setNotice("");
    try {
      window.speechSynthesis?.cancel?.();
      const recognition = new Recognition();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setListening(true);
      recognition.onresult = (event) => {
        const transcript = String(event.results?.[0]?.[0]?.transcript || "").trim().slice(0, 180);
        if (!transcript) return setNotice("I didn't catch that. Try again or type a message.");
        setTalkText(transcript);
        animatePet("talk", transcript, true);
      };
      recognition.onerror = (event) => {
        setNotice(event.error === "not-allowed" ? "Allow microphone access to use voice input, or type a message instead." : "I couldn't hear that clearly. Try again or type a message.");
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListening(false);
      setNotice("Voice input couldn't start. Type a message and your pet will say it aloud.");
    }
  };

  const care = async (actionId) => {
    if (!state?.pet || !needs) return;
    const action = CARE_ACTIONS[actionId];
    if (!action) return;
    const updatedNeeds = Object.fromEntries(NEEDS.map(({ id }) => [id, clamp(needs[id] + (action[id] || 0))]));
    const date = todayKey();
    const daily = state.daily.date === date ? state.daily : { ...state.daily, date, completed: [] };
    const wasComplete = daily.completed.includes(actionId);
    const completed = DAILY_CARE.some((task) => task.id === actionId) && !wasComplete
      ? [...daily.completed, actionId]
      : daily.completed;
    const didFinish = completed.length === DAILY_CARE.length && daily.completed.length < DAILY_CARE.length;
    let xp = state.xp + (!wasComplete && DAILY_CARE.some((task) => task.id === actionId) ? 10 : 0);
    let streak = daily.streak || 0;
    let lastCompleteDay = daily.lastCompleteDay || null;
    if (didFinish) {
      const yesterday = new Date(`${date}T00:00:00.000Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      streak = lastCompleteDay === yesterdayKey ? streak + 1 : lastCompleteDay === date ? streak : 1;
      lastCompleteDay = date;
      xp += 20;
    }
    const next = {
      ...state,
      xp,
      needs: { ...updatedNeeds, updatedAt: new Date().toISOString() },
      daily: { ...daily, completed, streak, lastCompleteDay, completedDay: didFinish ? date : daily.completedDay },
    };
    const message = didFinish ? `${action.message} Daily care complete! +20 bonus XP.`
      : !wasComplete && DAILY_CARE.some((task) => task.id === actionId) ? `${action.message} +10 XP for today's care.` : action.message;
    const saved = await commit(next, message);
    if (saved) animatePet(actionId, CARE_LINES[actionId] || "That was nice!");
  };

  const addItem = async (item) => {
    if (!state || state.ownedItems.includes(item.id)) return;
    await commit({ ...state, ownedItems: [...state.ownedItems, item.id] }, `${item.name} added to your collection.`);
  };

  const placeItem = async (item) => {
    if (!state?.ownedItems.includes(item.id)) return;
    if (item.slot === "pet") {
      await commit({ ...state, equipped: state.equipped === item.id ? null : item.id }, state.equipped === item.id ? "Accessory put away." : `${item.name} looks lovely!`);
      return;
    }
    const placed = { ...state.placed };
    if (placed[item.slot] === item.id) delete placed[item.slot];
    else placed[item.slot] = item.id;
    await commit({ ...state, placed }, placed[item.slot] ? `${item.name} placed in the room.` : `${item.name} put away.`);
  };

  const setTheme = async (nextTheme) => {
    if (!state) return;
    const isOwned = state.ownedThemes.includes(nextTheme.id);
    await commit({ ...state, theme: nextTheme.id, ownedThemes: isOwned ? state.ownedThemes : [...state.ownedThemes, nextTheme.id] }, `${nextTheme.name} is now your room style.`);
  };

  const renamePet = async () => {
    const nextName = window.prompt("What should your pet be called?", state.pet.name);
    if (nextName === null) return;
    const name = nextName.trim().slice(0, 18);
    if (!name) return setNotice("Give your pet a name with at least one letter.");
    if (name === state.pet.name) return;
    await commit({ ...state, pet: { ...state.pet, name } }, `${name} has a new name!`);
  };

  const changePet = async () => {
    const choice = PET_BY_ID[replacementPet];
    if (!choice || choice.id === state.pet.id) return;
    const previousDefaultName = PET_BY_ID[state.pet.id].name;
    const name = state.pet.name === previousDefaultName ? choice.name : state.pet.name;
    const changed = await commit({ ...state, pet: { id: choice.id, name, color: choice.color } }, `${name} is now your ${choice.name.toLowerCase()}! Your room and progress are safe.`);
    if (changed) {
      setChangePetOpen(false);
      animatePet("happy");
    }
  };

  if (loading) return <section className="pet-page" aria-label="Pet Room"><div className="pet-loading"><PawPrint size={38} /><p>Warming up the pet room…</p></div></section>;

  if (!state?.pet) return (
    <section className="pet-page" aria-label="Pet Room">
      <header className="pet-heading"><div className="pet-heading-icon"><PawPrint size={26} /></div><div><div className="pet-eyebrow">A LITTLE HOME, TOGETHER</div><h1>Pet Room</h1><p>Choose a companion for your shared space. You’ll both care for them and make their room yours.</p></div></header>
      {notice && <div className="pet-notice">{notice}</div>}
      <section className="pet-adopt-card">
        <div className="pet-section-heading"><div><span className="pet-eyebrow">MEET YOUR NEW ROOMMATE</span><h2>Who’s coming home?</h2><p>Every companion has their own little personality.</p></div><span className="pet-free-note">All pets, styles, and decor are free</span></div>
        <div className="pet-choice-grid">{PETS.map((choice) => <button className={`pet-choice ${selectedPet === choice.id ? "selected" : ""}`} key={choice.id} onClick={() => setSelectedPet(choice.id)} style={{ "--pet-color": choice.color }}><span className="pet-choice-character"><AnimatedPet species={choice.id} /></span><strong>{choice.name}</strong><small>{choice.personality}</small>{selectedPet === choice.id && <span className="pet-choice-check"><Check size={14} /></span>}</button>)}</div>
        <div className="pet-adopt-footer"><label className="pet-name-label">Give them a name<input value={petName} onChange={(event) => setPetName(event.target.value.slice(0, 18))} placeholder={PET_BY_ID[selectedPet].name} maxLength={18} /></label><button className="pet-primary" onClick={adopt} disabled={saving}><Heart size={17} /> {saving ? "Bringing them home…" : "Adopt together"}</button></div>
      </section>
      <p className="pet-footnote">Adopting creates one shared animal companion for everyone in this space. Choose another animal or room style whenever you like.</p>
    </section>
  );

  const allDailyDone = state.daily.completed.length === DAILY_CARE.length;
  const achievements = [
    { id: "adopt", title: "A new beginning", text: "Adopt your first companion", icon: Home, done: Boolean(state.adoptedAt || state.pet) },
    { id: "care", title: "Here for you", text: "Complete a daily care task", icon: Heart, done: state.daily.completed.length > 0 || state.daily.completedDay },
    { id: "routine", title: "The whole routine", text: "Finish all four daily tasks", icon: Check, done: Boolean(state.daily.completedDay) },
    { id: "streak", title: "Little ritual", text: "Build a three-day care streak", icon: Star, done: state.daily.streak >= 3 },
    { id: "level", title: "Growing together", text: "Reach level five", icon: PawPrint, done: level.level >= 5 },
    { id: "decor", title: "Interior dreamers", text: "Collect ten room items", icon: Package, done: state.ownedItems.length >= 10 },
  ];

  return (
    <section className="pet-page" aria-label="Pet Room">
      <header className="pet-heading"><div className="pet-heading-icon"><PawPrint size={26} /></div><div><div className="pet-eyebrow">YOUR SHARED LITTLE WORLD</div><h1>{state.pet.name}’s Pet Room</h1><p>Take care, collect cozy things, and make a home that feels like both of you.</p></div></header>
      {notice && <div className="pet-notice">{notice}</div>}
      {lastAction && <div className="pet-toast"><Sparkles size={16} /> {lastAction}</div>}
      <div className="pet-presence"><span className="pet-live-dot" /> Shared with {members.length} {members.length === 1 ? "member" : "members"}<span>·</span> Last shared change by {formatUpdatedBy(record?.updated_by, members)}</div>
      <nav className="pet-tabs" aria-label="Pet room pages">
        <button className={tab === "room" ? "active" : ""} onClick={() => setTab("room")}><Home size={17} /> Room</button>
        <button className={tab === "shop" ? "active" : ""} onClick={() => setTab("shop")}><Store size={17} /> Shop <span className="pet-tab-count">{DECOR.length}</span></button>
        <button className={tab === "collection" ? "active" : ""} onClick={() => setTab("collection")}><Package size={17} /> Collection <span className="pet-tab-count">{state.ownedItems.length}</span></button>
        <button className={tab === "trophies" ? "active" : ""} onClick={() => setTab("trophies")}><Trophy size={17} /> Milestones</button>
      </nav>

      {tab === "room" && <div className="pet-layout">
        <section className="pet-room-card">
          <div className="pet-room-top"><div><span className="pet-eyebrow">HOME SWEET HOME</span><h2>{theme.name}</h2></div><div className="pet-room-tools"><button className="pet-small-button" onClick={() => { setReplacementPet(state.pet.id); setChangePetOpen(true); }} disabled={saving}><PawPrint size={14} /> Change pet</button><button className="pet-small-button" onClick={renamePet} disabled={saving}><Pencil size={14} /> Rename</button><button className="pet-small-button" onClick={() => setTab("shop")}><Sparkles size={15} /> Change style</button></div></div>
          <div className="pet-scene" style={{ "--room-wall": theme.wall, "--room-floor": theme.floor, "--room-accent": theme.accent }}>
            <div className="pet-room-window"><i /><i /></div><div className="pet-room-wall-line" />
            {Object.entries(state.placed).map(([slot, itemId]) => {
              const item = DECOR_BY_ID[itemId];
              const position = ROOM_SLOTS[slot];
              if (!item || !position) return null;
              return <button key={slot} className={`pet-room-item pet-slot-${slot}`} style={position} onClick={() => placeItem(item)} title={`${item.name} · tap to put away`}><Furniture item={item} /><small>{item.name}</small></button>;
            })}
            <div className="pet-room-pet" style={{ "--pet-color": state.pet.color || pet.color }}><button key={petAnimationKey} className={`pet-character-button pet-action-${petReaction}`} type="button" onClick={reactToTouch} aria-label={`Touch ${state.pet.name} for a reaction`}><AnimatedPet species={pet.id} color={state.pet.color} action={petReaction} accessoryColor={state.equipped ? DECOR_BY_ID[state.equipped]?.color : undefined} /><span className={`pet-speech-bubble ${petBubble ? "visible" : ""}`} aria-live="polite">{petBubble}</span></button><strong>{state.pet.name}</strong><small>{needs.happiness >= 70 ? "feeling loved" : needs.happiness >= 40 ? "ready for a cuddle" : "missing you a little"} · touch for a reaction</small></div>
            <span className="pet-room-sparkle pet-sparkle-one" /><span className="pet-room-sparkle pet-sparkle-two" /><span className="pet-room-floor-label">Shared pet room</span>
          </div>
          <div className="pet-room-tip"><Sparkles size={15} /> Touch your pet for a different mood and spoken response. Care actions make them react; tap furniture to put it away.</div>
          <div className="pet-placed-chips">{Object.values(state.placed).length} items on display <span>·</span> {state.ownedItems.length} collected <span>·</span> {state.ownedThemes.length} room styles</div>
        </section>
        <aside className="pet-side-column">
          <section className="pet-panel pet-level-panel"><div className="pet-level-top"><div className="pet-level-badge"><Star size={18} fill="currentColor" /></div><div><strong>Level {level.level}</strong><small>{state.xp} total XP</small></div><span className="pet-level-next">{level.level >= 50 ? "MAX" : `${level.progress}/100 XP`}</span></div><div className="pet-xp-track"><span style={{ width: `${level.progress}%` }} /></div><p>Care together to earn XP and help {state.pet.name} grow.</p></section>
          <section className="pet-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">LITTLE CHECK-IN</span><h3>How are they feeling?</h3></div><span className="pet-mood-status">{Math.min(...NEEDS.map((need) => needs[need.id])) >= 75 ? "Content" : Math.min(...NEEDS.map((need) => needs[need.id])) >= 40 ? "Doing okay" : "Needs care"}</span></div><div className="pet-needs-list">{NEEDS.map((need) => { const Icon = NEED_ICONS[need.id]; return <div className="pet-need" key={need.id}><div className="pet-need-label"><span className="pet-need-name"><Icon size={13} /> {need.label}</span><strong>{needs[need.id]}%</strong></div><div className="pet-need-track"><span style={{ width: `${needs[need.id]}%`, background: need.color }} /></div></div>; })}</div></section>
          <section className="pet-panel pet-color-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">MAKE THEM YOURS</span><h3>Coat color</h3></div><span className="pet-color-preview" style={{ background: petColorDraft }} /></div><div className="pet-color-controls"><label className="pet-color-input-label"><span>Choose any color</span><input type="color" value={petColorDraft} onChange={(event) => setPetColorDraft(event.target.value)} aria-label="Choose your pet’s coat color" /></label><div className="pet-color-swatches" aria-label="Quick coat colors">{PET_COAT_SWATCHES.map((color) => <button key={color} type="button" className={petColorDraft.toLowerCase() === color ? "selected" : ""} onClick={() => setPetColorDraft(color)} aria-label={`Choose ${color} coat color`} aria-pressed={petColorDraft.toLowerCase() === color} style={{ "--swatch": color }} />)}</div></div><button className="pet-color-save" type="button" onClick={savePetColor} disabled={saving || petColorDraft.toLowerCase() === state.pet.color?.toLowerCase()}>{saving ? "Saving…" : "Save coat color"}</button></section>
          <section className="pet-panel pet-talk-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">SAY SOMETHING</span><h3>Talk together</h3></div><Mic size={17} /></div><p className="pet-talk-intro">{canSpeakPet ? "Your pet repeats what it hears in a playful voice." : "Send a message and your pet will answer in a speech bubble."}</p><form className="pet-talk-form" onSubmit={talkToPet}><label className="sr-only" htmlFor="pet-talk-message">Message for {state.pet.name}</label><input id="pet-talk-message" value={talkText} onChange={(event) => setTalkText(event.target.value.slice(0, 180))} placeholder={`Say something to ${state.pet.name}…`} maxLength={180} /><button type="submit" disabled={!talkText.trim()} aria-label="Have your pet repeat this message"><Volume2 size={17} /></button></form><button className={`pet-mic-button ${listening ? "listening" : ""}`} type="button" onClick={listenAndRepeat} disabled={!canRecognizeSpeech && !listening}>{listening ? <MicOff size={16} /> : <Mic size={16} />}{listening ? "Stop listening" : "Speak to your pet"}</button><small className="pet-talk-hint">{canRecognizeSpeech ? "Your browser handles voice input after you tap." : "Voice input isn't supported here; type a message instead."}</small></section>
          <section className="pet-panel pet-care-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">TODAY · UP TO 60 XP</span><h3>Care together</h3></div><span className="pet-streak"><Sparkles size={14} /> {state.daily.streak} day streak</span></div><p className="pet-care-intro">Complete each daily task for 10 XP, and finish all four for a 20 XP bonus.</p><div className="pet-care-actions">{[
            ["feed", "Feed"], ["play", "Play"], ["clean", "Freshen up"], ["cuddle", "Cuddle"], ["nap", "Nap"],
          ].map(([id, label]) => { const Icon = ACTION_ICONS[id]; return <button key={id} onClick={() => care(id)} disabled={saving} className={`pet-care-action ${state.daily.completed.includes(id) ? "done" : ""}`}><span><Icon size={17} /></span><strong>{label}</strong>{state.daily.completed.includes(id) && <Check size={13} />}</button>; })}</div><div className="pet-task-list">{DAILY_CARE.map((task) => { const Icon = ACTION_ICONS[task.id]; const done = state.daily.completed.includes(task.id); return <div className={done ? "done" : ""} key={task.id}><span className="pet-task-check">{done ? <Check size={13} /> : <Icon size={12} />}</span><span>{task.name}</span><strong>{done ? "Earned" : `+${task.xp} XP`}</strong></div>; })}</div>{allDailyDone && <div className="pet-daily-complete"><Check size={14} /> Today’s care is complete. Your pet feels so loved!</div>}</section>
        </aside>
      </div>}

      {tab === "shop" && <section className="pet-shop-page">
        <div className="pet-shop-header"><div><span className="pet-eyebrow">THE LITTLE THINGS SHOP</span><h2>Make this room yours</h2><p>Every pet, room style, and decor item is free.</p></div></div>
        <div className="pet-theme-section"><div className="pet-subheading"><div><h3><Sparkles size={17} /> Room styles</h3><p>Choose a complete color palette for your home.</p></div></div><div className="pet-theme-grid">{ROOM_THEMES.map((option) => { const owned = state.ownedThemes.includes(option.id); return <button key={option.id} className={`pet-theme-card ${state.theme === option.id ? "current" : ""}`} onClick={() => setTheme(option)} style={{ "--room-wall": option.wall, "--room-floor": option.floor, "--room-accent": option.accent }} disabled={saving}><span className="pet-theme-swatch"><i /><i /></span><span className="pet-theme-copy"><strong>{option.name}</strong><small>{state.theme === option.id ? "Current style" : owned ? "Owned · tap to use" : "Free · tap to use"}</small></span>{state.theme === option.id && <Check size={16} />}</button>; })}</div></div>
        <div className="pet-catalog-heading"><div><h3><ShoppingBag size={17} /> Furniture & little treasures</h3><p>{DECOR.length} pieces to make your home feel like yours.</p></div><label className="pet-category-select"><span className="sr-only">Filter decor</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{DECOR_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className="pet-shop-grid">{sortedDecor.map((item) => { const owned = state.ownedItems.includes(item.id); const isPlaced = item.slot === "pet" ? state.equipped === item.id : state.placed[item.slot] === item.id; return <article className={`pet-item-card ${owned ? "owned" : ""}`} key={item.id}><div className={`pet-item-art pet-item-${item.category.toLowerCase().replaceAll(" ", "-")}`}><Furniture item={item} />{owned && <span className="pet-owned-mark"><Check size={13} /></span>}</div><div className="pet-item-copy"><strong>{item.name}</strong><p>{item.description}</p><div className="pet-item-bottom">{owned ? <button className={`pet-item-action ${isPlaced ? "placed" : ""}`} onClick={() => placeItem(item)} disabled={saving}>{isPlaced ? "Put away" : item.slot === "pet" ? "Equip" : "Place in room"}</button> : <button className="pet-free-button" onClick={() => addItem(item)} disabled={saving}>Add free</button>}</div></div></article>; })}</div>
      </section>}

      {tab === "collection" && <section className="pet-collection-page"><div className="pet-shop-header"><div><span className="pet-eyebrow">YOUR SHARED COLLECTION</span><h2>All your treasures</h2><p>Place something in the room, or put it away until later.</p></div><div className="pet-collection-count"><Package size={17} /> {state.ownedItems.length} / {DECOR.length} items</div></div><div className="pet-collection-progress"><span style={{ width: `${Math.round(state.ownedItems.length / DECOR.length * 100)}%` }} /></div><div className="pet-collection-grid">{DECOR.filter((item) => state.ownedItems.includes(item.id)).map((item) => { const isPlaced = item.slot === "pet" ? state.equipped === item.id : state.placed[item.slot] === item.id; return <button className={`pet-collection-item ${isPlaced ? "active" : ""}`} key={item.id} onClick={() => placeItem(item)} disabled={saving}><span className="pet-collection-art"><Furniture item={item} /></span><span className="pet-collection-copy"><strong>{item.name}</strong><small>{item.category} · {isPlaced ? item.slot === "pet" ? "wearing" : "in room" : "in collection"}</small></span><span className="pet-collection-action">{isPlaced ? "Put away" : "Place"}</span></button>; })}</div><div className="pet-collection-empty">{DECOR.length - state.ownedItems.length > 0 && <p>There are {DECOR.length - state.ownedItems.length} more things waiting in the <button onClick={() => setTab("shop")}>shop</button>.</p>}</div></section>}

      {tab === "trophies" && <section className="pet-achievements-page"><div className="pet-shop-header"><div><span className="pet-eyebrow">LITTLE THINGS ADD UP</span><h2>Your shared milestones</h2><p>Small routines, happy memories, and a home you built together.</p></div><div className="pet-achievement-count"><Trophy size={17} /> {achievements.filter((item) => item.done).length} / {achievements.length} earned</div></div><div className="pet-achievement-grid">{achievements.map((achievement) => { const Icon = achievement.icon; return <article className={`pet-achievement ${achievement.done ? "unlocked" : ""}`} key={achievement.id}><span><Icon size={23} /></span><div><strong>{achievement.title}</strong><p>{achievement.text}</p></div><span className="pet-achievement-state">{achievement.done ? <Check size={16} /> : "Not yet"}</span></article>; })}</div><div className="pet-care-history"><div className="pet-care-history-icon"><Heart size={18} /></div><div><strong>{state.daily.streak} day{state.daily.streak === 1 ? "" : "s"} of showing up</strong><p>{state.daily.completedDay === todayKey() ? "All four care tasks are complete today. See you tomorrow for the next little ritual." : `${state.daily.completed.length} of 4 care tasks done today. A small check-in goes a long way.`}</p></div></div></section>}

      <footer className="pet-footnote">Your shared pet’s needs change gently over time, and never reach zero permanently. Your home and progress are saved together in your shared space.</footer>
      {changePetOpen && <div className="pet-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setChangePetOpen(false); }}><section className="pet-change-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-change-title"><button className="pet-modal-close" onClick={() => setChangePetOpen(false)} aria-label="Close pet selector">×</button><span className="pet-eyebrow">A NEW LITTLE LOOK</span><h2 id="pet-change-title">Choose a different pet</h2><p>Your room, care progress, and collection will stay just as they are.</p><div className="pet-change-grid">{PETS.map((choice) => <button key={choice.id} className={`pet-change-choice ${replacementPet === choice.id ? "selected" : ""}`} onClick={() => setReplacementPet(choice.id)} style={{ "--pet-color": choice.color }}><span className="pet-change-character"><AnimatedPet species={choice.id} /></span><strong>{choice.name}</strong></button>)}</div><div className="pet-change-actions"><button className="pet-cancel-button" onClick={() => setChangePetOpen(false)}>Keep current pet</button><button className="pet-primary" onClick={changePet} disabled={saving || replacementPet === state.pet.id}>{saving ? "Changing pet…" : "Change pet"}</button></div></section></div>}
    </section>
  );
}
