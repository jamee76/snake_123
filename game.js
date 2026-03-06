// Snake (Kaplay.js) — mobile-first prototype with scalable structure
// Modules: config, grid, snake, food, input, game-state

const CONFIG = Object.freeze({
  grid: { w: 20, h: 16, tile: 24 },
  timing: { stepsPerSecond: 9 },
  snake: { startLength: 4, startDir: { x: 1, y: 0 } },
  rules: { wallCollision: true },
  colors: {
    bg: [12, 18, 32],
    gridLine: [255, 255, 255, 0.07],
    snakeHead: [50, 205, 50],
    snakeBody: [34, 160, 34],
    food: [239, 68, 68],
    overlay: [0, 0, 0, 0.55],
    text: [233, 238, 252],
  },
});

const scoreEl = document.getElementById("scoreDisplay");
const restartBtn = document.getElementById("restart");

// Kaplay should expose global `kaplay`
if (typeof kaplay !== "function") {
  throw new Error("Kaplay.js не найден. Проверь подключение библиотеки в index.html.");
}

const GAME_W = CONFIG.grid.w * CONFIG.grid.tile;
const GAME_H = CONFIG.grid.h * CONFIG.grid.tile;

kaplay({
  width: GAME_W,
  height: GAME_H,
  canvas: document.getElementById("gameCanvas"),
  background: CONFIG.colors.bg,
  crisp: true,
});

// ---------- Utils ----------
const v = (x, y) => ({ x, y });
const eq = (a, b) => a.x === b.x && a.y === b.y;
const add = (a, b) => v(a.x + b.x, a.y + b.y);
const keyOf = (p) => `${p.x},${p.y}`;
const inBounds = (p, w, h) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
const isOpposite = (a, b) => a.x === -b.x && a.y === -b.y;
const randInt = (min, maxExcl) => Math.floor(Math.random() * (maxExcl - min)) + min;

// ---------- Module: Grid ----------
function createGrid(cfg) {
  const { w, h, tile } = cfg;
  return {
    w, h, tile,
    toWorld(cell) {
      return vec2(cell.x * tile, cell.y * tile);
    },
    draw() {
      const c = CONFIG.colors.gridLine;
      const col = rgba(c[0], c[1], c[2], c[3]);
      for (let x = 0; x <= w; x++) {
        drawLine({ p1: vec2(x * tile, 0), p2: vec2(x * tile, h * tile), width: 1, color: col });
      }
      for (let y = 0; y <= h; y++) {
        drawLine({ p1: vec2(0, y * tile), p2: vec2(w * tile, y * tile), width: 1, color: col });
      }
    },
  };
}

// ---------- Module: Snake ----------
function createSnake({ startLength, startDir, startPos }) {
  const body = [];
  for (let i = 0; i < startLength; i++) body.push(v(startPos.x - i, startPos.y));

  let dir = { ...startDir };
  let pendingDir = { ...startDir };
  let growBy = 0;

  return {
    get body() { return body; },
    get head() { return body[0]; },
    setNextDir(next) {
      if (isOpposite(next, dir)) return; // no 180°
      pendingDir = { ...next };
    },
    step() {
      dir = { ...pendingDir };
      body.unshift(add(body[0], dir));
      if (growBy > 0) growBy--;
      else body.pop();
    },
    grow(n = 1) { growBy += n; },
    occupies(cell) { return body.some((p) => eq(p, cell)); },
    hitsSelf() {
      const h = body[0];
      for (let i = 1; i < body.length; i++) if (eq(h, body[i])) return true;
      return false;
    },
    reset({ startLength, startDir, startPos }) {
      body.length = 0;
      for (let i = 0; i < startLength; i++) body.push(v(startPos.x - i, startPos.y));
      dir = { ...startDir };
      pendingDir = { ...startDir };
      growBy = 0;
    },
  };
}

// ---------- Module: Food ----------
function createFoodSpawner({ w, h }) {
  let food = null;
  return {
    get cell() { return food; },
    spawn(isBlocked) {
      for (let i = 0; i < 5000; i++) {
        const c = v(randInt(0, w), randInt(0, h));
        if (!isBlocked(c)) { food = c; return food; }
      }
      food = null;
      return null;
    },
    clear() { food = null; },
  };
}

