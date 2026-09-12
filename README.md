# Subtitle Bridge

Subtitle Bridge is a Windows-first desktop video player for English learners. The MVP will open local MKV files, render embedded text subtitles as interactive words, and show a Burmese translation when a subtitle word is selected.

This repository is currently implementing the MVP issue-by-issue. Issue #1 establishes the Electron + React + TypeScript foundation only; media playback and translation are intentionally deferred to later issues.

## Stack

- Electron for the desktop shell and system integration
- React + TypeScript for the renderer UI
- Vite through `electron-vite` for development and production builds
- Biome for linting/formatting
- Vitest for tests

## Prerequisites

- Windows 10 or Windows 11
- Node.js 22 LTS or newer
- npm 10 or newer

## Getting started

```bash
npm ci
npm run dev
```

Use `npm ci` for reproducible installs from the committed lockfile. The dev command starts the Vite renderer and launches the Electron window.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Run every project check with:

```bash
npm run check
```

The production Electron bundle is written to `out/`. A Windows installer will be added during the packaging milestone rather than in the bootstrap issue.

## Architecture

```text
Electron main process
├── desktop lifecycle / future media-process integration
└── secure preload bridge
    └── React renderer
        ├── components
        └── features
            ├── playback
            ├── subtitles
            ├── translation
            └── settings
```

The renderer runs with Node integration disabled and context isolation enabled. System capabilities should be exposed through narrow preload/IPC APIs instead of importing Node APIs into React components.

## Development workflow

1. Pick the next GitHub issue.
2. Create an issue-specific feature branch.
3. Implement only that issue's scope.
4. Run `npm run check`.
5. Open a pull request that closes the issue.
6. Review the PR before merging to `master`.

## Current scope

Issue #1 does **not** include MKV playback, subtitle extraction, FFmpeg/mpv, translation APIs, or persistent settings. Those are implemented in follow-up issues after the application foundation is reviewed.
