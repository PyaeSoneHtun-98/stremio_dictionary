# Project status

## Stable master

Current stable `master` commit before the v1.0.2 release branch:

`0abac1ebdd36b2d2a25113f9c9e7324c0021f8fd`

There are currently no open feature/bug PRs ahead of the v1.0.2 release work.

Stable capabilities include:

- local MKV and supported HTTP/HTTPS/Stremio playback through mpv;
- FFmpeg full-track text-subtitle extraction for local MKV files;
- mpv live text subtitles for network streams;
- clickable embedded SRT/ASS/SSA dialogue;
- native external SRT/ASS/SSA picker plus drag-and-drop loading;
- subtitle delay, size, and position controls;
- centered stream buffering/loading feedback that distinguishes manual pause from cache/seek stalls;
- single-click video-surface play/pause and system-aware double-click fullscreen;
- compact launcher with Local video, Stremio, and current-session status;
- frozen 30,000-headword Dictionary v1.0;
- frozen 3,000-entry Phrase Dictionary v1.0.0 with longest-match phrase lookup and single-word fallback;
- offline English → Burmese lookup;
- optional translation settings/cache;
- opt-in reversible Stremio **Play in Subtitle Bridge** compatibility integration;
- Windows x64 setup with Start Menu / Installed Apps integration;
- installer-managed pinned mpv/FFmpeg runtimes;
- rollback-safe upgrades, interrupted-upgrade recovery, ownership checks, and fail-closed Stremio cleanup;
- structured/redacted diagnostics;
- renderer Node integration disabled and context isolation enabled.

Post-merge CI #371 passed on the current stable `master` commit after PR #45.

## Dictionary v1.0

The production word dictionary is the frozen 30,000-headword Dictionary v1.0 plus the structured core supplement and collision-checked compatibility aliases.

PR #33 passed final CI and Codex review before merging. Issue #32 is closed.

## Phrase Dictionary v1.0.0

Issue #38 / PR #39 implemented automatic phrase detection. PR #41 finalized the frozen production phrase corpus.

Production artifact: `src/main/translation/data/phrases.json`

- canonical phrases: **3,000**
- stored phrase forms: **4,827**
- unique lookup keys: **7,827**
- Burmese semantic meanings: **4,092**
- composition: 1,185 phrasal verbs, 935 idioms, 880 expressions
- artifact SHA-256: `951a8bbe54824cf76728393791607798f878a062b19eca63e572278ba8f62926`

The 30,000-headword word dictionary remains unchanged.

## Windows v1.0.0

v1.0.0 was the first stable Windows release.

The release later exposed a real-world installer problem: its runtime manifest referenced a rotating upstream mpv development-build asset that was subsequently removed.

## Windows v1.0.1 runtime hotfix

Issue #42 / PR #43 are complete.

PR #43 replaced the dead rotating mpv dependency with the immutable first-party stable **mpv v0.41.0 x86_64 MSVC** archive and SHA-256:

`4e197f729f5071c6772f35fffd96e0f36e3e8a044bd9479b136bb09b7c6a80ff`

The hotfix also added live public-runtime CI verification and improved setup failure details.

PR #43 was Codex-reviewed with no remaining P1/P2/P3 findings and squash merged at:

`1328fa7b83609b26f1c4e44090abaf6d946ca17b`

Issue #42 is closed.

GitHub Release **v1.0.1** was published from that commit with the normal setup EXE, portable ZIP, and SHA-256 files.

## Player UX refresh

Issue #44 / PR #45 are complete.

The merged work includes:

- real stream buffering feedback for seek/cache stalls;
- manual-pause-safe buffering semantics;
- single-click surface play/pause;
- Windows-system-timed double-click fullscreen;
- primary-pointer filtering and interaction exclusions;
- correct top-chrome hit testing;
- native external subtitle picker with media/generation race protection;
- launcher redesign and current-session summary;
- accessibility fix preventing continuous playback-position live announcements;
- behavioral regression tests for the relevant races and gesture states.

PR #45 passed exact-head CI #370, real Windows manual acceptance, and final Codex review with no remaining P1/P2/P3 findings.

It squash merged at:

`0abac1ebdd36b2d2a25113f9c9e7324c0021f8fd`

Post-merge CI #371 passed. Issue #44 is closed.

## Active work — Windows v1.0.2

Issue #46 is the active release task on:

`release/issue-46-v1.0.2`

v1.0.2 is a release-only change. It packages the already-stable current `master` feature set into a new downloadable Windows release.

Release-branch scope:

- bump package metadata from 1.0.1 to 1.0.2;
- add `docs/releases/v1.0.2.md`;
- update README and STATUS;
- keep runtime/playback/subtitle/dictionary/Stremio semantics unchanged.

Pending release gates:

- exact-head PR CI;
- real Windows setup/upgrade smoke test;
- representative playback, dictionary/phrase, buffering, click/fullscreen, subtitle-picker, and Stremio smoke tests;
- final Codex review with no remaining P1/P2/P3 findings;
- squash merge;
- successful exact-`master` push CI;
- successful Release Windows workflow;
- verification of published v1.0.2 assets and checksums.

## Later work

Separate future issues include automatic updates, macOS packaging, Linux packaging, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, richer ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
