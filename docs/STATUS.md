# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10) and Stremio handoff (Issue #24, PR #25) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable. PR #25 passed CI #149 and manual Windows retesting before merge.

## Active work — Issue #26

**Issue:** Redesign player UI/UX for a modern subtitle-first viewing experience

**Branch:** `feat/issue-26-player-redesign`

**Implementation:** Codex produced the initial redesign. After manual design review, ChatGPT implemented the refinement/fix passes and Codex returned to review-only duty.

**State:** Draft PR #27. Manual Windows acceptance passed on the pre-review head. Codex review found two P2 presentation blockers plus one documentation P2 and one P3 cleanup item. The P2 layout fixes, documentation correction, and regression checks are now implemented. A short targeted Windows recheck and Codex re-review are required before merge. The P3 source cleanup for the legacy popup-position setting is optional unless the re-review promotes it.

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
- Targeted Windows recheck of the review fixes is pending before final Codex re-review.

### Targeted acceptance before final review

1. During playback, let controls hide and reveal them with pointer movement while aiming at a subtitle word. Confirm the subtitle line does not move and the intended word remains clickable.
2. At a small window size (including roughly 640×360), open a translation result/error card and confirm it paints above the control bar and remains interactive.
3. Confirm Settings still does not expose the obsolete popup-position choice; translation remains centered.
4. Reconfirm seek buttons, fullscreen, subtitle clicking, and one Stremio handoff to catch any visual regression.

## Later work

Dictionary expansion, subtitle delay/vertical-position/size controls, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
