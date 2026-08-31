# Repository Guidelines

## Project Structure & Module Organization

`src/cli.tsx` is the executable entry point. Command handlers live in `src/commands/`, reusable interactive prompts in `src/prompts/`, and storage, planning, validation, hashing, and GitHub operations in `src/core/`. The Ink/React interface is split between `src/tui/screens/`, reusable `src/tui/components/`, and shared state in `src/tui/state.ts`. Tests live in `test/`: core lifecycle coverage is in `core.integration.test.ts`, GitHub URL parsing in `github.test.ts`, and rendered/interactive terminal behavior in `tui.test.tsx`. Build output goes to `dist/` and should not be hand-edited.

## Build, Test, and Development Commands

- `pnpm install` installs the locked dependencies (Node.js 22+ and the system `git` command are required).
- `pnpm typecheck` runs strict TypeScript checks without emitting files.
- `pnpm test` runs the Bun test suite.
- `pnpm build` bundles and minifies `src/cli.tsx` into `dist/cli.js`.
- `pnpm start` runs the built CLI; rebuild after source changes. Use `node dist/cli.js --help` for non-interactive command discovery.

## Coding Style & Naming Conventions

Use TypeScript/TSX with two-space indentation, single quotes, semicolons, and ESM imports. Include `.js` extensions for local imports, matching NodeNext resolution. Use `camelCase` for functions and variables, `PascalCase` for React components and types, and kebab-case filenames such as `select-deck.ts`. Keep core filesystem and business logic separate from prompts and rendering. Preserve strict typing; avoid unchecked assertions unless a preceding check establishes the invariant.

No formatter or linter is configured, so match nearby code and run `pnpm typecheck` before submitting.

## Testing Guidelines

Write tests with `bun:test`; name files `*.test.ts` or `*.test.tsx`. Add focused unit tests for parsers and schemas, integration tests for storage/project lifecycles, and `ink-testing-library` tests for visible TUI or keyboard changes. Use temporary directories and clean them in `afterEach`; keep tests cross-platform and avoid network access. Run `pnpm test` and `pnpm typecheck` for every change. No numeric coverage threshold is currently enforced.

## Commit & Pull Request Guidelines

Recent commits use concise, imperative, sentence-case subjects, for example `Fix concurrent library imports`. Keep commits scoped to one behavior. Pull requests should explain the user-visible change, call out safety or compatibility implications, and list verification commands. Link relevant issues and include terminal screenshots or captured frames for TUI changes.

## Security & Data Safety

Skdeck manages user files and untrusted GitHub content. Preserve path-traversal and symlink protections, atomic writes, locking, immutable revisions, and checks that prevent overwriting unmanaged or locally modified skills.
