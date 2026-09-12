# Embedded subtitle cue pipeline

Issue #4 turns an embedded text subtitle stream into an application-owned normalized cue model.

## Extraction flow

1. mpv reports the MKV track list, including each track's `ff-index`.
2. Subtitle Bridge considers only subtitle tracks classified as text (`subrip`/SRT, ASS, SSA, and the other text codecs already recognized by the app).
3. Until the track-selection UI is built, the app prefers an English text track (`eng`, `en`, or an `en-*` language tag), then an already-selected text track, then the first supported text track.
4. A separate FFmpeg process reads that embedded stream directly from the MKV and converts it to SRT on stdout. The user does not have to extract a subtitle file manually.
5. Subtitle Bridge parses the SRT output into normalized cues with start/end seconds, preserved readable line breaks, and word offsets/lookup terms.
6. Playback time is matched against the normalized cue list, so the active cue updates after normal playback or a seek.

Image subtitle tracks such as PGS and VobSub never enter the text extraction/parser path.

## FFmpeg development prerequisite

Issue #4 expects `ffmpeg.exe` to be available on `PATH`, or `FFMPEG_PATH` to point to it. This is intentionally a runtime tool boundary rather than a checked-in binary. Windows packaging/bundling remains part of the packaging issue.

Example for a CMD session:

```cmd
set "FFMPEG_PATH=C:\Tools\ffmpeg\bin\ffmpeg.exe"
```

Playback remains usable if FFmpeg is missing or subtitle extraction fails; the subtitle model reports an error without crashing or stopping mpv.

## Normalized cue shape

Each cue contains:

- `startTime` and `endTime` in seconds
- full display `text`
- `lines` for readable line-break preservation
- word `tokens` with character `start`/`end` offsets and a normalized `lookupTerm`

Punctuation stays in the cue display text. Word tokens point only at the lookup word, so `hello` and the `hello` inside `hello?` both normalize to the same lookup term while `?` remains visible.

## Current scope boundary

This issue exposes cue diagnostics in the main app to prove extraction and synchronization. Replacing the three overlay probe words with the real synchronized clickable subtitle UI belongs to the next overlay issue.
