/**
 * constants.ts
 *
 * Minimal standalone config so the breakout mode can run/build on its own
 * for testing. If you're merging this into singularity-grid proper, these
 * should line up with (or replace duplicates in) your existing constants.ts —
 * keep whichever names your CA mode already uses and just add the
 * breakout-specific ones (BALL_*, PADDLE_*) alongside them.
 */

import type { BreakoutConfig } from "./simulate-breakout";
import type { Palette } from "./render-breakout-svg";

// Grid shape — matches a real GitHub contribution calendar (7 rows, ~53 weeks).
export const GRID_ROWS = 7;
export const GRID_COLS = 53;

// Animation timing — 15s total, locked to match the rest of the project.
export const ANIM_FRAME_MS = 1000 / 30; // 30fps simulation/render steps
export const ANIM_FRAME_COUNT = Math.round(15000 / ANIM_FRAME_MS);
export const HOLD_MS = 1500; // extra hold time appended after clearance, if you want it

// Grid sizing (px) — same vocabulary as the CA mode's CELL/GAP/PAD.
export const CELL = 10;
export const GAP = 3;
export const PAD = 12;

export const DARK_PALETTE: Palette = {
  background: "#0d1117",
  brickTier1: "#1f6feb33",
  brickTier2: "#1f6febaa",
  brickTier3: "#58a6ff",
  ball: "#f0f6fc",
  ballAccent: "#58a6ff",
  paddle: "#30363d",
  paddleAccent: "#58a6ff",
};

export const LIGHT_PALETTE: Palette = {
  background: "#ffffff",
  brickTier1: "#9be9a833",
  brickTier2: "#40c463aa",
  brickTier3: "#216e39",
  ball: "#24292f",
  ballAccent: "#0969da",
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
  ballSpeed: 5.5, // px/frame — tune so clearance lands ~13-14s; raise for more bricks/slower boards
  paddleWidth: CELL * 5,
  paddleHeight: 5,
  paddleMaxSpeed: 6,
  paddleYOffset: 24,
};
