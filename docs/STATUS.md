# Project status

## Stable master

Current stable `master`:

`efa3c4119361a748f8175b922c21244bf18be3fd`

Public release: **v1.0.6**, source `9c86f734c719cf0bacc1c15c510f0ea958813167`.

v1.0.6 fixed the real in-app updater install-directory lock. The affected Windows PC then completed the real **v1.0.5 → v1.0.6 in-app update successfully**, confirming the published hotfix outside CI.

PR #64 / Issue #63 subsequently changed missing/unsupported/subtitle-error recovery text into a four-second notice while keeping active subtitle loading status persistent. PR CI #506 and merged-master CI #507 passed, and the MP4 manual acceptance test passed.

Issue #65 / PR #66 completed the updater post-review hardening: physical path resolution, real Windows junction regression coverage, updater spawn-option tests, and subtitle notice timer lifecycle tests. Exact-head PR CI and merged-master CI passed.

Issue #67 / PR #68 fixed player subtitle positioning so the shared interactive subtitle overlay stays raised above visible controls and moves toward the bottom after chrome hides. A real Stremio-stream development test passed, Codex reported no P1/P2/P3 findings, and merged-master CI #514 passed.

Issue #69 / PR #70 is now squash-merged at the stable master above. It adds the shared audio selector
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

## Active work — Issue #71 dictionary report icon

Branch:

`codex/issue-71-dictionary-reports`

Draft PR: [#72](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/72).

Supabase code stays in the separate
`D:\Projects\subtitle-report-service` project.

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

Validation status:

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
