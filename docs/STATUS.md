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

**State:** Implementation and manual Windows acceptance are complete. Codex's first final review found two P2 correctness issues; both are fixed with targeted regression coverage. PR #31 is awaiting final exact-head CI and Codex re-review.

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
- External subtitle failures leave playback and the current working subtitle source intact.
- Full dropped subtitle paths, subtitle text, clicked words, and stream URLs are not written to diagnostics.
- Subtitle delay resets for unrelated playback targets; font size and vertical position persist as normal user preferences.

### Validation

Automated validation passed before manual acceptance, including `npm run check`, Windows packaging, install/upgrade regression, and Stremio handoff. CI #224 passed on head `fd3893e48528aa6e1654c86e9e605ef11fe05f52` after the toast auto-dismiss regression fix, and CI #225 passed on the pre-review documentation head `2cdcdebf73180037b331656f25712e832fa45337`.

Manual Windows acceptance passed for:

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
- one Stremio live-subtitle regression with subtitle controls;
- success/error toast auto-dismiss behavior after the regression fix.

Codex's first final review found two P2 issues, both resolved:

- external ASS/SSA no longer assumes English when language is unknown, so non-Latin dialogue remains visible; a non-Latin external ASS regression test was added;
- external subtitle loading now establishes a main-process generation before async validation and enforces latest-request-wins before extraction/state mutation; reversed validation and extraction completion orders are covered by dedicated tests.

CI #230 passed on the P2 implementation head `0de507059446a648e183ee9cb2410d246885bfe6`, including validation and Windows packaging. No remaining manual Issue #30 acceptance item is pending.

## Later work

Dictionary expansion toward the first 30,000-headword set is continuing separately from application feature work; only completed validated batches should be imported when that work receives its own issue. Removal of the legacy dictionary fallback after structured coverage supersedes it, multi-word/phrasal-verb lookup, pronunciation audio/TTS, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
