/**
 * simulate-breakout.ts
 *
 * Physics-based breakout simulator. Drives the ball, paddle, and brick HP
 * each frame. Features:
 *   - 3-level bricks (HP 1-3): each hit reduces HP and visually lightens the
 *     brick color until it disappears.
 *   - Score system: hitting a brick awards points equal to the brick's
 *     *original* tier (1, 2, or 3). Scoring milestones level up the ball.
 *   - 3+1 ball levels: normal (< 250 pts), powered (≥ 250), strong (≥ 500),
 *     ULTRA / piercing (≥ 1000). Higher levels = faster, larger, piercing at
 *     max level.
 *   - Predictive paddle AI: anticipates where the ball will land and moves
 *     the paddle there instead of just chasing the current ball X. The paddle
 *     can always keep up so the game never stalls.
 */

export interface BreakoutConfig {
  cols: number;        // ~53 weeks
  rows: number;        // 7 days
  cellSize: number;    // px, from CELL
  gap: number;         // px, from GAP
  pad: number;         // px, from PAD
  frameCount: number;  // from ANIM_FRAME_COUNT
  frameMs: number;     // from ANIM_FRAME_MS
  ballRadius: number;  // px (base — grows with level)
  ballSpeed: number;   // px per frame (base — multiplied by level)
  paddleWidth: number; // px
  paddleHeight: number;// px
  paddleMaxSpeed: number; // px per frame (not used in predictive AI but kept for compat)
  paddleYOffset: number;  // px below brick grid
}

/** Ball level thresholds (cumulative score) and their properties. */
export const BALL_LEVELS = [
  { minScore: 0,   speedMult: 1.0,  radiusMult: 1.0,  piercing: false }, // Level 1 – normal
  { minScore: 50,  speedMult: 1.0,  radiusMult: 1.0,  piercing: true }, // Level 2 – penetration
  { minScore: 200, speedMult: 2.4,  radiusMult: 1.0,  piercing: true }, // Level 3 – high speed
] as const;

export type BallLevelIndex = 0 | 1 | 2;

export interface BreakoutFrame {
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  ballRadius: number;  // current (level-scaled) radius
  ballLevel: BallLevelIndex; // 0-3
  paddleX: number;
  /** Row-major, length cols*rows. 0 = no brick / already broken. */
  brickHp: Int8Array;
  /** Original tier of each brick (immutable — used for scoring & colour). */
  brickInitialTier: Int8Array;
  bricksRemaining: number;
  score: number;
}

/**
 * Buckets raw contribution counts into brick tiers (HP):
 *   0 contributions → 0 (empty cell, no brick)
 *   low activity    → 1 (one-hit, lightest green)
 *   medium activity → 2 (two-hit, medium green)
 *   heavy activity  → 3 (three-hit, dark/glowing green)
 */
export function contributionsToTierGrid(counts: number[][]): number[][] {
  return counts.map((row) =>
    row.map((c) => {
      if (c <= 0) return 0; // State 1: Empty
      if (c <= 25) return 1; // State 2: Low
      return 2; // State 3: High
    })
  );
}

function brickRect(config: BreakoutConfig, row: number, col: number) {
  const x = config.pad + col * (config.cellSize + config.gap);
  const y = config.pad + row * (config.cellSize + config.gap);
  return { x, y, w: config.cellSize, h: config.cellSize };
}

/** Resolve the current ball level index from cumulative score. */
function getBallLevel(score: number): BallLevelIndex {
  if (score >= BALL_LEVELS[2].minScore) return 2;
  if (score >= BALL_LEVELS[1].minScore) return 1;
  return 0;
}

/**
 * Ensures the ball always has a minimum horizontal velocity component
 * so it can never get trapped bouncing perfectly vertically.
 */
function enforceMinHorizontal(vx: number, vy: number, speed: number): [number, number] {
  const minVx = speed * 0.05; // at least 5% of speed must be horizontal
  if (Math.abs(vx) < minVx) {
    vx = vx >= 0 ? minVx : -minVx;
    // Re-normalise to maintain speed
    vy = (vy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - vx * vx));
  }
  return [vx, vy];
}

/**
 * Predict the X position where the ball will next reach the paddle's Y.
 * Bounces off side walls analytically so the AI can position perfectly.
 */
