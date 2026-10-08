# Project status

## Stable master

Current stable `master`:

`2700484b4e85c8f42f0f749f2f7cc18a6b06731c`

Public release: **v1.0.6**, source `9c86f734c719cf0bacc1c15c510f0ea958813167`.

v1.0.6 fixed the real in-app updater install-directory lock. The affected Windows PC then completed the real **v1.0.5 → v1.0.6 in-app update successfully**, confirming the published hotfix outside CI.

PR #64 / Issue #63 subsequently changed missing/unsupported/subtitle-error recovery text into a four-second notice while keeping active subtitle loading status persistent. PR CI #506 and merged-master CI #507 passed, and the MP4 manual acceptance test passed.

Issue #65 / PR #66 completed the updater post-review hardening: physical path resolution, real Windows junction regression coverage, updater spawn-option tests, and subtitle notice timer lifecycle tests. Exact-head PR CI and merged-master CI passed.

Issue #67 / PR #68 fixed player subtitle positioning so the shared interactive subtitle overlay stays raised above visible controls and moves toward the bottom after chrome hides. A real Stremio-stream development test passed, Codex reported no P1/P2/P3 findings, and merged-master CI #514 passed.

Issue #69 / PR #70 squash-merged as `efa3c4119361a748f8175b922c21244bf18be3fd`. It adds the shared audio selector
and consolidated player panels, and enforces Offline dictionary → Burmese for v1.0.7. Windows manual
acceptance passed on `b4e0209d6ede0af6e386ee2afcad09e0773d5105`; its three P3 review findings were
resolved on `99195f83037d3b6dadb112c1e6fdb22b56b8f2b9`, which passed CI #578 and follow-up review
with no unresolved P1/P2/P3. Issue #69 is closed/completed. Dormant Google backend support remains.

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
- frozen 30,000-headword Dictionary v1.0 plus a pinned 10,000-entry extension and targeted app
  corrections: 40,011 unique runtime headwords;
- frozen 3,000-entry Phrase Dictionary v1.0.0 plus a pinned 1,000-entry extension, with
  longest-match phrase lookup and single-word fallback;
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

Stable master uses the frozen 30,000-headword Dictionary v1.0 plus the pinned 10,000-word
extension, targeted app corrections, structured core supplement and collision-checked
compatibility aliases: 40,011 unique runtime heads. Issues #75 / #79 and PRs #76 / #80 are
merged, with owner Windows acceptance recorded in their PRs.

## Phrase Dictionary v1.0.0

Production artifact: `src/main/translation/data/phrases.json`

- canonical phrases: **3,000**
- stored phrase forms: **4,827**
- unique lookup keys: **7,827**
- Burmese semantic meanings: **4,092**
- composition: 1,185 phrasal verbs, 935 idioms, 880 expressions
- artifact SHA-256: `951a8bbe54824cf76728393791607798f878a062b19eca63e572278ba8f62926`

Phrase matching remains longest-match-first for contiguous 2–5-token expressions inside the current cue, with normal single-word fallback.
PR #80 adds a separate 1,000-phrase extension: runtime totals are 4,000 canonical phrases,
7,509 forms and 11,509 stored variants. The counts above describe the unchanged frozen base.

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

## Completed — Issue #73 FFmpeg download availability

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
  records the exact-head CI and owner real-media acceptance results.
- See [RUNTIME_DEPENDENCIES.md](RUNTIME_DEPENDENCIES.md) for provenance, renewal deadline,
  and old-installer limitations.

PR #74 squash-merged as `8842cd86945332cdd0713c1a5f22798c479a1847`; Issue #73 is closed. CI #588 passed both jobs, and the owner confirmed the requested real-media test on 2026-10-06. The report flag was absent from that test build because reporting remained on PR #72.

## Completed — Issue #79 dictionary and phrase expansion

