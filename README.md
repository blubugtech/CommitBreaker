<div align="center">

# 🧱 CommitBreaker

**Turn your GitHub contribution graph into a retro Breakout arcade game.**

[![Build](https://img.shields.io/github/actions/workflow/status/blubugtech/commitbreaker/generate.yml?style=for-the-badge)](https://github.com/blubugtech/commitbreaker/actions)
![Release](https://img.shields.io/github/v/release/blubugtech/commitbreaker?style=for-the-badge)

*Inspired by [Platane/snk](https://github.com/Platane/snk) and classic Breakout arcade games*

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/blubugtech/CommitBreaker/output/breakout-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/blubugtech/CommitBreaker/output/breakout-light.svg" />
  <img alt="commit-breaker" src="https://raw.githubusercontent.com/blubugtech/CommitBreaker/output/breakout-light.svg" />
</picture>

</div>

---

**CommitBreaker** turns your GitHub contribution graph into a 15-second animated breakout game. 

Days you didn't code stay empty, while days you did commit become bricks in a breakout level! An AI paddle plays the game, clearing out your contributions. It renders in both dark and light palettes, as both SVG (crisp, native-animated, ideal for embedding) and GIF (universally viewable). 

It ships as a GitHub Action that can run on a schedule, pull your real contribution data via GitHub's API, and automatically regenerate the animation for your profile README.

## 🛠️ How it works

1. **`src/fetch.ts`** — Pulls your real contribution calendar via GitHub's GraphQL API (`contributionsCollection.contributionCalendar`), giving a 7-row x ~53-column grid of daily contribution counts.
2. **`src/simulate-breakout.ts`** — Translates the grid into a breakout game with physics for the ball, paddle, and bricks. Higher-activity days become tougher bricks!
3. **`src/render-breakout-svg.ts` / `src/render-breakout-gif.ts`** — Render the simulated frames as SVG (native per-cell `<animate>`, no rasterization) or GIF (rasterized via `sharp`, encoded via `gifenc`).

## 🚀 Usage

### Locally

```bash
npm install
GITHUB_USER_NAME=yourusername GITHUB_TOKEN=ghp_xxx npm run build
```

Outputs land in `dist/`:
- `breakout-light.svg`, `commit-breaker-light.svg`
- `breakout-light.gif`, `commit-breaker-light.gif`

> **Note:** `GITHUB_TOKEN` needs **no scopes at all** — contribution data is public. Generate one at [GitHub Developer Settings](https://github.com/settings/tokens) (classic token, no checkboxes needed) or a fine-grained token with no permissions.

### As a GitHub Action

Create the following file in your profile repository:

```text
.github/workflows/generate.yml
```

Add:

```yaml
name: Generate Commit Breaker

on:
  schedule:
    # Runs at midnight every day
    - cron: "0 0 * * *"
  workflow_dispatch:
  push:
    branches:
      - main

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1
      
      - name: Generate Commit Breaker
        uses: blubugtech/commitbreaker@v2.0.0.1
        with:
          github_user_name: ${{ github.repository_owner }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          out_dir: dist
          
      - name: Push to output branch
        uses: crazy-max/ghaction-github-pages@v4
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The workflow runs automatically every day at midnight using:

```yaml
- cron: "0 0 * * *"
```

It also supports manual execution through `workflow_dispatch` and runs when changes are pushed to the `main` branch.

### 🎨 Dark Mode Support on GitHub

For dark mode support on GitHub, use this [special syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-and-formatting-on-github/basic-writing-and-formatting-syntax#specifying-the-theme-an-image-is-shown-to) in your README.

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/<USERNAME>/<USERNAME>/output/breakout-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/<USERNAME>/<USERNAME>/output/breakout-light.svg" />
  <img alt="conways-game-of-life" src="https://raw.githubusercontent.com/<USERNAME>/<USERNAME>/output/breakout-light.svg" />
</picture>
```


## ⚙️ Tuning

All timing/color and physics config lives in `src/constants.ts`:
- `ballSpeed`, `paddleMaxSpeed`, `paddleWidth` control the breakout game dynamics.
- `DARK_PALETTE` / `LIGHT_PALETTE` control colors.
- `CELL`, `GAP`, `PAD` control grid sizing.

## 🧪 Testing without a token

`src/test-local.ts` generates a synthetic-but-realistic contribution grid so you can iterate on the simulation and renderers without hitting the GitHub API:

```bash
npx tsx src/test-local.ts
```
