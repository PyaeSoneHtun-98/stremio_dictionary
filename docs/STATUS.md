# Project status

## Stable master

Current stable `master`:

`efa3c4119361a748f8175b922c21244bf18be3fd`

Public release: **v1.0.6**, source `9c86f734c719cf0bacc1c15c510f0ea958813167`.

v1.0.6 fixed the real in-app updater install-directory lock. The affected Windows PC then completed the real **v1.0.5 → v1.0.6 in-app update successfully**, confirming the published hotfix outside CI.

PR #64 / Issue #63 subsequently changed missing/unsupported/subtitle-error recovery text into a four-second notice while keeping active subtitle loading status persistent. PR CI #506 and merged-master CI #507 passed, and the MP4 manual acceptance test passed.

Issue #65 / PR #66 completed the updater post-review hardening: physical path resolution, real Windows junction regression coverage, updater spawn-option tests, and subtitle notice timer lifecycle tests. Exact-head PR CI and merged-master CI passed.

Issue #67 / PR #68 fixed player subtitle positioning so the shared interactive subtitle overlay stays raised above visible controls and moves toward the bottom after chrome hides. A real Stremio-stream development test passed, Codex reported no P1/P2/P3 findings, and merged-master CI #514 passed.

Current stable capabilities include:

- local MKV/MP4 and supported HTTP/HTTPS/Stremio playback through mpv;
- FFmpeg full-track text-subtitle extraction for local MKV files;
- mpv live text subtitles for network streams;
- clickable embedded SRT/ASS/SSA dialogue;
- native external SRT/ASS/SSA picker plus drag-and-drop loading;
- subtitle delay, size, and position controls, including G/H 0.1-second delay shortcuts with temporary on-screen feedback;
- dynamic subtitle positioning that moves lower when player controls hide while preserving the saved vertical offset;
- temporary recovery notices for missing/unsupported/error subtitle states;
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
- updater/setup working-directory isolation from the installed application tree;
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

### v1.0.5

PR #59 published the completed PR #58 playback and Stremio integration work.

Published source:

`74cc355264f1b7898dbb70199b94496fe61763a9`

Official setup SHA-256:

`645d8da8a3445a4d9e5dda11272650c65cd929566e07d4582e89d33820c0f3b3`

The affected PC reproduced an install-directory lock during the real in-app update, leading to Issue #60 / PR #61.

### v1.0.6

PR #62 published the Issue #60 / PR #61 updater working-directory hotfix.

Published source:

`9c86f734c719cf0bacc1c15c510f0ea958813167`

Official setup SHA-256:

`2c3236da4162d3c3fa4c80835416e64337013b4d0a6c69ac73b14c2d67cb83ed`

Official ZIP SHA-256:

`7225d8e5889f2e0e00262ada206954560ed572c83629188b88600799db7d786e`

Release Windows #173 passed. The real affected PC then completed the official **v1.0.5 → v1.0.6** in-app update successfully.

## Updater shutdown-race fix

PR #54 is merged to master, and the later v1.0.6 working-directory hotfix completed the real affected-PC updater acceptance.

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

The real official in-app update acceptance passed on v1.0.6.

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

## Completed — Issue #69 audio track selector

Branch:

`feat/issue-69-audio-track-selector`

Merged PR:

`#70`

Scope:

- use the existing mpv `track-list` audio metadata already present in `PlaybackSnapshot.tracks`;
- add a narrow `selectAudioTrack` media IPC/preload API;
- validate that requested IDs belong to a current audio track;
- switch mpv's `aid` property without requiring playback to pause;
- consolidate subtitle source selection, external subtitle loading, delay, size, and vertical position into the bottom CC/Tracks panel;
- remove the separate top-right Subtitles button while preserving drag/drop subtitle loading;
- add Audio below the subtitle controls in that same CC/Tracks panel;
- move playback speed from the bottom bar into the gear/Settings panel as a simple option list;
- support local MKV/MP4 and HTTP/HTTPS/Stremio playback through the shared mpv path;
- preserve subtitle extraction, timing, translation, and external-subtitle behavior;
- hide the unverified Google Translate UI for v1.0.7 and enforce Offline dictionary → Burmese as the effective main-process runtime translation scope.

Validation status:

- Windows manual acceptance passed on reviewed head `b4e0209d6ede0af6e386ee2afcad09e0773d5105`, including the current player UI and representative multi-audio switching;
- CI #571 passed `validate` and `package-windows` on that reviewed head;
- Codex reviewed that exact head with no P1/P2 findings and three P3 findings: failed hidden-Google migration could leave Google active, dropdown clipping inside the scrollable player panel, and repeated subtitle-preference steps could lose increments;
- those three P3s were resolved at head `99195f83037d3b6dadb112c1e6fdb22b56b8f2b9`; CI #578 passed and the follow-up Codex review cleared the merge gate;
- PR #70 is merged to master. Public v1.0.7 has not been released.

## Active work — Issue #73 FFmpeg download availability

Owner assigned implementation to Codex on 2026-10-06. Branch: `codex/issue-73-ffmpeg-runtime`.

- The September 20 FFmpeg daily-build pin expired under BtbN's last-14-build retention policy;
  CI #582–#586 failed the live runtime gate with HTTP 404.
- The replacement pin is the September 30 month-end LGPL shared 8.1 build, retained upstream
  for two years. Its downloaded hash matches upstream checksums and release asset metadata.
- Installer transaction, cache ownership/hash verification, mpv pin, and playback logic remain
  unchanged. Old setup executables still contain their old manifests.
- Live Windows verification now exercises cold download, shared DLL execution, synthetic
  embedded SRT/ASS extraction, cached provisioning with unavailable URLs, and rejection/cleanup
  of corrupt cached/downloaded bytes. All passed locally on Windows.
- `npm run check` passed all 214 tests/build; `npm run package:win` produced the ZIP and setup.
- Codex reviewed implementation head `1d9c4e729ba2705b246cd415a1de3decf310bc06` with no
  unresolved P1/P2/P3 findings. [PR #74](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/74)
  records the current exact-head CI and owner real-media acceptance results and remaining gates.
- See [RUNTIME_DEPENDENCIES.md](RUNTIME_DEPENDENCIES.md) for provenance, renewal deadline,
  and old-installer limitations.

## Pending separately — Issue #71 dictionary reports / Draft PR #72

The opt-in report feature and separate reporting service remain on their own branches. The owner
confirmed a successful real-app report after restarting the development app. The current report
card moves the icon to its bottom-right footer; final real-app layout acceptance is pending.
PR #72's latest CI #586 passed validation but failed packaging at the FFmpeg URL tracked in
Issue #73. Merge remains pending green required CI and the documented acceptance gates.

## Later work

Separate future issues include macOS packaging, Linux packaging, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, richer ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
