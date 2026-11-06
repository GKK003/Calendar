import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Clock,
  Trash2,
  User,
  MapPin,
  Sparkles,
  Home,
  Images,
  MessageCircle,
  Gamepad2,
  UsersRound,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "./supabase.js";
import {
  AVATARS,
  PALETTE,
  TYPES,
  dateInZone,
  eventOriginLabel,
  greeting,
  hm,
  localizeEvent,
  mapHref,
  readStoredValue,
  sortEvents,
  timeLabel,
  uuid,
  writeStoredValue,
  ymd,
  zoneLabel,
  zoneOfCity,
} from "./lib.js";
import EventForm from "./EventForm.jsx";
import Clocks from "./Clocks.jsx";
import Avatar from "./Avatar.jsx";
import useChat from "./useChat.js";
import { useView } from "./router.js";
import useCall from "./useCall.js";
import usePush from "./usePush.js";
import usePosts from "./usePosts.js";
import "./special.css";

const YearView = lazy(() => import("./YearView.jsx"));
const Profile = lazy(() => import("./Profile.jsx"));
const PartnerProfile = lazy(() => import("./PartnerProfile.jsx"));
const Dashboard = lazy(() => import("./Dashboard.jsx"));
const CirclePage = lazy(() => import("./CirclePage.jsx"));
const Gallery = lazy(() => import("./Gallery.jsx"));
const Chat = lazy(() => import("./Chat.jsx"));
const Games = lazy(() => import("./Games.jsx"));
const CallOverlay = lazy(() => import("./CallOverlay.jsx"));
const VIEW_TITLES = {
  today: "Today", month: "Month", year: "Year", gallery: "Gallery",
  games: "Games", circle: "Circle", chat: "Chat", profile: "Profile",
};

