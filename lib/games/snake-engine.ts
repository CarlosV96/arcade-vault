import type { RealGameProps } from "./types";
import { FRUIT_SHEET_SRC, FRUIT_SPRITES, FRUIT_SPRITE_KEYS } from "./snake-sprites";

export interface SnakeEngine {
  pause(): void;
  resume(): void;
  endNow(): void; // termina la partida ya, dispara onGameOver(score) con el score actual
  destroy(): void; // cancela el loop de ticks y quita los listeners de teclado
}

type EngineCallbacks = Pick<
  RealGameProps,
  "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver"
>;

const W = 800;
const H = 600;
const CELL = 20;
const COLS = W / CELL; // 40
const ROWS = H / CELL; // 30

const START_LENGTH = 3;
const SCORE_PER_FRUIT = 10;
const START_INTERVAL = 140;
const INTERVAL_STEP = 4;
const MIN_INTERVAL = 60;
const MAX_DT = 50;

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

interface Vec {
  x: number;
  y: number;
}

type GameState = "playing" | "gameover";

function keyToDirection(code: string): Vec | null {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return { x: 0, y: -1 };
    case "ArrowDown":
    case "KeyS":
      return { x: 0, y: 1 };
    case "ArrowLeft":
    case "KeyA":
      return { x: -1, y: 0 };
    case "ArrowRight":
    case "KeyD":
      return { x: 1, y: 0 };
    default:
      return null;
  }
}

export function createSnakeEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks
): SnakeEngine {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  const fruitSheet = new Image();
  fruitSheet.src = FRUIT_SHEET_SRC;

  let snake: Vec[] = [];
  let direction: Vec = { x: 1, y: 0 };
  let pendingDirection: Vec = { x: 1, y: 0 };
  let fruit: Vec = { x: 0, y: 0 };
  let fruitKey: string = FRUIT_SPRITE_KEYS[0];
  let score = 0;
  let level = 1;
  let tickInterval = START_INTERVAL;
  let tickAccum = 0;
  let gameState: GameState = "playing";

  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;

  let lastEmittedScore = -1;
  let lastEmittedLevel = -1;
  let gameOverFired = false;

  function emitIfChanged() {
    if (score !== lastEmittedScore) {
      lastEmittedScore = score;
      callbacks.onScoreChange(score);
    }
    if (level !== lastEmittedLevel) {
      lastEmittedLevel = level;
      callbacks.onLevelChange(level);
    }
  }

  function fireGameOver() {
    if (gameOverFired) return;
    gameOverFired = true;
    callbacks.onGameOver(score);
  }

  function occupiedBySnake(x: number, y: number): boolean {
    return snake.some((seg) => seg.x === x && seg.y === y);
  }

  function spawnFruit() {
    let x: number;
    let y: number;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
    } while (occupiedBySnake(x, y));
    fruit = { x, y };
    fruitKey =
      FRUIT_SPRITE_KEYS[Math.floor(Math.random() * FRUIT_SPRITE_KEYS.length)];
  }

  function initGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 0; i < START_LENGTH; i++) {
      snake.push({ x: cx - i, y: cy });
    }
    direction = { x: 1, y: 0 };
    pendingDirection = { x: 1, y: 0 };
    score = 0;
    level = 1;
    tickInterval = START_INTERVAL;
    tickAccum = 0;
    gameState = "playing";
    gameOverFired = false;
    lastEmittedScore = -1;
    lastEmittedLevel = -1;
    spawnFruit();
    emitIfChanged();
  }

  function collide() {
    gameState = "gameover";
    callbacks.onLivesChange(0);
    fireGameOver();
  }

  function tick() {
    if (gameState !== "playing") return;

    direction = pendingDirection;
    const head = snake[0];
    const newHead: Vec = { x: head.x + direction.x, y: head.y + direction.y };

    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      collide();
      return;
    }

    const willGrow = newHead.x === fruit.x && newHead.y === fruit.y;
    const bodyToCheck = willGrow ? snake : snake.slice(0, snake.length - 1);
    if (bodyToCheck.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      collide();
      return;
    }

    snake.unshift(newHead);
    if (willGrow) {
      score += SCORE_PER_FRUIT;
      tickInterval = Math.max(MIN_INTERVAL, tickInterval - INTERVAL_STEP);
      spawnFruit();
    } else {
      snake.pop();
    }
    level = Math.max(1, Math.floor(snake.length / 5));
    emitIfChanged();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(0,255,136,0.06)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }
  }

  function drawSnake() {
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#00ff88" : "#00cc6a";
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function drawFruit() {
    const sprite = FRUIT_SPRITES[fruitKey];
    if (!sprite || !fruitSheet.complete || fruitSheet.naturalWidth === 0) return;
    ctx.drawImage(
      fruitSheet,
      sprite.x,
      sprite.y,
      sprite.w,
      sprite.h,
      fruit.x * CELL,
      fruit.y * CELL,
      CELL,
      CELL
    );
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (paused || gameState !== "playing") return;
    const dir = keyToDirection(e.code);
    if (!dir) return;
    if (dir.x === -direction.x && dir.y === -direction.y) return; // giro de 180° ignorado
    pendingDirection = dir;
  }
  window.addEventListener("keydown", onKeyDown);

  function loop(ts: number) {
    if (destroyed) return;
    if (paused) {
      lastTime = ts;
      draw();
      rafId = requestAnimationFrame(loop);
      return;
    }
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    tickAccum += dt;
    if (tickAccum >= tickInterval) {
      tickAccum = 0;
      tick();
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  callbacks.onLivesChange(1);
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    endNow() {
      gameState = "gameover";
      fireGameOver();
    },
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
