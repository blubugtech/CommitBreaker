/**
 * test-local.ts
 *
 * Generates a synthetic-but-realistic contribution grid (weekday bias, a
 * vacation gap, an intense streak — same idea as the CA mode's test-local.ts)
 * so you can iterate on the breakout simulation/renderer without hitting the
 * GitHub API. Run with: npx tsx src/test-local.ts
 *
 * Writes dist/breakout-dark.svg and dist/breakout-light.svg.
 */

import { writeFileSync, mkdirSync } from "fs";
import {
  GRID_ROWS,
  GRID_COLS,
  DARK_PALETTE,
  LIGHT_PALETTE,
  BREAKOUT_CONFIG,
} from "./constants";
import { contributionsToTierGrid, simulateBreakout } from "./simulate-breakout";
import { renderBreakoutSVG } from "./render-breakout-svg";
import { renderBreakoutGIF } from "./render-breakout-gif";

// Generate synthetic patterns
function generateSyntheticContributions(patternType: number): number[][] {
  const grid: number[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(0)
  );

  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      if (patternType === 0) {
        // Sparse: Tests endgame hunting logic extensively
        grid[row][col] = Math.random() < 0.08 ? (1 + Math.floor(Math.random() * 40)) : 0;
      } else if (patternType === 1) {
        // Checkerboard: Tests piercing and bouncing through tight gaps
        grid[row][col] = ((row + col) % 2 === 0) ? (1 + Math.floor(Math.random() * 40)) : 0;
      } else {
        // Dense: Tests high speed performance and large brick clusters
        grid[row][col] = Math.random() < 0.9 ? (1 + Math.floor(Math.random() * 40)) : 0;
      }
    }
  }

  return grid;
}

async function build() {
  const patterns = ['sparse', 'checkerboard', 'dense'];
  
  for (let p = 0; p < patterns.length; p++) {
    const patternName = patterns[p];
    console.log(`\n--- Generating pattern: ${patternName} ---`);
    const contributions = generateSyntheticContributions(p);
    const tierGrid = contributionsToTierGrid(contributions);
    const frames = simulateBreakout(tierGrid, BREAKOUT_CONFIG);

    const clearedAt = frames.findIndex((f) => f.bricksRemaining === 0);
    const totalSec   = (frames.length * BREAKOUT_CONFIG.frameMs / 1000).toFixed(1);
    console.log(`Frames: ${frames.length} → animation duration: ${totalSec}s`);
    console.log(
      clearedAt === -1
        ? `⚠ Safety cap hit — not all bricks cleared`
        : `✓ All bricks cleared at frame ${clearedAt} (~${((clearedAt * BREAKOUT_CONFIG.frameMs) / 1000).toFixed(1)}s)`
    );

    const outDir = `dist/${patternName}`;
    mkdirSync(outDir, { recursive: true });

    // Render Light
    const lightSVG = renderBreakoutSVG(frames, tierGrid, BREAKOUT_CONFIG, LIGHT_PALETTE);
    writeFileSync(`${outDir}/breakout-light.svg`, lightSVG);
    console.log(`Rendering ${patternName} light GIF...`);
    await renderBreakoutGIF(frames, tierGrid, BREAKOUT_CONFIG, LIGHT_PALETTE, `${outDir}/breakout-light.gif`);

    // Render Dark
    const darkSVG = renderBreakoutSVG(frames, tierGrid, BREAKOUT_CONFIG, DARK_PALETTE);
    writeFileSync(`${outDir}/breakout-dark.svg`, darkSVG);
    console.log(`Rendering ${patternName} dark GIF...`);
    await renderBreakoutGIF(frames, tierGrid, BREAKOUT_CONFIG, DARK_PALETTE, `${outDir}/breakout-dark.gif`);
  }
}

build().catch(console.error);
