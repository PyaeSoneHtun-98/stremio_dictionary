# Project status

## Stable master

Current stable `master`:

`dd61510c6a115417a25e8f4b369731f4c8c19c82`

That commit is the source of the published **Subtitle Bridge v1.0.2** Windows release.

Post-merge CI #375 passed `validate` and `package-windows`, including live mpv/FFmpeg verification and packaged install/upgrade/Stremio acceptance. Release Windows #43 rebuilt and revalidated the exact successful `master` SHA before publishing v1.0.2.

Stable released capabilities include:

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
- structured/redacted diagnostics;
- renderer Node integration disabled and context isolation enabled.

## Windows releases

### v1.0.0

The first stable Windows release. Its setup executable remained intact, but the runtime manifest referenced a rotating upstream mpv development asset that was later removed.

### v1.0.1

Issue #42 / PR #43 replaced that dead runtime dependency with the immutable first-party **mpv v0.41.0 x86_64 MSVC** archive and upstream SHA-256:

`4e197f729f5071c6772f35fffd96e0f36e3e8a044bd9479b136bb09b7c6a80ff`

It also added live public-runtime CI verification and clearer setup failure reporting.

### v1.0.2

Issue #46 / PR #47 packaged the completed player UX refresh and current dictionaries into the public release.

Release source:

`dd61510c6a115417a25e8f4b369731f4c8c19c82`

The v1.0.2 release includes the launcher redesign, stream buffering feedback, single-click play/pause, system-aware double-click fullscreen, native external subtitle picker, Phrase Dictionary v1.0.0, and the v1.0.1 runtime hotfix.

A real v1.0.1 → v1.0.2 Windows upgrade exposed and fixed a stale hardcoded launcher version badge before release. A regression test now requires renderer app metadata to match `package.json`.

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

## Active work — secure in-app updates

Issue #48 / Draft PR #49 are active on:

`feat/issue-48-auto-update`

The updater is intentionally built around the existing GitHub Release + setup EXE pipeline rather than `electron-updater`.

Implemented scope:

- delayed startup and six-hour periodic stable-release checks;
- fixed trust root: `PyaeSoneHtun-98/stremio_dictionary`;
- stable semantic-version comparison;
- fail-closed draft/prerelease/incomplete release metadata handling;
- exact required assets:
  - `SubtitleBridge-Setup-x64.exe`
  - `SubtitleBridge-Setup-x64.exe.sha256`;
- bounded HTTPS requests restricted to approved GitHub hosts;
- strict SHA-256 checksum parsing;
- app-owned temporary/atomic installer download;
- checksum verification after download;
- installer re-hash immediately before launch;
- explicit **Download update** and **Install and restart** actions;
- installation blocked while media is loading, playing, or paused;
- narrow preload/IPC surface with all network/filesystem/process operations kept in the main process;
- non-fatal retryable update errors;
- behavioral tests for release policy, version comparison, hash mismatch, playback blocking, verified launch, and post-download tampering.

CI #378 passed the implementation before the final documentation/policy tightening pass, including validation, Windows packaging, runtime verification, packaged install/upgrade/Stremio acceptance, and artifact upload.

Pending gates:

- final exact-head CI after documentation/policy tightening;
- real Windows smoke test:
  - normal startup;
  - official v1.0.2 check reports up-to-date;
  - retry/error UI does not affect normal use;
  - local/Stremio playback remains unaffected;
- final Codex review with no remaining P1/P2/P3 findings;
- squash merge and confirmation that Issue #48 closes.

A real live **newer-version download/install** cannot be exercised against the official latest-release endpoint until a release newer than the installed app exists. The newer-release path is therefore covered now by deterministic behavioral tests; the official live path can be exercised on the next public version after this updater lands.

## Later work

Separate future issues include macOS packaging, Linux packaging, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, richer ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
