import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check, Coins, Heart, Home, Package, PawPrint, Pencil, ShoppingBag,
  Sparkles, Star, Store, Trophy,
} from "lucide-react";
import { supabase } from "./supabase.js";
import {
  CARE_ACTIONS, DAILY_CARE, DECOR, DECOR_BY_ID, DECOR_CATEGORIES,
  NEEDS, PETS, PET_BY_ID, ROOM_SLOTS, ROOM_THEMES, STARTER_ITEMS,
  STARTER_PLACED,
} from "./petCatalog.js";
import "./pet.css";

const TABLE = "shared_pet_rooms";
const todayKey = () => new Date().toISOString().slice(0, 10);
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

function freshState() {
  return {
    pet: null,
    coins: 250,
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
  const raw = value && typeof value === "object" ? value : {};
  const pet = raw.pet && PET_BY_ID[raw.pet.id]
    ? { id: raw.pet.id, name: String(raw.pet.name || PET_BY_ID[raw.pet.id].name).slice(0, 18) }
    : null;
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
    coins: Number.isFinite(raw.coins) ? Math.max(0, Math.floor(raw.coins)) : base.coins,
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
  const [now, setNow] = useState(Date.now());

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

  const state = record?.state ? normalizeState(record.state) : null;
  const needs = useMemo(() => state ? currentNeeds(state.needs, now) : null, [state, now]);
  const level = state ? levelFor(state.xp) : { level: 1, progress: 0 };
  const pet = state?.pet ? PET_BY_ID[state.pet.id] : null;
  const theme = ROOM_THEMES.find((item) => item.id === state?.theme) || ROOM_THEMES[0];
  const visibleDecor = category === "All" ? DECOR : DECOR.filter((item) => item.category === category);
  const sortedDecor = [...visibleDecor].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));

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
    await commit({ ...state, pet: { id: selectedPet, name }, adoptedAt: new Date().toISOString() }, `${name} has joined your home!`);
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
    let coins = state.coins + (!wasComplete && DAILY_CARE.some((task) => task.id === actionId) ? 10 : 0);
    let xp = state.xp + (!wasComplete && DAILY_CARE.some((task) => task.id === actionId) ? 10 : 0);
    let streak = daily.streak || 0;
    let lastCompleteDay = daily.lastCompleteDay || null;
    if (didFinish) {
      const yesterday = new Date(`${date}T00:00:00.000Z`);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      streak = lastCompleteDay === yesterdayKey ? streak + 1 : lastCompleteDay === date ? streak : 1;
      lastCompleteDay = date;
      coins += 30;
      xp += 20;
    }
    const next = {
      ...state,
      coins,
      xp,
      needs: { ...updatedNeeds, updatedAt: new Date().toISOString() },
      daily: { ...daily, completed, streak, lastCompleteDay, completedDay: didFinish ? date : daily.completedDay },
    };
    const message = didFinish ? `${action.message} Daily care complete! +30 bonus coins and +20 XP.`
      : !wasComplete && DAILY_CARE.some((task) => task.id === actionId) ? `${action.message} +10 coins and +10 XP for today's care.` : action.message;
    await commit(next, message);
  };

  const buyItem = async (item) => {
    if (!state || state.ownedItems.includes(item.id)) return;
    if (state.coins < item.price) return setNotice(`You need ${item.price - state.coins} more coins for ${item.name}.`);
    await commit({ ...state, coins: state.coins - item.price, ownedItems: [...state.ownedItems, item.id] }, `${item.name} added to your collection.`);
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
    if (!isOwned && state.coins < nextTheme.price) return setNotice(`You need ${nextTheme.price - state.coins} more coins for this room style.`);
    await commit({ ...state, theme: nextTheme.id, coins: isOwned ? state.coins : state.coins - nextTheme.price, ownedThemes: isOwned ? state.ownedThemes : [...state.ownedThemes, nextTheme.id] }, `${nextTheme.name} is now your room style.`);
  };

  const renamePet = async () => {
    const nextName = window.prompt("What should your pet be called?", state.pet.name);
    if (nextName === null) return;
    const name = nextName.trim().slice(0, 18);
    if (!name) return setNotice("Give your pet a name with at least one letter.");
    if (name === state.pet.name) return;
    await commit({ ...state, pet: { ...state.pet, name } }, `${name} has a new name!`);
  };

  if (loading) return <section className="pet-page" aria-label="Pet Room"><div className="pet-loading"><span>🐾</span><p>Warming up the pet room…</p></div></section>;

  if (!state?.pet) return (
    <section className="pet-page" aria-label="Pet Room">
      <header className="pet-heading"><div className="pet-heading-icon"><PawPrint size={26} /></div><div><div className="pet-eyebrow">A LITTLE HOME, TOGETHER</div><h1>Pet Room</h1><p>Choose a companion for your shared space. You’ll both care for them and make their room yours.</p></div></header>
      {notice && <div className="pet-notice">{notice}</div>}
      <section className="pet-adopt-card">
        <div className="pet-section-heading"><div><span className="pet-eyebrow">MEET YOUR NEW ROOMMATE</span><h2>Who’s coming home?</h2><p>Every companion has their own little personality.</p></div><span className="pet-starter-coins"><Coins size={17} /> 250 starter coins</span></div>
        <div className="pet-choice-grid">{PETS.map((choice) => <button className={`pet-choice ${selectedPet === choice.id ? "selected" : ""}`} key={choice.id} onClick={() => setSelectedPet(choice.id)} style={{ "--pet-color": choice.color }}><span className="pet-choice-emoji">{choice.emoji}</span><strong>{choice.name}</strong><small>{choice.personality}</small>{selectedPet === choice.id && <span className="pet-choice-check"><Check size={14} /></span>}</button>)}</div>
        <div className="pet-adopt-footer"><label className="pet-name-label">Give them a name<input value={petName} onChange={(event) => setPetName(event.target.value.slice(0, 18))} placeholder={PET_BY_ID[selectedPet].name} maxLength={18} /></label><button className="pet-primary" onClick={adopt} disabled={saving}><Heart size={17} /> {saving ? "Bringing them home…" : "Adopt together"}</button></div>
      </section>
      <p className="pet-footnote">Adopting creates one shared pet for everyone in this space. Starter furniture and 250 coins are included.</p>
    </section>
  );

  const allDailyDone = state.daily.completed.length === DAILY_CARE.length;
  const achievements = [
    { id: "adopt", title: "A new beginning", text: "Adopt your first companion", emoji: "🏡", done: Boolean(state.adoptedAt || state.pet) },
    { id: "care", title: "Here for you", text: "Complete a daily care task", emoji: "🫶", done: state.daily.completed.length > 0 || state.daily.completedDay },
    { id: "routine", title: "The whole routine", text: "Finish all four daily tasks", emoji: "🌟", done: Boolean(state.daily.completedDay) },
    { id: "streak", title: "Little ritual", text: "Build a three-day care streak", emoji: "🔥", done: state.daily.streak >= 3 },
    { id: "level", title: "Growing together", text: "Reach level five", emoji: "📈", done: level.level >= 5 },
    { id: "decor", title: "Interior dreamers", text: "Collect ten room items", emoji: "🪴", done: state.ownedItems.length >= 10 },
  ];

  return (
    <section className="pet-page" aria-label="Pet Room">
      <header className="pet-heading"><div className="pet-heading-icon"><PawPrint size={26} /></div><div><div className="pet-eyebrow">YOUR SHARED LITTLE WORLD</div><h1>{state.pet.name}’s Pet Room</h1><p>Take care, collect cozy things, and make a home that feels like both of you.</p></div><div className="pet-wallet"><Coins size={18} /><strong>{state.coins}</strong><span>coins</span></div></header>
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
          <div className="pet-room-top"><div><span className="pet-eyebrow">HOME SWEET HOME</span><h2>{theme.emoji} {theme.name}</h2></div><div className="pet-room-tools"><button className="pet-small-button" onClick={renamePet} disabled={saving}><Pencil size={14} /> Rename pet</button><button className="pet-small-button" onClick={() => setTab("shop")}><Sparkles size={15} /> Change style</button></div></div>
          <div className="pet-scene" style={{ "--room-wall": theme.wall, "--room-floor": theme.floor, "--room-accent": theme.accent }}>
            <div className="pet-room-window"><span>☀️</span><i /><i /></div><div className="pet-room-wall-line" />
            {Object.entries(state.placed).map(([slot, itemId]) => {
              const item = DECOR_BY_ID[itemId];
              const position = ROOM_SLOTS[slot];
              if (!item || !position) return null;
              return <button key={slot} className={`pet-room-item pet-slot-${slot}`} style={position} onClick={() => placeItem(item)} title={`${item.name} · tap to put away`}><span>{item.emoji}</span><small>{item.name}</small></button>;
            })}
            <div className="pet-room-pet" style={{ "--pet-color": pet.color }}><span className="pet-pet-shadow" /><span className="pet-avatar">{pet.emoji}{state.equipped && <i>{DECOR_BY_ID[state.equipped]?.emoji}</i>}</span><strong>{state.pet.name}</strong><small>{needs.happiness >= 70 ? "feeling loved" : needs.happiness >= 40 ? "ready for a cuddle" : "missing you a little"}</small></div>
            <span className="pet-room-sparkle pet-sparkle-one">✦</span><span className="pet-room-sparkle pet-sparkle-two">✧</span><span className="pet-room-floor-label">a safe, cozy place</span>
          </div>
          <div className="pet-room-tip"><Sparkles size={15} /> Tap any furniture to put it away. Visit your Collection to place it again.</div>
          <div className="pet-placed-chips">{Object.values(state.placed).length} items on display <span>·</span> {state.ownedItems.length} collected <span>·</span> {state.ownedThemes.length} room styles</div>
        </section>
        <aside className="pet-side-column">
          <section className="pet-panel pet-level-panel"><div className="pet-level-top"><div className="pet-level-badge"><Star size={18} fill="currentColor" /></div><div><strong>Level {level.level}</strong><small>{state.xp} total XP</small></div><span className="pet-level-next">{level.level >= 50 ? "MAX" : `${level.progress}/100 XP`}</span></div><div className="pet-xp-track"><span style={{ width: `${level.progress}%` }} /></div><p>Care together to earn XP and help {state.pet.name} grow.</p></section>
          <section className="pet-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">LITTLE CHECK-IN</span><h3>How are they feeling?</h3></div><span className="pet-mood-emoji">{Math.min(...NEEDS.map((need) => needs[need.id])) >= 75 ? "🥰" : Math.min(...NEEDS.map((need) => needs[need.id])) >= 40 ? "🙂" : "🥺"}</span></div><div className="pet-needs-list">{NEEDS.map((need) => <div className="pet-need" key={need.id}><div className="pet-need-label"><span>{need.emoji} {need.label}</span><strong>{needs[need.id]}%</strong></div><div className="pet-need-track"><span style={{ width: `${needs[need.id]}%`, background: need.color }} /></div></div>)}</div></section>
          <section className="pet-panel pet-care-panel"><div className="pet-panel-heading"><div><span className="pet-eyebrow">TODAY · +70 COINS AVAILABLE</span><h3>Care together</h3></div><span className="pet-streak"><Sparkles size={14} /> {state.daily.streak} day streak</span></div><p className="pet-care-intro">Each task earns 10 coins and 10 XP once a day. Complete all four for a 30-coin bonus.</p><div className="pet-care-actions">{[
            ["feed", "Feed", "🍓"], ["play", "Play", "🎾"], ["clean", "Freshen up", "🫧"], ["cuddle", "Cuddle", "🫶"], ["nap", "Nap", "🌙"],
          ].map(([id, label, emoji]) => <button key={id} onClick={() => care(id)} disabled={saving} className={`pet-care-action ${state.daily.completed.includes(id) ? "done" : ""}`}><span>{emoji}</span><strong>{label}</strong>{state.daily.completed.includes(id) && <Check size={13} />}</button>)}</div><div className="pet-task-list">{DAILY_CARE.map((task) => <div className={state.daily.completed.includes(task.id) ? "done" : ""} key={task.id}><span className="pet-task-check">{state.daily.completed.includes(task.id) ? <Check size={13} /> : task.emoji}</span><span>{task.name}</span><strong>{state.daily.completed.includes(task.id) ? "Earned" : `+${task.reward} coins`}</strong></div>)}</div>{allDailyDone && <div className="pet-daily-complete">🌟 Today’s care is complete. Your pet feels so loved!</div>}</section>
        </aside>
      </div>}

      {tab === "shop" && <section className="pet-shop-page">
        <div className="pet-shop-header"><div><span className="pet-eyebrow">THE LITTLE THINGS SHOP</span><h2>Make this room yours</h2><p>Everything you buy belongs to your shared collection.</p></div><div className="pet-shop-wallet"><Coins size={17} /> {state.coins} coins</div></div>
        <div className="pet-theme-section"><div className="pet-subheading"><div><h3><Sparkles size={17} /> Room styles</h3><p>Choose a complete color palette for your home.</p></div></div><div className="pet-theme-grid">{ROOM_THEMES.map((option) => { const owned = state.ownedThemes.includes(option.id); return <button key={option.id} className={`pet-theme-card ${state.theme === option.id ? "current" : ""}`} onClick={() => setTheme(option)} style={{ "--room-wall": option.wall, "--room-floor": option.floor, "--room-accent": option.accent }} disabled={saving}><span className="pet-theme-swatch"><i /><i /></span><span className="pet-theme-copy"><strong>{option.emoji} {option.name}</strong><small>{owned ? state.theme === option.id ? "Current style" : "Owned · tap to use" : `${option.price} coins`}</small></span>{state.theme === option.id && <Check size={16} />}</button>; })}</div></div>
        <div className="pet-catalog-heading"><div><h3><ShoppingBag size={17} /> Furniture & little treasures</h3><p>{DECOR.length} pieces to make your home feel like yours.</p></div><label className="pet-category-select"><span className="sr-only">Filter decor</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{DECOR_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className="pet-shop-grid">{sortedDecor.map((item) => { const owned = state.ownedItems.includes(item.id); const isPlaced = item.slot === "pet" ? state.equipped === item.id : state.placed[item.slot] === item.id; return <article className={`pet-item-card ${owned ? "owned" : ""}`} key={item.id}><div className={`pet-item-art pet-item-${item.category.toLowerCase().replaceAll(" ", "-")}`}><span>{item.emoji}</span>{owned && <span className="pet-owned-mark"><Check size={13} /></span>}</div><div className="pet-item-copy"><strong>{item.name}</strong><p>{item.description}</p><div className="pet-item-bottom">{owned ? <button className={`pet-item-action ${isPlaced ? "placed" : ""}`} onClick={() => placeItem(item)} disabled={saving}>{isPlaced ? "Put away" : item.slot === "pet" ? "Equip" : "Place in room"}</button> : <button className="pet-buy-button" onClick={() => buyItem(item)} disabled={saving || state.coins < item.price}><Coins size={14} /> {item.price} coins</button>}</div></div></article>; })}</div>
      </section>}

      {tab === "collection" && <section className="pet-collection-page"><div className="pet-shop-header"><div><span className="pet-eyebrow">YOUR SHARED COLLECTION</span><h2>All your treasures</h2><p>Place something in the room, or put it away until later.</p></div><div className="pet-collection-count"><Package size={17} /> {state.ownedItems.length} / {DECOR.length} items</div></div><div className="pet-collection-progress"><span style={{ width: `${Math.round(state.ownedItems.length / DECOR.length * 100)}%` }} /></div><div className="pet-collection-grid">{DECOR.filter((item) => state.ownedItems.includes(item.id)).map((item) => { const isPlaced = item.slot === "pet" ? state.equipped === item.id : state.placed[item.slot] === item.id; return <button className={`pet-collection-item ${isPlaced ? "active" : ""}`} key={item.id} onClick={() => placeItem(item)} disabled={saving}><span className="pet-collection-emoji">{item.emoji}</span><span className="pet-collection-copy"><strong>{item.name}</strong><small>{item.category} · {isPlaced ? item.slot === "pet" ? "wearing" : "in room" : "in collection"}</small></span><span className="pet-collection-action">{isPlaced ? "Put away" : "Place"}</span></button>; })}</div><div className="pet-collection-empty">{DECOR.length - state.ownedItems.length > 0 && <p>There are {DECOR.length - state.ownedItems.length} more things waiting in the <button onClick={() => setTab("shop")}>shop</button>.</p>}</div></section>}

      {tab === "trophies" && <section className="pet-achievements-page"><div className="pet-shop-header"><div><span className="pet-eyebrow">LITTLE THINGS ADD UP</span><h2>Your shared milestones</h2><p>Small routines, happy memories, and a home you built together.</p></div><div className="pet-achievement-count"><Trophy size={17} /> {achievements.filter((item) => item.done).length} / {achievements.length} earned</div></div><div className="pet-achievement-grid">{achievements.map((achievement) => <article className={`pet-achievement ${achievement.done ? "unlocked" : ""}`} key={achievement.id}><span>{achievement.emoji}</span><div><strong>{achievement.title}</strong><p>{achievement.text}</p></div><span className="pet-achievement-state">{achievement.done ? <Check size={16} /> : "🔒"}</span></article>)}</div><div className="pet-care-history"><div className="pet-care-history-icon"><Heart size={18} /></div><div><strong>{state.daily.streak} day{state.daily.streak === 1 ? "" : "s"} of showing up</strong><p>{state.daily.completedDay === todayKey() ? "All four care tasks are complete today. See you tomorrow for the next little ritual." : `${state.daily.completed.length} of 4 care tasks done today. A small check-in goes a long way.`}</p></div></div></section>}

      <footer className="pet-footnote">Your shared pet’s needs change gently over time, and never reach zero permanently. Your home and progress are saved together in your shared space.</footer>
    </section>
  );
}
