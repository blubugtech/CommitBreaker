import * as core from "@actions/core";
import { fetchContributionGrid } from "./fetch.js";
import { simulateBreakout, contributionsToTierGrid } from "./simulate-breakout.js";
import { renderBreakoutSVG } from "./render-breakout-svg.js";
import { renderBreakoutGIF } from "./render-breakout-gif.js";
import { BREAKOUT_CONFIG, DARK_PALETTE, LIGHT_PALETTE, GRID_ROWS, GRID_COLS } from "./constants.js";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const userName = core.getInput("github_user_name") || process.env.GITHUB_USER_NAME || process.argv[2];
  const token = core.getInput("github_token") || process.env.GITHUB_TOKEN;
  let outDir = core.getInput("out_dir") || process.env.OUT_DIR || "dist";

  if (process.env.GITHUB_WORKSPACE && !path.isAbsolute(outDir)) {
    outDir = path.resolve(process.env.GITHUB_WORKSPACE, outDir);
  }

  if (!userName) {
    throw new Error("Provide github_user_name input or GITHUB_USER_NAME env var.");
  }
  if (!token) {
    throw new Error("Provide github_token input or GITHUB_TOKEN env var.");
  }

  console.log(`Fetching contribution graph for ${userName}...`);
  const grid = await fetchContributionGrid(userName, token);

  // Convert contribution days into a simple 2D array of counts for simulateBreakout
  // Ensure we get exactly GRID_ROWS x GRID_COLS
  const counts: number[][] = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));
  
  // Start filling from the end (most recent weeks) to align with GRID_COLS
  const startWeek = Math.max(0, grid.weeks.length - GRID_COLS);
  for (let c = 0; c < Math.min(GRID_COLS, grid.weeks.length); c++) {
    const week = grid.weeks[startWeek + c];
    for (let r = 0; r < Math.min(GRID_ROWS, week.length); r++) {
      counts[r][c] = week[r].count;
    }
  }

  const tierGrid = contributionsToTierGrid(counts);

  console.log("Running Breakout simulation...");
  const frames = simulateBreakout(tierGrid, BREAKOUT_CONFIG);

  await fs.mkdir(outDir, { recursive: true });

  console.log("Rendering Breakout SVG (dark)...");
  const svgDark = renderBreakoutSVG(frames, tierGrid, BREAKOUT_CONFIG, DARK_PALETTE);
  await fs.writeFile(path.join(outDir, "breakout-dark.svg"), svgDark);

  console.log("Rendering Breakout SVG (light)...");
  const svgLight = renderBreakoutSVG(frames, tierGrid, BREAKOUT_CONFIG, LIGHT_PALETTE);
  await fs.writeFile(path.join(outDir, "breakout-light.svg"), svgLight);

  console.log("Writing Breakout GIF (dark)...");
  await renderBreakoutGIF(frames, tierGrid, BREAKOUT_CONFIG, DARK_PALETTE, path.join(outDir, "breakout-dark.gif"));

  console.log("Writing Breakout GIF (light)...");
  await renderBreakoutGIF(frames, tierGrid, BREAKOUT_CONFIG, LIGHT_PALETTE, path.join(outDir, "breakout-light.gif"));

  console.log(`Done. Output written to ${outDir}/`);
}

main().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
