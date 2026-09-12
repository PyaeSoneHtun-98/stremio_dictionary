# Subtitle Bridge

Subtitle Bridge is a Windows-first desktop video player for English learners. It opens local MKV files, renders supported embedded text subtitles as interactive words, and can translate a selected word into Burmese without leaving the player.

## Stack

- Electron for the desktop shell, native playback window integration, and network/provider access
- React + TypeScript for the renderer UI
- Vite through `electron-vite` for development and production builds
- mpv for video playback
- FFmpeg for embedded text subtitle extraction
- Google Cloud Translation Basic (v2) as the first Burmese translation provider
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

## Google Translation development setup

Issue #7 uses Google Cloud Translation Basic (v2) through a replaceable translation-provider interface. Enable the Cloud Translation API in a Google Cloud project, create an API key that can call the Basic API, and expose it to the Electron main process before starting the app.

Windows Command Prompt:

```cmd
set "GOOGLE_TRANSLATE_API_KEY=your-api-key"
npm run dev
```

PowerShell:

```powershell
$env:GOOGLE_TRANSLATE_API_KEY = "your-api-key"
npm run dev
```

The API key stays in the Electron main process and is not exposed through the preload bridge to the React renderer. The current Google provider sends only the normalized selected word to Google (`source=en`, `target=my`, plain text). The current subtitle-line context is available to the provider interface for future context-aware/local providers but is not sent by `GoogleTranslationProvider`.

Do not commit API keys to the repository. Persistent provider settings and translation caching are handled in the next settings/caching milestone.

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
│   └── GoogleTranslationProvider
└── secure preload bridge
    └── React renderer
        ├── player controls
        ├── interactive subtitle overlay
        └── Burmese translation popup
```

The renderer runs with Node integration disabled and context isolation enabled. System capabilities and provider calls are exposed through narrow preload/IPC APIs instead of importing Node APIs into React components.

The translation provider is intentionally replaceable so a future local English→Burmese dictionary can become the primary provider with Google Translation as a fallback.

## Development workflow

1. Pick the next GitHub issue.
2. Create an issue-specific feature branch.
3. Implement only that issue's scope.
4. Run `npm run check`.
5. Open a pull request that closes the issue.
6. Review the PR before merging to `master`.
