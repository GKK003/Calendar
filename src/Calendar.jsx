import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
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
} from "lucide-react";
import { supabase } from "./supabase.js";
import {
  AVATARS,
  PALETTE,
  TYPES,
  greeting,
  hm,
  localizeEvent,
  mapHref,
  sortEvents,
  timeLabel,
  uuid,
  ymd,
  zoneLabel,
  zoneOfCity,
} from "./lib.js";
import EventForm from "./EventForm.jsx";
import YearView from "./YearView.jsx";
import Clocks from "./Clocks.jsx";
import Profile from "./Profile.jsx";
import Avatar from "./Avatar.jsx";
import PartnerProfile from "./PartnerProfile.jsx";
import Dashboard from "./Dashboard.jsx";
import Gallery from "./Gallery.jsx";
import Chat from "./Chat.jsx";
import CallOverlay from "./CallOverlay.jsx";
import useChat from "./useChat.js";
import useCall from "./useCall.js";
import usePush from "./usePush.js";
import usePosts from "./usePosts.js";
import "./special.css";

export default function Calendar({ session, member, space, onProfileChange }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(ymd(new Date()));
  const [view, setView] = useState("today");
  const [profileTab, setProfileTab] = useState("me");
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([member]);
  const [types, setTypes] = useState(new Set(Object.keys(TYPES)));
  const [who, setWho] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // { initial, editing }
  const [copied, setCopied] = useState(false);
  const postsApi = usePosts(space, member.user_id);
  const { markSeen } = postsApi;

  const year = cursor.getFullYear();

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*");
    if (data) setMembers(data);
  }, []);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", `${year - 1}-12-01`)
      .lte("date", `${year + 1}-01-31`)
      .order("start_time", { ascending: true });
    // ignore failed or out-of-date answers so events never disappear or come back stale
    if (error || id !== seq.current) return;
    setEvents(data || []);
  }, [year]);

  useEffect(() => {
    load();
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
  const chat = useChat(space, member.user_id, members);
  const callApi = useCall({
    space,
    userId: member.user_id,
    calls: { begin: chat.beginCall, finish: chat.finishCall },
  });
  const callPeer = callApi.call.peerId ? memberById[callApi.call.peerId] : null;
  const push = usePush(space, member.user_id);
  const [pushHidden, setPushHidden] = useState(
    () => localStorage.getItem("push-banner-hidden") === "1",
  );

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
  const selDate = parseISO(selected);

  function pick(d) {
    setSelected(ymd(d));
    if (!isSameMonth(d, cursor)) setCursor(d);
  }
  function go(dir) {
    setCursor(view === "year" ? addYears(cursor, dir) : addMonths(cursor, dir));
  }
  function today() {
    const t = new Date();
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
    await supabase.from("events").delete().eq("id", form.initial.id);
    setForm(null);
    load();
  }

  async function removeSeries() {
    const id = form.initial.series_id;
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("series_id", id);
    if (
      !confirm(
        `Delete all ${count ?? ""} events in this repeating series?`.replace(
          "  ",
          " ",
        ),
      )
    )
      return;
    await supabase.from("events").delete().eq("series_id", id);
    setForm(null);
    load();
  }

  function copyCode() {
    navigator.clipboard?.writeText(space.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="app">
      <div className={"shell" + (view === "chat" ? " chat-mode" : "")}>
        <nav className="rail">
          <div className="logo">V</div>
          <button
            className={"rail-btn" + (view === "today" ? " on" : "")}
            onClick={() => setView("today")}
            aria-label="Today"
          >
            <span className="rail-ico">
              <Home size={20} />
              {postsApi.unread && view !== "today" && <i className="dot" />}
            </span>
            <span>Today</span>
          </button>
          <button
            className={"rail-btn" + (view === "month" ? " on" : "")}
            onClick={() => setView("month")}
            aria-label="Month view"
          >
            <CalendarDays size={20} />
            <span>Month</span>
          </button>
          <button
            className={"rail-btn" + (view === "year" ? " on" : "")}
            onClick={() => setView("year")}
            aria-label="Year view"
          >
            <LayoutGrid size={20} />
            <span>Year</span>
          </button>
          <button
            className={"rail-btn" + (view === "gallery" ? " on" : "")}
            onClick={() => setView("gallery")}
            aria-label="Gallery"
          >
            <Images size={20} />
            <span>Gallery</span>
          </button>
          <button
            className={"rail-btn" + (view === "chat" ? " on" : "")}
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
          <button
            className={"rail-btn" + (view === "profile" ? " on" : "")}
            onClick={() => setView("profile")}
            aria-label="Profile"
          >
            <User size={20} />
            <span>Profile</span>
          </button>

          <button
            className="rail-btn"
            onClick={() => confirm("Sign out?") && supabase.auth.signOut()}
            aria-label="Sign out"
          >
            <LogOut size={20} />
            <span>Sign out</span>
          </button>
        </nav>

        <main className="main">
          {view !== "chat" && (
            <header className="top">
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
                  <p className="muted">
                    {others.length > 0 && (
                      <>
                        Shared with{" "}
                        {others.map((o, i) => (
                          <span key={o.user_id}>
                            {i > 0 &&
                              (i === others.length - 1 ? " and " : ", ")}
                            <button
                              className="linklike"
                              onClick={() => openPerson(o.user_id)}
                            >
                              {o.display_name}
                            </button>
                          </span>
                        ))}
                        {others.length === 1 && others[0].about && (
                          <span className="status"> · {others[0].about}</span>
                        )}
                        {" · "}
                      </>
                    )}
                    Invite code:{" "}
                    <button className="code" onClick={copyCode}>
                      {space.code} <Copy size={12} /> {copied && "Copied"}
                    </button>
                  </p>
                </div>
              </div>
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

          {push.state === "off" && !pushHidden && view !== "chat" && (
            <div className="push-banner">
              <span>
                Get notified about messages and calls, even when the app is
                closed.
              </span>
              <button className="btn primary sm" onClick={push.enable}>
                Turn on
              </button>
              <button
                className="link"
                onClick={() => {
                  localStorage.setItem("push-banner-hidden", "1");
                  setPushHidden(true);
                }}
              >
                Not now
              </button>
            </div>
          )}

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
          ) : view === "today" ? (
            <Dashboard
              me={me}
              others={others}
              events={localEvents}
              colorOf={colorOf}
              memberById={memberById}
              api={postsApi}
              onOpenEvent={(e) => setForm({ initial: e, editing: true })}
              onNewEvent={() => openNew(ymd(new Date()))}
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
                  <button
                    className={profileTab === "me" ? "on" : ""}
                    onClick={() => setProfileTab("me")}
                  >
                    Me
                  </button>
                  {others.map((o) => (
                    <button
                      key={o.user_id}
                      className={profileTab === o.user_id ? "on" : ""}
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
                  <button
                    key={k}
                    className={"chip" + (types.has(k) ? " on" : "")}
                    style={{ "--c": t.color }}
                    onClick={() => toggleType(k)}
                  >
                    <i /> {t.label}
                  </button>
                ))}
                {others.length > 0 && (
                  <div className="seg tiny">
                    <button
                      className={who === "all" ? "on" : ""}
                      onClick={() => setWho("all")}
                    >
                      Everyone
                    </button>
                    <button
                      className={who === member.user_id ? "on" : ""}
                      onClick={() => setWho(member.user_id)}
                    >
                      Me
                    </button>
                    {others.map((o) => (
                      <button
                        key={o.user_id}
                        className={who === o.user_id ? "on" : ""}
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
                      <button className="btn ghost" onClick={today}>
                        Today
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => go(-1)}
                        aria-label="Previous"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => go(1)}
                        aria-label="Next"
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
                            <button
                              key={k}
                              className={
                                "day" +
                                (isSameMonth(d, cursor) ? "" : " out") +
                                (isToday(d) ? " today" : "") +
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
                        {isToday(selDate) ? "Today" : format(selDate, "EEEE")}
                      </h2>
                      <p className="muted small">
                        {format(selDate, "d MMMM yyyy")}
                      </p>
                    </div>
                    <button
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
                    {dayEvents.map((e) => {
                      const owner = memberById[e.user_id];
                      return (
                        <div
                          key={e.id}
                          className={
                            "ev-card" + (e.type === "special" ? " special" : "")
                          }
                        >
                          <button
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
                                Set as {e.origin.start_time}
                                {e.origin.end_time &&
                                  ` – ${e.origin.end_time}`}{" "}
                                {zoneLabel(e.origin.tz)}
                              </span>
                            )}
                            <span className="meta">
                              <span>
                                <Clock size={13} /> {timeLabel(e)}
                                {e.start_time && ` ${zoneLabel(tz)}`}
                              </span>
                              {owner && (
                                <Avatar
                                  url={owner.avatar_url}
                                  name={owner.display_name}
                                  color={colorOf(owner.user_id)}
                                />
                              )}
                            </span>
                          </button>
                          {mapHref(e.place) && (
                            <a
                              className="map-btn"
                              href={mapHref(e.place)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MapPin size={16} /> Open map
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {view !== "gallery" && view !== "profile" && view !== "chat" && (
        <button
          className="fab"
          onClick={() => openNew(view === "today" ? ymd(new Date()) : selected)}
          aria-label="Add event"
        >
          <Plus size={26} />
        </button>
      )}

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
