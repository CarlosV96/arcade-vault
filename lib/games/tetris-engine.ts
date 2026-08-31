import type { RealGameProps } from "./types";

export interface TetrisEngine {
  pause(): void;
  resume(): void;
  endNow(): void; // termina la partida ya, dispara onGameOver(score) con el score actual
  destroy(): void; // cancela el loop y quita los listeners de teclado
}

type EngineCallbacks = Pick<
  RealGameProps,
  "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver"
>;

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PANEL_X = COLS * BLOCK; // 300
const PANEL_W = 150;
const NEXT_BLOCK = 24;

const LINE_SCORES = [0, 100, 300, 500, 800];

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: number[][][] = [
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                              // O
  [[0,3,0],[3,3,3],[0,0,0]],                 // T
  [[0,4,4],[4,4,0],[0,0,0]],                 // S
  [[5,5,0],[0,5,5],[0,0,0]],                 // Z
  [[6,0,0],[6,6,6],[0,0,0]],                 // J
  [[0,0,7],[7,7,7],[0,0,0]],                 // L
  [[8,8,8],[8,0,8],[8,8,8]],                 // N (tuerca)
];

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
]);

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks
): TetrisEngine {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let lastTime: number | null = null;
  let dropAccum = 0;
  let dropInterval = 1000;

  let destroyed = false;
  let rafId: number | null = null;
  let gameOverFired = false;
  let lastEmittedScore = -1;
  let lastEmittedLevel = -1;

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      fireGameOver();
    }
  }

  function fireGameOver() {
    gameOver = true;
    if (gameOverFired) return;
    gameOverFired = true;
    callbacks.onGameOver(score);
  }

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

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    gameOverFired = false;
    dropInterval = 1000;
    dropAccum = 0;
    next = randomPiece();
    spawn();
    emitIfChanged();
  }

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    if (!color) return;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function drawBoard() {
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  function drawPanel() {
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(PANEL_X, 0, PANEL_W, ROWS * BLOCK);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PANEL_X, 0);
    ctx.lineTo(PANEL_X, ROWS * BLOCK);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("NEXT", PANEL_X + PANEL_W / 2, 40);

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    const previewX = PANEL_X + (PANEL_W - 4 * NEXT_BLOCK) / 2;
    const previewY = 70;
    ctx.save();
    ctx.translate(previewX, previewY);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(ctx, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawPanel();
  }

  function update(dt: number) {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    emitIfChanged();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    emitIfChanged();
  }

  window.addEventListener("keydown", onKeyDown);

  function loop(ts: number) {
    if (destroyed) return;
    if (paused || gameOver) {
      lastTime = ts;
      draw();
      rafId = requestAnimationFrame(loop);
      return;
    }
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    update(dt);
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
      fireGameOver();
    },
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
