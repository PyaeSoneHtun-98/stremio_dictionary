# Windows v1.0.0 acceptance test

This document is the release gate for **Subtitle Bridge v1.0.0** on Windows x64. It reflects the current one-click installer, installer-managed runtime dependencies, 30,000-headword Dictionary v1.0, and optional Stremio integration.

The recommended normal-user flow is:

```text
Download SubtitleBridge-Setup-x64.exe
→ double-click
→ install
→ launch
```

Normal users do not need Git, Node.js, npm, PowerShell commands, manual PATH editing, or separate manual mpv/FFmpeg installation.

## Release artifacts

Build on Windows x64 with:

```cmd
npm ci
npm run package:win
```

Expected outputs:

- `release/SubtitleBridge-Setup-x64.exe` — recommended one-click installer
- `release/SubtitleBridge-Setup-x64.exe.sha256` — installer checksum
- `release/SubtitleBridge-win-x64.zip` — portable/developer package
- `release/SubtitleBridge-win-x64.zip.sha256` — portable ZIP checksum
- `release/SubtitleBridge-win-x64/` — unpacked build used by packaging/acceptance checks

The packaging scripts reject non-x64 Windows runtimes so ARM64/ia32 builds cannot be mislabeled as Windows x64.

## Normal installer behavior

`SubtitleBridge-Setup-x64.exe` installs Subtitle Bridge for the current Windows user, normally under:

```text
%LOCALAPPDATA%\Programs\Subtitle Bridge
```

The installer:

- creates a Start Menu shortcut;
- registers Subtitle Bridge in Windows Installed Apps / Add or Remove Programs;
- provisions pinned, SHA-256-verified app-local mpv and FFmpeg runtimes;
- records the installed application version;
- stages and validates upgrades before replacing the existing app;
- preserves the previously working installation if staging or post-swap setup fails;
- recovers safely after an interrupted upgrade;
- serializes concurrent setup executions for the same install path;
- cleans only ownership-validated installer transaction/cache/application paths;
- preserves user settings/cache across normal upgrades;
- can launch Subtitle Bridge after successful installation.

The current v1.0.0 installer is not code-signed, so Windows SmartScreen may show an **Unknown Publisher** warning.

## Runtime dependencies

Subtitle Bridge uses:

- `mpv.exe` for video playback and live text subtitles on supported network streams;
- `ffmpeg.exe` for embedded text-subtitle extraction from local media.

For the normal installer flow, the user does **not** install or configure these manually.

The installer obtains pinned Windows x64 runtime archives from the sources recorded in:

```text
packaging/runtime-manifest.json
```

Each downloaded archive is SHA-256 verified before use and installed app-locally. Third-party provenance/license information is packaged with Subtitle Bridge.

Runtime resolution order remains:

1. `MPV_PATH` / `FFMPEG_PATH` developer overrides
2. installer-managed app-local runtimes
3. system `PATH` fallback

The portable ZIP is primarily for development/manual use and does not replace the normal one-click installer flow.

## Dictionary acceptance

The production dictionary is the frozen **30,000-headword Dictionary v1.0**, plus the structured core supplement and collision-checked compatibility alias layer.

Release validation must include:

```cmd
npm run dictionary:verify-production
npm run dictionary:validate
```

Normal Burmese lookup is offline and requires no account, API key, payment method, or network request.

## Automated release checks

The Windows CI workflow must pass both jobs.

### `validate`

Runs:

- `npm ci`
- `npm run check`

This covers linting, TypeScript validation, production dictionary verification, dictionary validation, tests, and the Electron/Vite app build.

### `package-windows`

The Windows packaging job validates:

- Windows PowerShell installer/helper syntax;
- Windows x64 package creation;
- one-click setup EXE creation;
- pinned/hash-verified runtime provisioning using controlled CI fixtures;
- clean/fresh install behavior;
- upgrade behavior and stale-file replacement;
- rollback after staged/post-install failures;
- recovery after simulated hard interruption;
- recovery after shell-metadata restoration failure;
- committed-transaction crash cleanup at multiple cleanup boundaries;
- per-install-path concurrent-setup locking;
- install/cache/application ownership protections;
- custom install/uninstall paths;
- runtime-cache cleanup safety;
- Stremio enable/disable/re-enable behavior;
- exhaustive/persisted Stremio cleanup;
- failure when a recorded Stremio target cannot be safely cleaned;
- installer/package artifacts and checksum creation.

For PR #37, exact-head CI #331 passed both jobs on `b0a65e2476a62eef6c750a6c14a966873f420aa5` before the final documentation/version-consistency cleanup. A new exact-head CI run is required after any subsequent commit.

## Manual Windows acceptance

Issue #34 / PR #35 recorded the user-facing Windows installer acceptance that v1.0.0 inherits:

