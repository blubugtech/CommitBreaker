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

function generateSyntheticContributions(): number[][] {
  const grid: number[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(0)
  );

  const vacationStartWeek = 20;
  const vacationLenWeeks = 2;
  const streakStartWeek = 35;
  const streakLenWeeks = 3;

  for (let col = 0; col < GRID_COLS; col++) {
    const onVacation =
      col >= vacationStartWeek && col < vacationStartWeek + vacationLenWeeks;
    const onStreak = col >= streakStartWeek && col < streakStartWeek + streakLenWeeks;

    for (let row = 0; row < GRID_ROWS; row++) {
      if (onVacation) {
        grid[row][col] = 0;
        continue;
      }
      // row 0/6 = weekend, lighter activity; weekdays busier.
      const isWeekend = row === 0 || row === 6;
      const base = isWeekend ? 0.25 : 0.7;
      const chance = onStreak ? 0.95 : base;

      if (Math.random() < chance) {
        const max = onStreak ? 14 : isWeekend ? 4 : 9;
        grid[row][col] = 1 + Math.floor(Math.random() * max);
      } else {
        grid[row][col] = 0;
      }
    }
  }

  return grid;
}

function build() {
  mkdirSync("dist", { recursive: true });

  const contributions = generateSyntheticContributions();
  const tierGrid = contributionsToTierGrid(contributions);
  const frames = simulateBreakout(tierGrid, BREAKOUT_CONFIG);

  const darkSVG = renderBreakoutSVG(frames, tierGrid, BREAKOUT_CONFIG, DARK_PALETTE);
  const lightSVG = renderBreakoutSVG(frames, tierGrid, BREAKOUT_CONFIG, LIGHT_PALETTE);

  writeFileSync("dist/breakout-dark.svg", darkSVG);
  writeFileSync("dist/breakout-light.svg", lightSVG);

  const clearedAt = frames.findIndex((f) => f.bricksRemaining === 0);
  console.log(`Frames: ${frames.length}`);
  console.log(
    clearedAt === -1
      ? "Wall not fully cleared within frame budget — lower ballSpeed's effective difficulty or raise ballSpeed in constants.ts."
      : `Wall cleared at frame ${clearedAt} (~${((clearedAt * BREAKOUT_CONFIG.frameMs) / 1000).toFixed(
          1
        )}s)`
  );
  console.log("Wrote dist/breakout-dark.svg and dist/breakout-light.svg");
}

build();
