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
  zoneOfCity,
} from "./lib.js";
import EventForm from "./EventForm.jsx";
import YearView from "./YearView.jsx";
import Clocks from "./Clocks.jsx";
import Profile from "./Profile.jsx";
import Avatar from "./Avatar.jsx";
import PartnerProfile from "./PartnerProfile.jsx";

export default function Calendar({ session, member, space, onProfileChange }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(ymd(new Date()));
  const [view, setView] = useState("month");
  const [profileTab, setProfileTab] = useState("me");
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([member]);
  const [types, setTypes] = useState(new Set(Object.keys(TYPES)));
  const [who, setWho] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // { initial, editing }
  const [copied, setCopied] = useState(false);

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
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [space.id, load]);

  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members],
  );
  const colorOf = (id) => {
    const m = members.find((x) => x.user_id === id);
    if (m && PALETTE.includes(m.color)) return m.color;
    return AVATARS[
      Math.max(
        0,
        [...members]
          .sort((a, b) => a.user_id.localeCompare(b.user_id))
          .findIndex((x) => x.user_id === id),
      ) % AVATARS.length
    ];
  };
  function openPartner() {
    loadMembers();
    setProfileTab("partner");
    setView("profile");
  }
  async function profileSaved() {
    await loadMembers();
    await onProfileChange?.();
  }
  const me = memberById[member.user_id] || member;
  const partner = members.find((m) => m.user_id !== member.user_id);
  const tz = zoneOfCity(me.city);

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
              date: row.id === i.id ? f.date : localizeEvent(row, tz).date,
              start_time: start,
              end_time: end,
              tz,
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
          .update({ date: f.date, start_time: start, end_time: end, tz })
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
      tz,
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
      const dates = f.repeatDays.length
        ? Array.from({ length: f.repeatWeeks * 7 }, (_, i) =>
            addDays(start, i),
          ).filter(
            (d) =>
              f.repeatDays.includes(getDay(d)) &&
              differenceInCalendarWeeks(d, start, { weekStartsOn: 1 }) %
                f.repeatEvery ===
                0,
          )
        : [start];
      const series_id = f.repeatDays.length ? uuid() : null;
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

  async function clearAll() {
    if (!confirm("Delete ALL events for both of you? This cannot be undone."))
      return;
    const word = prompt("Type DELETE to confirm");
    if (word?.trim().toUpperCase() !== "DELETE") return;
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("space_id", space.id);
    if (error) return alert("Could not clear events: " + error.message);
    setEvents([]);
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
      <div className="shell">
        <nav className="rail">
          <div className="logo">V</div>
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
            className={"rail-btn" + (view === "profile" ? " on" : "")}
            onClick={() => setView("profile")}
            aria-label="Profile"
          >
            <User size={20} />
            <span>Profile</span>
          </button>
          <button
            className="rail-btn warn spacer"
            onClick={clearAll}
            aria-label="Clear all events"
          >
            <Trash2 size={20} />
            <span>Clear all</span>
          </button>
          <button
            className="rail-btn"
            onClick={() => supabase.auth.signOut()}
            aria-label="Sign out"
          >
            <LogOut size={20} />
            <span>Sign out</span>
          </button>
        </nav>

        <main className="main">
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
                  {partner ? (
                    <>
                      <button className="linklike" onClick={openPartner}>
                        Shared with {partner.display_name}
                      </button>
                      {partner.about && (
                        <span className="status"> · {partner.about}</span>
                      )}
                    </>
                  ) : (
                    <>
                      Invite code:{" "}
                      <button className="code" onClick={copyCode}>
                        {space.code} <Copy size={12} /> {copied && "Copied"}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="top-right">
              <Clocks tz={tz} />
              <label className="search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events"
                />
              </label>
            </div>
          </header>

          {view === "profile" ? (
            <>
              {partner && (
                <div className="seg ptabs">
                  <button
                    className={profileTab === "me" ? "on" : ""}
                    onClick={() => setProfileTab("me")}
                  >
                    Me
                  </button>
                  <button
                    className={profileTab === "partner" ? "on" : ""}
                    onClick={openPartner}
                  >
                    {partner.display_name}
                  </button>
                </div>
              )}
              {profileTab === "partner" && partner ? (
                <PartnerProfile
                  partner={partner}
                  tz={tz}
                  color={colorOf(partner.user_id)}
                />
              ) : (
                <Profile
                  session={session}
                  member={memberById[member.user_id] || member}
                  partner={partner}
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
                {partner && (
                  <div className="seg tiny">
                    <button
                      className={who === "all" ? "on" : ""}
                      onClick={() => setWho("all")}
                    >
                      Both
                    </button>
                    <button
                      className={who === member.user_id ? "on" : ""}
                      onClick={() => setWho(member.user_id)}
                    >
                      Me
                    </button>
                    <button
                      className={who === partner.user_id ? "on" : ""}
                      onClick={() => setWho(partner.user_id)}
                    >
                      {partner.display_name}
                    </button>
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
                          return (
                            <button
                              key={k}
                              className={
                                "day" +
                                (isSameMonth(d, cursor) ? "" : " out") +
                                (isToday(d) ? " today" : "") +
                                (k === selected ? " sel" : "")
                              }
                              onClick={() => pick(d)}
                              onDoubleClick={() => openNew(k)}
                            >
                              <b>{d.getDate()}</b>
                              <span className="labels">
                                {list.slice(0, 2).map((e) => (
                                  <em
                                    key={e.id}
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
                        <div key={e.id} className="ev-card">
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
                            <strong>{e.title}</strong>
                            {e.note && (
                              <span className="muted small note">{e.note}</span>
                            )}
                            <span className="meta">
                              <span>
                                <Clock size={13} /> {timeLabel(e)}
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

      <button className="fab" onClick={() => openNew()} aria-label="Add event">
        <Plus size={26} />
      </button>

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
