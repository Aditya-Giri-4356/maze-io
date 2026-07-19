/* ============================================================
   MAZE.IO — Maze Generation Engine
   Square + Circular mazes with seeded PRNG
   ============================================================ */

// ---- Seeded PRNG (Mulberry32) ----
function createRNG(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Utility: hash a string into a 32-bit integer seed
function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// ============================================================
//  SQUARE MAZE — Recursive Backtracker (DFS)
// ============================================================

class SquareMaze {
  constructor(cols, rows, seed) {
    this.cols = cols;
    this.rows = rows;
    this.rng = createRNG(seed);
    this.grid = [];
    this.entry = { col: cols - 1, row: rows - 1 }; // bottom-right (player starts here)
    this.exit = { col: 0, row: 0 }; // top-left (exit/goal)
    this.type = 'square';
    this._generate();
  }

  _idx(col, row) {
    return row * this.cols + col;
  }

  _generate() {
    const { cols, rows } = this;
    // Each cell: { walls: {N, S, E, W}, visited }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.grid.push({
          col: c,
          row: r,
          walls: { N: true, S: true, E: true, W: true },
          visited: false,
        });
      }
    }

    // DFS stack-based (non-recursive to avoid stack overflow on large mazes)
    const stack = [];
    const start = this.grid[this._idx(0, 0)];
    start.visited = true;
    stack.push(start);

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = this._getUnvisitedNeighbors(current);

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        // Pick random unvisited neighbor
        const idx = Math.floor(this.rng() * neighbors.length);
        const { cell: next, direction } = neighbors[idx];
        // Remove wall between current and next
        this._removeWall(current, next, direction);
        next.visited = true;
        stack.push(next);
      }
    }

    // Open entry (bottom wall of bottom-right) and exit (top wall of top-left)
    this.grid[this._idx(this.entry.col, this.entry.row)].walls.S = false;
    this.grid[this._idx(this.exit.col, this.exit.row)].walls.N = false;
  }

  _getUnvisitedNeighbors(cell) {
    const neighbors = [];
    const { col, row } = cell;
    const dirs = [
      { dc: 0, dr: -1, dir: 'N' },
      { dc: 0, dr: 1, dir: 'S' },
      { dc: 1, dr: 0, dir: 'E' },
      { dc: -1, dr: 0, dir: 'W' },
    ];
    for (const { dc, dr, dir } of dirs) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
        const neighbor = this.grid[this._idx(nc, nr)];
        if (!neighbor.visited) {
          neighbors.push({ cell: neighbor, direction: dir });
        }
      }
    }
    return neighbors;
  }

  _removeWall(a, b, direction) {
    const opposite = { N: 'S', S: 'N', E: 'W', W: 'E' };
    a.walls[direction] = false;
    b.walls[opposite[direction]] = false;
  }

  getCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.grid[this._idx(col, row)];
  }

  canMove(col, row, direction) {
    const cell = this.getCell(col, row);
    if (!cell) return false;
    
    // Cannot move if there's a wall
    if (cell.walls[direction]) return false;

    // Even if there is no wall (e.g., the visual entry/exit gaps on the outer edge),
    // prevent moving if the target grid cell does not exist.
    const delta = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const [dc, dr] = delta[direction];
    const targetCell = this.getCell(col + dc, row + dr);
    
    return targetCell !== null;
  }

  // Render onto a canvas
  render(ctx, canvasSize, colors) {
    const { cols, rows } = this;
    const wallColor = colors.wall;
    const bgColor = colors.bg;
    const cellSize = canvasSize / Math.max(cols, rows);
    const offsetX = (canvasSize - cols * cellSize) / 2;
    const offsetY = (canvasSize - rows * cellSize) / 2;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.strokeStyle = wallColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (const cell of this.grid) {
      const x = offsetX + cell.col * cellSize;
      const y = offsetY + cell.row * cellSize;

      if (cell.walls.N) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellSize, y);
        ctx.stroke();
      }
      if (cell.walls.S) {
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
      if (cell.walls.E) {
        ctx.beginPath();
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
      if (cell.walls.W) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cellSize);
        ctx.stroke();
      }
    }
  }

  getPlayerPosition(col, row, canvasSize) {
    const cellSize = canvasSize / Math.max(this.cols, this.rows);
    const offsetX = (canvasSize - this.cols * cellSize) / 2;
    const offsetY = (canvasSize - this.rows * cellSize) / 2;
    return {
      x: offsetX + col * cellSize + cellSize / 2,
      y: offsetY + row * cellSize + cellSize / 2,
      size: cellSize * 0.35,
    };
  }

  isExit(col, row) {
    return col === this.exit.col && row === this.exit.row;
  }

  getStartPosition() {
    return { col: this.entry.col, row: this.entry.row };
  }
}

// ============================================================
//  LEVEL CONFIGURATION — All Square, Increasing Difficulty
// ============================================================

const LEVEL_CONFIG = [
  { cols: 10, rows: 10 },   // Level 1 — Easy
  { cols: 15, rows: 15 },   // Level 2 — Medium
  { cols: 20, rows: 20 },   // Level 3 — Hard
  { cols: 25, rows: 25 },   // Level 4 — Very Hard
  { cols: 30, rows: 30 },   // Level 5 — Brutal
];

function generateMazeForLevel(level, roomSeed) {
  const config = LEVEL_CONFIG[level - 1] || LEVEL_CONFIG[LEVEL_CONFIG.length - 1];
  const seed = hashSeed(roomSeed + '-level-' + level);
  return new SquareMaze(config.cols, config.rows, seed);
}

// Make available globally
window.MazeEngine = {
  SquareMaze,
  generateMazeForLevel,
  createRNG,
  hashSeed,
  LEVEL_CONFIG,
  TOTAL_LEVELS: LEVEL_CONFIG.length,
};

