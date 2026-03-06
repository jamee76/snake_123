"use strict";

// ════════════════════════════════════════════════════════════════
//  CONFIG  —  All tunable game parameters in one place.
//  Add levels, obstacles, or new food types by extending this.
// ════════════════════════════════════════════════════════════════
const CONFIG = {
  GRID_COLS:     20,       // horizontal cells
  GRID_ROWS:     20,       // vertical cells
  CELL_SIZE:     24,       // pixels per cell
  INITIAL_SPEED:  8,       // game ticks per second
  INITIAL_LENGTH: 3,       // starting snake length

  // RGB colors [R, G, B]
  COLOR: {
    BG:         [15,  23,  42],   // canvas background
    GRID_LINE:  [30,  41,  59],   // subtle grid
    SNAKE_HEAD: [74, 222, 128],   // bright green head
    SNAKE_BODY: [34, 197,  94],   // slightly darker body
    FOOD:       [248, 113, 113],  // soft red food
    TEXT:       [226, 232, 240],  // light text
  },
};

// ════════════════════════════════════════════════════════════════
//  GRID MODULE  —  Tracks which cells are occupied.
//  Provides fast free-cell lookup for food spawning.
//  Extendable: add wall/obstacle sets here later.
// ════════════════════════════════════════════════════════════════
function createGrid(cols, rows) {
  const occupied = new Set();
  const key = (x, y) => `${x},${y}`;

  return {
    cols,
    rows,
    isInBounds:  (x, y) => x >= 0 && x < cols && y >= 0 && y < rows,
    occupy:      (x, y) => occupied.add(key(x, y)),
    release:     (x, y) => occupied.delete(key(x, y)),
    isOccupied:  (x, y) => occupied.has(key(x, y)),
    clear:       ()     => occupied.clear(),

    /** Returns every cell not currently occupied */
    getFreeCells() {
      const free = [];
      for (let x = 0; x < cols; x++)
        for (let y = 0; y < rows; y++)
          if (!occupied.has(key(x, y))) free.push({ x, y });
      return free;
    },
  };
}

// ════════════════════════════════════════════════════════════════
//  SNAKE MODULE  —  Segment array, direction, movement logic.
//  180° reversals are silently rejected.
// ════════════════════════════════════════════════════════════════
function createSnake(grid, initialLength) {
  let segments = [];           // [head, ...body]
  let dir      = { x: 1, y: 0 };
  let nextDir  = { x: 1, y: 0 };

  function reset() {
    // Release any existing cells
    for (const s of segments) grid.release(s.x, s.y);
    segments = [];

    const sx = Math.floor(grid.cols / 2);
    const sy = Math.floor(grid.rows / 2);
    for (let i = 0; i < initialLength; i++) {
      const seg = { x: sx - i, y: sy };
      segments.push(seg);
      grid.occupy(seg.x, seg.y);
    }
    dir     = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
  }

  reset();

  return {
    reset,

    /** Queue a direction change; 180° turn is ignored */
    setDirection(dx, dy) {
      if (dx === -dir.x && dy === -dir.y) return;
      nextDir = { x: dx, y: dy };
    },

    getHead()     { return segments[0]; },
    getSegments() { return segments; },

    /** Returns what the next head position will be without mutating state */
    peekNextHead() {
      return {
        x: segments[0].x + nextDir.x,
        y: segments[0].y + nextDir.y,
      };
    },

    /**
     * Advance the snake one step.
     * @param {boolean} grow – when true the tail is kept (snake ate food).
     */
    move(grow = false) {
      dir = nextDir;
      const newHead = {
        x: segments[0].x + dir.x,
        y: segments[0].y + dir.y,
      };
      segments.unshift(newHead);
      grid.occupy(newHead.x, newHead.y);

      if (!grow) {
        const tail = segments.pop();
        grid.release(tail.x, tail.y);
      }
    },
  };
}

// ════════════════════════════════════════════════════════════════
//  FOOD MODULE  —  Spawns a single food piece on a free cell.
//  Extendable: support multiple food items / types.
// ════════════════════════════════════════════════════════════════
function createFood(grid) {
  let pos = null;

  function spawn() {
    const free = grid.getFreeCells();
    if (!free.length) return false;
    pos = free[Math.floor(Math.random() * free.length)];
    return true;
  }

  spawn();   // place initial food

  return {
    spawn,
    getPos:  ()     => pos,
    isAt:    (x, y) => pos !== null && pos.x === x && pos.y === y,
    clear:   ()     => { pos = null; },
  };
}

// ════════════════════════════════════════════════════════════════
//  GAME-STATE MODULE  —  Simple FSM: RUNNING ↔ GAME_OVER.
//  Extendable: add PAUSED, LEVEL_TRANSITION, etc.
// ════════════════════════════════════════════════════════════════
function createGameState() {
  let running = true;
  let score   = 0;

  return {
    isRunning:   () => running,
    isGameOver:  () => !running,
    setGameOver: () => { running = false; },
    reset:       () => { running = true; score = 0; },
    addScore:    (n = 1) => { score += n; },
    getScore:    () => score,
  };
}

// ════════════════════════════════════════════════════════════════
//  KAPLAY SETUP
// ════════════════════════════════════════════════════════════════
const CANVAS_W = CONFIG.GRID_COLS * CONFIG.CELL_SIZE;  // 480 px
const CANVAS_H = CONFIG.GRID_ROWS * CONFIG.CELL_SIZE;  // 480 px

