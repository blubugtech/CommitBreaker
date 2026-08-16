import sharp from "sharp";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc as any;
import type { BreakoutConfig, BreakoutFrame } from "./simulate-breakout.js";
import type { Palette } from "./render-breakout-svg.js";

function brickTierColor(p: Palette, hp: number): string {
  if (hp >= 2) return p.brickState3;
  if (hp === 1) return p.brickState2;
  return p.emptyCell; // For hp <= 0
}

function brickRect(config: BreakoutConfig, row: number, col: number) {
  const x = config.pad + col * (config.cellSize + config.gap);
  const y = config.pad + row * (config.cellSize + config.gap);
  return { x, y, w: config.cellSize, h: config.cellSize };
}

function frameSVG(
  frame: BreakoutFrame,
  tierGrid: number[][],
  config: BreakoutConfig,
  palette: Palette,
  width: number,
  height: number,
  appearFrames: Int16Array,
  frameIndex: number
): string {
  const { rows, cols } = config;
  const brickEls: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const initialTier = tierGrid[r]?.[c] ?? 0;
      const rect = brickRect(config, r, c);
      
      if (initialTier === 0) {
        // empty cell, static background
        brickEls.push(
          `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="2" fill="${palette.emptyCell}" />`
        );
        continue;
      }

      const idx = r * cols + c;
      const hp = frame.brickHp[idx];
      const isVisible = frameIndex >= appearFrames[idx];
      const fill = (!isVisible || hp <= 0) ? palette.emptyCell : brickTierColor(palette, hp);
      const glow = (isVisible && hp >= 2) ? ` filter="url(#brickGlow)"` : "";

      brickEls.push(
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="2" fill="${fill}"${glow} />`
      );
    }
  }

  // Ball — single clean circle
  const ballColor = palette.ballLevelColors[frame.ballLevel];
  const r = frame.ballRadius;
  const ball = `
    <circle cx="${frame.ballX.toFixed(1)}" cy="${frame.ballY.toFixed(1)}" r="${r.toFixed(2)}" fill="${ballColor}" filter="url(#ballGlow)"/>`;

  // Paddle
  const paddleY =
    config.pad +
    rows * config.cellSize +
    (rows - 1) * config.gap +
    config.paddleYOffset;
  const paddle = `
    <g>
      <rect x="${frame.paddleX.toFixed(1)}" y="${paddleY}" width="${config.paddleWidth}" height="${config.paddleHeight}" rx="3" fill="${palette.paddle}" />
      <rect x="${frame.paddleX.toFixed(1)}" y="${paddleY + config.paddleHeight / 2 - 1}" width="${config.paddleWidth}" height="2" fill="${palette.paddleAccent}" />
    </g>`;

  // HUD — arcade-style score bar at the bottom
  const hudHeight = 18;
  const levelLabels = ["LVL 1", "LVL 2 ●", "HIGH SPEED ●●"];
  const levelColors = palette.ballLevelColors;
  const lvlLabel = levelLabels[frame.ballLevel] ?? "LVL 1";
  const lvlColor = levelColors[frame.ballLevel] ?? palette.ballAccent;
  const isLight = palette.background === "#ffffff";
  const hudBg = isLight ? "#ebedf0" : "#161b22";
  const hudText = isLight ? "#24292f" : "#c9d1d9";

  const hud = `
    <rect x="0" y="${height - hudHeight}" width="${width}" height="${hudHeight}" fill="${hudBg}"/>
    <text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-family="'Courier New', Courier, monospace"
          font-size="9" font-weight="bold" fill="${lvlColor}" letter-spacing="1">${lvlLabel}</text>
    <text x="6" y="${height - 5}" font-family="'Courier New', Courier, monospace"
          font-size="9" font-weight="bold" fill="${hudText}" letter-spacing="1">SCORE: ${String(frame.score).padStart(4, "0")}</text>
    <text x="${width - 6}" y="${height - 5}" text-anchor="end" font-family="'Courier New', Courier, monospace"
          font-size="9" font-weight="bold" fill="${hudText}" letter-spacing="1">BRICKS: ${frame.bricksRemaining}</text>
    <text x="${width / 2}" y="12" text-anchor="middle" font-family="'Courier New', Courier, monospace"
          font-size="11" font-weight="bold" fill="${palette.ballAccent}" letter-spacing="1">CommitBreaker</text>`;

  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="brickGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="ballGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${palette.background}" />
  ${brickEls.join("\n  ")}
  ${paddle}
  ${ball}
  ${hud}
</svg>`;
}

export async function renderBreakoutGIF(
  frames: BreakoutFrame[],
  tierGrid: number[][],
  config: BreakoutConfig,
  palette: Palette,
  outPath: string,
  scale = 2
): Promise<void> {
  const { rows, cols } = config;
  const width =
    config.pad * 2 + cols * config.cellSize + (cols - 1) * config.gap;
  const height =
    config.pad +
    rows * config.cellSize +
    (rows - 1) * config.gap +
    config.paddleYOffset +
    config.paddleHeight +
    config.pad +
    20; // HUD score bar

  const outW = width * scale;
  const outH = height * scale;

  const gif = GIFEncoder();

  const introFramesCount = Math.round(2000 / config.frameMs);
  const appearFrames = new Int16Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    appearFrames[i] = Math.floor(Math.random() * introFramesCount);
  }

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const svg = frameSVG(f, tierGrid, config, palette, width, height, appearFrames, i);
    const { data, info } = await sharp(Buffer.from(svg))
      .resize(outW, outH)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const palette256 = quantize(rgba, 256);
    const index = applyPalette(rgba, palette256);

    gif.writeFrame(index, info.width, info.height, {
      palette: palette256,
      delay: config.frameMs,
      dispose: -1,
    });
  }

  gif.finish();
  const bytes = gif.bytesView();

  const fs = await import("node:fs/promises");
  await fs.writeFile(outPath, Buffer.from(bytes));
}
