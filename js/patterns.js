const LETTERS = ["B", "I", "N", "G", "O"];

function emptyPattern() {
  return Array.from({ length: 5 }, () => Array(5).fill(false));
}

function clonePattern(grid) {
  return grid.map((row) => row.slice());
}

function mark(cells) {
  const g = emptyPattern();
  for (const [r, c] of cells) g[r][c] = true;
  return g;
}

function allTrue() {
  return Array.from({ length: 5 }, () => Array(5).fill(true));
}

const PATTERNS = [
  { id: "custom", name: "Custom / Draw Your Own", grid: emptyPattern() },
  { id: "single-line", name: "Any Straight Line", grid: emptyPattern(), anyLine: true },
  { id: "coverall", name: "Coverall / Blackout", grid: allTrue() },
  {
    id: "four-corners",
    name: "Four Corners",
    grid: mark([[0, 0], [0, 4], [4, 0], [4, 4]]),
  },
  {
    id: "postage-stamp",
    name: "Postage Stamp",
    grid: mark([[0, 3], [0, 4], [1, 3], [1, 4]]),
  },
  {
    id: "small-frame",
    name: "Small Picture Frame",
    grid: mark([
      [1, 1], [1, 2], [1, 3],
      [2, 1], [2, 3],
      [3, 1], [3, 2], [3, 3],
    ]),
  },
  {
    id: "large-frame",
    name: "Large Picture Frame",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 0], [1, 4],
      [2, 0], [2, 4],
      [3, 0], [3, 4],
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
    ]),
  },
  {
    id: "letter-x",
    name: "Letter X",
    grid: mark([
      [0, 0], [0, 4],
      [1, 1], [1, 3],
      [2, 2],
      [3, 1], [3, 3],
      [4, 0], [4, 4],
    ]),
  },
  {
    id: "plus",
    name: "Plus Sign",
    grid: mark([
      [0, 2], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 2], [4, 2],
    ]),
  },
  {
    id: "diamond",
    name: "Diamond",
    grid: mark([
      [0, 2],
      [1, 1], [1, 3],
      [2, 0], [2, 4],
      [3, 1], [3, 3],
      [4, 2],
    ]),
  },
  {
    id: "small-diamond",
    name: "Small Diamond",
    grid: mark([[1, 2], [2, 1], [2, 3], [3, 2]]),
  },
  {
    id: "letter-t",
    name: "Letter T",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 2], [2, 2], [3, 2], [4, 2],
    ]),
  },
  {
    id: "letter-h",
    name: "Letter H",
    grid: mark([
      [0, 0], [0, 4],
      [1, 0], [1, 4],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [3, 0], [3, 4],
      [4, 0], [4, 4],
    ]),
  },
  {
    id: "letter-l",
    name: "Letter L",
    grid: mark([
      [0, 0], [1, 0], [2, 0], [3, 0],
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
    ]),
  },
  {
    id: "letter-n",
    name: "Letter N",
    grid: mark([
      [0, 0], [0, 4],
      [1, 0], [1, 1], [1, 4],
      [2, 0], [2, 2], [2, 4],
      [3, 0], [3, 3], [3, 4],
      [4, 0], [4, 4],
    ]),
  },
  {
    id: "letter-c",
    name: "Letter C",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 0], [2, 0], [3, 0],
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
    ]),
  },
  {
    id: "letter-u",
    name: "Letter U",
    grid: mark([
      [0, 0], [0, 4],
      [1, 0], [1, 4],
      [2, 0], [2, 4],
      [3, 0], [3, 4],
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
    ]),
  },
  {
    id: "lucky-7",
    name: "Lucky 7",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 3], [2, 2], [3, 1], [4, 0],
    ]),
  },
  {
    id: "six-pack",
    name: "Six Pack",
    grid: mark([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]),
  },
  {
    id: "railroad",
    name: "Railroad Tracks",
    grid: mark([
      [0, 1], [0, 3],
      [1, 1], [1, 3],
      [2, 1], [2, 3],
      [3, 1], [3, 3],
      [4, 1], [4, 3],
    ]),
  },
  {
    id: "layer-cake",
    name: "Layer Cake",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
    ]),
  },
  {
    id: "checkerboard",
    name: "Checkerboard",
    grid: mark([
      [0, 0], [0, 2], [0, 4],
      [1, 1], [1, 3],
      [2, 0], [2, 2], [2, 4],
      [3, 1], [3, 3],
      [4, 0], [4, 2], [4, 4],
    ]),
  },
  {
    id: "bowtie",
    name: "Bow Tie",
    grid: mark([
      [0, 0], [0, 4],
      [1, 1], [1, 3],
      [2, 2],
      [3, 1], [3, 3],
      [4, 0], [4, 4],
    ]),
  },
  {
    id: "top-hat",
    name: "Top Hat",
    grid: mark([
      [0, 1], [0, 2], [0, 3],
      [1, 1], [1, 2], [1, 3],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
    ]),
  },
  {
    id: "hardway",
    name: "Hardway Bingo (no free space)",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
      [2, 0], [2, 1], [2, 3], [2, 4],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
    ]),
  },
  {
    id: "double-bingo",
    name: "Double Bingo",
    grid: mark([
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 2], [2, 2], [3, 2], [4, 2],
    ]),
  },
  {
    id: "sputnik",
    name: "Sputnik",
    grid: mark([
      [0, 2], [1, 2],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [3, 2], [4, 2],
      [0, 0], [0, 4], [4, 0], [4, 4],
    ]),
  },
  {
    id: "arrow",
    name: "Arrow",
    grid: mark([
      [0, 4],
      [1, 3], [1, 4],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [3, 3], [3, 4],
      [4, 4],
    ]),
  },
  {
    id: "tree",
    name: "Tree",
    grid: mark([
      [0, 2],
      [1, 1], [1, 2], [1, 3],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [3, 2], [4, 2],
    ]),
  },
  {
    id: "heart",
    name: "Heart",
    grid: mark([
      [0, 1], [0, 3],
      [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
      [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [3, 1], [3, 2], [3, 3],
      [4, 2],
    ]),
  },
  {
    id: "ladder",
    name: "Ladder",
    grid: mark([
      [0, 1], [0, 2], [0, 3],
      [1, 1], [1, 3],
      [2, 1], [2, 2], [2, 3],
      [3, 1], [3, 3],
      [4, 1], [4, 2], [4, 3],
    ]),
  },
  {
    id: "block9",
    name: "Block of 9",
    grid: mark([
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ]),
  },
  {
    id: "b-column",
    name: "B Column",
    grid: mark([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
  },
  {
    id: "i-column",
    name: "I Column",
    grid: mark([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]),
  },
  {
    id: "n-column",
    name: "N Column",
    grid: mark([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]),
  },
  {
    id: "g-column",
    name: "G Column",
    grid: mark([[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]]),
  },
  {
    id: "o-column",
    name: "O Column",
    grid: mark([[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]]),
  },
];

function usedColumns(grid) {
  const used = [false, false, false, false, false];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c]) used[c] = true;
    }
  }
  if (!used.some(Boolean)) return [true, true, true, true, true];
  return used;
}

function letterForNumber(n) {
  if (n <= 15) return "B";
  if (n <= 30) return "I";
  if (n <= 45) return "N";
  if (n <= 60) return "G";
  return "O";
}

function columnIndexForNumber(n) {
  return Math.floor((n - 1) / 15);
}

function ballColor(letter) {
  return {
    B: { fill: "#c62828", text: "#fff" },
    I: { fill: "#1565c0", text: "#fff" },
    N: { fill: "#f5f5f5", text: "#111" },
    G: { fill: "#2e7d32", text: "#fff" },
    O: { fill: "#ef6c00", text: "#fff" },
  }[letter];
}
