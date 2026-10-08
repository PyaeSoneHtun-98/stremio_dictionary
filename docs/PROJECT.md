# Subtitle Bridge project

## Product goal

Subtitle Bridge is a Windows desktop video player for English learners. Its core interaction is simple: while watching a video with English subtitles, the learner can click an individual subtitle word and immediately see a Burmese translation without leaving playback.

The product should feel like a normal media player first. Translation and subtitle interaction should be available when needed without taking over the viewing experience.

## Current platform and stack

- Windows x64 is the supported target.
- Electron provides the desktop application shell and native playback surface.
- React + TypeScript provides the renderer UI.
- Vite/electron-vite builds the application.
- mpv handles video/audio playback.
- FFmpeg handles full embedded text-subtitle extraction for local files.
- The offline English → Burmese Dictionary v1.0 is the default translation provider.

Release packages do not redistribute mpv or FFmpeg binaries inside the setup executable. The Windows setup provisions pinned, SHA-256-verified app-local runtime archives on first install, caches the verified archives under the user's local application data for upgrades, and the app prefers those managed runtimes. Developer overrides through `MPV_PATH` / `FFMPEG_PATH` and system `PATH` remain fallback paths.

Runtime pins and upstream retention constraints are documented in [RUNTIME_DEPENDENCIES.md](RUNTIME_DEPENDENCIES.md). FFmpeg uses a BtbN month-end LGPL shared build with two-year upstream retention; daily builds expire after 14 builds and must not be used for release pins.

## Main playback architecture

### Local MKV and MP4 files

```text
Local MKV / MP4
  ↓
Electron main process
  ├─ mpv → video/audio playback
  └─ FFmpeg → embedded text subtitle extraction
                    ↓
              normalization
                    ↓
              subtitle cues
                    ↓
React interactive subtitle overlay
                    ↓
click word → translation provider → Burmese popup
```

For local files with a supported embedded text track, subtitle extraction reads the complete selected track and normalizes it into cues. Local MP4 files do not need an embedded subtitle track to play; users can load an external SRT/ASS/SSA file through the existing subtitle picker or drag/drop path. The existing overlay uses cue timing to show synchronized clickable text.

mpv also exposes local audio tracks through the shared track list. Subtitle Bridge can select among those audio tracks during playback by setting mpv's `aid` property; audio switching does not require the subtitle pause gate.

### HTTP/HTTPS network streams

Network streams, including Stremio's local `http://127.0.0.1:11470/...` stream URLs, use a different subtitle path.

```text
HTTP/HTTPS stream
  ↓
mpv
  ├─ video/audio playback
  └─ selected embedded subtitle track
          ↓
      live subtitle text/timing
          ↓
React interactive subtitle overlay
          ↓
click word → Burmese translation
```

Do not use FFmpeg full-track extraction for Stremio/torrent-backed network playback. That approach was manually tested and can remain stuck on `Loading subtitles...` while FFmpeg waits to scan the complete stream. Network playback therefore uses mpv live subtitle properties while mpv's own subtitle rendering stays hidden.

When mpv exposes multiple audio tracks for an HTTP/HTTPS or Stremio stream, the same shared audio selector can switch them without changing the live-subtitle path.

## Subtitle support

Interactive text support currently covers:

- SubRip / SRT
- ASS
- SSA

External SRT/ASS/SSA files can be dragged onto active playback. Embedded/live and external subtitle sources remain switchable. Subtitle Bridge also provides delay/sync, font-size, and vertical-position controls for its rendered subtitle overlay. Player keyboard shortcuts include G / H for 0.1-second subtitle-delay adjustments with temporary on-screen feedback.

Image-based subtitles such as PGS and VobSub may be detected but are not converted into clickable text. The UI should show a clear unsupported state rather than pretending extraction succeeded.

ASS/SSA handling is defensive. The overlay prioritizes readable dialogue and filters drawing/effect garbage. It does not currently reproduce full libass visual fidelity, positioning, signs, fonts, karaoke effects, or vector drawings.

A future richer architecture may allow mpv/libass to render original ASS visuals while Subtitle Bridge separately exposes readable dialogue for interaction.

## Translation architecture

The default translation provider is `LocalDictionaryProvider`.

- English → Burmese lookup works fully offline at runtime.
- The production corpus is the frozen Dictionary v1.0 artifact from `PyaeSoneHtun-98/dictionary-dataset/dist/dictionary_v1.json`.
- The frozen corpus contains 30,000 unique headwords and 15,864 stored inflected forms.
- Subtitle Bridge vendors the exact frozen artifact and verifies its SHA-256 during automated checks.
- A separately pinned 10,000-headword extension from dataset commit `3bce847` adds batches 061–080.
  Nineteen targeted app corrections preserve core vocabulary/forms and restore common subtitle senses.
  The combined dictionary has 40,011 unique headwords; the frozen artifacts remain unchanged.
  See [dictionary expansion](DICTIONARY_EXPANSION.md) for hashes, reconciliation, and acceptance gates.
