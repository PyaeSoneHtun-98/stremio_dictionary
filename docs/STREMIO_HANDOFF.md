# Stremio Windows handoff

Subtitle Bridge can accept HTTP/HTTPS media streams from the command line and can unwrap Stremio's current Windows VLC external-player handoff format (`vlc://<http-or-https-url>`).

## Why the first integration uses the VLC option

Current Stremio Windows exposes VLC and M3U as external-player choices; it does not expose MPV on Windows. Stremio Core generates the Windows VLC external-player URL as:

```text
vlc://<stream-url>
```

The first Subtitle Bridge integration therefore provides an **opt-in compatibility handler** for the current-user `vlc://` URL protocol. While enabled, choosing **VLC** as Stremio's external player launches Subtitle Bridge instead.

This is an MVP compatibility path, not a claim that Subtitle Bridge is VLC. A future clean integration should use a dedicated `subtitlebridge://` handoff if Stremio adds a native Subtitle Bridge player entry.

## Prerequisites

- Windows x64
- Subtitle Bridge installed or extracted
- `mpv.exe` and `ffmpeg.exe` available through persistent `PATH`, `MPV_PATH`, and `FFMPEG_PATH` configuration
- Stremio running while a Stremio-served stream is playing

## Test Subtitle Bridge with a stream URL first

From Command Prompt or PowerShell, launch a direct HTTP/HTTPS stream:

```cmd
"C:\Users\<you>\AppData\Local\Programs\Subtitle Bridge\Subtitle Bridge.exe" "https://example.com/video.mkv"
```

A Stremio-style wrapper can also be tested directly:

```cmd
"C:\Users\<you>\AppData\Local\Programs\Subtitle Bridge\Subtitle Bridge.exe" "vlc://http://127.0.0.1:11470/..."
```

Only HTTP/HTTPS network targets are accepted. Arbitrary URL schemes are rejected before they are passed to mpv or FFmpeg.

## Enable the Stremio compatibility handoff

Run the helper from the **installed Subtitle Bridge directory** so the Windows protocol points to a stable executable path:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Enable-StremioHandoff.ps1"
```

The helper registers Subtitle Bridge as the current user's `vlc://` handler. If a current-user VLC protocol registration already exists, it is exported to a backup before Subtitle Bridge takes over.

Then in Stremio:

```text
Settings
→ Player
→ External Player
→ VLC
```

Choose a stream. Stremio should hand its `vlc://...` URL to Windows, Subtitle Bridge should open (or reuse the existing Subtitle Bridge instance), unwrap the HTTP/HTTPS stream URL, and begin playback.

## Disable and restore the previous VLC URL handler

From the installed Subtitle Bridge directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Disable-StremioHandoff.ps1"
```

If the enable helper backed up a previous current-user `vlc://` registration, the disable helper restores it. Otherwise, it removes Subtitle Bridge's current-user registration so Windows can fall back to any system-level VLC handler.

The disable helper refuses to delete a current-user `vlc://` registration that is not marked as owned by Subtitle Bridge.

## Single-instance behavior

Subtitle Bridge uses an Electron single-instance lock. If Subtitle Bridge is already running and Stremio launches another stream, the new command-line target is delivered to the existing app instead of creating a duplicate application instance.

## Subtitle behavior

The Stremio handoff MVP supports **embedded text subtitles in the media stream**, using the same SRT/ASS/SSA extraction and clickable Burmese lookup path as local MKV playback.

Not included yet:

- Stremio subtitle-addon URLs that are separate from the video stream
- watched/progress synchronization back to Stremio
- a native `Subtitle Bridge` entry in Stremio's external-player settings
- image-based subtitles as clickable text

## Compatibility warning

While the handoff helper is enabled, other `vlc://` links for the same Windows user will also open Subtitle Bridge. Disable the compatibility handoff when you want normal VLC protocol handling again.
