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
**State:** Draft; implementation and manual testing are complete enough for Codex review after current CI/docs validation.

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

### Remaining gate for PR #25

1. Ensure the latest CI is green after documentation/helper changes.
2. Send the current PR head to Codex for final review.
3. Fix any P1/P2 blockers and re-review if necessary.
4. Mark the PR ready only after Codex says no P1/P2 blockers remain.
5. Verify final head + CI and squash merge.
6. Confirm Issue #24 closes.

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
