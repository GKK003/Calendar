import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { supabase } from "./supabase.js";
import { makePoster, putSmall, r2, uploadToR2 } from "./movieUpload.js";
import { LIBRARY, TABS } from "./library.js";
import "./cinema.css";

const DRIFT = 2;
const TICK = 5000;
const MAX_LAG = 1.5;
const GUARD_MS = 600;
const GRACE_MS = 1500;

export default function Cinema({ space, userId }) {
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [movie, setMovie] = useState(null);
  const [peers, setPeers] = useState(1);
  const [live, setLive] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [count, setCount] = useState(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [uploaded, setUploaded] = useState([]);
  const [src, setSrc] = useState(null);
  const [srcError, setSrcError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cin-hidden") || "[]");
    } catch {
      return [];
    }
  });

  const video = useRef(null);
  const channel = useRef(null);
  const peerIds = useRef([userId]);
  const movieRef = useRef(null);
  const pending = useRef(null);
  const handler = useRef(() => {});
  const guard = useRef(null);
  const lastLocal = useRef(0);
  const countTimer = useRef(null);
  const remoteFlag = useRef(false);
  movieRef.current = movie;
  const allRef = useRef([]);

  const all = useMemo(
    () => [...uploaded, ...LIBRARY.filter((m) => !hidden.includes(m.id))],
    [uploaded, hidden],
  );
  allRef.current = all;

  const loadMovies = async () => {
    const { data, error } = await supabase
      .from("movies")
      .select("*")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (error || !data) return;
    const map = {};
    const sbPosters = data
      .filter((r) => r.poster_path && r.store !== "r2")
      .map((r) => r.poster_path);
    const r2Posters = data
      .filter((r) => r.poster_path && r.store === "r2")
      .map((r) => r.poster_path);
    if (sbPosters.length) {
      const { data: signed } = await supabase.storage
        .from("movies")
        .createSignedUrls(sbPosters, 21600);
      (signed || []).forEach((x) => (map[x.path] = x.signedUrl));
    }
    if (r2Posters.length) {
      try {
        Object.assign(map, (await r2({ action: "get", keys: r2Posters })).urls);
      } catch {}
    }
    setUploaded(
      data.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        genres: r.genres || [],
        year: r.year || "",
        desc: r.description || "",
        path: r.path,
        store: r.store || "supabase",
        posterPath: r.poster_path,
        poster: map[r.poster_path] || "",
        owner: r.user_id,
      })),
    );
  };

  useEffect(() => {
    loadMovies();
    const ch = supabase
      .channel("movies-" + space.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movies",
          filter: "space_id=eq." + space.id,
        },
        loadMovies,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [space.id]);

  // Each phone gets its own private link to the file when a title opens
  useEffect(() => {
    setSrc(null);
    setSrcError("");
    if (!movie) return;
    if (movie.src) return setSrc(movie.src);
    let dead = false;
    const fail = () =>
      !dead &&
      setSrcError("Could not load this video. It may have been deleted.");
    if (movie.store === "r2") {
      r2({ action: "get", keys: [movie.path] })
        .then((d) =>
          dead
            ? null
            : d.urls[movie.path]
              ? setSrc(d.urls[movie.path])
              : fail(),
        )
        .catch(fail);
    } else {
      supabase.storage
        .from("movies")
        .createSignedUrl(movie.path, 21600)
        .then(({ data, error }) => {
          if (dead) return;
          if (error || !data) return fail();
          setSrc(data.signedUrl);
        });
    }
    return () => {
      dead = true;
    };
  }, [movie?.id]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((m) => {
      if (tab !== "All" && m.type !== tab) return false;
      if (!s) return true;
      return (m.title + " " + m.genres.join(" ")).toLowerCase().includes(s);
    });
  }, [tab, q, all]);

  const send = (type, extra = {}) =>
    channel.current?.send({
      type: "broadcast",
      event: "cmd",
      payload: { type, at: Date.now(), from: userId, ...extra },
    });

  const remote = (fn) => {
    remoteFlag.current = true;
    clearTimeout(guard.current);
    guard.current = setTimeout(() => (remoteFlag.current = false), GUARD_MS);
    fn();
  };

  const playSafe = () => video.current?.play().catch(() => setNeedsTap(true));

  const runCountdown = (time) => {
    const v = video.current;
    if (!v) return;
    clearInterval(countTimer.current);
    remote(() => {
      v.pause();
      v.currentTime = time;
    });
    let n = 3;
    setCount(n);
    countTimer.current = setInterval(() => {
      n -= 1;
      if (n > 0) return setCount(n);
      clearInterval(countTimer.current);
      setCount(null);
      remote(playSafe);
    }, 1000);
  };

  handler.current = (p) => {
    const v = video.current;
    const lag = Math.min(MAX_LAG, Math.max(0, (Date.now() - p.at) / 1000));
    const m = allRef.current.find((x) => x.id === p.movieId) || null;
    if (p.type === "select") {
      pending.current = null;
      clearInterval(countTimer.current);
      setCount(null);
      return setMovie(m);
    }
    if (p.type === "play") {
      if (!v) return (pending.current = { time: p.time + lag, playing: true });
      return remote(() => {
        v.currentTime = p.time + lag;
        playSafe();
      });
    }
    if (p.type === "pause") {
      if (!v) return;
      return remote(() => {
        v.pause();
        v.currentTime = p.time;
      });
    }
    if (p.type === "seek") {
      if (!v) return;
      return remote(() => (v.currentTime = p.time + (p.playing ? lag : 0)));
    }
    if (p.type === "countdown") return runCountdown(p.time);
    if (p.type === "tick") {
      if (!v || p.movieId !== movieRef.current?.id) return;
      if (Date.now() - lastLocal.current < GRACE_MS) return;
      const want = p.time + (p.playing ? lag : 0);
      if (Math.abs(v.currentTime - want) > DRIFT)
        remote(() => (v.currentTime = want));
      if (p.playing && v.paused) remote(playSafe);
      if (!p.playing && !v.paused) remote(() => v.pause());
      return;
    }
    if (p.type === "state_request") {
      if (!v || !movieRef.current) return;
      return send("state", {
        movieId: movieRef.current.id,
        time: v.currentTime,
        playing: !v.paused,
      });
    }
    if (p.type === "state") {
      if (movieRef.current || !m) return;
      pending.current = {
        time: p.time + (p.playing ? lag : 0),
        playing: p.playing,
      };
      setMovie(m);
    }
  };

  useEffect(() => {
    const ch = supabase.channel("cinema-" + space.id, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });
    channel.current = ch;
    ch.on("broadcast", { event: "cmd" }, ({ payload }) =>
      handler.current(payload),
    )
      .on("presence", { event: "sync" }, () => {
        peerIds.current = Object.keys(ch.presenceState());
        setPeers(peerIds.current.length);
      })
      .subscribe(async (status) => {
        setLive(status === "SUBSCRIBED");
        if (status !== "SUBSCRIBED") return;
        await ch.track({ at: Date.now() });
        send("state_request");
      });
    return () => {
      clearInterval(countTimer.current);
      clearTimeout(guard.current);
      supabase.removeChannel(ch);
    };
  }, [space.id, userId]);

  useEffect(() => {
    const t = setInterval(() => {
      const v = video.current;
      if (!v || v.paused || !movieRef.current) return;
      if ([...peerIds.current].sort()[0] !== userId) return;
      send("tick", {
        movieId: movieRef.current.id,
        time: v.currentTime,
        playing: true,
      });
    }, TICK);
    return () => clearInterval(t);
  }, [userId]);

  const local = (type) => () => {
    const v = video.current;
    if (remoteFlag.current || !v || !movieRef.current) return;
    lastLocal.current = Date.now();
    send(type, {
      movieId: movieRef.current.id,
      time: v.currentTime,
      playing: !v.paused,
    });
  };

  const pick = (m) => {
    pending.current = null;
    clearInterval(countTimer.current);
    setCount(null);
    setMovie(m);
    send("select", { movieId: m ? m.id : null });
  };

  const onLoaded = () => {
    const p = pending.current;
    if (!p || !video.current) return;
    pending.current = null;
    remote(() => {
      video.current.currentTime = p.time;
      if (p.playing) playSafe();
    });
  };

  const startTogether = () => {
    const t = video.current?.currentTime || 0;
    send("countdown", { movieId: movie.id, time: t });
    runCountdown(t);
  };

  const removeMovie = async (m) => {
    if (!m.path) {
      if (!confirm('Remove "' + m.title + '" from your library?')) return;
      const next = [...hidden, m.id];
      setHidden(next);
      try {
        localStorage.setItem("cin-hidden", JSON.stringify(next));
      } catch {}
      if (movieRef.current?.id === m.id) pick(null);
      return;
    }
    if (
      !confirm(
        'Delete "' + m.title + '" for everyone? This removes the video file.',
      )
    )
      return;
    if (movieRef.current?.id === m.id) pick(null);
    const files = [m.path, m.posterPath].filter(Boolean);
    try {
      if (m.store === "r2") await r2({ action: "delete", keys: files });
      else await supabase.storage.from("movies").remove(files);
    } catch (e) {
      alert("Could not delete the file: " + e.message);
      return;
    }
    await supabase.from("movies").delete().eq("id", m.id);
    loadMovies();
  };

  const status = (
    <span className={"cin-live" + (live ? " on" : "")}>
      <Users size={14} />
      {live ? peers + " watching" : "Connecting"}
    </span>
  );

  if (movie) {
    return (
      <div className="cin">
        <div className="cin-bar">
          <button className="btn ghost sm" onClick={() => pick(null)}>
            <ArrowLeft size={15} /> Library
          </button>
          {status}
        </div>

        <div className="cin-stage card">
          <video
            key={movie.id}
            ref={video}
            src={src || undefined}
            controls
            playsInline
            preload="auto"
            onLoadedMetadata={onLoaded}
            onPlay={local("play")}
            onPause={local("pause")}
            onSeeked={local("seek")}
            onWaiting={() => setBuffering(true)}
            onCanPlay={() => setBuffering(false)}
            onPlaying={() => {
              setBuffering(false);
              setNeedsTap(false);
            }}
          />
          {!src && (
            <div className="cin-overlay clear">
              {srcError ? (
                <span className="cin-err">{srcError}</span>
              ) : (
                <span className="cin-spin" />
              )}
            </div>
          )}
          {buffering && (
            <div className="cin-overlay clear">
              <span className="cin-spin" />
            </div>
          )}
          {count != null && (
            <div className="cin-overlay">
              <span className="cin-count">{count}</span>
            </div>
          )}
          {needsTap && (
            <button
              className="cin-overlay cin-tap"
              onClick={() => {
                setNeedsTap(false);
                video.current?.play();
              }}
            >
              Tap to join
            </button>
          )}
        </div>

        <div className="cin-info">
          <div>
            <h2>{movie.title}</h2>
            <p className="muted">
              {movie.genres.join(", ")} · {movie.year}
            </p>
            <p>{movie.desc}</p>
          </div>
          <div className="cin-actions">
            <button
              className="btn primary"
              onClick={startTogether}
              disabled={!src}
            >
              Start together (3, 2, 1)
            </button>
            {
              <button
                className="btn ghost sm"
                onClick={() => removeMovie(movie)}
              >
                <Trash2 size={14} /> Delete
              </button>
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cin">
      <div className="cin-bar">
        <div className="seg tiny">
          {TABS.map((t) => (
            <button
              key={t}
              className={tab === t ? "on" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="cin-bar-r">
          {status}
          <button className="btn primary sm" onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add movie
          </button>
        </div>
      </div>

      {showAdd && (
        <AddMovie
          space={space}
          userId={userId}
          onClose={() => setShowAdd(false)}
          onDone={loadMovies}
        />
      )}

      <label className="search cin-search">
        <Search size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles or genres"
        />
      </label>

      {shown.length === 0 && (
        <p className="muted cin-empty">
          Nothing here yet. Tap Add movie to upload one from your computer.
        </p>
      )}

      <div className="cin-grid">
        {shown.map((m, i) => (
          <div key={m.id} className="cin-item">
            <button className="cin-card" onClick={() => pick(m)}>
              <div className={"cin-poster tone-" + (i % 2)}>
                {m.poster ? (
                  <img src={m.poster} alt="" loading="lazy" />
                ) : (
                  <span>{m.title}</span>
                )}
                <em>{m.type}</em>
              </div>
              <h3>{m.title}</h3>
              <small className="muted">{m.genres.join(", ")}</small>
              <p>{m.desc}</p>
            </button>
            <button
              className="cin-del"
              aria-label="Delete"
              onClick={() => removeMovie(m)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddMovie({ space, userId, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Movies");
  const [genres, setGenres] = useState("");
  const [year, setYear] = useState("");
  const [desc, setDesc] = useState("");
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cancel = useRef(null);

  const choose = (f) => {
    setFile(f);
    if (f && !title)
      setTitle(
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[._]+/g, " ")
          .trim(),
      );
  };

  const submit = async () => {
    if (!file || !title.trim() || busy) return;
    setBusy(true);
    setErr("");
    setPct(0);
    let key = null;
    let posterKey = null;
    try {
      const posterBlob = await makePoster(file);
      key = await uploadToR2({
        file,
        onProgress: setPct,
        onCancel: (fn) => (cancel.current = fn),
      });
      if (posterBlob) {
        try {
          const pk = key.replace(/\.[^.]+$/, "") + "-poster.jpg";
          await putSmall(pk, posterBlob);
          posterKey = pk;
        } catch {}
      }
      const { error } = await supabase.from("movies").insert({
        space_id: space.id,
        user_id: userId,
        title: title.trim(),
        type,
        genres: genres
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
        year: parseInt(year) || null,
        description: desc.trim(),
        path: key,
        poster_path: posterKey,
        size: file.size,
        store: "r2",
      });
      if (error) throw error;
      onDone();
      onClose();
    } catch (e) {
      const leftovers = [key, posterKey].filter(Boolean);
      if (leftovers.length)
        r2({ action: "delete", keys: leftovers }).catch(() => {});
      setErr(e.message === "cancelled" ? "" : e.message || "Upload failed");
      setBusy(false);
    }
  };

  const close = () => {
    cancel.current?.();
    onClose();
  };

  return (
    <div
      className="cin-modal"
      onClick={(e) => e.target === e.currentTarget && !busy && close()}
    >
      <div className="cin-form card">
        <div className="cin-form-head">
          <h2>Add a movie</h2>
          <button className="btn ghost sm" onClick={close} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <label className="cin-file">
          <Upload size={18} />
          <span>
            {file
              ? file.name + " (" + (file.size / 1048576).toFixed(0) + " MB)"
              : "Choose a video from this computer"}
          </span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            disabled={busy}
            onChange={(e) => choose(e.target.files?.[0] || null)}
          />
        </label>
        <p className="muted cin-hint">
          MP4 (H.264) plays on every phone. MKV and AVI usually will not.
        </p>

        <input
          className="cin-in"
          placeholder="Title"
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="cin-row">
          <select
            className="cin-in"
            value={type}
            disabled={busy}
            onChange={(e) => setType(e.target.value)}
          >
            <option>Movies</option>
            <option>Series</option>
            <option>Anime</option>
          </select>
          <input
            className="cin-in"
            placeholder="Year"
            inputMode="numeric"
            value={year}
            disabled={busy}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <input
          className="cin-in"
          placeholder="Genres, separated by commas"
          value={genres}
          disabled={busy}
          onChange={(e) => setGenres(e.target.value)}
        />
        <textarea
          className="cin-in"
          rows={3}
          placeholder="Description (optional)"
          value={desc}
          disabled={busy}
          onChange={(e) => setDesc(e.target.value)}
        />

        {busy && (
          <div className="cin-prog">
            <div style={{ width: pct + "%" }} />
            <span>{pct < 100 ? "Uploading " + pct + "%" : "Finishing..."}</span>
          </div>
        )}
        {err && <p className="cin-err">{err}</p>}

        <button
          className="btn primary"
          disabled={!file || !title.trim() || busy}
          onClick={submit}
        >
          {busy ? "Uploading, keep this tab open" : "Upload"}
        </button>
      </div>
    </div>
  );
}
