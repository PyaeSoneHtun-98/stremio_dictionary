# Subtitle Bridge

Subtitle Bridge is a Windows desktop video player for English learners. It plays local MKV files and supported HTTP/HTTPS media streams, shows supported English text subtitles as clickable words, and provides offline English → Burmese word and phrase lookup without leaving the player.

## Windows v1.0.4

Subtitle Bridge v1.0.4 is a focused Windows updater reliability release. It keeps the stable player UX, dictionary/phrase lookup, Stremio handoff, runtime, and secure user-approved updater from v1.0.3 while fixing the install-directory shutdown race that could make an in-app upgrade fail on some PCs.

### Normal installation

Requirements:

- Windows 10 or Windows 11 x64
- an internet connection during first setup so the installer can obtain the pinned mpv/FFmpeg runtimes

From the latest GitHub Release, download:

```text
SubtitleBridge-Setup-x64.exe
```

Then double-click the setup executable.

The normal installer:

- installs Subtitle Bridge for the current Windows user;
- creates a Start Menu entry;
- registers Subtitle Bridge in Windows Installed Apps / Add or Remove Programs;
- provisions pinned, SHA-256-verified app-local mpv and FFmpeg runtimes;
- requires no Git, Node.js, npm, terminal commands, PATH editing, or manual mpv/FFmpeg setup;
- supports rollback-safe upgrades and interrupted-upgrade recovery;
- keeps optional Stremio integration reversible and fail-closed.

Existing installations can be upgraded by running the newer setup executable; uninstalling first is not required.

A matching `SubtitleBridge-Setup-x64.exe.sha256` file is published with the installer.

> The current Windows build is not code-signed. Windows SmartScreen may show an **Unknown Publisher** warning when opening a downloaded installer.

### Portable package

The release also contains:

```text
SubtitleBridge-win-x64.zip
SubtitleBridge-win-x64.zip.sha256
```

The one-click setup EXE is the recommended download for normal users.

## In-app update support

Subtitle Bridge v1.0.4 includes the same user-approved Windows updater and strengthens the updater-to-installer shutdown handoff.

- Subtitle Bridge checks the official stable GitHub Release shortly after startup and periodically.
- Up-to-date checks stay unobtrusive.
- A newer stable release shows its version and release notes in the launcher.
- **Download update** downloads the normal setup EXE plus its published SHA-256 file.
- Networking, disk writes, hashing, and installer launch stay in the Electron main process.
- The setup EXE is SHA-256 verified after download and re-verified immediately before launch.
- Installation is explicit; there are no forced or silent installs.
- Installation is blocked while video playback is loading, playing, or paused.
- Offline/update-server failures do not block normal playback or dictionary use.

The updater only trusts stable releases and the exact Windows assets from the official `PyaeSoneHtun-98/stremio_dictionary` repository. v1.0.4 also waits safely for the launching app to exit, tolerates bounded transient install-directory locks, verifies updater-parent identity, and remains compatible with older updater-enabled builds that do not pass the new identity metadata.

## What v1.0.4 includes

- local MKV playback;
- HTTP/HTTPS and Stremio stream playback;
- centered stream buffering/loading feedback;
- single-click video-surface play/pause;
- double-click fullscreen using the Windows-configured double-click interval;
- synchronized clickable embedded SRT/ASS/SSA text subtitles;
- native external SRT/ASS/SSA file picker plus drag-and-drop loading;
- subtitle delay, size, and position controls;
- frozen 30,000-headword English → Burmese Dictionary v1.0;
- frozen 3,000-entry Phrase Dictionary v1.0.0 with longest-match phrase detection and normal single-word fallback;
- compact launcher with Local video, Stremio, and current-session status;
- installer-managed, pinned, SHA-256-verified mpv and FFmpeg;
- Start Menu and Windows uninstall integration;
- rollback-safe upgrades and recovery after interrupted setup;
- opt-in in-app Stremio enable/disable controls;
- secure user-approved GitHub Release update checking/downloading with SHA-256 verification;
- custom install-directory preservation during in-app updates;
- redacted rotating diagnostics;
- Electron renderer isolation with Node integration disabled and context isolation enabled.

## Dictionary and phrase lookup

The production word dictionary is the frozen **30,000-headword Dictionary v1.0**, plus a small structured core supplement and a collision-checked compatibility alias layer.

