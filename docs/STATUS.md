# Project status

## Stable master

Current `master` before the v1.0.3 release branch:

`e138a55aee5859ace0749878c1f1db7bc42ccfad`

PR #49 / Issue #48 added secure in-app Windows update support to `master`.

Post-merge CI #393 passed on that exact commit, including `validate`, Windows packaging, live mpv/FFmpeg verification, packaged install/upgrade acceptance, custom-directory installer behavior, Stremio acceptance, and artifact upload.

Release Windows #61 correctly detected that the package version was still 1.0.2 and did not republish or overwrite the existing v1.0.2 GitHub Release.

Current stable capabilities on `master` include:

- local MKV and supported HTTP/HTTPS/Stremio playback through mpv;
- FFmpeg full-track text-subtitle extraction for local MKV files;
- mpv live text subtitles for network streams;
- clickable embedded SRT/ASS/SSA dialogue;
- native external SRT/ASS/SSA picker plus drag-and-drop loading;
- subtitle delay, size, and position controls;
- centered stream buffering/loading feedback that distinguishes manual pause from cache/seek stalls;
- single-click video-surface play/pause and Windows-system-aware double-click fullscreen;
- compact launcher with Local video, Stremio, and current-session status;
- frozen 30,000-headword Dictionary v1.0;
- frozen 3,000-entry Phrase Dictionary v1.0.0 with longest-match phrase lookup and single-word fallback;
- offline English → Burmese lookup;
- optional translation settings/cache;
- opt-in reversible Stremio **Play in Subtitle Bridge** compatibility integration;
- Windows x64 setup with Start Menu / Installed Apps integration;
- installer-managed pinned mpv/FFmpeg runtimes;
- rollback-safe upgrades, interrupted-upgrade recovery, ownership checks, and fail-closed Stremio cleanup;
- secure user-approved GitHub Release update checking and download;
- SHA-256 verification after update download and again immediately before installer launch;
- canonical stable-version/release-tag validation;
- custom install-directory preservation during in-app updates;
- active-playback installation blocking;
- non-fatal offline/retry update behavior;
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

v1.0.2 includes the launcher redesign, stream buffering feedback, single-click play/pause, system-aware double-click fullscreen, native external subtitle picker, Phrase Dictionary v1.0.0, and the v1.0.1 runtime hotfix.

Public v1.0.2 does **not** contain the in-app updater.

## Secure in-app updater

Issue #48 / PR #49 are complete.

Merged source:

`e138a55aee5859ace0749878c1f1db7bc42ccfad`

The updater:

- checks the fixed official repository for stable releases;
- requires exact canonical `vX.Y.Z` tags;
- rejects drafts, prereleases, malformed/noncanonical versions, older versions, and equal versions;
- requires exact setup EXE + SHA-256 assets;
- restricts update network traffic to approved HTTPS GitHub hosts with request/redirect/size bounds;
- downloads to app-owned update storage;
- verifies SHA-256 after download;
- re-hashes immediately before installation;
- exposes only narrow updater state/actions through preload/IPC;
- never gives the renderer arbitrary URL/path/filesystem/process capability;
- blocks installation while media is loading, playing, or paused;
- derives the install target from the running executable and forwards it through `SUBTITLE_BRIDGE_INSTALL_DIR`;
- keeps update failures non-fatal and retryable.

Real Windows smoke testing confirmed the live official v1.0.2 up-to-date path, offline/retry behavior, and no playback/Stremio/dictionary regression.

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

## Active work — Windows v1.0.3

Issue #50 is the active release task on:

`release/issue-50-v1.0.3`

v1.0.3 is intended to be a release-only change that publishes the already-reviewed updater and current stable `master` behavior.

Release-branch scope:

- bump package/app metadata from 1.0.2 to 1.0.3;
- add `docs/releases/v1.0.3.md`;
- update README and STATUS;
- keep updater/playback/subtitle/dictionary/runtime/Stremio behavior unchanged unless a release-blocking defect is found.

Pending release gates:

- exact-head PR CI;
- real Windows public-v1.0.2 → v1.0.3 manual installer upgrade smoke test;
- final Codex review with no remaining P1/P2/P3 findings;
- squash merge;
- successful exact-`master` push CI;
- successful Release Windows publication of v1.0.3;
- verification of published installer/ZIP/checksum assets;
- first real official end-to-end in-app update from an updater-enabled v1.0.2 feature build to published v1.0.3.

## Later work

Separate future issues include macOS packaging, Linux packaging, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, richer ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
