import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw, Users, Gamepad2, Grid3X3, Keyboard } from "lucide-react";
import { supabase } from "./supabase.js";
import VALID_WORDS from "./word-list.json";
import { usePath, navigate } from "./router.js";
import "./games.css";

const WORDS = ["APPLE","BRAVE","CHAIR","DREAM","EARTH","FLAME","GRAPE","HEART","JUICE","KNIFE","LEMON","MUSIC","NIGHT","OCEAN","PEACH","QUIET","ROBOT","SMILE","TRAIN","WATER","PLANT","CLOUD","BREAD","LIGHT","HOUSE","GREEN","STONE","WORLD","PARTY","SUGAR","TIGER","RIVER","SHEEP","MOUSE","CROWN","BEACH","SWEET","HAPPY","MAGIC","PIZZA"];
const PUZZLE = [
  [5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
  [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
  [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]
];
const SOLUTION = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
];
const wordState = () => ({ answer: WORDS[Math.floor(Math.random()*WORDS.length)], guesses: [], current: "", status: "playing", lastBy: null });
const sudokuState = () => ({ puzzle: PUZZLE, solution: SOLUTION, values: PUZZLE.map(r=>r.slice()), selected: [0,0], status: "playing", lastBy: null });

export default function Games({ space, member, members }) {
  const path = usePath();
  const game = path.startsWith("/games/sudoku") ? "sudoku" : "wordle";
  const setGame = (g) => navigate("/games/" + g);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const writeQueue = useRef(Promise.resolve());
  const partner = members.find(m => m.user_id !== member.user_id);
  const nameById = useMemo(() => Object.fromEntries(members.map(m=>[m.user_id,m.display_name])), [members]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("shared_games").select("*").eq("space_id", space.id).eq("game_type", game).maybeSingle();
    if (error) setNotice("Games database isn't set up yet. Run supabase/games.sql in your Supabase SQL Editor.");
    else if (data) {
      const ok = game === "wordle" ? Array.isArray(data.state?.guesses) : Array.isArray(data.state?.values) && Array.isArray(data.state?.puzzle) && Array.isArray(data.state?.solution);
      if (ok) setSession(data);
      else {
        const fresh = game === "wordle" ? wordState() : sudokuState();
        await supabase.from("shared_games").update({state:fresh, updated_by:member.user_id, updated_at:new Date().toISOString()}).eq("id", data.id);
        setSession({ ...data, state: fresh });
      }
    }
    else {
      const initial_state = game === "wordle" ? wordState() : sudokuState();
      const { data: created, error: createError } = await supabase.from("shared_games").insert({space_id:space.id, game_type:game, state:initial_state, updated_by:member.user_id}).select().single();
      if (createError) {
        const { data: retry } = await supabase.from("shared_games").select("*").eq("space_id",space.id).eq("game_type",game).maybeSingle();
        if (retry) setSession(retry); else setNotice("Couldn't create the shared board. Check the games SQL setup and try again.");
      } else setSession(created);
    }
    setLoading(false);
  }, [space.id, game, member.user_id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel(`shared-game-${space.id}-${game}`)
      .on("postgres_changes", {event:"*", schema:"public", table:"shared_games", filter:`space_id=eq.${space.id}`}, payload => {
        const next = payload.new;
        if (next?.game_type === game) setSession(current => !current || current.game_type !== next.game_type || new Date(next.updated_at || 0) >= new Date(current.updated_at || 0) ? next : current);
      }).subscribe();
    const refresh = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("focus", refresh); supabase.removeChannel(channel); };
  }, [space.id, game, load]);

  const commit = (nextState) => {
    if (!session) return;
    const optimistic = { ...session, state: nextState, updated_by: member.user_id, updated_at: new Date().toISOString() };
    setSession(optimistic);
    setNotice("");
    const id = session.id;
    writeQueue.current = writeQueue.current.then(async () => {
      setSaving(true);
      const { error } = await supabase.from("shared_games").update({state:nextState, updated_by:member.user_id, updated_at:new Date().toISOString()}).eq("id",id);
      if (error) setNotice("Move wasn't saved. Check your connection and try again.");
      setSaving(false);
    }).catch(() => {
      setNotice("Move wasn't saved. Check your connection and try again.");
      setSaving(false);
    });
  };
  const reset = () => commit(game === "wordle" ? wordState() : sudokuState());
  const rawState = session && session.game_type === game ? session.state : null;
  const validState = rawState && (game === "wordle" ? Array.isArray(rawState.guesses) : Array.isArray(rawState.values) && Array.isArray(rawState.puzzle) && Array.isArray(rawState.solution));
  const state = validState ? rawState : null;
  const wordGuess = (letter) => {
    if (!state || state.status !== "playing") return;
    const current = (state.current || "");
    if (letter === "BACKSPACE") return commit({...state,current:current.slice(0,-1),lastBy:member.user_id});
    if (letter === "ENTER") {
      if (current.length !== 5) return setNotice("Enter a five-letter word first.");
      if (!VALID_WORDS.includes(current.toLowerCase())) return setNotice("That word is not in the game word list. Try another.");
      const guesses = [...state.guesses, {word:current, by:member.user_id}];
      const status = current === state.answer ? "won" : guesses.length >= 6 ? "lost" : "playing";
      return commit({...state,guesses,current:"",status,lastBy:member.user_id});
    }
    if (/^[A-Z]$/.test(letter) && current.length < 5) commit({...state,current:current+letter,lastBy:member.user_id});
  };
  const sudokuSet = (n) => {
    if (!state || !state.selected || state.status === "won") return;
    const [r,c] = state.selected;
    if (state.puzzle[r][c] !== 0) return;
    const values = state.values.map(row=>row.slice()); values[r][c] = n;
    const won = values.every((row,ri)=>row.every((v,ci)=>v === state.solution[ri][ci]));
    commit({...state,values,status:won?"won":"playing",lastBy:member.user_id});
  };
  const selectCell = (r,c) => state && commit({...state,selected:[r,c],lastBy:member.user_id});

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

      if (game === "wordle") {
        if (/^[a-z]$/i.test(event.key)) {
          event.preventDefault();
          wordGuess(event.key.toUpperCase());
        } else if (event.key === "Enter") {
          event.preventDefault();
          wordGuess("ENTER");
        } else if (event.key === "Backspace") {
          event.preventDefault();
          wordGuess("BACKSPACE");
        }
        return;
      }

      if (game === "sudoku") {
        if (/^[1-9]$/.test(event.key)) {
          event.preventDefault();
          sudokuSet(Number(event.key));
        } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
          event.preventDefault();
          sudokuSet(0);
        } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          const [r, c] = state?.selected || [0, 0];
          const nextR = Math.max(0, Math.min(8, r + (event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0)));
          const nextC = Math.max(0, Math.min(8, c + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0)));
          selectCell(nextR, nextC);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game, state, wordGuess, sudokuSet, selectCell]);

  const score = (guess, index) => {
    const answer = state.answer.split(""); const result = Array(5).fill("absent");
    guess.split("").forEach((ch,i)=>{ if(ch===answer[i]) { result[i]="correct"; answer[i]=null; } });
    guess.split("").forEach((ch,i)=>{ if(result[i]!=="correct") { const j=answer.indexOf(ch); if(j>=0){result[i]="present";answer[j]=null;} } });
    return result;
  };
  const lastName = state?.lastBy ? nameById[state.lastBy] || "Someone" : "No moves yet";

  return <section className="games-page">
    <header className="games-heading"><div className="games-icon"><Gamepad2 size={25}/></div><div><p className="games-eyebrow">YOUR SHARED SPACE</p><h1>Play together</h1><p className="games-subtitle">One board, two players. Every move syncs to both screens.</p></div></header>
    <div className="games-presence"><Users size={17}/><span>{member.display_name}</span><span className="presence-dot"/><span>{partner ? partner.display_name + " is your teammate" : "Waiting for your teammate"}</span><span className="live-pill">LIVE SYNC</span></div>
    <div className="games-tabs"><button className={game === "wordle" ? "active" : ""} onClick={()=>setGame("wordle")}><Keyboard size={18}/> Wordle</button><button className={game === "sudoku" ? "active" : ""} onClick={()=>setGame("sudoku")}><Grid3X3 size={18}/> Sudoku</button></div>
    {notice && <div className="games-notice" role="status">{notice}</div>}
    {loading || !state ? <div className="games-loading">Loading shared board…</div> : game === "wordle" ? <div className="game-card wordle-card">
      <div className="game-card-head"><div><h2>Wordle together</h2><p>Work together to find the five-letter word in six guesses. Type letters on your keyboard, press Enter to submit, and Backspace to erase.</p></div><button className="games-reset" onClick={reset} title="Start a new game"><RotateCcw size={17}/> New game</button></div>
      <div className="wordle-board" aria-label="Shared Wordle board">{Array.from({length:6},(_,ri)=>{const guess=state.guesses[ri];const letters=guess?guess.word:ri===state.guesses.length?state.current:"";const colors=guess?score(guess.word,ri):[];return <div className="wordle-row" key={ri}>{Array.from({length:5},(_,ci)=><div key={ci} className={`wordle-tile ${guess?colors[ci]:letters[ci]?"filled":""}`} aria-label={letters[ci]||"empty"}>{letters[ci]||""}</div>)}</div>})}</div>
      <div className="wordle-keyboard">{["QWERTYUIOP","ASDFGHJKL"].map(row=><div className="keyboard-row" key={row}>{row.split("").map(k=><button key={k} onClick={()=>wordGuess(k)}>{k}</button>)}</div>)}<div className="keyboard-row"><button className="key-wide" onClick={()=>wordGuess("ENTER")}>ENTER</button>{"ZXCVBNM".split("").map(k=><button key={k} onClick={()=>wordGuess(k)}>{k}</button>)}<button className="key-wide" onClick={()=>wordGuess("BACKSPACE")}>⌫</button></div></div>
      <div className="games-status">{state.status === "won" ? <><Check size={17}/> You solved it together! The word was {state.answer}.</> : state.status === "lost" ? <>The word was {state.answer}. Start a new game to play again.</> : <>Last move: <strong>{lastName}</strong> · {state.guesses.length}/6 guesses used</>}</div>
    </div> : <div className="game-card sudoku-card">
      <div className="game-card-head"><div><h2>Shared Sudoku</h2><p>Choose any empty cell and fill it. Your teammate sees each number live.</p></div><button className="games-reset" onClick={reset} title="Start a new puzzle"><RotateCcw size={17}/> Reset</button></div>
      <div className="sudoku-layout"><div className="sudoku-board" role="grid" aria-label="Shared Sudoku board">{state.values.map((row,r)=>row.map((value,c)=>{const fixed=state.puzzle[r][c]!==0;const selected=state.selected?.[0]===r&&state.selected?.[1]===c;const same=state.selected?.[0]===r||state.selected?.[1]===c;return <button role="gridcell" aria-label={`Row ${r+1}, column ${c+1}, ${value||"empty"}`} key={`${r}-${c}`} className={`sudoku-cell ${fixed?"fixed":"editable"} ${selected?"selected":""} ${same&&!selected?"related":""} ${r%3===2&&r!==8?"block-bottom":""} ${c%3===2&&c!==8?"block-right":""}`} onClick={()=>selectCell(r,c)}>{value||""}</button>}))}</div>
      <div className="sudoku-controls"><p className="sudoku-label">Selected cell</p><div className="number-pad">{[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>sudokuSet(n)} disabled={state.puzzle[state.selected[0]][state.selected[1]]!==0}>{n}</button>)}<button className="clear-number" onClick={()=>sudokuSet(0)} disabled={state.puzzle[state.selected[0]][state.selected[1]]!==0}>Clear</button></div><p className="games-tip">Click a cell, then type 1–9 on your keyboard. Use Backspace or Delete to clear, and arrow keys to move between cells. Numbers sync instantly.</p></div></div>
      <div className="games-status">{state.status === "won" ? <><Check size={17}/> Puzzle completed together!</> : <>Last move: <strong>{lastName}</strong> · Shared progress</>}</div>
    </div>}
    <p className="games-footnote">Changes are saved to your shared calendar space, so you can switch devices and continue together.</p>
  </section>;
}
