# Subtitle Bridge

Subtitle Bridge is a Windows-first desktop video player for English learners. It opens local MKV files and supported HTTP/HTTPS media streams, renders supported embedded text subtitles as interactive words, and can translate a selected word into Burmese without leaving the player.

## Project documentation

Before substantial development work, read:

- [`AGENTS.md`](AGENTS.md) — repository instructions for coding agents and reviewers
- [`docs/PROJECT.md`](docs/PROJECT.md) — product goal, architecture, invariants, and limitations
- [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — required issue → branch → test → review → merge process
- [`docs/STATUS.md`](docs/STATUS.md) — current stable state, active issue/PR, verified behavior, and next work

These files are the project source of truth when chat history becomes stale or incomplete.

## Stack

- Electron for the desktop shell and native playback window integration
- React + TypeScript for the renderer UI
- Vite through `electron-vite` for development and production builds
- mpv for video playback and live subtitle decoding on network streams
- FFmpeg for full embedded text subtitle extraction from local files
- a replaceable translation-provider interface with an offline English → Burmese dictionary as the default provider
- Biome for linting/formatting
- Vitest for tests

## Development prerequisites

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

`LocalDictionaryProvider` is the default translation provider. It performs English → Burmese word lookup entirely inside the Electron main process, so normal translation lookup requires no account, API key, payment method, or internet connection.

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

## Package the Windows MVP

On Windows x64, create the distributable package with:

```cmd
npm ci
npm run package:win
```

This writes:

```text
release\SubtitleBridge-win-x64\
release\SubtitleBridge-win-x64.zip
release\SubtitleBridge-win-x64.zip.sha256
```

The unpacked/ZIP package contains `Subtitle Bridge.exe` and `Install-SubtitleBridge.ps1`. The app can be run directly from the extracted folder, or installed for the current Windows user with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-SubtitleBridge.ps1
```

The installer defaults to `%LOCALAPPDATA%\Programs\Subtitle Bridge`, creates a Start Menu shortcut, stages and validates upgrades before swapping them into place, and removes stale files from the previous installation.

### mpv and FFmpeg in packaged builds

The release artifact intentionally **does not bundle or redistribute mpv or FFmpeg binaries**. Their license obligations depend on the exact third-party build configuration and provenance, so the MVP keeps them external rather than opportunistically copying whatever executable happens to be installed on the packaging machine.

On the target Windows machine, install compatible Windows x64 builds of mpv and FFmpeg separately and either:

- make `mpv.exe` and `ffmpeg.exe` available on `PATH`, or
- set `MPV_PATH` and `FFMPEG_PATH` to the corresponding executable paths before launching Subtitle Bridge.

For normal Start Menu use, configure those values in the Windows user/system environment rather than only in a temporary terminal session. The package includes `RUNTIME_DEPENDENCIES.txt` with the same requirement.

## Stremio Windows handoff

Subtitle Bridge accepts HTTP/HTTPS media URLs on the command line, including Stremio local streaming-server URLs such as `http://127.0.0.1:11470/...` while Stremio remains running.

For HTTP/HTTPS playback, Subtitle Bridge uses mpv's selected embedded text subtitle track as a **live subtitle source**. mpv keeps its own subtitle rendering hidden while exposing the current plain subtitle text, which is tokenized and shown through the existing clickable React overlay. This avoids waiting for FFmpeg to scan an entire torrent-backed stream before subtitles become usable. Local MKV files continue to use FFmpeg full-track extraction.

The tested Stremio 6 beta build exposes only **Disabled** and **M3U Playlist** under **Settings → Player → Play in external player**, so the earlier `vlc://` settings-based approach is not available there. The working Stremio desktop path is the in-player external-device menu, where the streaming server already discovers entries such as **Play in VLC**.

The packaged `Enable-StremioHandoff.ps1` helper therefore makes an opt-in, reversible patch to Stremio's local `server.js` external-player table and adds **Play in Subtitle Bridge** to that menu. It validates the expected server layout and creates a backup before writing. `Disable-StremioHandoff.ps1` removes only the marked Subtitle Bridge block. Stremio must be fully restarted after either operation, and Stremio updates may require rerunning the enable helper.

Full instructions and compatibility details are in [`docs/STREMIO_HANDOFF.md`](docs/STREMIO_HANDOFF.md).

Separate subtitle-addon URLs and watched/progress synchronization are later work.

## Diagnostics

The desktop main process writes a small rotating diagnostic log under the Electron user-data directory in a `diagnostics\subtitle-bridge.log` file. It records lifecycle, controlled mpv/FFmpeg failure metadata, subtitle extraction status, and a main-process memory sample at startup and every 10 minutes.

Diagnostics intentionally avoid subtitle text, selected dictionary words, raw FFmpeg stderr, and full media paths or stream URLs. Secret-shaped fields plus known API-key query/header patterns are redacted. Do not add provider request bodies, authorization headers, raw stored credentials, or third-party stderr/stdout text to logging.

The full release checklist and known limitations are documented in [`docs/MVP_ACCEPTANCE_TEST.md`](docs/MVP_ACCEPTANCE_TEST.md).

## Architecture

```text
Electron main process
├── launch-target parser
├── mpv playback controller
│   └── live text subtitles for HTTP/HTTPS streams
├── FFmpeg full-track subtitle extraction for local MKV files
├── translation provider adapters
│   ├── LocalDictionaryProvider  ← default/offline
│   └── GoogleTranslationProvider  ← optional adapter
├── redacted diagnostic logging
└── secure preload bridge
    └── React renderer
        ├── player controls
        ├── interactive subtitle overlay
        └── Burmese translation popup

Optional Stremio compatibility helper
└── patches Stremio server.js external-player table
    └── adds "Play in Subtitle Bridge"
```

The renderer runs with Node integration disabled and context isolation enabled. System capabilities and provider calls are exposed through narrow preload/IPC APIs instead of importing Node APIs into React components.

The provider boundary is intentionally replaceable so the starter dictionary can grow into a larger JSON/SQLite dataset later, and additional translation providers can be added without changing the subtitle UI.

## Development workflow

See [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) for the full process. In short:

1. Define the next GitHub issue and acceptance criteria.
2. Create an issue-specific feature branch.
3. Implement only that issue's scope.
4. Run `npm run check` and relevant packaging checks.
5. Open/maintain a Draft PR while testing is incomplete.
6. Perform the required real Windows/manual tests.
7. Record truthful results in the PR/docs.
8. Send the current head to Codex for review.
9. Fix all P1/P2 blockers and re-review when needed.
10. Verify final head + CI, mark ready, squash merge, and confirm the issue closed.
