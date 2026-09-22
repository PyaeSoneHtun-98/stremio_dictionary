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

## Windows v1.0.1 installer hotfix

Issue #42 is in progress after a real-world v1.0.0 setup failure exposed a dead mpv runtime URL.

The v1.0.0 installer itself matches its published checksum, but its runtime manifest pinned mpv to the rotating upstream `git-release` prerelease. Upstream replaced that development-build asset, so fresh v1.0.0 installs can fail with HTTP 404 during mpv provisioning.

The hotfix branch:

- bumps Subtitle Bridge to **v1.0.1**;
- pins mpv to the immutable first-party stable `v0.41.0` x86_64 MinGW ZIP;
- verifies upstream SHA-256 `a49811c0752c108b8260636f9c6f6fcb97406641c98b30f1e7b500dfb20177de`;
- rejects the rotating `/git-release/` mpv URL in tests;
- improves GUI setup failure details so runtime-source outages are not presented only as an internet problem;
- keeps the existing FFmpeg pin, whose exact dated release asset and digest remain valid.

The v1.0.1 installer must pass exact-head CI and a real manual install before this hotfix is merged and automatically published.

## Phrase Dictionary v1.0.0

The phrase auto-detection engine from Issue #38 / PR #39 is complete and the production phrase corpus is now the frozen **Phrase Dictionary v1.0.0** from `PyaeSoneHtun-98/dictionary-dataset`.

- Users still click a single subtitle word; Subtitle Bridge checks the bounded current-cue token window for the longest known phrase containing that click before falling back to the existing word dictionary.
- Production phrase artifact: `src/main/translation/data/phrases.json`.
- Frozen dataset finalization commit: `aa6b3a4ebe55e38307e56bc40323327998e4cb32`.
- Artifact SHA-256: `951a8bbe54824cf76728393791607798f878a062b19eca63e572278ba8f62926`.
- Canonical phrases: **3,000**.
- Stored phrase forms: **4,827**.
- Unique phrase lookup keys: **7,827**.
- Burmese semantic meanings: **4,092**.
- Dataset composition: 1,185 phrasal verbs, 935 idioms, and 880 expressions.
- Two editorial QA passes replaced 96 low-value/artificial/incomplete entries before the dataset was frozen.
- The frozen 30,000-headword single-word Dictionary v1.0 remains unchanged.
- Phrase data is limited to contiguous 2–5-token surface strings for the current matcher.
- The app verifies the exact production phrase artifact SHA/counts during `npm run check`.

## Later work

Further phrase coverage beyond Phrase Dictionary v1, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, macOS packaging, automatic updates, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support remain separate work.
