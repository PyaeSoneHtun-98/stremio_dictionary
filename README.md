# Subtitle Bridge

Subtitle Bridge is a Windows desktop video player for English learners. It plays local MKV files and supported HTTP/HTTPS media streams, shows supported English text subtitles as clickable words, and provides offline English → Burmese word and phrase lookup without leaving the player.

## Windows v1.0.7

Subtitle Bridge v1.0.7 adds a **Stream URL** entry to the main window, audio-track switching during playback, a consolidated CC/Tracks panel, the neutral charcoal theme and approved logo, a larger offline dictionary (40,011 headwords and 4,000 phrases), and an optional flag for reporting missing or questionable dictionary entries. See the [v1.0.7 release notes](docs/releases/v1.0.7.md).

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

Subtitle Bridge includes a user-approved Windows updater. Since v1.0.6 it isolates the setup working directory so setup does not keep the install directory locked during an in-app upgrade.

- Subtitle Bridge checks the official stable GitHub Release shortly after startup and periodically.
- Up-to-date checks stay unobtrusive.
- A newer stable release shows its version and release notes in the launcher.
- **Download update** downloads the normal setup EXE plus its published SHA-256 file.
- Networking, disk writes, hashing, and installer launch stay in the Electron main process.
- The setup EXE is SHA-256 verified after download and re-verified immediately before launch.
- Installation is explicit; there are no forced or silent installs.
- Installation is blocked while video playback is loading, playing, or paused.
- Offline/update-server failures do not block normal playback or dictionary use.

The updater only trusts stable releases and the exact Windows assets from the official `PyaeSoneHtun-98/stremio_dictionary` repository. It retains the existing process-identity, checksum, rollback, custom-install-directory, and transient-lock protections while explicitly relocating updater/setup working directories outside the installed application tree.

## What v1.0.7 includes

- local MKV and MP4 playback;
- HTTP/HTTPS and Stremio stream playback, including a **Stream URL** field in the main window;
- audio-track switching while playback continues;
- a consolidated CC/Tracks panel for subtitle selection, external subtitles, delay, size and position;
- centered stream buffering/loading feedback;
- single-click video-surface play/pause;
- double-click fullscreen using the Windows-configured double-click interval;
- synchronized clickable embedded SRT/ASS/SSA text subtitles;
- native external SRT/ASS/SSA file picker plus drag-and-drop loading;
- subtitle delay, size, and position controls, including G/H 0.1-second timing shortcuts with on-screen feedback;
- frozen 30,000-headword dictionary plus a separate 10,000-entry extension and core corrections;
- 4,000 phrases from the frozen 3,000-entry base plus 1,000 new phrases, with longest-match detection;
- optional dictionary-entry reporting from the translation card;
- compact launcher with Local video, Stremio, Stream URL, and current-session status;
- neutral charcoal theme and the approved Subtitle Bridge logo;
- installer-managed, pinned, SHA-256-verified mpv and FFmpeg;
- Start Menu and Windows uninstall integration;
- rollback-safe upgrades and recovery after interrupted setup;
- opt-in in-app Stremio enable/disable controls with verified status, repair-state guidance, and fail-closed cleanup;
- secure user-approved GitHub Release update checking/downloading with SHA-256 verification;
- custom install-directory preservation during in-app updates;
- redacted rotating diagnostics;
- Electron renderer isolation with Node integration disabled and context isolation enabled.

## Stream URL entry

Since v1.0.7 the main window has a **Stream URL** field. Paste an HTTP/HTTPS media
URL, then select **Open stream** or press Enter. This uses the same mpv playback and live text
subtitle path as Stremio; an ordinary website page URL may not be playable media. Other URL
schemes are rejected. The field clears on successful opening and no URL history is saved.

## macOS beta (Apple Silicon)

An unnotarized, ad-hoc-signed macOS beta for Apple Silicon is in progress
([Issue #53](https://github.com/PyaeSoneHtun-98/stremio_dictionary/issues/53)). It requires
`brew install mpv ffmpeg`, runs libmpv inside the app to draw video into the player window, and
does not include Stremio one-click handoff or in-app updates. It has passed CI on GitHub's
macOS runners but has not yet been accepted on a physical Mac. See
[docs/releases/macos-beta.md](docs/releases/macos-beta.md) and
[docs/MACOS_BETA_ACCEPTANCE.md](docs/MACOS_BETA_ACCEPTANCE.md).

## Dictionary and phrase lookup

The word dictionary combines frozen **Dictionary v1.0**, a pinned **10,000-entry extension**, targeted corrections and the remaining core supplement: **40,011 runtime headwords**. Compatibility aliases remain collision-checked. See [dictionary expansion](docs/DICTIONARY_EXPANSION.md) for provenance and acceptance status.

The frozen **Phrase Dictionary v1.0.0** plus its separate extension contain:

- 4,000 canonical phrases;
- 7,509 stored forms;
- 11,509 stored lookup variants (token-equivalent spellings can share a runtime key under one owner).

When a user clicks a subtitle word, Subtitle Bridge checks the current cue for the longest known phrase containing that word before falling back to the normal single-word dictionary.

Normal Burmese word and phrase lookup is offline and requires no account, API key, payment method, or network request.

The dictionary and phrase data were generated by the project owner with OpenAI GPT models and are maintained in [PyaeSoneHtun-98/dictionary-dataset](https://github.com/PyaeSoneHtun-98/dictionary-dataset). The copies shipped in this repository are covered by the same [MIT license](LICENSE). The data is AI-generated and has not had a full native-speaker editorial review, so some meanings may be imperfect; use the report flag on the translation card to point out problems.

Dictionary validation is part of the normal project checks:

```bash
npm run dictionary:verify-production
npm run dictionary:verify-extension
npm run dictionary:validate
npm run phrase-dictionary:verify-production
npm run phrase-dictionary:verify-extension
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

Dictionary reports are sent only when you click the flag on a translation card. A report contains the looked-up word or phrase, the report category, the target language, the app and dictionary versions, and a random request ID used only to deduplicate retries. It goes to the project's HTTPS reporting endpoint for manual review and never includes subtitle context, translations, media paths, stream URLs, credentials, or user/device identifiers. See [dictionary reporting](docs/DICTIONARY_REPORTING.md).

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

Build the macOS beta on an Apple Silicon Mac (Homebrew `mpv` provides the libmpv headers):

```bash
brew install mpv ffmpeg
npm run build:mac-native
npm run package:mac
```

This produces `release/SubtitleBridge-macos-arm64.dmg` and its `.sha256`. `npm run dev` on macOS
also needs `npm run build:mac-native` once so the native video view exists.

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

Future work includes Linux packaging, a notarized stable macOS release, separated-object phrasal-verb matching, pronunciation/TTS, richer ASS/libass fidelity, broader bilingual editorial review, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.

## License

Subtitle Bridge, including the dictionary and phrase data in this repository, is released under the [MIT License](LICENSE). Third-party components keep their own licenses: mpv and FFmpeg (downloaded separately by the Windows installer, or installed with Homebrew for the macOS beta), Electron/Chromium, and the Inter font used in the logo artwork. See [packaging/THIRD_PARTY_NOTICES.txt](packaging/THIRD_PARTY_NOTICES.txt) and [assets/branding/licenses](assets/branding/licenses).