kaplay({
  width:      CANVAS_W,
  height:     CANVAS_H,
  canvas:     document.getElementById("gameCanvas"),
  background: CONFIG.COLOR.BG,
  global:     true,   // exposes kaplay API in global scope
});

// ════════════════════════════════════════════════════════════════
//  SCENE: "game"
// ════════════════════════════════════════════════════════════════
scene("game", () => {
  const CS = CONFIG.CELL_SIZE;

  // Instantiate modules (new instances every time the scene loads)
  const grid  = createGrid(CONFIG.GRID_COLS, CONFIG.GRID_ROWS);
  const snake = createSnake(grid, CONFIG.INITIAL_LENGTH);
  const food  = createFood(grid);
  const state = createGameState();

  // ── Keyboard input ─────────────────────────────────────────
  onKeyPress(["left",  "a"], () => snake.setDirection(-1,  0));
  onKeyPress(["right", "d"], () => snake.setDirection( 1,  0));
  onKeyPress(["up",    "w"], () => snake.setDirection( 0, -1));
  onKeyPress(["down",  "s"], () => snake.setDirection( 0,  1));

  // ── Fixed-rate game tick ────────────────────────────────────
  loop(1 / CONFIG.INITIAL_SPEED, () => {
    if (!state.isRunning()) return;

    const next   = snake.peekNextHead();
    const eating = food.isAt(next.x, next.y);
    const segs   = snake.getSegments();

    // --- Wall collision ---
    if (!grid.isInBounds(next.x, next.y)) {
      state.setGameOver();
      go("gameover", state.getScore());
      return;
    }

    // --- Self-collision ---
    // When not eating the tail vacates, so skip the last segment.
    const checkLimit = eating ? segs.length : segs.length - 1;
    for (let i = 1; i < checkLimit; i++) {
      if (segs[i].x === next.x && segs[i].y === next.y) {
        state.setGameOver();
        go("gameover", state.getScore());
        return;
      }
    }

    // --- Move ---
    snake.move(eating);

    // --- Eat food ---
    if (eating) {
      food.clear();
      state.addScore(1);
      food.spawn();
    }
  });

  // ── Draw (called every frame) ───────────────────────────────
  onDraw(() => {
    // Grid lines (1-px rectangles spanning the full canvas)
    for (let x = 0; x <= CONFIG.GRID_COLS; x++) {
      drawRect({
        pos:    vec2(x * CS, 0),
        width:  1,
        height: CANVAS_H,
        color:  rgb(...CONFIG.COLOR.GRID_LINE),
      });
    }
    for (let y = 0; y <= CONFIG.GRID_ROWS; y++) {
      drawRect({
        pos:    vec2(0,        y * CS),
        width:  CANVAS_W,
        height: 1,
        color:  rgb(...CONFIG.COLOR.GRID_LINE),
      });
    }

    // Snake segments
    const segs = snake.getSegments();
    for (let i = 0; i < segs.length; i++) {
      const col = i === 0 ? CONFIG.COLOR.SNAKE_HEAD : CONFIG.COLOR.SNAKE_BODY;
      drawRect({
        pos:    vec2(segs[i].x * CS + 1, segs[i].y * CS + 1),
        width:  CS - 2,
        height: CS - 2,
        color:  rgb(...col),
        radius: 3,
      });
    }

    // Food
    const fp = food.getPos();
    if (fp) {
      drawCircle({
        pos:    vec2(fp.x * CS + CS / 2, fp.y * CS + CS / 2),
        radius: CS / 2 - 3,
        color:  rgb(...CONFIG.COLOR.FOOD),
      });
    }

    // Score HUD (top-left corner)
    drawText({
      text:  `Score: ${state.getScore()}`,
      size:  14,
      pos:   vec2(6, 6),
      color: rgb(...CONFIG.COLOR.TEXT),
    });
  });
});

// ════════════════════════════════════════════════════════════════
//  SCENE: "gameover"
// ════════════════════════════════════════════════════════════════
scene("gameover", (score) => {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  // GAME OVER title
  add([
    text("GAME OVER", { size: 40 }),
    pos(cx, cy - 80),
    anchor("center"),
    color(...CONFIG.COLOR.FOOD),
  ]);

  // Final score
  add([
    text(`Score: ${score}`, { size: 26 }),
    pos(cx, cy - 20),
    anchor("center"),
    color(...CONFIG.COLOR.TEXT),
  ]);

  // Keyboard hint
  add([
    text("Press ENTER or Space to restart", { size: 14 }),
    pos(cx, cy + 30),
    anchor("center"),
    color(...CONFIG.COLOR.TEXT),
  ]);

  // Clickable RESTART button
  const btn = add([
    rect(180, 44, { radius: 8 }),
    pos(cx, cy + 90),
    anchor("center"),
    color(...CONFIG.COLOR.FOOD),
    area(),
  ]);

  add([
    text("RESTART", { size: 20 }),
    pos(cx, cy + 90),
    anchor("center"),
    color(255, 255, 255),
  ]);

  btn.onClick(() => go("game"));
  onKeyPress(["enter", "space"], () => go("game"));
});

// ── Launch ──────────────────────────────────────────────────────
go("game");
