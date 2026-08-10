# singularity-grid — Breakout mode (scaffold)

A standalone, runnable scaffold for the Breakout/Arkanoid mode described in
chat — built so you can test the simulation and rendering on synthetic data
*before* wiring it into the real `singularity-grid` repo.

## What's here

- `src/simulate-breakout.ts` — physics stepper (ball/paddle/bricks), plus
  `contributionsToTierGrid()` which buckets raw contribution counts into
  1/2/3-hit brick tiers (0 contributions = no brick).
- `src/render-breakout-svg.ts` — SVG renderer. Same native-`<animate>`
  approach as the CA mode: no rasterization, no per-frame duplication.
  Bricks fade out (opacity) on the frame they break. Ball is an angular
  "AI drone" polygon that rotates to face its direction of travel, with a
  phase-delayed low-opacity trail copy for a thruster streak. Paddle is a
  bar with a thin accent stripe.
- `src/constants.ts` — grid size, timing, both palettes, and the breakout
  physics config (ball speed, paddle speed, etc.) in one place to tune.
- `src/test-local.ts` — generates a synthetic contribution grid (weekday
  bias, a vacation gap, an intense streak) and renders both palettes to
  `dist/` without needing a GitHub token.

## Try it

```
npm install
npm run test-local
```

Outputs `dist/breakout-dark.svg` and `dist/breakout-light.svg` — open
either directly in a browser to watch the animation play. The console also
prints the frame the wall got cleared on, so you can tune `ballSpeed` in
`constants.ts` until clearance lands around 13-14s of the 15s total.

## Merging into the real repo

This scaffold duplicates `constants.ts` on purpose so it's self-contained.
To merge into `singularity-grid`:

1. Copy `src/simulate-breakout.ts` and `src/render-breakout-svg.ts` into the
   real `src/`.
2. In the real `src/constants.ts`, add the `BALL_*`/`PADDLE_*`-style fields
   from this scaffold's constants file (don't duplicate `CELL`/`GAP`/`PAD`/
   `ANIM_FRAME_COUNT`/palettes — reuse the ones already there).
3. Add a `mode: "cellular-automaton" | "breakout"` switch wherever the real
   entrypoint currently calls `simulate()` / the render functions, and in
   `action.yml`'s inputs.
4. Write a `render-breakout-gif.ts` mirroring `render-gif.ts` (rasterize
   each frame via `sharp`, encode via `gifenc`) if you want GIF output too
   — the SVG renderer here doesn't cover that path.
5. If `simulate.ts` already has an intensity-bucketing helper for the CA
   mode's seed density, swap it in for `contributionsToTierGrid()` so tier
   boundaries stay consistent across both modes.

## Tuning

- `ballSpeed` in `constants.ts` is the main knob for how long clearance
  takes — raise it if the wall isn't clearing within 15s, lower it if it
  clears too fast for a satisfying rally.
- `paddleMaxSpeed` / `paddleWidth` control how "skilled" the AI paddle
  looks — a slower max speed with a slightly wider paddle reads as more
  dramatic near-miss saves.
