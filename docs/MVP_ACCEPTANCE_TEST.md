# Windows MVP acceptance test

This checklist is the release gate for Subtitle Bridge 0.1.0. Automated checks prove the build layout and project validation; media, subtitle, interaction, and long-session checks are exercised on Windows and recorded below. Clean-VM coverage that was not performed is called out explicitly rather than inferred from local-machine results.

## Build artifact

Run on Windows:

```cmd
npm ci
npm run package:win
```

Outputs:

- `release/SubtitleBridge-win-x64/` — unpacked portable application
- `release/SubtitleBridge-win-x64.zip` — distributable archive
- `release/SubtitleBridge-win-x64.zip.sha256` — SHA-256 checksum

The archive contains `Install-SubtitleBridge.ps1`. From an extracted package, install for the current user with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-SubtitleBridge.ps1
```

The default install directory is `%LOCALAPPDATA%\Programs\Subtitle Bridge` and a Start Menu shortcut is created. The app can also be run directly from the extracted folder without installing.

## Runtime dependencies

Subtitle Bridge needs `mpv.exe` for video playback and `ffmpeg.exe` for text-subtitle extraction.

`npm run package:win` checks `MPV_PATH` / `FFMPEG_PATH` first and then the Windows `PATH`. If the executables are found, they are copied into the package under `resources\tools\` and the packaged app uses them automatically. If they are not bundled, the target Windows machine must have mpv and FFmpeg on `PATH`, or the environment variables must point to them.

Do not commit third-party runtime binaries to this repository. If binaries are redistributed with a release, include and review their applicable licenses separately.

## Automated release checks

The Windows CI workflow must pass both jobs:

- `validate`: `npm ci` + `npm run check`
- `package-windows`: builds the portable package and ZIP, runs the installer into a temporary directory, verifies the packaged Electron entry points, and uploads the ZIP + checksum as the `subtitle-bridge-windows-mvp` artifact

## Manual acceptance matrix

Current manual acceptance was performed on Windows 11 using the packaged build with bundled mpv and FFmpeg. Clean Windows VM coverage was not performed for this MVP pass.

| Test | Expected result | Result |
| --- | --- | --- |
| Clean Windows 10 install + launch | Installer copies the app and the installed app launches without crashing | Not run; deferred |
| Clean Windows 11 install + launch | Installer copies the app and the installed app launches without crashing | Clean VM not run; local Windows 11 install + launch passed |
| Embedded English SRT MKV | Video plays; subtitle stays synchronized; words are clickable | Pass on packaged build |
| Embedded English ASS MKV | Video plays; dialogue is clickable; raw ASS drawing data is not exposed; karaoke micro-cues do not replace the main English line | Pass on packaged build with Tales of Herding Gods sample |
| Embedded English SSA MKV | Video plays; readable dialogue is clickable and synchronized | Pass on packaged build with real SSA sample |
| Clicked known word | Burmese local-dictionary translation appears | Pass on packaged build |
| Repeated normalized lookup | Session cache prevents a duplicate provider lookup | Previously validated; no separate packaged instrumentation retest |
| File with no subtitles | Clear no-subtitle recovery message appears | Pass on packaged build |
| Image-only PGS/VobSub file | Clear unsupported-subtitle message appears | Pass on packaged build with VobSub sample |
| Unknown local-dictionary word | Short readable unavailable message appears and playback remains usable | Previously validated behavior |
| Optional Google provider with no/invalid key | Short readable failure state; playback remains usable | Previously validated UI behavior |
| API-key persistence | Reopening Settings never reveals the stored key value | Pass after packaged-app restart |
| Fullscreen + keyboard + popup dismissal | Player controls and translation popup remain usable | Previously manually validated |
| Long playback session | No obvious unbounded memory growth or progressive playback degradation | Pass; multiple 10-minute samples stabilized around ~127 MB private / ~136–148 MB resident during the continuous run |

## Long-session memory check

The main process writes a `memory.sample` record at startup and every 10 minutes. During the Windows 11 acceptance run, memory rose during playback warm-up and then stabilized across successive samples instead of growing without bound. Representative samples were approximately 104 MB → 128 MB private memory followed by ~127 MB steady-state private memory, while resident memory settled from ~145–148 MB down to ~136 MB. Later samples also remained stable rather than showing runaway growth.

Diagnostic log location observed in the packaged build:

```text
%APPDATA%\Subtitle Bridge\diagnostics\subtitle-bridge.log
```

The exact Electron user-data folder can vary with package metadata, so if the file is not at that path, search `%APPDATA%` for `subtitle-bridge.log`.

## Diagnostic privacy

Diagnostics intentionally avoid logging video contents, subtitle text, selected dictionary words, or full media paths. Known secret-shaped fields and API-key query/header patterns are redacted before writing. Do not add provider request bodies, authorization headers, or raw stored credentials to diagnostics.

## Known MVP limitations

- The packaged MVP targets Windows 10/11 x64, but this acceptance pass was manually exercised on Windows 11 only; clean Windows 10 and clean-VM Windows 11 coverage is deferred.
- The default offline English → Burmese dictionary is intentionally small; unknown words are expected until the dataset is expanded.
- Advanced ASS/SSA visual styling, positioning, karaoke animation, and drawings are not reproduced by the interactive overlay. Drawing/effect garbage is filtered defensively; normal dialogue remains the learning surface.
- Image-based PGS/VobSub subtitles are detected but not rendered as clickable text.
- mpv and FFmpeg are external runtime dependencies unless explicitly bundled at packaging time.
- Stremio handoff/integration is post-MVP work and is not part of Issue #10.
