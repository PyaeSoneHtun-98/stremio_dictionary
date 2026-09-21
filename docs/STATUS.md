# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), subtitle-first player redesign (Issue #26, PR #27), structured offline dictionary pipeline (Issue #28, PR #29), external subtitle/control work (Issue #30, PR #31), finalized 30,000-word Dictionary v1.0 integration (Issue #32, PR #33), one-click Windows installer with managed dependency setup (Issue #34, PR #35), and first stable Windows release (Issue #36, PR #37) are complete.

Stable master capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, drag-and-drop external SRT/ASS/SSA subtitles, subtitle delay/size/position controls, structured offline Burmese lookup, translation settings/cache, and a normal Windows x64 setup executable with Start Menu integration, Installed Apps uninstall support, rollback-safe upgrades, and installer-managed mpv/FFmpeg runtimes.

The production dictionary is the frozen 30,000-headword Dictionary v1.0 plus a 16-entry structured core supplement and a collision-checked compatibility alias layer preserving historical starter-dictionary coverage. PR #33 passed final CI #249 and final Codex review with no remaining P1/P2/P3 findings, then squash merged at `5c0ea8abc32f8b90a1d3ffff6ee10e4e0cc65259`. Issue #32 is closed.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, persisted/exhaustive cleanup targets, and structured diagnostics are stable.

PR #35 completed Issue #34 after successive installer-safety reviews and regression fixes covering install/cache ownership, interrupted and failed rollback recovery, committed-transaction cleanup, concurrent setup serialization, and fail-closed Stremio cleanup. Exact-head CI #327 passed both jobs, Codex reported no remaining P1/P2/P3 findings, and PR #35 squash merged to `master` at `e8927e2097feccb16f72b6a2709e6078e2cd75d0`. Issue #34 is closed.

## Windows v1.0.0 release

Subtitle Bridge **v1.0.0** is published as the first stable Windows release.

Release tag:

`v1.0.0`

Release source commit:

`a89cf5b83f07634027e3d523626176a08751d6ac`

PR #37 passed exact-head CI #332 and final Codex review with no remaining P1/P2/P3 findings before squash merge. The resulting exact-`master` commit passed CI #333, including `validate`, Windows packaging, and the complete packaged install/upgrade/rollback/runtime/Stremio acceptance suite.

The dedicated Release Windows workflow then rebuilt and revalidated that exact successful `master` SHA in a read-only build job, verified the packaged v1.0.0 version and SHA-256 files, handed off a verified release bundle, reverified it in the isolated publish job, and published the GitHub Release.

Published assets:

- `SubtitleBridge-Setup-x64.exe` — recommended normal-user installer
  - SHA-256: `8655d20ee839c6d1d0c324cad021dade919d0d0904a9e5c9704415bd81e6916e`
- `SubtitleBridge-Setup-x64.exe.sha256`
- `SubtitleBridge-win-x64.zip`
  - SHA-256: `d5d201afa82591531b4b441d72683baeb32bc8093b5a364bbcfed2dc050cc7ab`
- `SubtitleBridge-win-x64.zip.sha256`

GitHub's published asset digests match the release-build hashes, and the uploaded checksum-file asset digests match the deterministic checksum-file contents generated for those binaries. Tag `v1.0.0` points directly to the release source commit above.

Issue #36 is closed as completed.

## Phrase auto-detection MVP

Issue #38 / PR #39 are complete.

- Users still click a single subtitle word; Subtitle Bridge automatically checks a bounded nearby-token window for a known multi-word expression before falling back to the existing word dictionary.
- The pilot ships as a separate 12-entry phrase dataset and does not modify the frozen 30,000-headword Dictionary v1.0.
- Longest-match selection, curated inflected forms, phrase-aware cache isolation, bounded IPC validation, and explicit detected-phrase UI are covered by tests.
- Final reviewed feature head: `7ba26f6c0b3d2a3d07c45a4e09662e1aa1bc29cd`.
- Codex final re-review: no remaining P1/P2/P3 findings.
- Exact-head CI #341 passed `validate` and `package-windows`.
- Manual local acceptance passed for canonical, inflected, three-word, fallback, popup, and playback behavior.
- Squash merge commit: `6e1d84d7bb5d30f7b0e5d5630cab1c4390fbfeb8`.
- Master CI #342 passed `validate` and `package-windows`, including packaged install/upgrade/Stremio acceptance.
- Issue #38 is closed as completed.

## Later work

Large-scale phrase/phrasal-verb dataset expansion, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry dataset, macOS packaging, automatic updates, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support remain separate work.