function predictLandingX(
  bx: number, by: number, vx: number, vy: number,
  targetY: number, boardWidth: number, maxBounces = 8
): number {
  if (vy <= 0) return bx; // moving up, no prediction needed
  let x = bx;
  let y = by;
  let dx = vx;
  let dy = vy;

  for (let bounce = 0; bounce < maxBounces; bounce++) {
    // Steps to reach targetY
    const stepsY = (targetY - y) / dy;
    const rawX = x + dx * stepsY;

    // Wrap across side walls
    const wall = boardWidth;
    let wrapped = rawX;
    if (wrapped < 0 || wrapped > wall) {
      // Reflect modulo
      const mod = wall * 2;
      wrapped = ((rawX % mod) + mod) % mod;
      if (wrapped > wall) wrapped = mod - wrapped;
    }
    return wrapped;
  }
  return bx;

}

/**
 * Pick a random active brick to aim for. By doing this instead of a centroid,
 * the ball won't get stuck aiming at an empty middle space when bricks are only on the sides.
 */
function getRandomActiveBrickX(
  brickHp: Int8Array,
  rows: number,
  cols: number,
  config: BreakoutConfig
): number {
  const activeCols: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (brickHp[r * cols + c] > 0) {
        activeCols.push(c);
      }
    }
  }
  if (activeCols.length === 0) {
    // Fallback: board centre
    return config.pad + cols * (config.cellSize + config.gap) / 2;
  }
  const randomCol = activeCols[Math.floor(Math.random() * activeCols.length)];
  const rect = brickRect(config, 0, randomCol);
  return rect.x + rect.w / 2;
}

