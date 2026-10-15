"use client";

import { useState, useEffect, useRef } from "react";

export default function GamesPage({ supabaseChannel }) {
  const [activeGame, setActiveGame] = useState(null);

  return (
    <div className="min-h-screen bg-[#090d16] text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 to-emerald-400 bg-clip-text text-transparent">
            Sync Arcade 🎮
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Play together on a live shared board in real-time
          </p>
        </div>

        {activeGame && (
          <button
            onClick={() => setActiveGame(null)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-xl transition border border-slate-700"
          >
            ← Back to Games
          </button>
        )}
      </div>

      {/* Game Selection Grid or Active Game */}
      {!activeGame ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => setActiveGame("wordle")}
            className="group bg-slate-900/70 border border-emerald-500/30 rounded-3xl p-8 cursor-pointer hover:scale-[1.02] transition-all hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between"
          >
            <div>
              <div className="text-4xl mb-4">🔠</div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-emerald-400 transition">
                Wordle Duo (Shared Board)
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Collaborate or take turns guessing the 6-letter secret word
                together on the exact same board.
              </p>
            </div>
            <div className="mt-8 text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <span>Play Wordle</span> <span>→</span>
            </div>
          </div>

          <div
            onClick={() => setActiveGame("sudoku")}
            className="group bg-slate-900/70 border border-pink-500/30 rounded-3xl p-8 cursor-pointer hover:scale-[1.02] transition-all hover:shadow-2xl hover:shadow-pink-500/10 flex flex-col justify-between"
          >
            <div>
              <div className="text-4xl mb-4">🔢</div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-pink-400 transition">
                Sudoku Co-op
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Fill out the 9x9 grid together. Every number placed syncs
                instantly to both screens.
              </p>
            </div>
            <div className="mt-8 text-sm font-semibold text-pink-400 flex items-center gap-2">
              <span>Play Sudoku</span> <span>→</span>
            </div>
          </div>
        </div>
      ) : activeGame === "wordle" ? (
        <SharedWordleBoard supabaseChannel={supabaseChannel} />
      ) : (
        <SharedSudokuBoard supabaseChannel={supabaseChannel} />
      )}
    </div>
  );
}

// --- SHARED WORDLE COMPONENT ---
function SharedWordleBoard({ supabaseChannel }) {
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState("");
  const targetWord = "HEARTS";
  const isRemote = useRef(false);

  useEffect(() => {
    if (!supabaseChannel) return;

    const sub = supabaseChannel.on(
      "broadcast",
      { event: "wordle-sync" },
      ({ payload }) => {
        isRemote.current = true;
        if (payload.guesses) setGuesses(payload.guesses);
        if (payload.currentGuess !== undefined)
          setCurrentGuess(payload.currentGuess);
        setTimeout(() => {
          isRemote.current = false;
        }, 200);
      },
    );

    return () => {
      // Clean up listener
    };
  }, [supabaseChannel]);

  const broadcastState = (newGuesses, newCurrentGuess) => {
    if (isRemote.current || !supabaseChannel) return;
    supabaseChannel.send({
      type: "broadcast",
      event: "wordle-sync",
      payload: { guesses: newGuesses, currentGuess: newCurrentGuess },
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (currentGuess.length !== 6) {
        setMessage("Word must be 6 letters!");
        return;
      }
      setMessage("");
      const updatedGuesses = [...guesses, currentGuess];
      setGuesses(updatedGuesses);
      setCurrentGuess("");
      broadcastState(updatedGuesses, "");
    } else if (e.key === "Backspace") {
      const updated = currentGuess.slice(0, -1);
      setCurrentGuess(updated);
      broadcastState(guesses, updated);
    } else if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < 6) {
      const updated = (currentGuess + e.key).toUpperCase();
      setCurrentGuess(updated);
      broadcastState(guesses, updated);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentGuess, guesses]);

  return (
    <div className="flex flex-col items-center space-y-6 py-6">
      <h2 className="text-2xl font-bold text-emerald-400">
        Wordle Duo (Shared Live Board)
      </h2>
      <p className="text-xs text-slate-400">
        Type on your keyboard — your partner sees letters pop up instantly!
      </p>
      {message && (
        <span className="text-xs px-3 py-1 bg-pink-500/20 text-pink-300 rounded-lg">
          {message}
        </span>
      )}

      <div className="space-y-2">
        {[...Array(6)].map((_, r) => {
          const guess =
            guesses[r] || (r === guesses.length ? currentGuess : "");
          return (
            <div key={r} className="flex gap-2">
              {[...Array(6)].map((_, c) => {
                const char = guess[c] || "";
                let bg = "bg-slate-900 border-slate-700 text-white";
                if (guesses[r]) {
                  if (char === targetWord[c])
                    bg = "bg-emerald-600 border-emerald-500 text-white";
                  else if (targetWord.includes(char))
                    bg = "bg-amber-600 border-amber-500 text-white";
                  else bg = "bg-slate-800 text-slate-500 border-slate-800";
                }
                return (
                  <div
                    key={c}
                    className={`w-14 h-14 border-2 rounded-xl flex items-center justify-center text-xl font-bold uppercase ${bg}`}
                  >
                    {char}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- SHARED SUDOKU COMPONENT ---
function SharedSudokuBoard({ supabaseChannel }) {
  const initialGrid = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ];

  const [grid, setGrid] = useState(initialGrid);
  const isRemote = useRef(false);

  useEffect(() => {
    if (!supabaseChannel) return;

    const sub = supabaseChannel.on(
      "broadcast",
      { event: "sudoku-sync" },
      ({ payload }) => {
        isRemote.current = true;
        if (payload.grid) setGrid(payload.grid);
        setTimeout(() => {
          isRemote.current = false;
        }, 200);
      },
    );
  }, [supabaseChannel]);

  const handleCellChange = (r, c, val) => {
    if (initialGrid[r][c] !== 0) return;
    const num = val === "" ? 0 : parseInt(val) || 0;
    if (num >= 0 && num <= 9) {
      const updatedGrid = grid.map((row, rowIndex) =>
        row.map((cell, colIndex) =>
          rowIndex === r && colIndex === c ? num : cell,
        ),
      );
      setGrid(updatedGrid);

      if (!isRemote.current && supabaseChannel) {
        supabaseChannel.send({
          type: "broadcast",
          event: "sudoku-sync",
          payload: { grid: updatedGrid },
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 py-6">
      <h2 className="text-2xl font-bold text-pink-400">Sudoku Co-op Board</h2>
      <p className="text-xs text-slate-400">
        Collaborate live — numbers fill in for both players simultaneously.
      </p>

      <div className="grid grid-cols-9 gap-1 bg-slate-800 p-3 rounded-2xl border border-slate-700 shadow-2xl">
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isInitial = initialGrid[r][c] !== 0;
            return (
              <input
                key={`${r}-${c}`}
                type="text"
                maxLength={1}
                value={cell === 0 ? "" : cell}
                disabled={isInitial}
                onChange={(e) => handleCellChange(r, c, e.target.value)}
                className={`w-10 h-10 text-center font-bold text-lg rounded-lg transition-all focus:outline-none ${
                  isInitial
                    ? "bg-slate-900 text-slate-500 cursor-not-allowed"
                    : "bg-slate-950 text-pink-300 focus:bg-pink-500/20 focus:border-pink-500 border border-slate-800"
                }`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
