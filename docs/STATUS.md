# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), subtitle-first player redesign (Issue #26, PR #27), structured offline dictionary pipeline (Issue #28, PR #29), external subtitle/control work (Issue #30, PR #31), finalized 30,000-word Dictionary v1.0 integration (Issue #32, PR #33), and one-click Windows installer with managed dependency setup (Issue #34, PR #35) are merged.

Stable master capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, drag-and-drop external SRT/ASS/SSA subtitles, subtitle delay/size/position controls, structured offline Burmese lookup, translation settings/cache, and a normal Windows x64 setup executable with Start Menu integration, Installed Apps uninstall support, rollback-safe upgrades, and installer-managed mpv/FFmpeg runtimes.

The production dictionary is the frozen 30,000-headword Dictionary v1.0 plus a 16-entry structured core supplement and a collision-checked compatibility alias layer preserving historical starter-dictionary coverage. PR #33 passed final CI #249 and final Codex review with no remaining P1/P2/P3 findings, then squash merged at `5c0ea8abc32f8b90a1d3ffff6ee10e4e0cc65259`. Issue #32 is closed.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, persisted/exhaustive cleanup targets, and structured diagnostics are stable.

PR #35 completed Issue #34 after successive installer-safety reviews and regression fixes covering install/cache ownership, interrupted and failed rollback recovery, committed-transaction cleanup, concurrent setup serialization, and fail-closed Stremio cleanup. Exact-head CI #327 passed both jobs, Codex reported no remaining P1/P2/P3 findings, and PR #35 squash merged to `master` at `e8927e2097feccb16f72b6a2709e6078e2cd75d0`. Issue #34 is closed.

## Active work — Issue #36

**Issue:** Publish Subtitle Bridge Windows v1.0.0

**Branch:** `release/v1.0.0`

**State:** Release preparation is in progress. The app/package version is being promoted to 1.0.0, public-facing installation documentation is being refreshed, v1.0.0 release notes are being added, and a release workflow is being introduced so a successful exact-`master` CI run can publish the verified Windows setup/portable artifacts automatically.

### Release goal

Publish the first stable Windows release as `v1.0.0`, with `SubtitleBridge-Setup-x64.exe` as the recommended normal-user download and its SHA-256 checksum attached to the GitHub Release.

The release must come from the exact successful `master` CI head and must not be published from a pull-request run or failed workflow.

## Later work

Multi-word/phrasal-verb lookup, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry dataset, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support remain separate work.
