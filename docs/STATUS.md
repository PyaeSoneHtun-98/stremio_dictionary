# Project status

## Stable master

Current stable `master`:

`cbd1c8bd21edc20844137d9cff6e4b098e6545b4`

PR #58 is merged on top of the public v1.0.4 release source, adding the local MP4, subtitle-delay shortcut, launcher/player polish, and Stremio handoff reliability work planned for v1.0.5.

PR #58 passed final review with no remaining P1/P2/P3 findings. Its merged master commit `cbd1c8bd21edc20844137d9cff6e4b098e6545b4` passed CI #498, including project validation, Windows packaging, packaged install/upgrade coverage, runtime checks, and Stremio regressions. The full manual regression set was also completed successfully before this release.

Issue #52 remains open intentionally until the real affected/test Windows PC completes an official in-app update to the now-published v1.0.4 successfully.

Current stable capabilities include:

- local MKV/MP4 and supported HTTP/HTTPS/Stremio playback through mpv;
- FFmpeg full-track text-subtitle extraction for local MKV files;
- mpv live text subtitles for network streams;
- clickable embedded SRT/ASS/SSA dialogue;
- native external SRT/ASS/SSA picker plus drag-and-drop loading;
- subtitle delay, size, and position controls, including G/H 0.1-second delay shortcuts with temporary on-screen feedback;
- centered stream buffering/loading feedback that distinguishes manual pause from cache/seek stalls;
- single-click video-surface play/pause and Windows-system-aware double-click fullscreen;
- compact launcher with Local video, Stremio, and current-session status;
- frozen 30,000-headword Dictionary v1.0;
- frozen 3,000-entry Phrase Dictionary v1.0.0 with longest-match phrase lookup and single-word fallback;
- offline English → Burmese lookup;
- optional translation settings/cache;
- opt-in reversible Stremio **Play in Subtitle Bridge** compatibility integration with verified enabled/disabled/repair status and fail-closed recovery;
- Windows x64 setup with Start Menu / Installed Apps integration;
- installer-managed pinned mpv/FFmpeg runtimes;
- rollback-safe upgrades, interrupted-upgrade recovery, ownership checks, and fail-closed Stremio cleanup;
- secure user-approved GitHub Release update checking and download;
- SHA-256 verification after update download and again immediately before installer launch;
- canonical stable-version/release-tag validation;
- custom install-directory preservation during in-app updates;
- active-playback installation blocking;
- non-fatal offline/retry update behavior;
- verified updater-parent handoff using PID + executable path + process start time;
- backward-compatible installer shutdown grace for older updater builds;
- recycled-PID protection;
- PID-specific fallback for missing CIM executable paths;
- limited-access process-image lookup plus SID-based cross-user handling;
- exact-standard-path and full-ancestor reparse-point checks before any cross-user exclusion;
- bounded atomic same-volume install-directory move retry for transient locks;
- structured/redacted diagnostics;
- renderer Node integration disabled and context isolation enabled.

## Windows releases

### v1.0.0

The first stable Windows release. Its setup executable later encountered a removed rotating upstream mpv development asset.

### v1.0.1

Issue #42 / PR #43 replaced the dead runtime dependency with immutable first-party stable **mpv v0.41.0 x86_64 MSVC** and added live runtime CI verification plus clearer setup failures.

### v1.0.2

Issue #46 / PR #47 packaged the completed player UX refresh and current dictionaries into the public release.

Published source:

`dd61510c6a115417a25e8f4b369731f4c8c19c82`

Public v1.0.2 does not contain the in-app updater.

### v1.0.3

Issue #50 / PR #51 published the secure in-app updater.

Published source:

`34662c9fea0f68317df7e08f83f8e26402496abf`

Official setup SHA-256:

`11908f8a962f90811bb31bf095b9367cd4177601e6cf86c6e24e50250dceeead`

Official ZIP SHA-256:

`5ff9449706b787ecf6d59bbc209ab04806d3a1f4324d19965a665e86d4b2eeaa`

