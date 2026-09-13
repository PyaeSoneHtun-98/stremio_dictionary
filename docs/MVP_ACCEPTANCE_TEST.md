# Windows MVP acceptance test

This checklist is the release gate for Subtitle Bridge 0.1.0. Automated checks prove the build layout and project validation; media, subtitle, interaction, and long-session checks must still be exercised on real Windows machines before Issue #10 is closed.

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

Record the exact Windows version and test-file details when completing each row.

| Test | Expected result | Status before Issue #10 final acceptance |
| --- | --- | --- |
| Clean Windows 10 install + launch | Installer copies the app and the installed app launches without crashing | Pending |
| Clean Windows 11 install + launch | Installer copies the app and the installed app launches without crashing | Pending |
| Embedded English SRT MKV | Video plays; subtitle stays synchronized; words are clickable | Previously validated with multi-track SubRip media; packaged-build retest pending |
| Embedded English ASS MKV | Video plays; dialogue is clickable; raw ASS drawing data is not exposed; karaoke micro-cues do not replace the main English line | Previously validated with Tales of Herding Gods; packaged-build retest pending |
| Embedded English SSA MKV | Video plays; readable dialogue is clickable and synchronized | Pending real SSA sample |
| Clicked known word | Burmese local-dictionary translation appears | Previously validated; packaged-build retest pending |
| Repeated normalized lookup | Session cache prevents a duplicate provider lookup | Previously validated; packaged-build retest pending |
| File with no subtitles | Clear no-subtitle recovery message appears | Pending final packaged-build test |
| Image-only PGS/VobSub file | Clear unsupported-subtitle message appears | Pending final packaged-build test |
| Unknown local-dictionary word | Short readable unavailable message appears and playback remains usable | Previously validated behavior; packaged-build retest pending |
| Optional Google provider with no/invalid key | Short readable failure state; playback remains usable | Previously validated UI behavior; packaged-build retest pending |
| API-key persistence | Reopening Settings never reveals the stored key value | Previously manually validated; packaged-build retest pending |
| Fullscreen + keyboard + popup dismissal | Player controls and translation popup remain usable | Previously manually validated; packaged-build retest pending |
| Long playback session | No obvious unbounded memory growth or progressive playback degradation | Pending; run at least 60 minutes and compare diagnostic memory samples |

## Long-session memory check

The main process writes a `memory.sample` record at startup and every 10 minutes. Play a representative MKV for at least 60 minutes, use seek/translation/fullscreen periodically, then inspect the diagnostic log. Some fluctuation is normal; investigate steady, unbounded growth across successive samples or a large increase that never settles after activity stops.

Diagnostic log location:

```text
%APPDATA%\subtitle-bridge\diagnostics\subtitle-bridge.log
```

The exact Electron user-data folder can vary with package metadata, so if the file is not at that path, search `%APPDATA%` for `subtitle-bridge.log`.

## Diagnostic privacy

Diagnostics intentionally avoid logging video contents, subtitle text, selected dictionary words, or full media paths. Known secret-shaped fields and API-key query/header patterns are redacted before writing. Do not add provider request bodies, authorization headers, or raw stored credentials to diagnostics.

## Known MVP limitations

- Windows 10/11 x64 only for the packaged MVP.
- The default offline English → Burmese dictionary is intentionally small; unknown words are expected until the dataset is expanded.
- Advanced ASS/SSA visual styling, positioning, karaoke animation, and drawings are not reproduced by the interactive overlay. Drawing/effect garbage is filtered defensively; normal dialogue remains the learning surface.
- Image-based PGS/VobSub subtitles are detected but not rendered as clickable text.
- mpv and FFmpeg are external runtime dependencies unless explicitly bundled at packaging time.
- Stremio handoff/integration is post-MVP work and is not part of Issue #10.
