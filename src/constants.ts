/**
 * constants.ts
 */

import type { BreakoutConfig } from "./simulate-breakout";
import type { Palette } from "./render-breakout-svg";

export const GRID_ROWS = 7;
export const GRID_COLS = 53;

export const ANIM_FRAME_MS = 1000 / 30; // 30fps
export const ANIM_FRAME_COUNT = Math.round(30000 / ANIM_FRAME_MS); // 30s animation
export const HOLD_MS = 3000; // hold at end before loop

export const CELL = 10;
export const GAP = 3;
export const PAD = 18;

export const DARK_PALETTE: Palette = {
  background: "#0d1117",
  emptyCell: "#161b22",
  brickState2: "#2ea043", // <= 25 contributions
  brickState3: "#216e39", // > 25 contributions
  ball: "#f0f6fc",
  ballAccent: "#58a6ff",
  ballLevelColors: ["#58a6ff", "#00e5ff", "#ff1744"], // Normal, Penetration, High Speed
  paddle: "#30363d",
  paddleAccent: "#58a6ff",
};

export const LIGHT_PALETTE: Palette = {
  background: "#ffffff",
  emptyCell: "#ebedf0",
  brickState2: "#40c463",
  brickState3: "#216e39",
  ball: "#24292f",
  ballAccent: "#0969da",
  ballLevelColors: ["#0969da", "#00bcd4", "#d32f2f"],
  paddle: "#d0d7de",
  paddleAccent: "#0969da",
};

export const BREAKOUT_CONFIG: BreakoutConfig = {
  cols: GRID_COLS,
  rows: GRID_ROWS,
  cellSize: CELL,
  gap: GAP,
  pad: PAD,
  frameCount: ANIM_FRAME_COUNT,
  frameMs: ANIM_FRAME_MS,
  ballRadius: 4,
  ballSpeed: 8,
  paddleWidth: CELL * 6,
  paddleHeight: 5,
  paddleMaxSpeed: 10,
  paddleYOffset: 24,
};