| Test | Expected result | Recorded result |
| --- | --- | --- |
| Clean/fresh Windows install | Double-click setup installs and launches without requiring prior mpv/FFmpeg configuration | Pass |
| First launch | Installed app starts normally | Pass |
| Local MKV playback | Video/audio works using managed runtime dependencies | Pass |
| Embedded English text subtitles | Supported text subtitles stay synchronized and remain clickable | Pass |
| Burmese lookup | Clicked known words return offline Burmese dictionary results | Pass |
| 30k dictionary packaging | Frozen Dictionary v1.0 remains packaged and production verification passes | Pass |
| Start Menu launch | Start Menu shortcut opens the installed application | Pass |
| Upgrade | Existing installation is replaced safely without stale application files | Pass |
| Failed/interrupted upgrade | Previous working application is preserved/recovered | Pass |
| Uninstall/reinstall | Windows uninstall removes the managed app safely and reinstall succeeds | Pass |
| No Stremio installed | Subtitle Bridge installs and works normally | Pass |
| Stremio enable/use/disable/re-enable | Play in Subtitle Bridge can be managed without manual PowerShell commands | Pass |
| Stremio foreground behavior | Handoff brings the playback window forward without an extra click | Pass |
| Failed Stremio cleanup | Uninstall aborts rather than deleting the app while leaving a dangling patch | Pass |

The automated suite additionally covers failure/recovery paths that are difficult to reproduce reliably by hand.

## Subtitle/media behavior

Expected supported behavior includes:

- local MKV playback;
- embedded SRT/ASS/SSA text subtitle extraction for local files;
- clickable English dialogue;
- live clickable text subtitles for supported HTTP/HTTPS streams;
- drag-and-drop external SRT/ASS/SSA subtitles;
- subtitle delay, size, and position controls;
- readable recovery states when no supported text subtitles are available;
- image-based PGS/VobSub subtitle tracks are not converted into clickable text.

Advanced ASS/SSA styling, positioning, karaoke animation, and drawing fidelity are not fully reproduced by the interactive subtitle overlay.

## Stremio acceptance

Stremio integration remains optional.

The app-facing integration must:

- enable **Play in Subtitle Bridge** only for a recognized compatible Stremio layout;
- preserve a backup/safe reversible mutation path;
- be idempotent;
- use atomic replacement;
- persist every patched target so later disable/uninstall can find it;
- clean all recorded/discovered patched targets before reporting success;
- abort safely when a required target is unreadable or structurally unrecognized;
- allow disable and re-enable without manual PowerShell commands.

Stremio itself is not required for Subtitle Bridge installation or normal local playback.

## Diagnostic privacy

Diagnostics intentionally avoid:

- subtitle text;
- clicked dictionary words;
- raw FFmpeg/mpv logs;
- credentials;
- full media paths;
- full stream URLs.

Known secret-shaped fields and sensitive query/header patterns are redacted before writing.

Do not add provider request bodies, authorization headers, stored credentials, or raw third-party stdout/stderr to diagnostics.

## Long-session behavior

The main process periodically records controlled memory samples in its rotating diagnostics. Prior Windows acceptance showed playback memory stabilizing after warm-up rather than growing without bound during the observed session.

Diagnostic logs are stored under the Electron user-data directory in:

```text
diagnostics\subtitle-bridge.log
```

## v1.0.0 known limitations

- Windows 10/11 x64 only.
- The installer is currently unsigned and may trigger a Windows SmartScreen Unknown Publisher warning.
- Image-based subtitle formats such as PGS/VobSub are not converted into clickable text.
- Advanced ASS/libass visual fidelity is outside v1.0.0 scope.
- Stremio updates can change its local layout and may require re-enabling the integration.
- macOS and Linux installers are not included.
- Multi-word/phrasal-verb lookup, pronunciation/TTS, automatic updates, and watched-state synchronization remain future work.

## Release decision

v1.0.0 may be published only when:

1. the final PR head has green `validate` and `package-windows` CI;
2. final review has no unresolved P1/P2/P3 release findings;
3. the release-prep PR is squash merged;
4. CI passes on the exact resulting `master` commit;
5. the release workflow publishes from that exact successful `master` CI SHA;
6. the GitHub Release contains all four expected artifacts;
7. published checksums verify against the uploaded setup EXE and portable ZIP.


## Local MP4 + external subtitle acceptance

1. Open a local MP4 from **Choose video**.
2. Confirm video/audio playback starts even when the MP4 has no embedded subtitle track.
3. Pause or continue playback and choose an external SRT file from the existing subtitle controls.
4. Confirm the SRT appears synchronized and each word remains clickable.
5. Confirm Burmese word lookup and phrase lookup still work.
6. Repeat with external ASS or SSA when representative files are available.
7. Drag/drop a supported external subtitle during MP4 playback and confirm it loads.
8. Reopen a representative MKV and confirm embedded subtitle extraction still works.
9. Open a Stremio/network stream and confirm network subtitle behavior is unchanged.

## Subtitle delay keyboard acceptance

1. Start playback with a visible text subtitle source.
2. Press **G** once.
3. Confirm subtitle delay changes by **-0.1 s** and an on-screen notice shows the new delay.
4. Press **H** once.
5. Confirm subtitle delay changes by **+0.1 s** relative to the current value and the notice refreshes.
6. Press G/H repeatedly and confirm the value stays within **-10.0 s** to **+10.0 s**.
7. Open the subtitle controls and confirm its delay value matches the keyboard-adjusted value.
8. Focus an input/select/button and confirm G/H do not trigger the shortcut while operating that control.
9. Confirm the on-screen delay notice disappears automatically.