- Automatic multi-word lookup uses the separately frozen Phrase Dictionary v1.0.0 from `PyaeSoneHtun-98/dictionary-dataset/dist/phrases_v1.json`.
- Phrase Dictionary v1 contains 3,000 canonical phrases, 4,827 stored forms, 7,827 collision-free lookup keys, and 4,092 Burmese semantic meanings.
- A separate extension from the same dataset commit adds 1,000 phrases and 2,682 forms;
  runtime lookup contains 4,000 canonical phrases and 11,509 stored variants. Phrase index keys
  use subtitle tokenization, including hyphens; distinct spellings can share a key under one owner,
  and collisions between different owners fail. Canonical display/report text stays unchanged.
- The vendored phrase artifact SHA-256 is `951a8bbe54824cf76728393791607798f878a062b19eca63e572278ba8f62926` and is verified during `npm run check`.
- Phrase matching is longest-match-first within the bounded current subtitle cue; clicking any token inside a known contiguous 2–5-token phrase can resolve the phrase before single-word fallback.
- The 16-entry structured core supplement preserves useful basic words absent from frozen v1;
  11 remain separate after `go`, `love`, `run`, `see` and `wait` are explicitly reconciled into the extension.
- A collision-checked compatibility alias table restores 11 historical starter-dictionary inflections that are intentionally absent from the frozen corpus forms, without modifying the frozen JSON.
- All local results use the same structured dictionary model: canonical headword, pronunciation, grouped parts of speech, and Burmese meanings.
- Canonical headwords are indexed before forms, so an exact headword wins over another entry's inflection.
- The former flat starter/legacy fallback is no longer part of the translation path.
- Translation results are cached.

The frozen v1.0 corpus is AI-authored and has passed structural and targeted quality audits, but it has not received exhaustive native/bilingual editorial review of every entry.

`GoogleTranslationProvider` remains in the backend for future live validation, but **v1.0.7 does not expose or activate it in the user interface**. The effective v1.0.7 runtime translation scope is enforced in the main process as Offline dictionary → Burmese before translation requests are handled, so stale persisted Google/provider-language settings cannot keep network translation active. Existing credential storage remains dormant and protected by the secure settings behavior; credentials must never be written to diagnostics.

## Desktop and IPC model

The renderer uses a neutral charcoal dark palette with layered gray surfaces, off-white text,
and white controls on gray backgrounds, with neutral focus rings, sliders and selection highlights.
Shared `--theme-*` variables in `styles.css` cover
the launcher, player panels, translation/report card, feedback and scrollbars. Warning/error
colors remain distinct. The native playback overlay remains transparent, including its required
nonzero hit-testing layer; changing the palette does not alter layout or media behavior.

The renderer does not own system/media processes directly.

```text
Electron main process
├─ mpv controller
├─ local FFmpeg subtitle extractor
├─ launch-target handling
├─ translation providers/cache/settings
├─ diagnostics
└─ narrow preload/IPC bridge
    ↓
React renderer
├─ player controls
├─ subtitle track UI
├─ interactive subtitle overlay
└─ translation popup
```

Renderer Node integration remains disabled and context isolation remains enabled.

## Dictionary issue reporting

Issue #71 adds a small flag icon with tooltip/accessible-label feedback at the bottom right of the
translation card. Explicitly reporting a missing translation sends its normalized lookup word;
reporting an existing translation sends the resolved canonical headword or phrase for manual review.
Loading and general translation failures are not treated as dictionary misses.

The player has a narrow main-process HTTPS client. All Supabase function/database code lives in the
separate `D:\Projects\subtitle-report-service` project. Only the public endpoint is embedded at build
time; no Supabase credentials or SDK are distributed in the app. Unconfigured builds disable the
icon. Lookup stays fully offline, and reporting does not change playback or automatic-pause behavior.

Because the direct Supabase hostname is unreachable on the tested connection, the official endpoint
is the separate Vercel reporting relay at `https://subtitle-report-service.vercel.app/api/report-dictionary`.
It forwards the same validated report body/receipt to the existing Supabase function. That deployment
also has a private owner dashboard for browsing and reviewing reports; its owner authentication and
database credentials remain in the backend project. The player has no admin interface.

