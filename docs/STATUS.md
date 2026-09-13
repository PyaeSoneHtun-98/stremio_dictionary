# Project status

This file is the short living summary of Subtitle Bridge development. Update it when a feature is merged or when the active issue changes materially.

## Stable `master`

The standalone Windows MVP roadmap is complete through Issues #1–#10.

Stable capabilities on `master` include:

- Electron + React + TypeScript Windows desktop application
- mpv video/audio playback
- local MKV opening and player controls
- embedded text subtitle extraction/normalization
- synchronized clickable subtitle overlay
- SRT/SubRip, ASS, and SSA text subtitle support
- subtitle-track selection
- defensive filtering for malformed/drawing/effect-heavy ASS content
- offline English → Burmese dictionary translation
- translation cache/settings and protected optional provider credentials
- packaged Windows x64 portable build/current-user installer
- privacy-conscious rotating diagnostics and memory sampling

Release artifacts intentionally do not bundle mpv or FFmpeg; they are external runtime dependencies.

## Active work

**Issue #24:** Add Stremio external-player handoff MVP on Windows  
**PR #25:** Add Stremio external-player handoff MVP  
**Branch:** `feat/issue-24-stremio-handoff`  
**State:** Draft; manual feature testing passed. The first Codex review found four merge blockers; fixes are on the branch and require green CI plus Codex re-review before merge.

### Verified manually for Issue #24

- Direct Stremio local stream URL opens in Subtitle Bridge.
- Video/audio playback works from Stremio's `127.0.0.1:11470` stream.
- Embedded text subtitle tracks are detected.
- Network subtitles appear live instead of waiting for FFmpeg full-stream extraction.
- Live subtitles are synchronized.
- Subtitle words are clickable.
- Burmese lookup works during Stremio playback.
- Embedded subtitle-track switching works while paused.
- The Stremio compatibility helper adds `Play in Subtitle Bridge` to the in-player external-device menu after restart.
- One-click `Play in Subtitle Bridge` handoff was manually tested successfully.

### Important implementation decisions in PR #25

- Local MKV files keep the existing FFmpeg full-track subtitle extraction path.
- HTTP/HTTPS streams use mpv live subtitle text/timing.
- mpv's own subtitle rendering remains hidden while the React overlay displays interactive text.
- The tested Stremio 6 beta Settings UI exposes only `Disabled` and `M3U Playlist` under external-player settings; the integration therefore targets Stremio's verified in-player external-device mechanism instead.
- The Stremio integration is an opt-in reversible local compatibility patch, not native upstream Stremio support.
- Media-open requests are serialized before reaching the playback controller so simultaneous external launches cannot race multiple mpv startups against the same IPC pipe.
- Raw mpv file logging is intentionally disabled because mpv can write complete private Stremio stream URLs to such logs; Subtitle Bridge uses only its structured/redacted diagnostics.
- Stremio patch enable/disable validates a specific external-player discovery structure and patch-marker integrity before writing.
- Stremio patch writes use a verified temporary file plus atomic replacement. Existing safety backups are preserved instead of overwritten.

### Codex review findings being addressed

The first final review reported:

1. P1 — raw mpv diagnostics could persist full Stremio URLs.
2. P2 — concurrent launch requests could race multiple mpv processes against one named pipe.
3. P2 — Stremio layout validation was too weak.
4. P2 — enable/disable writes were non-atomic and backup handling could destroy the useful recovery copy.

The current branch includes fixes for all four findings plus CI coverage for stronger Stremio layout validation, malformed-marker refusal, idempotency, exact disable restoration, and backup preservation. These fixes are not considered merge-ready until the latest CI is green and Codex confirms that no P1/P2 blockers remain.

### Remaining gate for PR #25

1. Ensure the latest CI is green after the review fixes.
2. Re-run the affected Stremio manual smoke test if the packaged helper behavior changed materially.
3. Send the current PR head back to Codex for re-review of the four findings.
4. Fix any remaining P1/P2 blockers and repeat affected validation as needed.
5. Mark the PR ready only after Codex says no P1/P2 blockers remain.
6. Verify final head + CI and squash merge.
7. Confirm Issue #24 closes.

## Next planned issue

**Player UI/UX redesign** — create only after PR #25 is merged.

The current player UI is functionally complete but visually and ergonomically MVP-quality. Known UX problems include controls that occupy too much video space, text-heavy controls, subtitle/control overlap risk, and insufficient auto-hide/visual hierarchy.

For this one issue, Codex is planned to be the primary implementer. The issue/prompt should define the UX problems, functional constraints, and acceptance criteria while deliberately leaving room for Codex to choose the visual design and interaction details.

The redesign must preserve playback, subtitle interaction, translation, keyboard behavior, and Stremio functionality unless the issue explicitly changes them.

## Later work / known limitations

Not yet scheduled as part of the current issue:

- larger English → Burmese dictionary dataset
- external Stremio subtitle-addon URL ingestion
- watched/progress synchronization back to Stremio
- native/upstream `Subtitle Bridge` Stremio external-player support
- rich ASS/SSA visual fidelity with clickable styled/positioned text
- self-contained redistribution strategy for properly licensed/pinned mpv and FFmpeg builds
- broader Windows environment acceptance beyond the currently tested setup
