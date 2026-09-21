# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), subtitle-first player redesign (Issue #26, PR #27), structured offline dictionary pipeline (Issue #28, PR #29), external subtitle/control work (Issue #30, PR #31), and finalized 30,000-word Dictionary v1.0 integration (Issue #32, PR #33) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, drag-and-drop external SRT/ASS/SSA subtitles, subtitle delay/size/position controls, structured offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer.

The production dictionary is the frozen 30,000-headword Dictionary v1.0 plus a 16-entry structured core supplement and a collision-checked compatibility alias layer preserving historical starter-dictionary coverage. PR #33 passed final CI #249 and final Codex review with no remaining P1/P2/P3 findings, then squash merged at `5c0ea8abc32f8b90a1d3ffff6ee10e4e0cc65259`. Issue #32 is closed.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable.

## Active work — Issue #34

**Issue:** Create a one-click Windows installer with dependency setup

**Branch:** `feat/issue-34-windows-installer`

**State:** Issue defined and branch created from current stable master. Installer/dependency architecture research and implementation are next.

### User-facing goal

Replace the current developer-oriented ZIP + PowerShell flow with a normal Windows install:

```text
Download SubtitleBridge-Setup-x64.exe
→ double-click
→ install
→ launch
```

A normal user should not need Git, Node/npm, PowerShell commands, the source repository, manual PATH editing, or separate manual mpv/FFmpeg setup.

### Issue #34 goals

- produce one normal Windows x64 setup executable;
- install per-user with Start Menu and Windows uninstall integration;
- support safe upgrades while preserving user settings;
- choose and document a secure, reproducible mpv/FFmpeg acquisition/distribution strategy;
- remove the need for manual `MPV_PATH`, `FFMPEG_PATH`, or PATH configuration in a normal install;
- prefer installer-managed app-local runtime dependencies while preserving useful developer overrides;
- provide clear dependency-readiness/recovery behavior;
- expose Stremio enable/disable through an installer or app-facing action rather than a terminal command;
- keep Stremio integration opt-in, reversible, idempotent, atomic, and fail-closed;
- keep the frozen 30k dictionary included and verified;
- add Windows installer CI and manual clean-install/upgrade acceptance testing.

### Important constraints

- Do not redistribute unknown mpv/FFmpeg builds.
- Pin runtime versions/sources and verify downloaded/distributed artifacts.
- Include required third-party license/provenance information.
- Installer/upgrade failures must not destroy a previously working installation.
- Renderer Node integration remains disabled and context isolation remains enabled.
- Existing playback, subtitle, dictionary, diagnostics/privacy, and launch-target safety behavior must remain intact.

## Later work

Multi-word/phrasal-verb lookup, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry dataset, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support remain separate work.
