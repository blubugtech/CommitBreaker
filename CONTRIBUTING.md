# Contributing to CommitBreaker

First off, thank you for considering contributing to CommitBreaker! It's people like you that make open source such a fantastic community.

## Local Development

To get started with local development:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/blubugtech/commit-breaker.git
   cd commit-breaker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run local tests:**
   You do not need a GitHub token to test changes to the simulation or rendering logic. A script is provided that generates a synthetic, realistic contribution grid for testing:
   ```bash
   npm run test:local
   ```
   This will output the generated SVGs and GIFs into the `dist/` directory.

4. **Code Formatting:**
   We use Prettier and ESLint. Please ensure your code is formatted before opening a Pull Request:
   ```bash
   npm run lint
   ```

## Pull Request Process

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes (`npm run test:local`).
5. Issue that pull request!

## Any questions?

If you have any questions, feel free to open an issue or reach out!
