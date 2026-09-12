# Playback proof of concept

Issue #2 validates the Windows media path and the future clickable subtitle overlay relationship before the polished player UI is built.

## Chosen proof-of-concept architecture

- Electron main process owns the media process and file picker.
- A dedicated Electron `BrowserWindow` acts as the native video host.
- Electron exposes the host `HWND` through `getNativeWindowHandle()`; mpv receives that window through `--wid` and renders video inside it.
- A transparent child `BrowserWindow` is parented to the video host and kept aligned to the host content bounds on move/resize.
- The transparent child renders a React HTML overlay with clickable test words and the live mpv playback timestamp.
- mpv JSON IPC runs over a Windows named pipe.
- The renderer receives only normalized playback state through the secure preload bridge.
- mpv's `track-list` property is normalized into video, audio, and subtitle metadata.
- Subtitle codecs are classified as text, image, or unknown so later issues can reject PGS/VobSub cleanly.
- mpv subtitle rendering is disabled (`--sid=no`) because Subtitle Bridge will own the subtitle overlay.

This is still a feasibility probe rather than the polished player, but it validates the critical relationship needed by later issues: native mpv video can be hosted by Electron while a separate HTML surface stays visually above it, follows window geometry, receives playback-time updates, and accepts pointer input for clickable words.

## Windows prerequisite

Install a current Windows build of mpv and make `mpv.exe` available on `PATH`.

Alternatively, set `MPV_PATH` before starting Subtitle Bridge:

```powershell
$env:MPV_PATH = 'C:\path\to\mpv.exe'
npm run dev
```

No mpv binary is committed to the repository in this issue.

## Manual validation

1. Run `npm ci`.
2. Ensure `mpv --version` works, or set `MPV_PATH`.
3. Run `npm run dev`.
4. Click **Open MKV** and choose a representative MKV containing video, audio, and at least one embedded subtitle track.
5. Confirm a **Subtitle Bridge Video Surface POC** window opens and the video/audio play inside that Electron-owned window rather than in a separate mpv top-level window.
6. Confirm the transparent HTML overlay appears above the video and its timestamp advances with playback.
7. Move and resize the video window; confirm the HTML overlay remains aligned over the video surface.
8. Click one of the overlay words (`interactive`, `subtitle`, or `works`) and confirm the overlay reports the clicked word.
9. Confirm the main Electron window updates the current playback position.
10. Confirm the track table shows video/audio/subtitle tracks with codec, language, and title when available.
11. Test an MKV with SRT/ASS/SSA subtitles and confirm the subtitle mode is `text`.
12. Test an MKV with PGS or VobSub and confirm the subtitle mode is `image`.

## Failure/lifecycle checks

- Named-pipe errors remain handled after the initial connection succeeds; a disconnect must update the renderer instead of crashing Electron's main process.
- Unexpected mpv exit clears the active playback state and publishes an actionable error.
- Intentional application shutdown does not report a false playback failure.

## Known limitations of this spike

- The overlay is a separate transparent child `BrowserWindow`, not the final styled subtitle component.
- The proof keeps the entire overlay window interactive. Later player work may selectively pass pointer events through transparent regions when custom controls are designed.
- CI can verify TypeScript, tests, and the production bundle, but it cannot prove real codec/GPU behavior, z-order, DPI behavior, or pointer routing without an interactive Windows desktop session.
- Unknown subtitle codecs remain explicitly classified as `unknown` rather than guessed.
- Packaging mpv with the final installer is deferred until the Windows packaging milestone.
