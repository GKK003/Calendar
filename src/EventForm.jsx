import { useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { TYPES, ZONES, convertTime } from "./lib.js";
import Clocks from "./Clocks.jsx";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

// 24-hour time picker (no AM/PM, same on every device)
function TimeField({ value, onChange }) {
  const [h = "09", m = "00"] = (value || "09:00").split(":");
  const mins = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0"),
  );
  if (!mins.includes(m)) {
    mins.push(m);
    mins.sort();
  }
  return (
    <div className="time">
      <select
        aria-label="Hour"
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
      >
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <b>:</b>
      <select
        aria-label="Minutes"
        value={m}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {mins.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}

const WEEKDAYS = [
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
  ["Sun", 0],
];

export default function EventForm({
  initial,
  editing,
  members,
  onSave,
  onDelete,
  onDeleteSeries,
  onClose,
}) {
  const [f, setF] = useState({
    title: initial.title || "",
    date: initial.date,
    type: initial.type || "work",
    allDay: !initial.start_time && !!editing,
    start: initial.start_time?.slice(0, 5) || "09:00",
    end: initial.end_time?.slice(0, 5) || "10:00",
    note: initial.note || "",
    place: initial.place || "",
    repeatDays: [],
    repeatWeeks: 12,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const downOnBackdrop = useRef(false);
  const [zone, setZone] = useState(ZONES[0].id);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleDay = (n) =>
    setF((p) => ({
      ...p,
      repeatDays: p.repeatDays.includes(n)
        ? p.repeatDays.filter((x) => x !== n)
        : [...p.repeatDays, n],
    }));
  const other = ZONES.find((z) => z.id !== zone);
  const here = ZONES.find((z) => z.id === zone);
  const a =
    !f.allDay && f.date && f.start
      ? convertTime(f.date, f.start, zone, other.id)
      : null;
  const b =
    !f.allDay && f.date && f.end
      ? convertTime(f.date, f.end, zone, other.id)
      : null;
  const owner = editing && members.find((m) => m.user_id === initial.user_id);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const problem = await onSave(f);
    setBusy(false);
    if (problem) setErr(problem);
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <form className="sheet" onSubmit={submit}>
        <div className="sheet-head">
          <h2>{editing ? "Edit event" : "New event"}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <label>
          Title
          <input
            autoFocus
            required
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Lecture, shift, exam…"
          />
        </label>

        <div className="chips">
          {Object.entries(TYPES).map(([k, t]) => (
            <button
              type="button"
              key={k}
              className={"chip" + (f.type === k ? " on" : "")}
              style={{ "--c": t.color }}
              onClick={() => set("type", k)}
            >
              <i /> {t.label}
            </button>
          ))}
        </div>

        <div className="row">
          <label>
            Date
            <input
              type="date"
              required
              value={f.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={f.allDay}
              onChange={(e) => set("allDay", e.target.checked)}
            />{" "}
            All day
          </label>
        </div>

        {!f.allDay && (
          <div className="row">
            <div className="field">
              <span>From</span>
              <TimeField value={f.start} onChange={(v) => set("start", v)} />
            </div>
            <div className="field">
              <span>To</span>
              <TimeField value={f.end} onChange={(v) => set("end", v)} />
            </div>
          </div>
        )}

        <div className="tz">
          <Clocks compact />
          {a && (
            <>
              <div className="tz-row">
                <span className="small muted">Times above are in</span>
                <div className="seg tiny">
                  {ZONES.map((z) => (
                    <button
                      type="button"
                      key={z.id}
                      className={zone === z.id ? "on" : ""}
                      onClick={() => setZone(z.id)}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="tz-result">
                {f.start}–{f.end} {here.label} ={" "}
                <strong>
                  {a.time}
                  {b ? `–${b.time}` : ""} {other.label}
                </strong>
                {a.dayShift !== 0 && (
                  <span className="muted">
                    {" "}
                    ({a.dayShift > 0 ? "next day" : "previous day"})
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        <label>
          Place
          <input
            value={f.place}
            onChange={(e) => set("place", e.target.value)}
            placeholder="Paste a map link or write an address"
          />
        </label>

        <label>
          Note
          <textarea
            rows={2}
            value={f.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Add note"
          />
        </label>

        {!editing && (
          <div className="repeat">
            <span className="lbl">Repeat every week on</span>
            <div className="wd">
              {WEEKDAYS.map(([label, n]) => (
                <button
                  type="button"
                  key={n}
                  className={f.repeatDays.includes(n) ? "on" : ""}
                  onClick={() => toggleDay(n)}
                >
                  {label}
                </button>
              ))}
            </div>
            {f.repeatDays.length > 0 ? (
              <label>
                For how long
                <select
                  value={f.repeatWeeks}
                  onChange={(e) => set("repeatWeeks", Number(e.target.value))}
                >
                  {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "week" : "weeks"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="muted small">
                Pick days to repeat. Leave empty for a one-time event.
              </p>
            )}
          </div>
        )}

        {editing && initial.series_id && (
          <p className="muted small">
            Part of a repeating series. Edits here change only this day.
          </p>
        )}
        {owner && <p className="muted small">Added by {owner.display_name}</p>}

        {err && <p className="error">Could not save: {err}</p>}

        <div className="actions">
          {editing && (
            <button type="button" className="btn danger" onClick={onDelete}>
              <Trash2 size={16} />{" "}
              {initial.series_id ? "Delete this day" : "Delete"}
            </button>
          )}
          {editing && initial.series_id && (
            <button
              type="button"
              className="btn danger solid"
              onClick={onDeleteSeries}
            >
              <Trash2 size={16} /> Delete all
            </button>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
