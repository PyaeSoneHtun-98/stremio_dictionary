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
- An offline English → Burmese dictionary is the default translation provider.

Release packages intentionally do not bundle mpv or FFmpeg. They are external runtime dependencies supplied by the target machine through `PATH`, `MPV_PATH`, and `FFMPEG_PATH`.

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

Image-based subtitles such as PGS and VobSub may be detected but are not converted into clickable text. The UI should show a clear unsupported state rather than pretending extraction succeeded.

ASS/SSA handling is defensive. The overlay prioritizes readable dialogue and filters drawing/effect garbage. It does not currently reproduce full libass visual fidelity, positioning, signs, fonts, karaoke effects, or vector drawings.

A future richer architecture may allow mpv/libass to render original ASS visuals while Subtitle Bridge separately exposes readable dialogue for interaction.

## Translation architecture

The default translation provider is `LocalDictionaryProvider`.

- English → Burmese lookup works offline.
- No cloud account or API key is required for normal use.
- The starter dictionary is intentionally small and replaceable/expandable.
- Translation results are cached.

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

The current package is an Electron portable directory/ZIP plus a current-user PowerShell installer. The installer stages and validates upgrades before replacing an existing installation and removes stale files from older installs.

Diagnostics are intentionally small and privacy-conscious. They may record lifecycle, controlled media/subtitle failure metadata, and memory samples. They must not record:

- API keys or authorization material
- full stream URLs
- full local media paths
- subtitle text
- clicked dictionary words
- raw FFmpeg stderr

## Current product limitations

- Windows x64 only.
- mpv and FFmpeg must currently be installed/configured separately.
- The offline Burmese dictionary is still a starter dataset.
- Rich ASS/SSA styling is not recreated in the interactive overlay.
- Image subtitles are not clickable text.
- Stremio external subtitle-addon URLs are not yet ingested.
- Watched/progress state is not synchronized back to Stremio.
- Stremio compatibility currently depends on a reversible local patch rather than native upstream support.
- The current player UI is functional but still MVP-quality and is planned for a dedicated redesign issue after the Stremio handoff PR is merged.

## Product priorities

When trade-offs are required, prefer:

1. reliable playback
2. synchronized readable subtitles
3. fast, simple word interaction
4. safe Burmese translation
5. unobtrusive player UX
6. visual polish and advanced subtitle fidelity

Do not sacrifice stable playback or subtitle correctness merely to add visual effects or broader scope.
