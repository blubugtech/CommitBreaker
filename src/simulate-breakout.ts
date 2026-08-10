/**
 * simulate-breakout.ts
 *
 * Physics-based sibling to simulate.ts's cellular automaton. Instead of
 * stepping a tick-based birth/death rule, this steps continuous
 * position/velocity state for a ball each frame, resolving collisions
 * against a paddle and a wall of bricks derived from the contribution grid.
 *
 * Drop into src/. Wire up alongside simulate.ts behind a `mode` switch in
 * whatever entrypoint currently calls simulate() (index.ts / action code).
 *
 * Assumes it can import ANIM_FRAME_COUNT / ANIM_FRAME_MS / CELL / GAP / PAD
 * from ./constants — adjust the import names below if yours differ.
 */

// import { ANIM_FRAME_COUNT, ANIM_FRAME_MS, CELL, GAP, PAD } from "./constants";

export interface BreakoutConfig {
  cols: number; // ~53 weeks
  rows: number; // 7 days
  cellSize: number; // px, from CELL
  gap: number; // px, from GAP
  pad: number; // px, from PAD
  frameCount: number; // from ANIM_FRAME_COUNT
  frameMs: number; // from ANIM_FRAME_MS
  ballRadius: number; // px
  ballSpeed: number; // px per frame (tune so clearance lands ~13-14s)
  paddleWidth: number; // px
  paddleHeight: number; // px
  paddleMaxSpeed: number; // px per frame, caps AI tracking speed
  paddleYOffset: number; // px below the brick grid before the paddle sits
}

export interface BreakoutFrame {
  ballX: number;
  ballY: number;
  ballVX: number; // exposed so the renderer can orient the drone sprite
  ballVY: number;
  paddleX: number;
  /** Row-major, length cols*rows. 0 = no brick / already broken. */
  brickHp: Int8Array;
  bricksRemaining: number;
}

/**
 * Buckets raw contribution counts into brick tiers (HP):
 *   0 contributions -> 0 (no brick, gap in the wall)
 *   low activity     -> 1 (thin/dim, one hit)
 *   medium activity   -> 2 (cracks after first hit)
 *   heavy activity    -> 3 (armored, glowing)
 *
 * Thresholds are computed from the non-zero values in the grid so tiers
 * stay relative to the user's own activity distribution rather than
 * fixed magic numbers. Swap this out if simulate.ts already has an
 * equivalent bucketing helper for the CA mode's seed density — reuse
 * that instead of this one to keep tier boundaries consistent across modes.
 */
export function contributionsToTierGrid(counts: number[][]): number[][] {
  const nonZero = counts.flat().filter((c) => c > 0);
  if (nonZero.length === 0) return counts.map((row) => row.map(() => 0));

  const sorted = [...nonZero].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const lowMax = q(0.4);
  const medMax = q(0.75);

  return counts.map((row) =>
    row.map((c) => {
      if (c <= 0) return 0;
      if (c <= lowMax) return 1;
      if (c <= medMax) return 2;
      return 3;
    })
  );
}

function brickRect(config: BreakoutConfig, row: number, col: number) {
  const x = config.pad + col * (config.cellSize + config.gap);
  const y = config.pad + row * (config.cellSize + config.gap);
  return { x, y, w: config.cellSize, h: config.cellSize };
}