The real official updater flow to v1.0.3 succeeded twice on one Windows PC. A second PC reached installer launch but failed because the existing install directory was still in use; that failure became Issue #52 and is fixed on current master.

### v1.0.4

Issue #55 / PR #56 published the updater shutdown-race fix.

Published source:

`6e41fb125be3984a80fb1f3178409801d72357ae`

Official setup SHA-256:

`bfb7f286950289166fb87a044f2b2adc312eae1798cd58eb05d1fbdc87f956c2`

Official ZIP SHA-256:

`deb5cd07c69765f0ae5bccffd2abaced45134140e713a94b7e8d818957bf715a`

Exact merged master CI #414 and Release Windows #82 passed. Issue #52 remains open only for the real affected/test-PC in-app updater acceptance.

## Updater shutdown-race fix

PR #54 is merged to master. Issue #52 remains open until the real affected/test PC completes the published fixed updater flow.

The fix:

- passes PID + executable path + process start time from newer updater builds;
- verifies process identity before waiting so recycled PIDs are ignored;
- remains compatible with older updater builds that pass no parent identity;
- gives the installed app a bounded shutdown grace period;
- falls back per-process when CIM omits `ExecutablePath`;
- uses `PROCESS_QUERY_LIMITED_INFORMATION` / `QueryFullProcessImageName` when possible;
- compares Windows owners by SID;
- permits cross-user exclusion only for the exact standard per-user executable path;
- walks every path ancestor through the volume root and fails closed on reparse points;
- uses bounded `System.IO.Directory.Move` retries for transient locks without partial PowerShell `Move-Item` backups;
- preserves rollback/recovery, ownership, custom-directory, updater trust, runtime, and Stremio invariants.

The remaining acceptance gate is a real official in-app update using the published fixed installer.

## Dictionary v1.0

The production word dictionary remains the frozen 30,000-headword Dictionary v1.0 plus the structured core supplement and collision-checked compatibility aliases.

## Phrase Dictionary v1.0.0

Production artifact: `src/main/translation/data/phrases.json`

- canonical phrases: **3,000**
- stored phrase forms: **4,827**
- unique lookup keys: **7,827**
- Burmese semantic meanings: **4,092**
- composition: 1,185 phrasal verbs, 935 idioms, 880 expressions
- artifact SHA-256: `951a8bbe54824cf76728393791607798f878a062b19eca63e572278ba8f62926`

Phrase matching remains longest-match-first for contiguous 2–5-token expressions inside the current cue, with normal single-word fallback.

## Active work — Windows v1.0.5

Release branch:

`release/v1.0.5`

v1.0.5 packages the completed PR #58 feature/reliability work on top of v1.0.4.

Release scope:

- local MP4 playback through the existing mpv path;
- external SRT/ASS/SSA picker and drag/drop support during MP4 playback;
- G/H subtitle-delay shortcuts in 0.1-second steps with shared timing state and on-screen feedback;
- compact launcher and cleaner player-close/error behavior;
- Stremio handoff status inspection, repair guidance, and safer fail-closed enable/disable cleanup;
- no dictionary, phrase dataset, updater trust-policy, runtime-source, or installer security weakening.

Completed gates before release preparation:

- PR #58 final review reported no remaining P1/P2/P3 findings;
- merged master CI #498 passed at `cbd1c8bd21edc20844137d9cff6e4b098e6545b4`;
- local MP4 + external SRT/ASS/SSA playback acceptance passed;
- subtitle picker/drag-drop, clickable word/phrase lookup, and G/H timing acceptance passed;
- local MKV embedded-subtitle regression passed;
- Stremio/network playback regression passed;
- playback close/failure messaging checks passed;
- packaged and development-mode Stremio status/action checks passed.

Remaining release gates:

- exact-head v1.0.5 release-PR CI;
- merge the release-only version/documentation PR;
- successful exact-`master` CI;
- successful Release Windows publication of v1.0.5;
- verify the published EXE/ZIP/checksum assets.

## Later work

Separate future issues include macOS packaging, Linux packaging, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, richer ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
