# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), subtitle-first player redesign (Issue #26, PR #27), and structured offline dictionary v1 pipeline (Issue #28, PR #29) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, structured offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable. PR #25 passed CI #149 and manual Windows retesting before merge.

PR #27 modernized the player controls, subtitle safe area, centered translation card, panels, launcher, focus behavior, and control auto-hide flow without changing the native playback architecture. Manual Windows acceptance and the targeted post-review recheck passed, Codex found no remaining P1/P2 blockers, and final CI #167 passed before squash merge.

PR #29 added the structured dictionary v1 schema, JSON-backed lookup, form-to-headword resolution, grouped POS/Burmese rendering, deterministic 500-entry batch tooling, structured-first legacy fallback, and 30k-scale lookup indexing. Batch 001 was validated locally with 500 entries, 1,152 forms, and 735 Burmese meanings. Manual local-MKV and Stremio acceptance passed. Codex's P2 findings were resolved, CI #198 passed on the final head, and Issue #28 closed when PR #29 was squash merged.

## Active work — Issue #30

**Issue:** Add drag-and-drop external subtitles and subtitle controls

**Branch:** `feat/issue-30-external-subtitles-controls`

**State:** Implementation starting. The issue combines external text-subtitle loading with live subtitle timing, size, and vertical-position controls while preserving the current mpv/FFmpeg architecture and clickable dictionary overlay.

### Issue #30 goals

- Load an external `.srt`, `.ass`, or `.ssa` subtitle by dragging it onto the player without restarting video/audio playback.
- Validate and parse external subtitle files through a narrow preload/IPC boundary; do not expose broad filesystem access to the renderer.
- Make a successfully loaded external subtitle the active interactive subtitle source while keeping embedded/live subtitle sources available for switching back.
- Keep external subtitle dialogue clickable so existing English → Burmese lookup works unchanged.
- Add subtitle delay/sync adjustment with earlier/later control and reset to zero.
- Add persistent subtitle font-size and vertical-position preferences.
- Apply size/position controls to Subtitle Bridge-rendered subtitles regardless of source.
- Apply delay to local embedded, external, and Stremio/live subtitle paths without altering video/audio playback time.
- Keep mpv native subtitle rendering hidden when the interactive overlay is active.
- Preserve renderer Node isolation, context isolation, privacy rules, packaging behavior, and existing translation/provider/cache behavior.

### Important constraints

- Supported external v1 formats are SRT, ASS, and SSA text subtitles only.
- PGS/VobSub and other image subtitles remain non-clickable/out of scope.
- Full ASS/libass styling fidelity, online subtitle search/download, persistent per-media subtitle associations, dual subtitles, and advanced visual styling remain later work.
- External subtitle failures must leave playback and the current working subtitle source intact.
- Full dropped subtitle paths, subtitle text, clicked words, and stream URLs must not be written to diagnostics.
- Subtitle delay resets for unrelated playback targets; font size and vertical position persist as normal user preferences.

### Validation plan

Automated validation will cover the external-subtitle file boundary, safe parsing/limits, source switching, subtitle-delay behavior, preference validation/persistence helpers where practical, and existing regression tests through `npm run check`.

Manual Windows validation must still cover:

- local MKV + embedded subtitle regression;
- drag-and-drop external SRT during playback;
- external ASS/SSA readable/clickable behavior;
- switching embedded ↔ external subtitle source;
- seek/pause/resume with an external subtitle active;
- malformed/unsupported dropped-file failure;
- subtitle delay earlier/later/reset;
- subtitle size adjustment and persistence;
- subtitle vertical-position adjustment and persistence;
- clickable Burmese lookup from an external subtitle;
- one Stremio live-subtitle regression with subtitle controls.

No manual Issue #30 acceptance has been performed yet.

## Later work

Dictionary expansion toward the first 30,000-headword set is continuing separately from application feature work; only completed validated batches should be imported when that work receives its own issue. Removal of the legacy dictionary fallback after structured coverage supersedes it, multi-word/phrasal-verb lookup, pronunciation audio/TTS, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
