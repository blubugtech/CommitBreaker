/**
 * render-breakout-svg.ts
 *
 * Sibling to render-svg.ts for the CA mode. Same native-<animate> approach
 * (no rasterization): bricks get a single fade-out animation timed to the
 * frame they broke on, the ball follows an <animateMotion> path built from
 * per-frame positions, and the paddle animates its x attribute.
 *
 * Wire in behind the same mode switch as simulate-breakout.ts. Expects a
 * palette shaped like your existing DARK_PALETTE / LIGHT_PALETTE — adjust
 * the field names in `Palette` below to match your actual constants.ts.
 */

import type { BreakoutConfig, BreakoutFrame } from "./simulate-breakout";

export interface Palette {
  background: string;
  brickTier1: string; // dim / thin
  brickTier2: string; // medium, cracked look after 1st hit
  brickTier3: string; // armored / glowing
  ball: string;
  ballAccent: string;
  paddle: string;
  paddleAccent: string;
}

const TIER_COLOR = (p: Palette, tier: number) =>
  tier === 3 ? p.brickTier3 : tier === 2 ? p.brickTier2 : p.brickTier1;

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
  const totalMs = frames.length * config.frameMs;
  const boardWidth = config.pad * 2 + cols * config.cellSize + (cols - 1) * config.gap;
  const boardHeight =
    config.pad +
    rows * config.cellSize +
    (rows - 1) * config.gap +
    config.paddleYOffset +
    config.paddleHeight +
    config.pad;

  // --- Bricks: one <rect> per contribution day that had a brick, with a
  // single opacity fade timed to the frame it broke on (or none if it
  // survives to the end).
  const brickEls: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tier = tierGrid[r]?.[c] ?? 0;
      if (tier === 0) continue;
      const idx = r * cols + c;
      let breakFrame = -1;
      for (let f = 0; f < frames.length; f++) {
        if (frames[f].brickHp[idx] <= 0) {
          breakFrame = f;
          break;
        }
      }
      const rect = brickRect(config, r, c);
      const fill = TIER_COLOR(palette, tier);
      const glow = tier === 3 ? ` filter="url(#brickGlow)"` : "";

      if (breakFrame === -1) {
        brickEls.push(
          `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="2" fill="${fill}"${glow} />`
        );
      } else {
        const beginMs = breakFrame * config.frameMs;
        const beginS = (beginMs / 1000).toFixed(3);
        brickEls.push(
          `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="2" fill="${fill}"${glow}>` +
            `<animate attributeName="opacity" values="1;1;0" keyTimes="0;${(beginMs / totalMs).toFixed(
              5
            )};${Math.min(1, (beginMs + 250) / totalMs).toFixed(5)}" ` +
            `begin="0s" dur="${(totalMs / 1000).toFixed(3)}s" fill="freeze" />` +
            `</rect>`
        );
      }
    }
  }

  // --- Ball path: build a keyTimes/values path from every frame's position.
  // linear interpolation between frames reads as smooth motion at normal
  // frame rates (e.g. 24-30fps sim steps).
  const pathPoints = frames.map((f) => `${f.ballX.toFixed(1)},${f.ballY.toFixed(1)}`).join(" L ");
  const ballPath = `M ${pathPoints}`;
  const keyTimes = frames.map((_, i) => (i / (frames.length - 1)).toFixed(5)).join(";");

  // Drone heading: rotate to face the direction of travel each frame.
  const rotateValues = frames
    .map((f) => (Math.atan2(f.ballVY, f.ballVX) * (180 / Math.PI) + 90).toFixed(1))
    .join(";");

  const droneSize = config.ballRadius * 2.2;
  const drone = `
    <g id="drone">
      <!-- angular AI-drone silhouette: diamond body + two wing fins -->
      <polygon points="0,-${droneSize} ${droneSize * 0.55},${droneSize * 0.4} 0,${droneSize * 0.15} -${droneSize * 0.55},${droneSize * 0.4}"
        fill="${palette.ball}" stroke="${palette.ballAccent}" stroke-width="1" />
      <circle cx="0" cy="-${droneSize * 0.15}" r="${droneSize * 0.18}" fill="${palette.ballAccent}" />
    </g>`;

  // Thruster trail: a second, smaller copy of the same motion path,
  // phase-delayed so it visually lags a beat behind the drone, faded low
  // opacity, no rotation (just a soft streak).
  const trail = `
    <circle r="${config.ballRadius * 0.6}" fill="${palette.ballAccent}" opacity="0.35">
      <animateMotion path="${ballPath}" keyTimes="${keyTimes}" dur="${(totalMs / 1000).toFixed(
    3
  )}s" begin="-${(config.frameMs * 2) / 1000}s" fill="freeze" calcMode="linear" />
    </circle>`;

  // --- Paddle: robotic bar with an accent stripe, animates x only.
  const paddleXs = frames.map((f) => f.paddleX.toFixed(1)).join(";");
  const paddleY =
    config.pad + rows * config.cellSize + (rows - 1) * config.gap + config.paddleYOffset;
  const paddle = `
    <g>
      <rect y="${paddleY}" width="${config.paddleWidth}" height="${config.paddleHeight}" rx="3" fill="${palette.paddle}">
        <animate attributeName="x" values="${paddleXs}" keyTimes="${keyTimes}" dur="${(
    totalMs / 1000
  ).toFixed(3)}s" fill="freeze" calcMode="linear" />
      </rect>
      <rect y="${paddleY + config.paddleHeight / 2 - 1}" width="${config.paddleWidth}" height="2" fill="${palette.paddleAccent}">
        <animate attributeName="x" values="${paddleXs}" keyTimes="${keyTimes}" dur="${(
    totalMs / 1000
  ).toFixed(3)}s" fill="freeze" calcMode="linear" />
      </rect>
    </g>`;

  return `<svg viewBox="0 0 ${boardWidth} ${boardHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="brickGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="${boardWidth}" height="${boardHeight}" fill="${palette.background}" />
  ${brickEls.join("\n  ")}
  ${paddle}
  ${trail}
  <g>
    ${drone}
    <animateMotion path="${ballPath}" keyTimes="${keyTimes}" dur="${(totalMs / 1000).toFixed(
    3
  )}s" fill="freeze" calcMode="linear" rotate="auto" />
  </g>
</svg>`;
}
