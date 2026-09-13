# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10) and Stremio handoff (Issue #24, PR #25) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable. PR #25 passed CI #149 and manual Windows retesting before merge.

## Active work — Issue #26

**Issue:** Redesign player UI/UX for a modern subtitle-first viewing experience

**Branch:** `feat/issue-26-player-redesign`

**Implementer:** Codex, as explicitly assigned by Issue #26

**State:** Implemented; Draft PR and CI followed by manual Windows testing. Do not merge before manual acceptance and final review.

### UX changes

- Compact icon controls over a bottom gradient; title and controls fade after 2.8 seconds of inactivity during playback.
- Pointer movement and keyboard activity reveal controls. Pausing, errors, open panels, word lookup, control hover, slider dragging, and keyboard focus keep them visible. Hidden controls are inert until revealed.
- A stable subtitle safe area above the control bar avoids moving words when controls fade. The selected word uses a soft green highlight; the translation card supports the saved above/below preference with bounded scrolling on small windows.
- Subtitle selection, translation settings, and keyboard help use dismissible panels. Escape/close returns focus to the panel trigger; input/select/button keyboard actions remain isolated from playback shortcuts.
- Play/pause, ±5-second seeking, volume, speed, fullscreen, and file opening remain available. All icon controls have accessible names and tooltips.
- The launcher prioritizes opening a movie and Stremio guidance. Existing playback diagnostics remain available under a collapsed Playback details disclosure.

The native mpv/Electron surface, playback processes, Stremio helpers, IPC, parser, providers, cache, and stored settings architecture are unchanged. The subtitle menu follows the existing main-process rule allowing live HTTP tracks without an FFmpeg index.

### Validation

- `npm run check`: lint, both TypeScript checks, 65 tests, and production build pass.
- Added inactivity-timer regression tests for activity reset, pinned controls, unpin delay, and cleanup.
- Browser renderer smoke tests with a mocked preload bridge passed: hide/reveal, Tab/Enter word selection, popup dismissal, paused track selection, settings, and safe-area geometry at 1280×720 and 640×360. These tests do not validate native mpv or Stremio playback.
- Real Windows local MKV / Stremio playback, native fullscreen/focus, and persistent settings testing for this redesign: **pending user testing**. Prior PR manual results do not validate this new UI.

### Manual acceptance before review

1. Open/drop a local MKV, confirm audio/video, subtitles and seeking; replace it with another file.
2. Let playback controls fade, then reveal them by pointer and keyboard. Pause, drag sliders, open panels and navigate with Tab; controls must stay usable.
3. Click words with automatic pause on/off; verify Burmese results, unknown-word recovery, outside click/Escape dismissal, both popup positions and cache clearing.
4. Pause and switch embedded text tracks. Confirm image/no-subtitle recovery states remain understandable.
5. Test volume, speed, play/pause and fullscreen at normal and minimum window sizes; subtitle lines and the control bar must not overlap.
6. Test Space/K, arrows, F, Tab, Enter/Space on words, and Escape; settings inputs/selects must keep their normal keyboard behavior.
7. Launch through Stremio Play in Subtitle Bridge; confirm live subtitles/lookup and hand off a second stream into the same app.

## Later work

Dictionary expansion, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
