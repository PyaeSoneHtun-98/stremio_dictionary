# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10) and Stremio handoff (Issue #24, PR #25) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable. PR #25 passed CI #149 and manual Windows retesting before merge.

## Active work — Issue #26

**Issue:** Redesign player UI/UX for a modern subtitle-first viewing experience

**Branch:** `feat/issue-26-player-redesign`

**Implementation:** Codex produced the initial redesign. After manual design review, ChatGPT implemented the refinement/fix passes and Codex returned to review-only duty.

**State:** Draft PR #27. Manual Windows acceptance passed on the pre-review head, and the targeted Windows recheck after the review fixes also passed. Codex re-review at `89a9017` confirmed the subtitle-target and popup-stacking P2 findings are resolved and found no new functional P1/P2 regressions. The only remaining P2 was stale validation documentation; this update records the completed recheck. The legacy popup-position renderer plumbing remains a non-blocking P3 cleanup item.

### UX changes

- Compact icon controls over a bottom gradient; title and controls fade after 2.8 seconds of inactivity during playback.
- Pointer movement and keyboard activity reveal controls. Pausing, errors, open panels, word lookup, control hover, slider dragging, and keyboard focus keep them visible. Hidden controls are inert until revealed.
- Clickable subtitles use a cinematic shadow treatment without the heavy rounded background. Their safe-area position stays stationary while controls fade/reveal so pointer targets do not move underneath the user.
- The selected word uses a soft green highlight. Translation lookup is always presented as a centered translucent glass-style card with bounded scrolling on small windows.
- Subtitle selection, translation settings, and keyboard help use dismissible panels. Escape/close returns focus to the panel trigger; input/select/button keyboard actions remain isolated from playback shortcuts.
- Play/pause, icon-only ±5-second seeking, volume, speed, fullscreen, and file opening remain available. Icon controls have accessible names and tooltips.
- The launcher prioritizes opening a movie and Stremio guidance. Existing playback diagnostics remain available under a collapsed Playback details disclosure.

The native mpv/Electron surface, playback processes, Stremio helpers, IPC, parser, providers, cache, and stored settings architecture are unchanged. The subtitle menu follows the existing main-process rule allowing live HTTP tracks without an FFmpeg index.

### Validation

- Before review fixes, `npm run check` passed lint, both TypeScript checks, 65 tests, and the production build; CI #155 also passed.
- Added inactivity-timer regression tests for activity reset, pinned controls, unpin delay, and cleanup.
- Added presentation regression checks that prevent chrome visibility from changing subtitle target geometry and verify the centered popup layer remains above player controls.
- Browser renderer smoke tests with a mocked preload bridge previously passed hide/reveal, Tab/Enter word selection, popup dismissal, paused track selection, settings, and safe-area geometry at 1280×720 and 640×360. These tests do not validate native mpv or Stremio playback.
- Manual Windows acceptance passed for local MKV playback, control behavior, clickable subtitles/translation, subtitle track switching, fullscreen/keyboard interaction, settings, and Stremio one-click/single-instance handoff on the pre-review head.
- CI #162 passed for review head `89a9017`.
- Targeted Windows recheck after the review fixes passed: subtitle words stayed stationary while controls revealed; the centered popup remained above controls and interactive at roughly 640×360; the obsolete popup-position choice stayed hidden; seek, fullscreen, subtitle clicking, and one Stremio handoff all still worked.

### Targeted acceptance completed after review

1. Passed — revealing controls while aiming at a subtitle word did not move the subtitle line, and the intended word remained clickable.
2. Passed — at roughly 640×360, translation cards painted above the control bar and remained interactive.
3. Passed — Settings did not expose the obsolete popup-position choice, and translation remained centered.
4. Passed — seek buttons, fullscreen, subtitle clicking, and one Stremio handoff were reconfirmed without regression.

## Later work

Dictionary expansion, subtitle delay/vertical-position/size controls, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