export default function Calendar({ session, member, space, onProfileChange }) {
  const initialZone = zoneOfCity(member.city);
  const initialDate = dateInZone(initialZone);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseISO(initialDate));
  const [selected, setSelected] = useState(initialDate);
  const [view, setView] = useView();
  const [profileTab, setProfileTab] = useState("me");
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([member]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [types, setTypes] = useState(new Set(Object.keys(TYPES)));
  const [who, setWho] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // { initial, editing }
  const postsApi = usePosts(space, member.user_id);
  const { markSeen } = postsApi;

  const year = cursor.getFullYear();

  const membersSeq = useRef(0);
  const loadMembers = useCallback(async () => {
    const id = ++membersSeq.current;
    try {
      const { data, error } = await supabase.from("members").select("*");
      if (id !== membersSeq.current) return;
      if (error) throw error;
      setMembers(data || []);
      setMembersError("");
    } catch (error) {
      if (id === membersSeq.current) setMembersError(error.message || "Could not load calendar members.");
    }
  }, []);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("date", `${year - 1}-12-01`)
        .lte("date", `${year + 1}-01-31`)
        .order("start_time", { ascending: true });
      if (id !== seq.current) return;
      if (error) throw error;
      setEvents(data || []);
      setEventsError("");
    } catch (error) {
      if (id === seq.current) setEventsError(error.message || "Could not load events.");
    } finally {
      if (id === seq.current) setEventsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
    return () => { seq.current += 1; };
  }, [load]);

  useEffect(() => {
    loadMembers();
    const ch = supabase
      .channel("events-" + space.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
          filter: `space_id=eq.${space.id}`,
        },
        load,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `space_id=eq.${space.id}`,
        },
        loadMembers,
      )
      .subscribe();
    const wake = () => document.visibilityState === "visible" && loadMembers();
    document.addEventListener("visibilitychange", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      membersSeq.current += 1;
      supabase.removeChannel(ch);
    };
  }, [space.id, load, loadMembers]);

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members],
  );
  const colorOf = (id) => {
    const m = members.find((x) => x.user_id === id);
    if (m && PALETTE.includes(m.color)) return m.color;
    // nobody else has this colour yet: hand out the free ones in a fixed order, same on every phone
    const taken = new Set(
      members.map((x) => x.color).filter((c) => PALETTE.includes(c)),
    );
    const free = PALETTE.filter((c) => !taken.has(c));
    const pool = free.length ? free : AVATARS;
    const loose = members
      .filter((x) => !PALETTE.includes(x.color))
      .sort((a, b) => a.user_id.localeCompare(b.user_id));
    return pool[
      Math.max(
        0,
        loose.findIndex((x) => x.user_id === id),
      ) % pool.length
    ];
  };
  function openPerson(id) {
    loadMembers();
    setProfileTab(id);
    setView("profile");
  }
  async function profileSaved() {
    await loadMembers();
    await onProfileChange?.();
  }
  const me = memberById[member.user_id] || member;
  const others = useMemo(
    () => members.filter((m) => m.user_id !== member.user_id),
    [members, member.user_id],
  );
  const profileOf = others.find((m) => m.user_id === profileTab);
  const tz = zoneOfCity(me.city);
  const todayKey = dateInZone(tz, currentDate);
  const previousToday = useRef(initialDate);
  const chat = useChat(space, member.user_id, members);
  const callApi = useCall({
    space,
    userId: member.user_id,
    calls: { begin: chat.beginCall, finish: chat.finishCall },
  });
  const callPeer = callApi.call.peerId ? memberById[callApi.call.peerId] : null;
  const push = usePush(space, member.user_id);
  const [pushHidden, setPushHidden] = useState(
    () => readStoredValue("push-banner-hidden") === "1",
  );

  useEffect(() => {
    const update = () => setCurrentDate(new Date());
    const timer = setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    document.title = `${VIEW_TITLES[view] || 'Calendar'} · Our Calendar`;
  }, [view]);

  useEffect(() => {
    const previous = previousToday.current;
    if (previous === todayKey) return;
    previousToday.current = todayKey;
    if (selected === previous) {
      setSelected(todayKey);
      setCursor(parseISO(todayKey));
    }
  }, [selected, todayKey]);

  // opening the app from a notification goes straight to the chat
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("open") === "chat") {
      setView("chat");
      if (q.get("chat")) chat.openChat(q.get("chat"));
      history.replaceState(null, "", location.pathname);
    }
    const onMsg = (e) => {
      if (e.data?.type !== "open") return;
      setView(e.data.view || "chat");
      if (e.data.chat) chat.openChat(e.data.chat);
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);

  const localEvents = useMemo(
    () => events.map((e) => localizeEvent(e, tz)),
    [events, tz],
  );

  useEffect(() => {
    if (view === "today") markSeen();
  }, [view, markSeen]);

  const byDate = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = {};
    for (const raw of events) {
      const e = localizeEvent(raw, tz);
      if (!types.has(e.type)) continue;
      if (who !== "all" && e.user_id !== who) continue;
      if (q && !(e.title + " " + (e.note || "")).toLowerCase().includes(q))
        continue;
      (map[e.date] ||= []).push(e);
    }
    for (const k in map) map[k] = sortEvents(map[k]);
    return map;
  }, [events, types, who, query, tz]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor],
  );

  const dayEvents = byDate[selected] || [];
  const dayGroups = [...new Set(dayEvents.map((event) => event.user_id))]
    .sort((a, b) => a === member.user_id ? -1 : b === member.user_id ? 1 : 0)
    .map((userId) => ({
      person: memberById[userId] || { user_id: userId, display_name: "Member" },
      events: dayEvents.filter((event) => event.user_id === userId),
    }));
  const selDate = parseISO(selected);

  function pick(d) {
    setSelected(ymd(d));
    if (!isSameMonth(d, cursor)) setCursor(d);
  }
  function go(dir) {
    setCursor(view === "year" ? addYears(cursor, dir) : addMonths(cursor, dir));
  }
  function today() {
    const t = parseISO(todayKey);
    setCursor(t);
    setSelected(ymd(t));
  }
  function toggleType(k) {
    const n = new Set(types);
    n.has(k) ? n.delete(k) : n.add(k);
    setTypes(n);
  }
  const openNew = (date = selected) =>
    setForm({ initial: { date }, editing: false });

  async function saveSeries(f) {
    const i = form.initial;
    const title = f.title.trim();
    const note = f.note.trim() || null;
    const place = f.place.trim() || null;
    const start = f.allDay ? null : f.start || null;
    const end = f.allDay ? null : f.end || null;
    const patch = {};
    if (title !== i.title) patch.title = title;
    if (f.type !== i.type) patch.type = f.type;
    if (note !== (i.note || null)) patch.note = note;
    if (place !== (i.place || null)) patch.place = place;
    const timeChanged =
      f.zone !== tz ||
      start !== (i.start_time ? hm(i.start_time) : null) ||
      end !== (i.end_time ? hm(i.end_time) : null);

    if (timeChanged) {
      const { data, error } = await supabase
        .from("events")
        .select("id, date, start_time, end_time, tz")
        .eq("series_id", i.series_id);
      if (error) return error.message;
      const results = await Promise.all(
        data.map((row) =>
          supabase
            .from("events")
            .update({
              ...patch,
              date: row.id === i.id ? f.date : localizeEvent(row, f.zone).date,
              start_time: start,
              end_time: end,
              tz: f.zone,
            })
            .eq("id", row.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed) return failed.error.message;
    } else {
      if (Object.keys(patch).length) {
        const { error } = await supabase
          .from("events")
          .update(patch)
          .eq("series_id", i.series_id);
        if (error) return error.message;
      }
      if (f.date !== i.date) {
        const { error } = await supabase
          .from("events")
          .update({
            date: f.date,
            start_time: start,
            end_time: end,
            tz: f.zone,
          })
          .eq("id", i.id);
        if (error) return error.message;
      }
    }

    seq.current++;
    const d = parseISO(f.date);
    if (!isSameMonth(d, cursor)) setCursor(d);
    setSelected(f.date);
    setForm(null);
    load();
    return null;
  }

  async function save(f) {
    if (form.editing && f.applyAll && form.initial.series_id)
      return saveSeries(f);
    const base = {
      space_id: space.id,
      title: f.title.trim(),
      type: f.type,
      tz: f.zone,
      note: f.note.trim() || null,
      place: f.place.trim() || null,
      start_time: f.allDay ? null : f.start || null,
      end_time: f.allDay ? null : f.end || null,
    };
    let req;
    if (form.editing) {
      req = supabase
        .from("events")
        .update({ ...base, date: f.date })
        .eq("id", form.initial.id)
        .select();
    } else {
      const start = parseISO(f.date);
      const weekly = f.type !== "special" && f.repeatDays.length > 0;
      const yearly = f.type === "special" && f.repeatYearly;
      let dates = [start];
      if (weekly)
        dates = Array.from({ length: f.repeatWeeks * 7 }, (_, i) =>
          addDays(start, i),
        ).filter(
          (d) =>
            f.repeatDays.includes(getDay(d)) &&
            differenceInCalendarWeeks(d, start, { weekStartsOn: 1 }) %
              f.repeatEvery ===
              0,
        );
      if (yearly)
        dates = Array.from({ length: f.repeatYears }, (_, i) =>
          addYears(start, i),
        );
      const series_id = weekly || yearly ? uuid() : null;
      const rows = dates.map((d) => ({ ...base, date: ymd(d), series_id }));
      req = supabase.from("events").insert(rows).select();
    }
    let res;
    try {
      res = await Promise.race([
        req,
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                error: {
                  message:
                    "This is taking too long. Check your internet and press Save again.",
                },
              }),
            20000,
          ),
        ),
      ]);
    } catch (err) {
      res = { error: { message: err.message || "Could not save. Try again." } };
    }
    if (res.error) return res.error.message; // the form stays open and shows the reason

    const saved = res.data || [];
    const ids = new Set(saved.map((r) => r.id));
    seq.current++; // drop any older reload that is still on its way
    setEvents((prev) => [...prev.filter((e) => !ids.has(e.id)), ...saved]);
    const d = parseISO(f.date);
    if (!isSameMonth(d, cursor)) setCursor(d);
    setSelected(f.date);
    setForm(null);
    load();
    return null;
  }

  async function remove() {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", form.initial.id);
    if (error) return error.message;
    setForm(null);
    await load();
    return null;
  }

  async function removeSeries() {
    const id = form.initial.series_id;
    const { count, error: countError } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("series_id", id);
    if (countError) return countError.message;
    if (
      !confirm(
        `Delete all ${count ?? 0} events in this repeating series?`,
      )
    )
      return;
    const { error } = await supabase.from("events").delete().eq("series_id", id);
    if (error) return error.message;
    setForm(null);
    await load();
    return null;
  }

  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div
        className={
          "shell" + (view === "chat" || view === "games" ? " chat-mode" : "")
        }
      >
        <div className="menu-controls">
          <button
            type="button"
            className={`brutal-menu-trigger${menuOpen ? " is-open" : ""}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
          >
            <span className="brutal-menu-trigger-icon">{menuOpen ? <X size={23} strokeWidth={2.5} /> : <Menu size={23} strokeWidth={2.5} />}</span>
            <span className="brutal-menu-trigger-label">MENU</span>
          </button>
        </div>
        {view === "today" && !menuOpen && (
          <div className="today-right-clocks"><Clocks tz={tz} /></div>
        )}
        {menuOpen && <button type="button" className="brutal-menu-scrim" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />}
        <nav id="main-navigation" className={`rail${menuOpen ? " menu-open" : ""}`} onClick={() => setMenuOpen(false)} aria-label="Main navigation">
          <div className="logo">S</div>
          <button type="button"
            className={"rail-btn" + (view === "today" ? " on" : "")}
            aria-current={view === "today" ? "page" : undefined}
            onClick={() => setView("today")}
            aria-label="Today"
          >
            <span className="rail-ico">
              <Home size={20} />
              {postsApi.unread && view !== "today" && <i className="dot" />}
            </span>
            <span>Today</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "month" ? " on" : "")}
            aria-current={view === "month" ? "page" : undefined}
            onClick={() => setView("month")}
            aria-label="Month view"
          >
            <CalendarDays size={20} />
            <span>Month</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "year" ? " on" : "")}
            aria-current={view === "year" ? "page" : undefined}
            onClick={() => setView("year")}
            aria-label="Year view"
          >
            <LayoutGrid size={20} />
            <span>Year</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "gallery" ? " on" : "")}
            aria-current={view === "gallery" ? "page" : undefined}
            onClick={() => setView("gallery")}
            aria-label="Gallery"
          >
            <Images size={20} />
            <span>Gallery</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "games" ? " on" : "")}
            aria-current={view === "games" ? "page" : undefined}
            onClick={() => setView("games")}
            aria-label="Games"
          >
            <Gamepad2 size={20} />
            <span>Games</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "chat" ? " on" : "")}
            aria-current={view === "chat" ? "page" : undefined}
            onClick={() => {
              chat.closeChat();
              setView("chat");
            }}
            aria-label="Chat"
          >
            <span className="rail-ico">
              <MessageCircle size={20} />
              {chat.unread > 0 && view !== "chat" && <i className="dot" />}
            </span>
            <span>Chat</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "profile" ? " on" : "")}
            aria-current={view === "profile" ? "page" : undefined}
            onClick={() => setView("profile")}
            aria-label="Profile"
          >
            <User size={20} />
            <span>Profile</span>
          </button>
          <button type="button"
            className={"rail-btn" + (view === "circle" ? " on" : "")}
            aria-current={view === "circle" ? "page" : undefined}
            onClick={() => setView("circle")}
            aria-label="Circle"
          >
            <UsersRound size={20} />
            <span>Circle</span>
          </button>

          <button type="button"
            className="rail-btn"
            onClick={() => confirm("Sign out?") && supabase.auth.signOut()}
            aria-label="Sign out"
          >
            <LogOut size={20} />
            <span>Sign out</span>
          </button>
        </nav>

        <main id="main-content" tabIndex={-1} className={"main" + (view === "today" ? " today-main" : view === "circle" ? " circle-main" : "")}>
          {eventsError && (
            <div className="data-alert" role="alert">
              <span>Events could not be refreshed: {eventsError}</span>
              <button type="button" className="btn ghost sm" onClick={load}>Retry</button>
            </div>
          )}
          {membersError && (
            <div className="data-alert" role="alert">
              <span>Calendar members could not be refreshed: {membersError}</span>
              <button type="button" className="btn ghost sm" onClick={loadMembers}>Retry</button>
            </div>
          )}
          {postsApi.error && (
            <div className="data-alert" role="alert">
              <span>Posts or photos could not be refreshed: {postsApi.error}</span>
              <button type="button" className="btn ghost sm" onClick={postsApi.reload}>Retry</button>
            </div>
          )}
          {eventsLoading && events.length === 0 && <p className="load-status" role="status">Loading events…</p>}
          {view !== "chat" && view !== "games" && view !== "today" && view !== "circle" && (
            <header className="top">
              {view !== "month" && (
                <div className="hello-row">
                  <Avatar
                    url={me.avatar_url}
                    name={me.display_name}
                    color={colorOf(member.user_id)}
                    size="md"
                  />
                  <div>
                    <h1 className="hello">
                      {greeting()}, {member.display_name}
                    </h1>
                    {others.length > 0 && (
                      <p className="muted">
                        Shared with{" "}
                        {others.map((o, i) => (
                          <span key={o.user_id}>
                            {i > 0 && (i === others.length - 1 ? " and " : ", ")}
                            <button type="button" className="linklike" onClick={() => openPerson(o.user_id)}>
                              {o.display_name}
                            </button>
                          </span>
                        ))}
                        {others.length === 1 && others[0].about && (
                          <span className="status"> · {others[0].about}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="top-right">
                <Clocks tz={tz} />
                {(view === "month" || view === "year") && (
                  <label className="search">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search events"
                    />
                  </label>
                )}
              </div>
            </header>
          )}

          {push.state === "off" &&
            !pushHidden &&
            view !== "chat" &&
            view !== "games" &&
            view !== "circle" && (
              <div className="push-banner">
                <span>
                  Get notified about messages and calls, even when the app is
                  closed.
                </span>
                <button type="button" className="btn primary sm" onClick={push.enable} disabled={push.busy}>
                  {push.busy ? "Turning on…" : "Turn on"}
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    writeStoredValue("push-banner-hidden", "1");
                    setPushHidden(true);
                  }}
                >
                  Not now
                </button>
                {push.err && <span className="error" role="alert">{push.err}</span>}
              </div>
            )}

          <Suspense fallback={<div className="page-loading" role="status">Opening page…</div>}>
          {view === "chat" ? (
            <Chat
              chat={chat}
              call={callApi}
              push={push}
              me={me}
              members={members}
              groupName={space.name}
              memberById={memberById}
              colorOf={colorOf}
            />
          ) : view === "games" ? (
            <Games space={space} member={member} members={members} />
          ) : view === "circle" ? (
            <CirclePage
              space={space}
              me={me}
              members={members}
              colorOf={colorOf}
              onEditProfile={() => {
                setProfileTab("me");
                setView("profile");
              }}
              onOpenPerson={openPerson}
            />
          ) : view === "today" ? (
            <Dashboard
              me={me}
              others={others}
              events={localEvents}
              colorOf={colorOf}
              memberById={memberById}
              api={postsApi}
              onOpenEvent={(e) => setForm({ initial: e, editing: true })}
              onNewEvent={() => openNew(todayKey)}
              onOpenCalendar={() => setView("month")}
            />
          ) : view === "gallery" ? (
            <Gallery
              shots={postsApi.gallery}
              urls={postsApi.urls}
              me={me}
              others={others}
              memberById={memberById}
            />
          ) : view === "profile" ? (
            <>
              {others.length > 0 && (
                <div className="seg ptabs">
                  <button type="button"
                    className={profileTab === "me" ? "on" : ""}
                    aria-pressed={profileTab === "me"}
                    onClick={() => setProfileTab("me")}
                  >
                    Me
                  </button>
                  {others.map((o) => (
                    <button type="button"
                      key={o.user_id}
                      className={profileTab === o.user_id ? "on" : ""}
                      aria-pressed={profileTab === o.user_id}
                      onClick={() => openPerson(o.user_id)}
                    >
                      {o.display_name}
                    </button>
                  ))}
                </div>
              )}
              {profileOf ? (
                <PartnerProfile
                  key={profileOf.user_id}
                  partner={profileOf}
                  tz={tz}
                  color={colorOf(profileOf.user_id)}
                />
              ) : (
                <Profile
                  session={session}
                  member={memberById[member.user_id] || member}
                  others={others}
                  color={colorOf(member.user_id)}
                  onSaved={profileSaved}
                />
              )}
            </>
          ) : (
            <>
              <div className="filters">
                {Object.entries(TYPES).map(([k, t]) => (
                  <button type="button"
                    key={k}
                    className={"chip" + (types.has(k) ? " on" : "")}
                    style={{ "--c": t.color }}
                    aria-pressed={types.has(k)}
                    onClick={() => toggleType(k)}
                  >
                    <i /> {t.label}
                  </button>
                ))}
                {others.length > 0 && (
                  <div className="seg tiny">
                    <button type="button"
                      className={who === "all" ? "on" : ""}
                      aria-pressed={who === "all"}
                      onClick={() => setWho("all")}
                    >
                      Everyone
                    </button>
                    <button type="button"
                      className={who === member.user_id ? "on" : ""}
                      aria-pressed={who === member.user_id}
                      onClick={() => setWho(member.user_id)}
                    >
                      Me
                    </button>
                    {others.map((o) => (
                      <button type="button"
                        key={o.user_id}
                        className={who === o.user_id ? "on" : ""}
                        aria-pressed={who === o.user_id}
                        onClick={() => setWho(o.user_id)}
                      >
                        {o.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid2">
                <section className="card cal">
                  <div className="cal-head">
                    <h2>
                      {view === "year" ? (
                        year
                      ) : (
                        <>
                          {format(cursor, "MMMM")}{" "}
                          <span className="yr">{year}</span>
                        </>
                      )}
                    </h2>
                    <div className="nav">
                      <button type="button" className="btn ghost" onClick={today}>
                        Today
                      </button>
                      <button type="button"
                        className="icon-btn"
                        onClick={() => go(-1)}
                        aria-label={`Previous ${view === "year" ? "year" : "month"}`}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button type="button"
                        className="icon-btn"
                        onClick={() => go(1)}
                        aria-label={`Next ${view === "year" ? "year" : "month"}`}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  {view === "year" ? (
                    <YearView
                      year={year}
                      byDate={byDate}
                      onPick={(d) => {
                        pick(d);
                        setView("month");
                      }}
                    />
                  ) : (
                    <>
                      <div className="dows">
                        {dow.map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                      <div className="days">
                        {days.map((d) => {
                          const k = ymd(d);
                          const list = byDate[k] || [];
                          const hasSpecial = list.some(
                            (e) => e.type === "special",
                          );
                          return (
                            <button type="button"
                              key={k}
                              aria-label={`${format(d, "EEEE, d MMMM yyyy")}${list.length ? `, ${list.length} events` : ", no events"}`}
                              aria-pressed={k === selected}
                              className={
                                "day" +
                                (isSameMonth(d, cursor) ? "" : " out") +
                                (ymd(d) === todayKey ? " today" : "") +
                                (hasSpecial ? " special" : "") +
                                (k === selected ? " sel" : "")
                              }
                              onClick={() => pick(d)}
                              onDoubleClick={() => openNew(k)}
                            >
                              <b>{d.getDate()}</b>
                              {hasSpecial && (
                                <Sparkles className="sd-badge" size={14} />
                              )}
                              <span className="labels">
                                {list.slice(0, 2).map((e) => (
                                  <em
                                    key={e.id}
                                    className={
                                      e.type === "special" ? "sd-em" : undefined
                                    }
                                    style={{ "--c": TYPES[e.type].color }}
                                  >
                                    {e.title}
                                  </em>
                                ))}
                                {list.length > 2 && (
                                  <small>+{list.length - 2} more</small>
                                )}
                              </span>
                              <span className="dots">
                                {list.slice(0, 4).map((e) => (
                                  <i
                                    key={e.id}
                                    style={{ background: TYPES[e.type].color }}
                                  />
                                ))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>

                <aside className="card panel">
                  <div className="panel-head">
                    <div>
                      <h2>
                        {selected === todayKey ? "Today" : format(selDate, "EEEE")}
                      </h2>
                      <p className="muted small">
                        {format(selDate, "d MMMM yyyy")}
                      </p>
                    </div>
                    <button type="button"
                      className="btn primary sm desk-only"
                      onClick={() => openNew()}
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>

                  <div className="list">
                    {dayEvents.length === 0 && (
                      <p className="empty">
                        Nothing planned. Tap + to add something.
                      </p>
                    )}
                    {dayGroups.map(({ person, events: personEvents }) => (
                      <section className="month-event-group" key={person.user_id}>
                        <div className="month-event-group-head">
                          <Avatar
                            url={person.avatar_url}
                            name={person.display_name}
                            color={colorOf(person.user_id)}
                            size="sm"
                          />
                          <strong>{person.user_id === member.user_id ? "Your day" : `${person.display_name}'s day`}</strong>
                          <span className="month-event-group-count">{personEvents.length}</span>
                        </div>
                        <div className="month-event-group-list">
                          {personEvents.map((e) => (
                        <div
                          key={e.id}
                          className={
                            "ev-card" + (e.type === "special" ? " special" : "")
                          }
                        >
                          <button type="button"
                            className="ev"
                            onClick={() =>
                              setForm({ initial: e, editing: true })
                            }
                          >
                            <span
                              className="bar"
                              style={{ background: TYPES[e.type].color }}
                            />
                            <strong>
                              {e.type === "special" && (
                                <Sparkles size={14} className="sd-inline" />
                              )}
                              {e.title}
                            </strong>
                            {e.note && (
                              <span className="muted small note">{e.note}</span>
                            )}
                            {e.origin && (
                              <span className="muted small note">
                                {eventOriginLabel(e)}
                              </span>
                            )}
                            <span className="meta">
                              <span>
                                <Clock size={13} /> {timeLabel(e)}
                                {e.start_time && ` · ${zoneLabel(tz)} time`}
                              </span>
                            </span>
                          </button>
                          {mapHref(e.place) && (
                            <a
                              className="map-btn"
                              href={mapHref(e.place)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open map for ${e.title}; opens in a new tab`}
                              title="Opens in a new tab"
                            >
                              <MapPin size={16} aria-hidden="true" /> Open map
                            </a>
                          )}
                        </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </aside>
              </div>
            </>
          )}
          </Suspense>
        </main>
      </div>

      {view !== "gallery" &&
        view !== "profile" &&
        view !== "chat" &&
        view !== "games" &&
        view !== "circle" && (
          <button type="button"
            className="fab"
            onClick={() =>
              openNew(view === "today" ? todayKey : selected)
            }
            aria-label="Add event"
          >
            <Plus size={26} />
          </button>
        )}

      <Suspense fallback={null}>
        <CallOverlay
          api={callApi}
          partner={callPeer}
          color={callPeer ? colorOf(callPeer.user_id) : undefined}
          name={
            callPeer
              ? chat.settings.nicknames?.[callPeer.user_id] ||
                callPeer.display_name
              : ""
          }
        />
      </Suspense>

      {form && (
        <EventForm
          tz={tz}
          initial={form.initial}
          editing={form.editing}
          members={members}
          onSave={save}
          onDelete={remove}
          onDeleteSeries={removeSeries}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