// ---------- Module: Input ----------
function createInput({ onDir, onRestart }) {
  // Keyboard
  onKeyPress("up", () => onDir(v(0, -1)));
  onKeyPress("down", () => onDir(v(0, 1)));
  onKeyPress("left", () => onDir(v(-1, 0)));
  onKeyPress("right", () => onDir(v(1, 0)));
  onKeyPress("w", () => onDir(v(0, -1)));
  onKeyPress("s", () => onDir(v(0, 1)));
  onKeyPress("a", () => onDir(v(-1, 0)));
  onKeyPress("d", () => onDir(v(1, 0)));
  onKeyPress("r", () => onRestart());

  // On-screen buttons
  const map = {
    up: v(0, -1),
    down: v(0, 1),
    left: v(-1, 0),
    right: v(1, 0),
  };

  ["up", "down", "left", "right"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onDir(map[id]);
    }, { passive: false });
  });

  restartBtn?.addEventListener("click", () => onRestart());
}

// ---------- Module: Game ----------
function createGame({ grid }) {
  let score = 0;
  let isOver = false;

  const walls = new Set(); // extension point

  const startPos = v(Math.floor(grid.w / 2), Math.floor(grid.h / 2));
  const snake = createSnake({
    startLength: CONFIG.snake.startLength,
    startDir: CONFIG.snake.startDir,
    startPos,
  });
  const food = createFoodSpawner({ w: grid.w, h: grid.h });

  const setScore = (n) => {
    score = n;
    scoreEl.textContent = `Score: ${score}`;
  };

  const setOver = (v) => {
    isOver = v;
    restartBtn.disabled = !isOver;
  };

  const isBlocked = (cell) => walls.has(keyOf(cell)) || snake.occupies(cell);

  const ensureFood = () => { if (!food.cell) food.spawn(isBlocked); };

  const reset = () => {
    setScore(0);
    setOver(false);
    snake.reset({
      startLength: CONFIG.snake.startLength,
      startDir: CONFIG.snake.startDir,
      startPos,
    });
    food.clear();
    ensureFood();
  };

  const step = () => {
    if (isOver) return;

    snake.step();

    if (CONFIG.rules.wallCollision && !inBounds(snake.head, grid.w, grid.h)) {
      setOver(true);
      return;
    }
    if (snake.hitsSelf()) {
      setOver(true);
      return;
    }

    if (food.cell && eq(snake.head, food.cell)) {
      snake.grow(1);
      setScore(score + 1);
      food.spawn(isBlocked);
    }
  };

  const draw = () => {
    grid.draw();

    // food
    if (food.cell) {
      const p = grid.toWorld(food.cell);
      const s = grid.tile;
      drawRect({
        pos: vec2(p.x + 3, p.y + 3),
        width: s - 6,
        height: s - 6,
        radius: 6,
        color: rgb(CONFIG.colors.food[0], CONFIG.colors.food[1], CONFIG.colors.food[2]),
      });
    }

    // snake
    const headCol = rgb(CONFIG.colors.snakeHead[0], CONFIG.colors.snakeHead[1], CONFIG.colors.snakeHead[2]);
    const bodyCol = rgb(CONFIG.colors.snakeBody[0], CONFIG.colors.snakeBody[1], CONFIG.colors.snakeBody[2]);

    snake.body.forEach((cell, idx) => {
      if (CONFIG.rules.wallCollision && !inBounds(cell, grid.w, grid.h)) return;
      const p = grid.toWorld(cell);
      const s = grid.tile;
      drawRect({
        pos: vec2(p.x + 1, p.y + 1),
        width: s - 2,
        height: s - 2,
        radius: 4,
        color: idx === 0 ? headCol : bodyCol,
      });
    });

    if (isOver) {
      drawRect({ pos: vec2(0, 0), width: width(), height: height(), color: rgba(0, 0, 0, 0.55) });
      drawText({
        text: `GAME OVER\nScore: ${score}\nPress Restart / R`,
        pos: vec2(width() / 2, height() / 2),
        anchor: "center",
        size: 22,
        color: rgb(CONFIG.colors.text[0], CONFIG.colors.text[1], CONFIG.colors.text[2]),
        align: "center",
      });
    }
  };

  return {
    reset,
    step,
    draw,
    setDirection: (d) => snake.setNextDir(d),
  };
}

// ---------- Wire ----------
const grid = createGrid(CONFIG.grid);
const game = createGame({ grid });

createInput({
  onDir: (dir) => game.setDirection(dir),
  onRestart: () => game.reset(),
});

game.reset();

// Fixed timestep
let acc = 0;
const stepDt = 1 / CONFIG.timing.stepsPerSecond;

onUpdate(() => {
  game.draw();
  acc += dt();
  while (acc >= stepDt) {
    game.step();
    acc -= stepDt;
  }
});