PR #80 squash-merged as `91cb213a7f0e77018ff7fc14ec6e93c40d872fba`; Issue #79 is closed/completed.
Final head `b4817c8774df9cf4f0e9176abd48d0cfd5e92eea` passed CI #602 validate and
package-windows. The owner confirmed all requested new-word, reporting, Stremio and phrase
checks passed in the combined Windows preview, then authorized merge. No exhaustive bilingual,
codec inventory or private report-version inspection is claimed. Release stays on hold.
The implementation and earlier pending snapshots below are historical.

The owner authorized integration after the readiness assessment of dataset commit
`3bce8474b301c89e0dd21b09588c063b7342397d`. Branch: `codex/issue-79-dictionary-expansion`,
based on stable master; theme PR #78 remains separate and unmerged.
Merged PR: [#80](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/80).

- Vendor word batches 061–080 (10,000 total extension heads) and phrase batches 013–016
  (1,000 new phrases), retaining both frozen bases byte-for-byte.
- Reconcile `go`, `run` and `see` with core entries; preserve `went`/`gone` and prior corrections.
- Correct common senses for `can`, `die`, `let`, `in` and `lot` in the separate app correction layer.
- Align phrase keys with subtitle tokenization so hyphenated phrases resolve; canonical strings
  remain unchanged. Same-owner spelling variants share keys; cross-owner collisions fail.
- Resulting runtime has 40,011 word heads and 4,000 canonical phrases. Report identifiers are
  `1.0-ext.061-080.2` and `1.0-ext.013-016.1`.
- Dataset structural/artifact/index checks and all 38 upstream tests passed. Local `npm run check`
  passed 250 tests in 36 files, lint/typechecks, all corpus gates and production builds.
  CI #600 passed both jobs at implementation head `4b55b5fdedd4cc08fe49674f47a2bb66f7908965`.
  Local Windows build and both packaging scripts passed in isolated staging. CI #601 passed
  both jobs at documentation head `e5e2badb0b4b14bac44a3b27fccdb8d1421c0874`; complete-diff
  final code review found no unresolved P1/P2/P3 findings. Subsequent heads need their own CI.
- Prepared a separate local portable preview with this PR's app bundles, PR #78 neutral CSS
  and hash-matched existing runtimes; the prior running test app was preserved. The fixture
  `release/dictionary-expansion-acceptance.srt` supports representative external-subtitle checks.
  This combined preview is not the pure Issue #79 ZIP/setup and is not a release.
- The initial owner screenshots came from the older theme app, as confirmed by its running
  executable path and absence of the new phrase extension. After switching to the dictionary
  preview, the owner reported the requested phrase retest passed. Broader word/reporting/
  Stremio acceptance confirmation remains pending; no exhaustive manual checklist pass is claimed.
- A first app check exposed legitimate same-owner hyphen/open spellings; the matcher now retains
  these while continuing to reject actual duplicate stored variants and cross-owner collisions.
- Merge and acceptance completed as recorded above. See [dictionary expansion](DICTIONARY_EXPANSION.md).

## Active work — Issue #81 main-window stream entry

Branch: `codex/issue-81-open-stream`. The owner assigned implementation to Codex before release.
Issue: [#81](https://github.com/PyaeSoneHtun-98/stremio_dictionary/issues/81).
PR: [#82](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/82).

- Add a compact Stream URL field and Open stream button below the local/Stremio launcher cards,
  using the accepted gray/white theme. Enter submits, errors stay inline, and pending requests
  disable competing local/drop/stream actions with a synchronous guard.
- Validate HTTP/HTTPS in both renderer and main; preserve signed URL spelling, reject malformed
  input/other schemes/control characters, and use the existing serialized mpv/network path.
  Network subtitles continue using mpv live decoding; extraction, track selection and handoff
  logic are unchanged.
- Clear the URL field on successful opening. No URL history, persistence, logging, diagnostics
  or raw URL error messages are added. Authenticated/signed URLs remain in memory as required
  by existing playback, with the usual safe hostname-based session label.
- Eighteen focused behavioral tests pass for validation, actual launcher form handling,
  duplicates/loading/failure/retry, common IPC routing, preload exposure and disposal.
- Local `npm run check` passes all 268 tests in 39 files, corpus gates, lint/typechecks and
  production builds. The pre-existing Biome configuration/CSS/large-data warnings remain.
- Actual React launcher preview with synthetic IPC responses passed desktop (1100px) and
  narrow (320px) checks: click/Enter, opening state, invalid input, failure/control recovery,
  successful input clearing and scroll reachability. No document-level horizontal overflow
  occurred at 320px. This does not claim native mpv playback or actual network acceptance.
- Fresh Windows ZIP/setup packaging passed in isolated staging at implementation head
  `a98317a7018f67d5e06c4405689ab72a8d17b95f`. The separate local test player is
  `release/SubtitleBridge-stream-test-win-x64/Subtitle Bridge.exe`; its app bundles match the
  production build and all 16 existing runtime copies hash-match. Existing apps were preserved.
  ZIP SHA-256: `5e4ece3a9768a73cd9d52d9dd07e70de71c2b2621b537d75d42bbddd6428e764`.
  Setup SHA-256: `0136851a12346552af62da8cc346fbbd44d1e75848cc80de4ae6ef3144ed38f1`.
  These are local test artifacts, not a published release.
- On 2026-10-08 the owner confirmed a real Stremio localhost HTTP stream opens in that test
  build, then explicitly confirmed clickable subtitles/Burmese lookup, button and Enter opening,
  and local video/external subtitles all passed. No private stream URL or identifier is retained
  in this record. A separate public HTTPS playback test or exhaustive codec inventory is not claimed.
- Complete-diff follow-up review at `771930b489a5fb6c9fd6215257ef2a9f39806479` found no
  P1/P2/P3/P4 findings. It was performed by the implementing Codex agent; no independent second
  reviewer is claimed. All 18 focused stream tests were re-run and passed; CI #607 passed
  validate and package-windows at that head. This acceptance update changes documentation only;
  subsequent final-head CI is tracked in PR #82 before merge.
- CI #608 passed both jobs at `02f2d7ec85b0014f148e4cbd118b11d083684246`.
  The owner authorized merging PRs #86 and #82, then preparing a combined release candidate.
  Updating this branch to icon master `2700484` conflicted only in this status document;
  stream implementation and tests remain unchanged. Combined validation and final-head CI
  are recorded in PR #82 before merge.
- Code and owner manual acceptance gates passed. Release publication remains on hold;
  public release is still v1.0.6. No merge is claimed by this acceptance record.

## Completed — Issue #77 neutral charcoal theme

PR #78 squash-merged as `67c8edf29b1b902296c3c0a318151f8e4c9bac3a`; Issue #77 is closed/completed.
Final reviewed head `15907b0ee897033a5f6855071ad7af0677bcceee` passed CI #604 validate and
package-windows. Owner appearance acceptance and review found no unresolved P1/P2/P3 issues.
The implementation and earlier pending snapshots below are historical.

The owner requested a modern editor-style dark palette using a Codex screenshot as the reference
and assigned the focused presentation implementation to Codex. Branch: `codex/issue-77-charcoal-theme`.
Merged PR: [#78](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/78).

- The owner rejected the initial blue accent preview and requested white controls on gray backgrounds
  throughout the app. Replace green/blue accents with charcoal surfaces and neutral highlights
  across the launcher, player menus/controls, dictionary/report card, feedback, updates and scrollbars.
- Shared CSS palette retains existing layout, keyboard focus, disabled/selected/error states,
  white shadowed subtitles, popup anchoring and transparent Windows overlay hit testing.
- More opaque neutral player surfaces keep text readable over bright scenes. Normal/hover primary
  button contrast is 12.63/10.37:1; muted launcher text on its darkest panel is at least 5.58:1.
- Local `npm run check` passed all 241 tests, corpus gates, typechecks and production builds after
  replacing the blue accents with gray/white; exact-head CI will be recorded in the PR.
- Actual React components were previewed with an ignored local synthetic desktop-bridge fixture,
  including launcher/player, audio options, subtitle steppers, speed/settings, dictionary/miss card
  and simulated report success/failure. Normal desktop, 360px short-player and 320px bright-scene
  checks show scroll-reachable options and an unclipped card. These are not real mpv/manual tests.
  The gray/white revision was rechecked for launcher/player/card colors, subtitle selection,
  sliders, keyboard focus, short-player track options and bright-scene miss/report-error feedback.
- On 2026-10-08, the owner confirmed the gray/white launcher, controls/menus, card readability
  over bright/dark scenes and narrow-window appearance were checked in the combined dictionary
  preview and accepted. That preview uses this PR's unchanged theme CSS at `a0862ef`.
- Updating this branch to master `91cb213` conflicted only in STATUS.md; all six theme CSS files
  remain byte-for-byte identical to the accepted revision. Local `npm run check` passed all 250
  tests in 36 files, corpus gates, lint/typechecks and production build. Complete theme review
  found no unresolved P1/P2/P3 findings; no independent second reviewer is claimed. Non-palette
  CSS declarations, transparent hit testing, offsets, responsive layout and behavior are preserved.
- Fresh Windows ZIP/setup packaging passed in isolated staging. The separate portable preview is
  `release/SubtitleBridge-theme-test-win-x64/Subtitle Bridge.exe`; app bundles match the build,
  compiled CSS matches the accepted preview and all 16 existing runtime copies hash-match.
  ZIP SHA-256: `ec0d2724102f030c4d507a04aebd195d0dcabaf2017959d610036aebf488f08a`.
  Setup SHA-256: `15dcd002d64b931465ccd9a49ccea8793785e5a88c63a5fc0fb4c2b3f1a9fd25`.
  These are local test artifacts, not a release. Latest CI is recorded in PR #78 before merge.
  Public release remains v1.0.6 and publication stays on hold.
- Next: [Issue #81](https://github.com/PyaeSoneHtun-98/stremio_dictionary/issues/81), a main-window
  HTTP/HTTPS stream entry using the existing validated network playback path, in a separate PR.
- Local Windows packaging passed. The portable test app is
  `release/SubtitleBridge-win-x64/Subtitle Bridge.exe`; its 16 previously verified managed runtime
  files were restored and hash-matched after ZIP/setup creation, so they are local test tools only.
  The packaged theme is verified, main/preload match the build, and synthetic preview files are excluded.

## Completed — Issue #83 clean vector logo

Approved artwork PR #84 squash-merged as `5d4532f2a8338805e611f41919cda5af20b86648`
after exact-head CI #610 passed both jobs. Issue #83 is closed/completed. The owner then
authorized app/Windows icon integration separately as Issue #85. No release was published.
The asset-creation snapshots below describe the completed artwork work.

The owner kept the Subtitle Bridge name and assigned SVG recreation of the selected generated
bridge/subtitle-bubble concept to Codex. Branch: `codex/issue-83-vector-logo`, based on master.
PR: [#84](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/84).

- Hand-authored white/charcoal SVG symbol, square icon and full logo; no embedded PNG or
  external resources in the finished vector assets. Wordmark outlines use licensed Inter Bold.
- Editable wordmark source, font provenance/license, optional export tools, PNG previews and
  a seven-size Windows ICO are under [assets/branding](../assets/branding/README.md).
- Full logo and native 16/24/32/48/64/128/256px icons were rendered and visually inspected.
  The owner approved the recreated vector appearance on 2026-10-08 at asset head
  `e9498e76dde0d5ea749c2990470a183808d5efed`; this follow-up changes acceptance documentation only.
- Local `npm run check` passed: 250 tests in 36 files, lint/typechecks, corpus gates and
  production builds. SVG structure/resource checks, PNG dimensions/alpha checks and all
  seven decoded ICO frames passed; `git diff --check` passed. Existing lint warnings remain.
- Complete asset/tooling review found no unresolved P1/P2/P3 findings. Review was performed
  by the implementing Codex agent; no independent second review is claimed. Exact-head CI
  and merge status are recorded in PR #84. Artwork approval does not publish a release.
- App/installer icon wiring, executable/shortcut icon acceptance and release are separate
  follow-up work; playback code and packaging configuration are unchanged.

## Completed — Issue #85 apply approved app icon

PR [#86](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/86) squash-merged as
`2700484b4e85c8f42f0f749f2f7cc18a6b06731c`; Issue #85 is closed/completed.
Exact-head CI #612 passed validate and package-windows at `76432a2a882454fabca8610db8afba7f8b0b0ce9`.
The owner confirmed the icon preview was checked and works. No real setup installation or
manual installed-shortcut appearance check is claimed; CI verified installed icon resources,
shortcut metadata and registry references. Final review found no unresolved P1/P2/P3 findings.
Implementation snapshots below are historical; no independent second reviewer is claimed.

The owner authorized applying the approved logo to the app and Windows packaging.
Branch: `codex/issue-85-app-icons`, using the approved PR #84 artwork.

- Replace the launcher header's SB tile with the approved SVG. Native launcher/player host
  windows load the app-local ICO; transparent subtitle-overlay flags and behavior are unchanged.
- Embed all seven approved ICO frames into the copied app EXE and setup EXE. Setup uses its
  own associated icon; the icon object is disposed with the setup form. Start Menu shortcuts
  explicitly use the app EXE's index-0 icon; existing Installed Apps metadata uses the same source.
- Pin build-only `resedit` 3.1.0 (two packages); no new runtime app dependency or bundled tools.
  Before saving, embedding verifies non-icon resource payloads and non-resource section hashes/
  addresses plus the architecture and entry point remain unchanged.
- CI/release checks inspect the actual EXE resource frames. Windows install CI also verifies
  copied window assets, real shortcut metadata and the Installed Apps icon reference.
- Local `npm run check` passed all 250 tests in 36 files, corpus gates, lint/typechecks and
  production build. Existing lint warnings remain. Windows packaging passed in isolated staging;
  all seven frames in both final EXEs and packaged ICO/PNG/license copies match the approved assets.
  The unmodified Electron icon was rejected as a negative control. A temporary shortcut persisted
  the branded executable/index-0 icon correctly. `git diff --check` and installer syntax passed.
- The exact packaged preview was launched and its process path verified. Native inspection
  confirmed the launcher SVG and title-bar icon render correctly in the real Electron window.
  This verifies app startup/header rendering, not real-media playback or owner acceptance.
- An initial stronger pre-edit snapshot check caught the PE editor shrinking the resource
  virtual size and moving `.reloc`. Embedding now retains the original resource allocation;
  immutable before/after section addresses/hashes and entry-point checks pass in the rebuilt EXE.
- Local ZIP SHA-256: `1a0b892251fe4445f96d5010ccc6d7f3d342bf6c26df308e75175bc69ad9d53d`.
  Setup SHA-256: `09bf195585418bf3506773c635ff67d6abcad76f84b3aba88ec01b6749958760`.
- Portable preview: `release/SubtitleBridge-icon-test-win-x64/Subtitle Bridge.exe`.
  Its 16 existing verified runtime files were copied/hash-matched after ZIP/setup creation;
  distribution artifacts contain no media runtime binaries. This preview excludes stream PR #82.
- Acceptance/CI/merge completed as recorded above. No release has been published.

## Completed — Issue #75 dictionary extension

PR #76 squash-merged as `bc6346003f073f33848b21653e38e6e50c06a68b`; Issue #75 is closed/completed.
Final reviewed head `ff77cd62ead83c327900dcc0f1dd370768513bac` passed CI #595 validate and
package-windows. The owner authorized merge after Windows acceptance and explicitly held release.
The implementation and acceptance details below are the completed work's historical record.

The owner selected the current 5,000-word extension after readiness validation and explicitly
assigned implementation to Codex. Branch: `codex/issue-75-dictionary-extension`.
PR: [#76](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/76).

- Upstream snapshot: `7be581cc925e8c097cf89efdf973b1f65a62da66`, batches 061–070.
- Separate unchanged asset: 5,000 headwords, 3,783 forms, 5,329 Burmese meanings.
- Eleven app-level corrections reconcile `love`/`wait`, restore `waited`, and enrich the
  ordinary senses of new canonical entries that supersede core/compatibility inflections.
- Runtime total: 35,014 unique headwords, including 14 nonoverlapping core entries.
- Frozen 30k and 3k-phrase artifacts stay unchanged; exact-headword and phrase-first rules remain.
- Reports identify the combined corpus as `1.0-ext.061-070.1` using the existing backend contract.
- Focused tests pass: all extension keys through the real tokenizer/provider, frozen/core/alias
  availability, every overlapping key's meaning, combined ownership/schema, and all phrase variants.
- Local `npm run check` passes lint/typechecks, all corpus gates, 241 tests and production builds.
  Biome reports existing configuration/CSS warnings and skips the large pinned dictionary JSON
  assets; explicit digest/schema gates validate those assets.
- Local `npm run package:win` passed. CI #594 passed validate and package-windows at
  `e78189376d389c7cc2e8e7887503fe8363fe67cd`.
- The owner reported "passed" for the prepared Windows test build at that same head after the
  requested external-subtitle word/phrase/rendering, report action and Stremio lookup checks.
  No per-codec inventory, backend database-version inspection or exhaustive editorial pass is claimed.
- The complete final code review found no unresolved P1/P2/P3/P4 findings. It was performed by
  the implementing Codex agent; no separate independent reviewer is claimed. This acceptance
  record changed documentation only; final-head CI #595 passed before merge.
- Full independent bilingual/IPA editorial review remains an acknowledged dataset limitation.

See [dictionary extension](DICTIONARY_EXTENSION.md) for provenance, hashes and manual checklist.

## Completed work — Issue #71 dictionary report icon

PR #72 squash-merged as `7f42d8ca395907497324d563738260ea28828195`; Issue #71 is closed.
Exact-head CI #591 passed both jobs. The owner confirmed reporting works in the combined build
after intermittent Vercel reachability recovered. The underlying transient network cause is
uncertain; normal retry feedback is preserved. The details below are historical investigation
and validation snapshots, not current active work.

Branch:

`codex/issue-71-dictionary-reports`

Draft PR: [#72](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/72).

Supabase code stays in the separate
`D:\Projects\subtitle-report-service` project.

Historical pre-merge snapshot (2026-10-06, after merging the FFmpeg fix):

- report submission succeeds in the restarted development app; the deployed owner dashboard's
  login, report loading, and status saving were confirmed by the owner;
- merged master `8842cd86945332cdd0713c1a5f22798c479a1847` is included in this branch;
  the new combined test build contains both the bottom-right report flag and verified FFmpeg.
  The earlier runtime-only test build intentionally had no reporting code;
- the owner requested final review/merge and more separation between the flag and close icons,
  then specified a bottom-right flag. The card now keeps X at the top right and places the 34px
  report action in a footer after the card content, with additional card padding;
- actual-component synthetic browser previews at normal and 320px widths check footer alignment,
  long-card scroll reachability, wrapping, and report feedback. Earlier header-layout previews also
  checked independent dismissal. These previews are not real-media acceptance;
- official CI/release workflows now default to the public Vercel reporting endpoint; an optional
  Actions variable remains an override, so an absent variable no longer disables official reporting;
- local validation passes 235 tests. New behavioral tests cover report-versus-close/pointer behavior
  and the 100-report session limit, including retries and completed receipts at capacity;
- the full PR review found no unresolved P1/P2/P3 code defects after fixing official endpoint
  configuration. The earlier FFmpeg packaging blocker was resolved by merged PR #74 / Issue #73;
- merge was authorized and gated by green final-head CI and real Windows acceptance at this
  snapshot. Both gates subsequently passed and PR #72 merged as recorded above.

Scope:

- one flag icon with tooltip and accessible label, with no report form or extra visible card text;
- explicit missing-word or existing-entry/phrase reports for manual dictionary review;
- structured dictionary-miss IPC result, distinct from general lookup errors;
- main-process HTTPS submission, safe retry receipts, session deduplication, bounded requests,
  response validation, and shutdown cleanup;
- no automatic lookup collection, subtitle context, media paths, stream URLs, credentials, or term logs;
- public build-time endpoint configuration with no Supabase code/credentials packaged in the player;
- separate backend with private reports, atomic grouping/counts, idempotency, and hourly quota;
- owner-requested separate Vercel reporting endpoint and private report-review dashboard;
- app rename/icon and dictionary changes remain out of scope.

Initial validation status (subsequent fixes and acceptance are recorded above/below):

- local `npm run check` passed with 232 tests, dictionary verification, type checking, lint, and builds;
- 18 new player tests exercise actual React button events/lifecycle, HTTPS behavior, IPC validation,
  preload routing, and cleanup;
- the separate backend passes 10 Node tests, including the actual SQL migration, database roles/RLS,
  grouped counts, retry receipts, quota, rollback, handler validation, and server-only credential use;
- CI #581 passed at `a003b47653a34341e28d83360b9842e2576a14b9`;
- owner linked Supabase project `axcpqizzmjwdwwpdaggf` and applied the migration; the initially
  absent function was one setup defect found while investigating failed manual submissions;
- the prepared `report-dictionary` function is now deployed as ACTIVE version 1 with JWT verification
  disabled; live table/function presence and anonymous-denied/server-allowed RPC permissions are verified;
- local development endpoint is now the verified Vercel relay in ignored `.env.local`; official build Actions variable
  configuration remains pending;
- before adding the relay, user reported `Couldn't send` after Supabase deployment. Local Node and isolated Electron network
  checks fail before any HTTP response from the project endpoint; the management API remains reachable
  and public DNS matches system DNS. The owner browser receives the expected GET `method_not_allowed`
  response only with a browser VPN enabled; without that VPN the browser also cannot connect. The
  browser-only VPN does not cover the app's connection. The owner does not want VPN-based testing;
- the Vercel production route now accepts synthetic submissions without VPN, as recorded below;
- real player/manual Windows acceptance, private owner setup/acceptance, and final review are still pending;
- the feature stays Draft and must not be described as ready for release until those gates complete.

Connectivity investigation on 2026-10-03:

- owner reports that a mobile-hotspot test also failed without VPN;
- project health is `ACTIVE_HEALTHY`; project A records agree with Google public DNS;
- direct TCP connections to both project-resolved addresses (`104.18.38.10`, `172.64.149.246`)
  fail with `ECONNREFUSED` before TLS/HTTP; function, REST, and auth routes all fail normally;
- a temporary diagnostic DNS override to reachable Supabase/Cloudflare addresses reaches the same
  function with full certificate/hostname verification and returns HTTP 405 as expected for GET;
- evidence narrows the problem to reachability of the resolved addresses, but does not distinguish
  local firewall/security filtering from upstream network routing/filtering. A hotspot test on the
  same computer does not exclude a computer-specific cause;
- no DNS, hosts-file, firewall, or production client changes were made. Do not ship hardcoded
  Cloudflare addresses as a workaround; successful POST/storage acceptance remains unverified.

Vercel endpoint and owner dashboard on 2026-10-05:

- owner requested an interface for viewing reports; the separate backend now contains owner login,
  search/type/status filters, grouped counts, pagination, and manual review statuses;
- deployed production URL: `https://subtitle-report-service.vercel.app`;
- anonymous HTTPS checks without VPN: dashboard/health HTTP 200, reporting GET HTTP 405, no redirects
  or Vercel authentication bypass;
- two POSTs of one synthetic report returned HTTP 202; the live database confirms its retry receipt
  and grouped count of 1. That synthetic test group remains in the private table;
- owner UID and privately entered server key are configured in Vercel Production and redeployed;
  anonymous and invalid-session admin requests return HTTP 401, foreign-origin POST returns HTTP 403,
  and public dashboard/health remain HTTP 200 without VPN. Real owner login/read/status acceptance
  remains pending; no password or key was retrieved or sent in chat;
- backend passes 22 tests covering actual SQL/roles, owner/non-owner sessions, cookie/CSRF boundaries,
  bounded queries/status updates, and report relay behavior;
- dashboard layout was checked with synthetic local fixtures; this is not live owner-login acceptance;
- the player accepts only the exact official Vercel reporting route (plus the original Supabase route),
  and local `npm run check` passed again with 232 tests. New-head CI/final review remain pending;
- no DNS, hosts-file, firewall, or certificate validation changes were made.

Owner dashboard follow-up on 2026-10-05:

- owner screenshot confirmed login/session HTTP 200 but report listing HTTP 503;
- a real Vercel storage query reproduced HTTP 401 / PostgreSQL 42501. The owner confirmed the server
  variable held a public `sb_publishable_` key, then replaced it privately with `sb_secret_`;
- service-role schema/table/RLS permissions were verified; public database access was not expanded;
- the owner-requested Next.js rewrite is pushed to the separate
  [reporting repository](https://github.com/PyaeSoneHtun-98/subtitle-report-service), Draft PR #2;
- the new production deployment passed the actual report-list query/count parsing, and anonymous
  access-denial and existing report-retry checks passed without VPN. Local backend validation passes
  33 tests plus the Next.js build; responsive previews use synthetic data;
- owner confirmed real browser login, report loading, and review-status save work on the deployed
  Next.js app after the key fix. Backend code-head CI #3 passed. Player Windows acceptance remains
  pending; the earlier failed dashboard attempt is not counted as successful acceptance.

CI #582 at `ecc2a34aee4a10029de026e6cc5f59bdbfb22c78` passed validate, but package-windows failed
at the existing live-runtime gate: the pinned FFmpeg archive now returns HTTP 404. An independent
anonymous HEAD check confirms 404; packaging/install steps were skipped. [Issue #73](https://github.com/PyaeSoneHtun-98/stremio_dictionary/issues/73)
tracks that separate runtime fix. No installer/runtime changes were added to the reporting PR.

Player report transport follow-up on 2026-10-05:

- owner reports immediate `Couldn't send` for every word even after the backend owner UI worked;
- the running development app and compiled main bundle use the official Vercel endpoint;
- local Node requests reproduced `ECONNRESET` before HTTP on the public reporting/dashboard/health
  routes. An isolated Electron comparison returned Node `ECONNRESET` and Chromium HTTP 200 for the
  same health URL. Subsequent actual report-client synthetic POSTs succeeded with both stacks, so
  the Node failure is intermittent; its underlying network cause is not proven;
- the actual translation IPC now injects Electron `net.fetch` into the narrow report client. Existing
  HTTPS validation, omitted cookies, redirect rejection, bounded responses/timeouts, retry receipts,
  and shutdown cancellation remain in place; no renderer network capability was added;
- direct IPC tests verify Electron transport is used even if Node fetch fails, and pending Electron
  requests are aborted on disposal. The local validation suite passes 233 tests;
- synthetic probe results contain only controlled outcomes/status/timing, never real report words,
  credentials, media targets, or request bodies;
- owner fully restarted the development app and confirmed the flag now shows `Reported`. This
  verifies the previously failing user submission flow at code head
  `5818bcab4f6bf99c83c1f5df5af2255d188fa126`; the full missing/existing/phrase, retry, narrow-window,
  and playback acceptance checklist remains pending;
- CI #583 passed validate at that head. Windows packaging still fails on the separately tracked
  pinned FFmpeg archive HTTP 404 (Issue #73), before packaging/install acceptance runs.

Setup guide: `D:\Projects\subtitle-report-service\README.md`.
Player contract/configuration: [DICTIONARY_REPORTING.md](DICTIONARY_REPORTING.md).

## Later work

Separate future issues include macOS packaging, Linux packaging, separated-object phrasal-verb matching, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry word dataset, richer ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, and native/upstream Stremio support.
