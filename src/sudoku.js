// Sudoku generator with difficulty levels. Every puzzle has exactly one solution.

export const DIFFICULTIES = {
  easy:   { label: 'Easy',   clues: 40 },
  normal: { label: 'Normal', clues: 33 },
  hard:   { label: 'Hard',   clues: 28 },
  expert: { label: 'Expert', clues: 24 },
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const canPlace = (g, r, c, n) => {
  for (let i = 0; i < 9; i++) if (g[r][i] === n || g[i][c] === n) return false
  const br = r - (r % 3), bc = c - (c % 3)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[br + i][bc + j] === n) return false
  return true
}

// pick the empty cell with the fewest candidates (keeps the solver fast)
function bestCell(g) {
  let best = null, bestOpts = null
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (g[r][c] !== 0) continue
    const opts = []
    for (let n = 1; n <= 9; n++) if (canPlace(g, r, c, n)) opts.push(n)
    if (opts.length === 0) return { r, c, opts }
    if (!best || opts.length < bestOpts.length) { best = { r, c }; bestOpts = opts }
    if (bestOpts.length === 1) return { ...best, opts: bestOpts }
  }
  return best ? { ...best, opts: bestOpts } : null
}

function countSolutions(g, limit = 2) {
  const cell = bestCell(g)
  if (!cell) return 1
  let total = 0
  for (const n of cell.opts) {
    g[cell.r][cell.c] = n
    total += countSolutions(g, limit - total)
    g[cell.r][cell.c] = 0
    if (total >= limit) break
  }
  return total
}

function fillGrid(g) {
  const cell = bestCell(g)
  if (!cell) return true
  for (const n of shuffle(cell.opts.slice())) {
    g[cell.r][cell.c] = n
    if (fillGrid(g)) return true
    g[cell.r][cell.c] = 0
  }
  return false
}

export function generatePuzzle(difficulty = 'normal') {
  const target = (DIFFICULTIES[difficulty] || DIFFICULTIES.normal).clues
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0))
  fillGrid(solution)
  const puzzle = solution.map((r) => r.slice())
  let clues = 81
  for (const idx of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (clues <= target) break
    const r = Math.floor(idx / 9), c = idx % 9
    const keep = puzzle[r][c]
    puzzle[r][c] = 0
    if (countSolutions(puzzle.map((row) => row.slice())) !== 1) puzzle[r][c] = keep
    else clues--
  }
  return { puzzle, solution }
}
