# Stremio Windows handoff

Subtitle Bridge can accept HTTP/HTTPS media streams from the command line, including Stremio's local streaming-server URLs such as `http://127.0.0.1:11470/...`.

## Verified Stremio 6 beta behavior

On the tested Windows build (Stremio 6 beta), **Settings → Player → Play in external player** exposes only **Disabled** and **M3U Playlist**. VLC is not available in that settings dropdown.

The in-player three-dot menu is different. Stremio's streaming server discovers installed desktop players and exposes entries such as **Play in VLC** through its casting/external-device list. Because that path is what the tested build actually uses, the Subtitle Bridge helper integrates there instead of relying on the disabled `vlc://` settings path.

## Integration approach

`Enable-StremioHandoff.ps1` makes a narrow, reversible patch to Stremio's local `server.js` external-player table. It inserts a new player entry that points to the installed `Subtitle Bridge.exe` before Stremio builds `devices.groups.external`.

After Stremio restarts, the expected player menu is:

```text
Copy stream link
Copy magnet link
Download this video
Play in VLC
Play in Subtitle Bridge
```

Selecting **Play in Subtitle Bridge** launches Subtitle Bridge with the same Stremio streaming URL that is already proven to work with mpv live subtitles, clickable words, and Burmese lookup.

This is an opt-in compatibility patch, not a native Stremio extension API. A Stremio update can replace `server.js`; if the menu entry disappears after an update, rerun the enable helper.

## Prerequisites

- Windows x64
- Subtitle Bridge installed
- `mpv.exe` available through persistent `PATH` or `MPV_PATH`
- FFmpeg installed for the existing local-file workflow
- Stremio running while its local `127.0.0.1:11470` stream is used

## Test the stream path directly first

In Stremio, use **Copy stream link**, then launch Subtitle Bridge with the clipboard URL:

```powershell
$url = Get-Clipboard
& "$env:LOCALAPPDATA\Programs\Subtitle Bridge\Subtitle Bridge.exe" $url
```

The verified Stremio stream path supports:

- video/audio playback
- embedded subtitle-track detection
- live synchronized subtitle text through mpv
- clickable subtitle words
- Burmese lookup
- embedded subtitle-track switching while paused

## Enable the one-click Stremio menu entry

Run the helper from the installed Subtitle Bridge directory:

```powershell
cd "$env:LOCALAPPDATA\Programs\Subtitle Bridge"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Enable-StremioHandoff.ps1"
```

The helper:

1. Locates Stremio's `server.js` automatically when possible.
2. Verifies the expected external-player discovery anchor exists before writing anything.
3. Creates `server.js.subtitle-bridge.backup` beside the original file.
4. Inserts one idempotent `players.subtitleBridge` block pointing to the installed Subtitle Bridge executable.
5. Refuses to patch an unrecognized Stremio server layout.

If automatic discovery fails, pass the server file explicitly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Enable-StremioHandoff.ps1" -ServerJsPath "C:\path\to\Stremio\server.js"
```

Then **fully exit Stremio and reopen it**. Start any stream, open the three-dot player menu, and select **Play in Subtitle Bridge**.

## Disable the Stremio menu entry

From the installed Subtitle Bridge directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Disable-StremioHandoff.ps1"
```

The disable helper removes only the marked Subtitle Bridge block from `server.js`; it does not replace the whole file with an old backup. Fully exit and reopen Stremio afterward.

## Single-instance behavior

Subtitle Bridge uses an Electron single-instance lock. If it is already running and Stremio launches another stream, the new target is delivered to the existing Subtitle Bridge instance instead of opening a duplicate app.

## Subtitle behavior

For HTTP/HTTPS Stremio streams, Subtitle Bridge uses mpv's live subtitle properties instead of waiting for FFmpeg to scan the complete torrent-backed stream. mpv's own subtitle rendering stays hidden while the current plain subtitle text feeds the interactive React overlay.

Local MKV files keep the existing FFmpeg full-track extraction path.

Not included yet:

- Stremio subtitle-addon URLs that are separate from the video stream
- watched/progress synchronization back to Stremio
- a native upstream `Subtitle Bridge` option in Stremio settings
- image-based subtitles as clickable text

## Compatibility warning

The one-click menu integration modifies Stremio's installed `server.js`. It is deliberately opt-in and reversible, but Stremio updates can overwrite the patch. The helper validates the expected layout and creates a backup before first modification; it will fail rather than patch an unrecognized layout.
