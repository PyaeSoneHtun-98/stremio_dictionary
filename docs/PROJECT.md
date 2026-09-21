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

## Main playback architecture

### Local MKV files

```text
Local MKV
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

Local subtitle extraction reads the complete selected embedded text track and normalizes it into cues. The existing overlay uses the cue timing to show synchronized clickable text.

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

## Subtitle support

Interactive text support currently covers:

- SubRip / SRT
- ASS
- SSA

External SRT/ASS/SSA files can be dragged onto active playback. Embedded/live and external subtitle sources remain switchable. Subtitle Bridge also provides delay/sync, font-size, and vertical-position controls for its rendered subtitle overlay.

Image-based subtitles such as PGS and VobSub may be detected but are not converted into clickable text. The UI should show a clear unsupported state rather than pretending extraction succeeded.

ASS/SSA handling is defensive. The overlay prioritizes readable dialogue and filters drawing/effect garbage. It does not currently reproduce full libass visual fidelity, positioning, signs, fonts, karaoke effects, or vector drawings.

A future richer architecture may allow mpv/libass to render original ASS visuals while Subtitle Bridge separately exposes readable dialogue for interaction.

## Translation architecture

The default translation provider is `LocalDictionaryProvider`.

- English → Burmese lookup works fully offline at runtime.
- The production corpus is the frozen Dictionary v1.0 artifact from `PyaeSoneHtun-98/dictionary-dataset/dist/dictionary_v1.json`.
- The frozen corpus contains 30,000 unique headwords and 15,864 stored inflected forms.
- Subtitle Bridge vendors the exact frozen artifact and verifies its SHA-256 during automated checks.
- A separate 16-entry structured core supplement preserves useful basic words intentionally absent from the frozen 30,000-headword set.
- A collision-checked compatibility alias table restores 11 historical starter-dictionary inflections that are intentionally absent from the frozen corpus forms, without modifying the frozen JSON.
- All local results use the same structured dictionary model: canonical headword, pronunciation, grouped parts of speech, and Burmese meanings.
- Canonical headwords are indexed before forms, so an exact headword wins over another entry's inflection.
- The former flat starter/legacy fallback is no longer part of the translation path.
- Translation results are cached.

The frozen v1.0 corpus is AI-authored and has passed structural and targeted quality audits, but it has not received exhaustive native/bilingual editorial review of every entry.

`GoogleTranslationProvider` remains optional. Provider credentials must be protected with the existing secure settings behavior and must never be written to diagnostics.

## Desktop and IPC model

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
- Multi-word expressions and phrasal-verb lookup are not yet supported.
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
