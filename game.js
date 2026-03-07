"use strict";

// ════════════════════════════════════════════════════════════════
//  CONFIG  —  All tunable game parameters in one place.
// ════════════════════════════════════════════════════════════════
const CONFIG = {
  GRID_COLS:     20,
  GRID_ROWS:     20,
  CELL_SIZE:     24,        // pixels per cell  → canvas = 480 × 480
  INITIAL_SPEED:  8,        // ticks per second
  INITIAL_LENGTH: 3,

  COLOR: {
    BG:         "#0f172a",
    GRID_LINE:  "#1e293b",
    SNAKE_HEAD: "#4ade80",
    SNAKE_BODY: "#22c55e",
    FOOD:       "#f87171",
    TEXT:       "#e2e8f0",
    OVERLAY:    "rgba(0,0,0,0.6)",
    BTN_HOVER:  "#ef4444",
  },
};

// ════════════════════════════════════════════════════════════════
//  GRID MODULE
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
    clear:       ()     => occupied.clear(),

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
//  SNAKE MODULE
// ════════════════════════════════════════════════════════════════
function createSnake(grid, initialLength) {
  let segments = [];
  let dir      = { x: 1, y: 0 };
  let nextDir  = { x: 1, y: 0 };

  function reset() {
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

    /** Queue a direction change; 180° reversals are ignored */
    setDirection(dx, dy) {
      if (dx === -dir.x && dy === -dir.y) return;
      nextDir = { x: dx, y: dy };
    },

    getHead()     { return segments[0]; },
    getSegments() { return segments; },

    peekNextHead() {
      return {
        x: segments[0].x + nextDir.x,
        y: segments[0].y + nextDir.y,
      };
    },

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
//  FOOD MODULE
// ════════════════════════════════════════════════════════════════
function createFood(grid) {
  let pos = null;

  function spawn() {
    const free = grid.getFreeCells();
    if (!free.length) return false;
    pos = free[Math.floor(Math.random() * free.length)];
    return true;
  }

  return {
    spawn,
    init()       { spawn(); },
    getPos()     { return pos; },
    isAt(x, y)   { return pos !== null && pos.x === x && pos.y === y; },
    clear()      { pos = null; },
  };
}

// ════════════════════════════════════════════════════════════════
//  GAME-STATE MODULE
// ════════════════════════════════════════════════════════════════
function createGameState() {
  let running = false;
  let score   = 0;

  return {
    isRunning:   () => running,
    isGameOver:  () => !running,
    setRunning:  () => { running = true; },
    setGameOver: () => { running = false; },
    reset()      { running = true; score = 0; },
    addScore(n = 1) { score += n; },
    getScore()   { return score; },
  };
}

// ════════════════════════════════════════════════════════════════
//  RENDERER  —  All canvas drawing in one place.
// ════════════════════════════════════════════════════════════════
function createRenderer(canvas, cfg) {
  const ctx  = canvas.getContext("2d");
  const CS   = cfg.CELL_SIZE;
  const W    = cfg.GRID_COLS * CS;
  const H    = cfg.GRID_ROWS * CS;

  canvas.width  = W;
  canvas.height = H;

  return {
    drawFrame(snake, food, state) {
      // Background
      ctx.fillStyle = cfg.COLOR.BG;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = cfg.COLOR.GRID_LINE;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      for (let x = 0; x <= cfg.GRID_COLS; x++) {
        ctx.moveTo(x * CS + 0.5, 0);
        ctx.lineTo(x * CS + 0.5, H);
      }
      for (let y = 0; y <= cfg.GRID_ROWS; y++) {
        ctx.moveTo(0,     y * CS + 0.5);
        ctx.lineTo(W, y * CS + 0.5);
      }
      ctx.stroke();

      // Food — filled circle
      const fp = food.getPos();
      if (fp) {
        ctx.fillStyle = cfg.COLOR.FOOD;
        ctx.beginPath();
        ctx.arc(fp.x * CS + CS / 2, fp.y * CS + CS / 2, CS / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Snake segments — rounded rectangles
      const segs = snake.getSegments();
      const r    = 4;
      for (let i = 0; i < segs.length; i++) {
        const { x, y } = segs[i];
        ctx.fillStyle = i === 0 ? cfg.COLOR.SNAKE_HEAD : cfg.COLOR.SNAKE_BODY;
        const px = x * CS + 1;
        const py = y * CS + 1;
        const sz = CS - 2;
        ctx.beginPath();
        ctx.roundRect(px, py, sz, sz, r);
        ctx.fill();
      }

      // Score HUD — dark pill so it's always readable regardless of food position
      const scoreText = `Score: ${state.getScore()}`;
      ctx.font = "bold 14px monospace";
      const tw = ctx.measureText(scoreText).width;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(4, 4, tw + 12, 22, 6);
      ctx.fill();
      ctx.fillStyle = cfg.COLOR.TEXT;
      ctx.fillText(scoreText, 10, 20);

      // Game-over overlay
      if (state.isGameOver()) {
        ctx.fillStyle = cfg.COLOR.OVERLAY;
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";

        ctx.fillStyle = cfg.COLOR.FOOD;
        ctx.font      = "bold 44px monospace";
        ctx.fillText("GAME OVER", W / 2, H / 2 - 70);

        ctx.fillStyle = cfg.COLOR.TEXT;
        ctx.font      = "bold 28px monospace";
        ctx.fillText(`Score: ${state.getScore()}`, W / 2, H / 2 - 20);

        ctx.font = "16px monospace";
        ctx.fillText("Press ENTER / Space / tap to restart", W / 2, H / 2 + 30);

        // Restart button (drawn on canvas)
        const bx = W / 2 - 80;
        const by = H / 2 + 60;
        const bw = 160;
        const bh = 44;
        ctx.fillStyle = cfg.COLOR.FOOD;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font      = "bold 20px monospace";
        ctx.fillText("RESTART", W / 2, by + bh / 2);

        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
      }
    },
  };
}

// ════════════════════════════════════════════════════════════════
//  GAME LOOP
// ════════════════════════════════════════════════════════════════
function startGame() {
  const canvas   = document.getElementById("gameCanvas");
  const cfg      = CONFIG;
  const renderer = createRenderer(canvas, cfg);

  let grid, snake, food, state;
  let tickInterval = null;

  function init() {
    if (tickInterval) clearInterval(tickInterval);

    grid  = createGrid(cfg.GRID_COLS, cfg.GRID_ROWS);
    snake = createSnake(grid, cfg.INITIAL_LENGTH);
    food  = createFood(grid);
    state = createGameState();

    food.init();
    state.setRunning();

    tickInterval = setInterval(tick, 1000 / cfg.INITIAL_SPEED);
    requestAnimationFrame(loop);
  }

  function tick() {
    if (!state.isRunning()) return;

    const next   = snake.peekNextHead();
    const eating = food.isAt(next.x, next.y);
    const segs   = snake.getSegments();

    // Wall collision
    if (!grid.isInBounds(next.x, next.y)) {
      state.setGameOver();
      clearInterval(tickInterval);
      return;
    }

    // Self-collision (tail vacates when not eating, so skip last segment)
    const checkLimit = eating ? segs.length : segs.length - 1;
    for (let i = 1; i < checkLimit; i++) {
      if (segs[i].x === next.x && segs[i].y === next.y) {
        state.setGameOver();
        clearInterval(tickInterval);
        return;
      }
    }

    snake.move(eating);

    if (eating) {
      food.clear();
      state.addScore(1);
      food.spawn();
    }
  }

  let animId = null;
  function loop() {
    renderer.drawFrame(snake, food, state);
    animId = requestAnimationFrame(loop);
  }

  // ── Input: keyboard ────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (state.isGameOver()) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); init(); }
      return;
    }
    switch (e.key) {
      case "ArrowLeft":  case "a": snake.setDirection(-1,  0); break;
      case "ArrowRight": case "d": snake.setDirection( 1,  0); break;
      case "ArrowUp":    case "w": snake.setDirection( 0, -1); break;
      case "ArrowDown":  case "s": snake.setDirection( 0,  1); break;
    }
  });

  // ── Input: canvas click / tap (restart button hit-test) ────
  canvas.addEventListener("click", (e) => {
    if (!state.isGameOver()) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;
    const W  = cfg.GRID_COLS * cfg.CELL_SIZE;
    const H  = cfg.GRID_ROWS * cfg.CELL_SIZE;
    const bx = W / 2 - 80, by = H / 2 + 60, bw = 160, bh = 44;
    if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) init();
  });

  // ── Input: mobile D-pad buttons ────────────────────────────
  const btnMap = {
    "btn-up":    [  0, -1],
    "btn-down":  [  0,  1],
    "btn-left":  [ -1,  0],
    "btn-right": [  1,  0],
  };
  Object.entries(btnMap).forEach(([id, dpad]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      if (state.isRunning()) snake.setDirection(dpad[0], dpad[1]);
    };
    el.addEventListener("click",      handler);
    el.addEventListener("touchstart", handler, { passive: false });
  });

  init();
}

// ── Boot ────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startGame);
} else {
  startGame();
}
