/**
 * render-breakout-svg.ts
 *
 * Renders the breakout simulation as an animated SVG using native <animate>
 * elements with explicit per-frame values.
 *
 *  Bricks  — 3 green tiers (dark → mid → light) that change on each hit
 *             then disappear when destroyed.
 *  Ball    — single clean circle with glow filter; colour + size changes
 *             with ball power level.
 *  Paddle  — smooth bar that follows the predictive AI position.
 */

import type { BreakoutConfig, BreakoutFrame } from "./simulate-breakout";

export interface Palette {
  background: string;
  emptyCell: string;
  brickState2: string; // hp 1
  brickState3: string; // hp 2
  ball: string;
  ballAccent: string;
  /** Ball fill colour at each of the 3 power levels (index 0–2) */
  ballLevelColors: [string, string, string];
  paddle: string;
  paddleAccent: string;
}

function brickColor(p: Palette, hp: number): string {
  if (hp >= 2) return p.brickState3;
  if (hp === 1) return p.brickState2;
  return p.emptyCell; // Fallback
}

function brickRect(config: BreakoutConfig, row: number, col: number) {
  const x = config.pad + col * (config.cellSize + config.gap);
  const y = config.pad + row * (config.cellSize + config.gap);
  return { x, y, w: config.cellSize, h: config.cellSize };
}

export function renderBreakoutSVG(
  frames: BreakoutFrame[],
  tierGrid: number[][],
  config: BreakoutConfig,
  palette: Palette
): string {
  const { rows, cols } = config;
  const n = frames.length;
  const totalMs = n * config.frameMs;
  const dur = (totalMs / 1000).toFixed(3) + "s";

  // keyTimes: 0..1 evenly spaced across all frames
  const keyTimes = Array.from({ length: n }, (_, i) =>
    (i / Math.max(n - 1, 1)).toFixed(5)
  ).join(";");

  const boardWidth =
    config.pad * 2 + cols * config.cellSize + (cols - 1) * config.gap;
  const boardHeight =
    config.pad +
    rows * config.cellSize +
    (rows - 1) * config.gap +
    config.paddleYOffset +
    config.paddleHeight +
    config.pad;

  // ------------------------------------------------------------------ Bricks
  const brickEls: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const initTier = tierGrid[r]?.[c] ?? 0;
      const rect = brickRect(config, r, c);

      if (initTier === 0) {
        // empty cell, static background
        brickEls.push(
          `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="2" fill="${palette.emptyCell}" />`
        );
        continue;
      }

      const idx = r * cols + c;
      const fillVals: string[] = [];
      const opacVals: string[] = [];
      
      // Randomly appear during the 2-second intro (first 60 frames)
      const introFrames = Math.round(2000 / config.frameMs);
      const appearFrame = Math.floor(Math.random() * introFrames);

      for (let f = 0; f < n; f++) {
        const hp = frames[f].brickHp[idx];
        if (f < appearFrame || hp <= 0) {
          // Instead of changing opacity to 0, it changes to empty cell color
          fillVals.push(palette.emptyCell);
          opacVals.push("1");
        } else {
          fillVals.push(brickColor(palette, hp));
          opacVals.push("1");
        }
      }

      const initHp  = frames[0].brickHp[idx];
      const initFill = brickColor(palette, initHp);
      const glow    = initHp >= 2 ? ` filter="url(#brickGlow)"` : "";

      // Append the initial values again at the end so the loop restarts cleanly
      const loopFill = [...fillVals, fillVals[0]].join(";");
      const loopOpac = [...opacVals, opacVals[0]].join(";");
      const loopKeys = [...keyTimes.split(";"), "1"].join(";");

      brickEls.push(
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="2" fill="${initFill}"${glow}>` +
        `<animate attributeName="fill" values="${loopFill}" keyTimes="${loopKeys}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="${loopOpac}" keyTimes="${loopKeys}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>` +
        `</rect>`
      );
    }
  }

  // ------------------------------------------------------------------ Ball
  // Build looping value lists — append first value so the loop jump is seamless
  const cxVals        = frames.map((f) => f.ballX.toFixed(1));
  const cyVals        = frames.map((f) => f.ballY.toFixed(1));
  const rVals         = frames.map((f) => f.ballRadius.toFixed(2));
  const ballColorVals = frames.map((f) => palette.ballLevelColors[f.ballLevel]);

  const loopKT    = [...keyTimes.split(";"), "1"].join(";");
  const loopCx    = [...cxVals,        cxVals[0]].join(";");
  const loopCy    = [...cyVals,        cyVals[0]].join(";");
  const loopR     = [...rVals,         rVals[0]].join(";");
  const loopColor = [...ballColorVals, ballColorVals[0]].join(";");

  const initCx    = cxVals[0];
  const initCy    = cyVals[0];
  const initR     = rVals[0];
  const initColor = ballColorVals[0];

  const ball = `
  <!-- ball (single, glowing, loops indefinitely) -->
  <circle cx="${initCx}" cy="${initCy}" r="${initR}" fill="${initColor}" filter="url(#ballGlow)">
    <animate attributeName="cx" values="${loopCx}" keyTimes="${loopKT}" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${loopCy}" keyTimes="${loopKT}" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>
    <animate attributeName="r"  values="${loopR}"  keyTimes="${loopKT}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>
    <animate attributeName="fill" values="${loopColor}" keyTimes="${loopKT}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>
  </circle>`;

  // ------------------------------------------------------------------ Paddle
  const paddleY =
    config.pad +
    rows * config.cellSize +
    (rows - 1) * config.gap +
    config.paddleYOffset;

  const paddleXVals   = frames.map((f) => f.paddleX.toFixed(1));
  const initPaddleX   = paddleXVals[0];
  const stripeY       = (paddleY + config.paddleHeight / 2 - 1).toFixed(1);
  const loopPaddleX   = [...paddleXVals, paddleXVals[0]].join(";");

  const paddle = `
  <rect x="${initPaddleX}" y="${paddleY}" width="${config.paddleWidth}" height="${config.paddleHeight}" rx="3" fill="${palette.paddle}">
    <animate attributeName="x" values="${loopPaddleX}" keyTimes="${loopKT}" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>
  </rect>
  <rect x="${initPaddleX}" y="${stripeY}" width="${config.paddleWidth}" height="2" fill="${palette.paddleAccent}" opacity="0.8">
    <animate attributeName="x" values="${loopPaddleX}" keyTimes="${loopKT}" dur="${dur}" calcMode="linear" repeatCount="indefinite"/>
  </rect>`;

  return `<svg viewBox="0 0 ${boardWidth} ${boardHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="brickGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="ballGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="${boardWidth}" height="${boardHeight}" fill="${palette.background}"/>
  ${brickEls.join("\n  ")}
  ${paddle}
  ${ball}
</svg>`;
}