export function simulateBreakout(
  tierGrid: number[][],
  config: BreakoutConfig
): BreakoutFrame[] {
  const { rows, cols } = config;
  const brickHp = new Int8Array(rows * cols);
  const brickInitialTier = new Int8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tier = tierGrid[r]?.[c] ?? 0;
      brickHp[r * cols + c] = tier;
      brickInitialTier[r * cols + c] = tier;
    }
  }
  let bricksRemaining = brickHp.reduce((n, hp) => n + (hp > 0 ? 1 : 0), 0);

  const boardWidth  = config.pad * 2 + cols * config.cellSize + (cols - 1) * config.gap;
  const brickBottom = config.pad + rows * config.cellSize + (rows - 1) * config.gap;
  const paddleY     = brickBottom + config.paddleYOffset;
  const floorY      = paddleY + config.paddleHeight + 40;

  let ballX = boardWidth / 2;
  let ballY = paddleY - config.ballRadius - 1.5;
  // Wider spread (±50° from vertical) ensures ball always has horizontal movement
  let angle = -Math.PI / 2 + ((Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.55));
  let vx = Math.cos(angle) * config.ballSpeed;
  let vy = Math.sin(angle) * config.ballSpeed;

  let paddleX = boardWidth / 2 - config.paddleWidth / 2;
  // Random offset applied to paddle target each hit so ball never repeats the same path
  let paddleJitter = 0;

  let score = 0;
  let ballLevel: BallLevelIndex = 0;

  const frames: BreakoutFrame[] = [];

  // --- Intro Hold (2 seconds) ---
  const introFramesCount = Math.round(2000 / config.frameMs);
  for (let i = 0; i < introFramesCount; i++) {
    frames.push({
      ballX,
      ballY,
      ballVX: 0,
      ballVY: 0,
      ballRadius: config.ballRadius,
      ballLevel: 0,
      paddleX,
      brickHp: brickHp.slice(),
      brickInitialTier: brickInitialTier.slice(),
      bricksRemaining,
      score: 0,
    });
  }

  // Sub-step so fast balls can't tunnel through thin bricks in one frame.
  const maxStep = Math.max(2, Math.floor(config.cellSize / 3));

  // Safety cap: never run longer than 60 seconds regardless of bricks left.
  const safetyCap = Math.round(60_000 / config.frameMs);

  // Run until every brick is destroyed (or safety cap hit).
  for (let f = 0; bricksRemaining > 0 && f < safetyCap; f++) {
      // --- Recompute ball level and apply physics multiplier ---
      ballLevel = getBallLevel(score);
      const lvl = BALL_LEVELS[ballLevel];
      const currentRadius = config.ballRadius * lvl.radiusMult;

      let currentSpeedMult = lvl.speedMult;
      if (ballLevel === 2) {
        // high speed: increase speed on each 75 points above 200 points
        const extraLevels = Math.floor((score - 200) / 75);
        if (extraLevels > 0) {
           currentSpeedMult += extraLevels * 0.2; // 20% increase per 75 pts
        }
      }

      // Normalise current velocity then scale to level speed.
      const currentSpeed = Math.hypot(vx, vy);
      const targetSpeed = config.ballSpeed * currentSpeedMult;
      if (currentSpeed > 0) {
        const ratio = targetSpeed / currentSpeed;
        vx *= ratio;
        vy *= ratio;
      }

      const dist = Math.hypot(vx, vy);
      const steps = Math.max(1, Math.ceil(dist / maxStep));
      let stepVX = vx / steps;
      let stepVY = vy / steps;

      // --- Predictive Paddle AI (with deliberate jitter so ball never loops) ---
      const landingX = predictLandingX(ballX, ballY, vx, vy, paddleY, boardWidth);
      // Aim so the ball lands at a jittered offset from paddle centre.
      const targetPaddleX = landingX - config.paddleWidth / 2 + paddleJitter;
      const clampedTarget = Math.max(0, Math.min(boardWidth - config.paddleWidth, targetPaddleX));
      const delta = clampedTarget - paddleX;
      // Move fast enough to always intercept the ball.
      const maxMove = Math.max(config.paddleMaxSpeed * 2.5, Math.abs(delta) * 0.3);
      paddleX += Math.max(-maxMove, Math.min(maxMove, delta));
      paddleX = Math.max(0, Math.min(boardWidth - config.paddleWidth, paddleX));

      for (let s = 0; s < steps; s++) {
        ballX += stepVX;
        ballY += stepVY;

        // Side walls
        if (ballX - currentRadius < 0) {
          ballX = currentRadius;
          vx = Math.abs(vx);
          [vx, vy] = enforceMinHorizontal(vx, vy, targetSpeed);
          stepVX = vx / steps; stepVY = vy / steps;
        } else if (ballX + currentRadius > boardWidth) {
          ballX = boardWidth - currentRadius;
          vx = -Math.abs(vx);
          [vx, vy] = enforceMinHorizontal(vx, vy, targetSpeed);
          stepVX = vx / steps; stepVY = vy / steps;
        }
        // Ceiling
        if (ballY - currentRadius < 0) {
          ballY = currentRadius;
          vy = Math.abs(vy);
          stepVY = vy / steps;
        }

        // Paddle collision
        const visualRadius = currentRadius + 1.5; // Account for glow filter so it bounces strictly on top
        if (
          ballY + visualRadius >= paddleY &&
          ballY + visualRadius <= paddleY + config.paddleHeight * 2 &&
          vy > 0
        ) {
          // Unfailing platform logic: ensure paddle is catching the ball
          if (ballX < paddleX || ballX > paddleX + config.paddleWidth) {
            // Ball is about to fall, snap paddle to it
            paddleX = Math.max(0, Math.min(boardWidth - config.paddleWidth, ballX - config.paddleWidth / 2));
          }

          ballY = paddleY - visualRadius;
          const speed = Math.hypot(vx, vy);

          // --- Target a random remaining brick ---
          const targetX = getRandomActiveBrickX(brickHp, rows, cols, config);
          const targetOffset = targetX - ballX;
          const boardHalf = boardWidth / 2;
          const brickBias = Math.max(-1, Math.min(1, targetOffset / boardHalf));
          
          const noise = (Math.random() - 0.5) * 0.1;
          const rawHit = brickBias + noise;
          
          const clampedHit = Math.sign(rawHit || 1) * Math.min(0.85, Math.abs(rawHit));
          const newAngle = -Math.PI / 2 + clampedHit * (Math.PI / 2.2);
          
          vx = Math.cos(newAngle) * speed;
          vy = Math.sin(newAngle) * speed;
          [vx, vy] = enforceMinHorizontal(vx, vy, speed);
          stepVX = vx / steps; stepVY = vy / steps;

          // Pre-position jitter for next hit so it doesn't look completely robotic
          paddleJitter = (Math.random() - 0.5) * config.paddleWidth * 0.4;
        }

        // Missed paddle: this shouldn't happen with the unfailing logic above,
        // but kept as a fallback safety catch.
        if (ballY - currentRadius > floorY) {
          ballY = paddleY - currentRadius;
          vy = -Math.abs(vy);
          continue;
        }

        // --- Brick collisions ---
        const approxRow = Math.floor((ballY - config.pad) / (config.cellSize + config.gap));
        const approxCol = Math.floor((ballX - config.pad) / (config.cellSize + config.gap));

        let hitThisStep = false;
        for (let r = approxRow - 1; r <= approxRow + 1 && !hitThisStep; r++) {
          if (r < 0 || r >= rows) continue;
          for (let c = approxCol - 1; c <= approxCol + 1 && !hitThisStep; c++) {
            if (c < 0 || c >= cols) continue;
            const idx = r * cols + c;
            if (brickHp[idx] <= 0) continue;
            const rect = brickRect(config, r, c);
            const closestX = Math.max(rect.x, Math.min(ballX, rect.x + rect.w));
            const closestY = Math.max(rect.y, Math.min(ballY, rect.y + rect.h));
            const dx = ballX - closestX;
            const dy = ballY - closestY;
            if (dx * dx + dy * dy <= currentRadius * currentRadius) {
              // Award points based on the brick's ORIGINAL tier
              const originalTier = brickInitialTier[idx];
              score += originalTier; // 1, 2, or 3 points

              // Piercing: at max ball level, ball doesn't bounce off bricks
              if (!lvl.piercing) {
                const overlapX = currentRadius - Math.abs(dx);
                const overlapY = currentRadius - Math.abs(dy);
                if (overlapX < overlapY) {
                  vx = -vx;
                } else {
                  vy = -vy;
                }
                stepVX = vx / steps; stepVY = vy / steps;
                hitThisStep = true;
              }

              brickHp[idx] -= 1;
              if (brickHp[idx] <= 0) {
                bricksRemaining -= 1;
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
      ballRadius: config.ballRadius * BALL_LEVELS[getBallLevel(score)].radiusMult,
      ballLevel: getBallLevel(score),
      paddleX,
      brickHp: brickHp.slice(),
      brickInitialTier: brickInitialTier.slice(),
      bricksRemaining,
      score,
    });
  }

  // --- All bricks cleared (or safety cap hit) ---
  // Append 3 seconds of hold frames where ball keeps bouncing on the empty board.
  const lvlFinal = BALL_LEVELS[getBallLevel(score)];
  const holdFrames = Math.round(3000 / config.frameMs);
  for (let h = 0; h < holdFrames; h++) {
    ballX += vx; ballY += vy;
    if (ballX - config.ballRadius * lvlFinal.radiusMult < 0)           { ballX = config.ballRadius * lvlFinal.radiusMult; vx = Math.abs(vx); }
    if (ballX + config.ballRadius * lvlFinal.radiusMult > boardWidth)   { ballX = boardWidth - config.ballRadius * lvlFinal.radiusMult; vx = -Math.abs(vx); }
    if (ballY - config.ballRadius * lvlFinal.radiusMult < 0)            { ballY = config.ballRadius * lvlFinal.radiusMult; vy = Math.abs(vy); }
    if (ballY + config.ballRadius * lvlFinal.radiusMult >= paddleY && vy > 0) { ballY = paddleY - config.ballRadius * lvlFinal.radiusMult; vy = -Math.abs(vy); }
    if (ballY - config.ballRadius * lvlFinal.radiusMult > floorY)       { ballY = brickBottom + config.paddleYOffset * 0.5; vy = -Math.abs(vy); }
    paddleX += Math.max(-config.paddleMaxSpeed * 2, Math.min(config.paddleMaxSpeed * 2, ballX - config.paddleWidth / 2 - paddleX));
    paddleX = Math.max(0, Math.min(boardWidth - config.paddleWidth, paddleX));
    frames.push({
      ballX, ballY, ballVX: vx, ballVY: vy,
      ballRadius: config.ballRadius * lvlFinal.radiusMult,
      ballLevel: getBallLevel(score),
      paddleX,
      brickHp: brickHp.slice(),
      brickInitialTier: brickInitialTier.slice(),
      bricksRemaining: 0,
      score,
    });
  }

  return frames;
}