The production **Phrase Dictionary v1.0.0** contains:

- 3,000 canonical phrases;
- 4,827 stored forms;
- 7,827 unique lookup keys.

When a user clicks a subtitle word, Subtitle Bridge checks the current cue for the longest known phrase containing that word before falling back to the normal single-word dictionary.

Normal Burmese word and phrase lookup is offline and requires no account, API key, payment method, or network request.

Dictionary validation is part of the normal project checks:

```bash
npm run dictionary:verify-production
npm run dictionary:validate
npm run phrase-dictionary:verify-production
```

## Stremio integration

Subtitle Bridge can receive supported Stremio HTTP/HTTPS playback URLs while Stremio remains running.

Use the app-facing Stremio integration controls to enable or disable **Play in Subtitle Bridge**. The compatibility integration remains opt-in, reversible, idempotent, atomic, and fail-closed on unrecognized Stremio layouts. Successfully patched targets are recorded so uninstall/disable can clean them safely and exhaustively.

Stremio updates can change its local layout and may require re-enabling the integration.

More details are in [`docs/STREMIO_HANDOFF.md`](docs/STREMIO_HANDOFF.md).

## Runtime dependencies

Normal setup provisions app-local mpv and FFmpeg automatically from the pinned sources in:

```text
packaging/runtime-manifest.json
```

Downloaded runtime archives are SHA-256 verified before use. CI also exercises the public runtime downloads, extraction, and executable startup. Third-party provenance/license information is included with the package.

Developer override order remains:

1. `MPV_PATH` / `FFMPEG_PATH`
2. installer-managed app-local runtimes
3. system `PATH`

## Diagnostics and privacy

The desktop main process writes a small rotating diagnostic log under the Electron user-data directory at:

```text
diagnostics\subtitle-bridge.log
```

Diagnostics intentionally avoid subtitle text, clicked dictionary words, raw FFmpeg/mpv logs, credentials, and full media paths or stream URLs. Known secret-shaped fields and sensitive query/header patterns are redacted.

## Development

### Prerequisites

- Windows 10/11
- Node.js 22 LTS or newer
- npm 10 or newer

Install dependencies and start development:

```bash
npm ci
npm run dev
```

Run the complete project validation suite:

```bash
npm run check
```

Build the Windows release artifacts on Windows x64:

```bash
npm run package:win
```

This produces:

```text
release\SubtitleBridge-Setup-x64.exe
release\SubtitleBridge-Setup-x64.exe.sha256
release\SubtitleBridge-win-x64.zip
release\SubtitleBridge-win-x64.zip.sha256
```

## Architecture

```text
Electron main process
├── launch-target parser
├── mpv playback controller
│   └── live text subtitles for HTTP/HTTPS streams
├── FFmpeg full-track subtitle extraction for local MKV files
├── offline word + phrase dictionary providers
├── optional translation provider adapters
├── redacted diagnostic logging
└── secure preload bridge
    └── React renderer
        ├── player controls and buffering feedback
        ├── interactive subtitle overlay
        └── Burmese translation popup

Optional Stremio compatibility integration
└── safely patches Stremio external-player discovery
    └── adds "Play in Subtitle Bridge"
```

The renderer runs with Node integration disabled and context isolation enabled. System capabilities are exposed through narrow preload/IPC APIs rather than importing Node APIs into React components.

## Project documentation

- [`AGENTS.md`](AGENTS.md) — repository instructions for coding agents/reviewers
- [`docs/PROJECT.md`](docs/PROJECT.md) — product goal, architecture, invariants, limitations
- [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — required issue → branch → test → review workflow
- [`docs/STATUS.md`](docs/STATUS.md) — current stable state and active work
- [`docs/MVP_ACCEPTANCE_TEST.md`](docs/MVP_ACCEPTANCE_TEST.md) — Windows acceptance coverage

## Development workflow

Substantial changes follow:

```text
issue
→ branch
→ implementation
→ npm run check
→ Draft PR / CI
→ relevant manual acceptance
→ Codex review
→ fix findings
→ exact-head CI verification
→ squash merge
→ confirm issue closed
```

Future work includes macOS/Linux packaging, separated-object phrasal-verb matching, pronunciation/TTS, richer ASS/libass fidelity, broader bilingual editorial review, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
