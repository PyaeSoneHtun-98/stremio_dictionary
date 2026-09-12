# Subtitle Bridge

Subtitle Bridge is a Windows-first desktop video player for English learners. It opens local MKV files, renders supported embedded text subtitles as interactive words, and can translate a selected word into Burmese without leaving the player.

## Stack

- Electron for the desktop shell and native playback window integration
- React + TypeScript for the renderer UI
- Vite through `electron-vite` for development and production builds
- mpv for video playback
- FFmpeg for embedded text subtitle extraction
- a replaceable translation-provider interface with an offline English → Burmese dictionary as the default provider
- Biome for linting/formatting
- Vitest for tests

## Prerequisites

- Windows 10 or Windows 11
- Node.js 22 LTS or newer
- npm 10 or newer
- mpv available through `PATH` or `MPV_PATH`
- FFmpeg available through `PATH` or `FFMPEG_PATH`

## Getting started

```bash
npm ci
npm run dev
```

Use `npm ci` for reproducible installs from the committed lockfile. The dev command starts the Vite renderer and launches the Electron application.

## Offline Burmese dictionary

Issue #7 uses `LocalDictionaryProvider` by default. It performs English → Burmese word lookup entirely inside the Electron main process, so normal translation lookup requires no account, API key, payment method, or internet connection.

The starter dataset lives in `src/main/translation/localDictionary.ts`. It contains a small curated set of common words plus selected inflected aliases such as `running → run`, `treaties → treaty`, and `signed → sign`. The dataset is intentionally easy to replace or expand while a larger English → Burmese dictionary is developed.

A word that is not yet in the local dataset returns a short readable “not available yet” message while video and subtitle playback continue normally.

`GoogleTranslationProvider` remains in the codebase as an optional provider adapter example, but it is not the active provider and no Google Cloud configuration is required to run Subtitle Bridge.

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

The production Electron bundle is written to `out/`. A Windows installer will be added during the packaging milestone.

## Architecture

```text
Electron main process
├── mpv playback controller
├── FFmpeg subtitle extraction
├── translation provider adapters
│   ├── LocalDictionaryProvider  ← default/offline
│   └── GoogleTranslationProvider  ← optional adapter
└── secure preload bridge
    └── React renderer
        ├── player controls
        ├── interactive subtitle overlay
        └── Burmese translation popup
```

The renderer runs with Node integration disabled and context isolation enabled. System capabilities and provider calls are exposed through narrow preload/IPC APIs instead of importing Node APIs into React components.

The provider boundary is intentionally replaceable so the starter dictionary can grow into a larger JSON/SQLite dataset later, and additional translation providers can be added without changing the subtitle UI.

## Development workflow

1. Pick the next GitHub issue.
2. Create an issue-specific feature branch.
3. Implement only that issue's scope.
4. Run `npm run check`.
5. Open a pull request that closes the issue.
6. Review the PR before merging to `master`.