export function simulateBreakout(
  tierGrid: number[][],
  config: BreakoutConfig
): BreakoutFrame[] {
  const { rows, cols } = config;
  const brickHp = new Int8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      brickHp[r * cols + c] = tierGrid[r]?.[c] ?? 0;
    }
  }
  let bricksRemaining = brickHp.reduce((n, hp) => n + (hp > 0 ? 1 : 0), 0);

  const boardWidth = config.pad * 2 + cols * config.cellSize + (cols - 1) * config.gap;
  const brickBottom =
    config.pad + rows * config.cellSize + (rows - 1) * config.gap;
  const paddleY = brickBottom + config.paddleYOffset;
  const floorY = paddleY + config.paddleHeight + 40; // a little slack below the paddle before "miss"

  let ballX = boardWidth / 2;
  let ballY = brickBottom + config.paddleYOffset * 0.5;
  // Launch up and slightly to one side so the opening shot isn't perfectly vertical.
  let angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  let vx = Math.cos(angle) * config.ballSpeed;
  let vy = Math.sin(angle) * config.ballSpeed;

  let paddleX = boardWidth / 2 - config.paddleWidth / 2;

  const frames: BreakoutFrame[] = [];

  // Sub-step so a fast ball can't tunnel through a thin brick row in one frame.
  const maxStep = Math.max(2, Math.floor(config.cellSize / 3));

  for (let f = 0; f < config.frameCount; f++) {
    if (bricksRemaining > 0) {
      const dist = Math.hypot(vx, vy);
      const steps = Math.max(1, Math.ceil(dist / maxStep));
      const stepVX = vx / steps;
      const stepVY = vy / steps;

      // Paddle AI: track the ball's x with a clamped max speed, and only
      // start reacting once the ball is heading downward (adds a beat of
      // "reaction lag" instead of perfect tracking).
      const targetX = ballX - config.paddleWidth / 2;
      if (vy > 0) {
        const delta = targetX - paddleX;
        const move = Math.max(-config.paddleMaxSpeed, Math.min(config.paddleMaxSpeed, delta));
        paddleX += move;
      }
      paddleX = Math.max(0, Math.min(boardWidth - config.paddleWidth, paddleX));

      for (let s = 0; s < steps; s++) {
        ballX += stepVX;
        ballY += stepVY;

        // Side walls
        if (ballX - config.ballRadius < 0) {
          ballX = config.ballRadius;
          vx = Math.abs(vx);
        } else if (ballX + config.ballRadius > boardWidth) {
          ballX = boardWidth - config.ballRadius;
          vx = -Math.abs(vx);
        }
        // Ceiling
        if (ballY - config.ballRadius < 0) {
          ballY = config.ballRadius;
          vy = Math.abs(vy);
        }

        // Paddle collision
        if (
          ballY + config.ballRadius >= paddleY &&
          ballY + config.ballRadius <= paddleY + config.paddleHeight &&
          ballX >= paddleX &&
          ballX <= paddleX + config.paddleWidth &&
          vy > 0
        ) {
          ballY = paddleY - config.ballRadius;
          // Bounce angle varies with where the ball hit the paddle (classic
          // Breakout feel) instead of a flat mirror reflection.
          const hitPos = (ballX - paddleX) / config.paddleWidth - 0.5; // -0.5..0.5
          const speed = Math.hypot(vx, vy);
          const newAngle = -Math.PI / 2 + hitPos * (Math.PI / 2.2);
          vx = Math.cos(newAngle) * speed;
          vy = Math.sin(newAngle) * speed;
        }

        // Missed paddle entirely: relaunch from center rather than ending
        // the animation early on a stray miss (there's no player to lose to).
        if (ballY - config.ballRadius > floorY) {
          ballX = boardWidth / 2;
          ballY = brickBottom + config.paddleYOffset * 0.5;
          const relaunch = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          const speed = Math.hypot(vx, vy);
          vx = Math.cos(relaunch) * speed;
          vy = Math.sin(relaunch) * speed;
          continue;
        }

        // Brick collisions: only check near the ball's current row/col band.
        const approxRow = Math.floor((ballY - config.pad) / (config.cellSize + config.gap));
        const approxCol = Math.floor((ballX - config.pad) / (config.cellSize + config.gap));
        for (let r = approxRow - 1; r <= approxRow + 1; r++) {
          if (r < 0 || r >= rows) continue;
          for (let c = approxCol - 1; c <= approxCol + 1; c++) {
            if (c < 0 || c >= cols) continue;
            const idx = r * cols + c;
            if (brickHp[idx] <= 0) continue;
            const rect = brickRect(config, r, c);
            const closestX = Math.max(rect.x, Math.min(ballX, rect.x + rect.w));
            const closestY = Math.max(rect.y, Math.min(ballY, rect.y + rect.h));
            const dx = ballX - closestX;
            const dy = ballY - closestY;
            if (dx * dx + dy * dy <= config.ballRadius * config.ballRadius) {
              // Reflect off whichever axis had the smaller penetration.
              const overlapX = config.ballRadius - Math.abs(dx);
              const overlapY = config.ballRadius - Math.abs(dy);
              if (overlapX < overlapY) {
                vx = -vx;
              } else {
                vy = -vy;
              }
              brickHp[idx] -= 1;
              if (brickHp[idx] <= 0) {
                bricksRemaining -= 1;
              }
              // one brick hit per sub-step keeps corner cases simple
              break;
            }
          }
        }
      }
    }

    frames.push({
      ballX,
      ballY,
      ballVX: vx,
      ballVY: vy,
      paddleX,
      brickHp: brickHp.slice(),
      bricksRemaining,
    });

    if (bricksRemaining === 0) {
      // Hold the cleared-wall frame for the remainder of the animation.
      for (let hold = f + 1; hold < config.frameCount; hold++) {
        frames.push({ ballX, ballY, ballVX: 0, ballVY: 0, paddleX, brickHp: brickHp.slice(), bricksRemaining: 0 });
      }
      break;
    }
  }

  return frames;
}