This is an explicit user submission, not automatic lookup telemetry. Only the term, report category,
fixed Burmese target, app/dictionary versions, and random retry receipt ID are sent. Subtitle context,
translations, media paths, stream URLs, user/device identifiers, and credentials are excluded. Report
terms never enter diagnostics. No persistent offline reporting queue is used.

See [dictionary reporting](DICTIONARY_REPORTING.md) for the contract, build configuration, and
remaining live deployment/Windows acceptance steps.

## Windows update architecture

The in-app updater reuses Subtitle Bridge's existing GitHub Release and rollback-safe setup pipeline rather than introducing a second installer system.

```text
official stable GitHub Release
  ↓
Electron main-process update client
  ├─ validates stable semantic version + exact official repository
  ├─ requires SubtitleBridge-Setup-x64.exe
  ├─ requires SubtitleBridge-Setup-x64.exe.sha256
  ├─ downloads through bounded approved HTTPS GitHub hosts
  ├─ verifies SHA-256
  └─ stores only app-owned update files
          ↓
narrow preload/IPC update state
          ↓
React launcher
  ├─ release notes
  ├─ Download update
  └─ Install and restart (explicit user action)
          ↓
re-hash installer immediately before launch
          ↓
existing rollback-safe Subtitle Bridge setup
```

Update checks run shortly after startup and periodically. A failed check is non-fatal and must never prevent playback, subtitle interaction, or offline dictionary lookup. Draft, prerelease, malformed, older, or equal-version releases are not offered.

The renderer never receives arbitrary network, filesystem, hashing, or process-launch capability. Installation is rejected while media is loading, playing, or paused, so an update cannot interrupt active playback. There is no silent or forced installation.

## Stremio integration

The first Stremio integration supports streams served by Stremio's local streaming server.

Verified behavior:

- A copied Stremio stream URL can be passed directly to Subtitle Bridge.
- Video/audio playback works.
- Embedded text subtitle tracks are detected.
- Live subtitles remain synchronized and clickable.
- Burmese lookup works during network playback.
- Embedded subtitle tracks can be switched while paused.

On the tested Stremio 6 beta Windows build, **Settings → Player → Play in external player** exposes only `Disabled` and `M3U Playlist`; there is no selectable VLC entry there.

The verified one-click integration point is the in-player external-device menu (the same area that can show `Play in VLC`). Issue #24 uses an opt-in compatibility helper that patches Stremio's local `server.js` player table to add `Play in Subtitle Bridge`.

The patch must remain:

- opt-in
- reversible
- idempotent
- conservative when the expected Stremio layout is not recognized
- resilient to Stremio updates by requiring re-application rather than overwriting unknown newer files

This is a compatibility integration, not native/upstream Stremio support.

## Packaging and diagnostics

The Windows package is produced with:

```cmd
npm run package:win
```

The release build produces an Electron portable directory/ZIP plus a single `SubtitleBridge-Setup-x64.exe` for normal users. The setup executable extracts the packaged app, provisions pinned/hash-verified app-local mpv and FFmpeg runtimes, registers a per-user Start Menu entry and Windows Installed Apps uninstall metadata, and uses a staged directory swap with rollback and interrupted-upgrade recovery. The packaged PowerShell installer remains the internal transaction engine and developer/test path. Normal users do not need to run PowerShell commands. Uninstall removes the managed runtime archive cache by default while preserving normal Electron user settings/data.

Diagnostics are intentionally small and privacy-conscious. They may record lifecycle, controlled media/subtitle failure metadata, and memory samples. They must not record:

- API keys or authorization material
- full stream URLs
- full local media paths
- subtitle text
- clicked dictionary words
- raw FFmpeg stderr

## Current product limitations

- Windows x64 only.
- The first normal Windows install requires Internet access to download the pinned mpv and FFmpeg runtime archives; verified archives are cached for later upgrades.
- The Dictionary v1.0 corpus is broad but not exhaustive; unknown words still fail cleanly offline.
- The frozen phrase base plus extension cover 4,000 contiguous 2–5-token expressions with longest-match detection and single-word fallback. Separated-object phrasal verbs, cross-cue matching, and phrases longer than five tokens are not supported yet.
- Rich ASS/SSA styling is not recreated in the interactive overlay.
- Image subtitles are not clickable text.
- Stremio external subtitle-addon URLs are not yet ingested.
- Watched/progress state is not synchronized back to Stremio.
- Stremio compatibility currently depends on a reversible local patch rather than native upstream support.

## Product priorities

When trade-offs are required, prefer:

1. reliable playback
2. synchronized readable subtitles
3. fast, simple word interaction
4. safe Burmese translation
5. unobtrusive player UX
6. visual polish and advanced subtitle fidelity

Do not sacrifice stable playback or subtitle correctness merely to add visual effects or broader scope.
