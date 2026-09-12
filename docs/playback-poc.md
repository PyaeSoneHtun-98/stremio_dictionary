# Playback proof of concept

Issue #2 validates the Windows media path before the polished player UI is built.

## Chosen proof-of-concept architecture

- Electron main process owns the media process and file picker.
- `mpv.exe` is launched as a child process.
- mpv JSON IPC runs over a Windows named pipe.
- The renderer receives only normalized playback state through the secure preload bridge.
- mpv's `track-list` property is normalized into video, audio, and subtitle metadata.
- Subtitle codecs are classified as text, image, or unknown so later issues can reject PGS/VobSub cleanly.
- mpv subtitle rendering is disabled (`--sid=no`) because Subtitle Bridge will eventually own the subtitle overlay.

The proof intentionally uses mpv's own playback window. It does **not** claim the final in-app video-surface integration is solved. Issue #3 must choose and validate the final window/rendering approach before the custom HTML subtitle overlay is built.

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
5. Confirm mpv opens and plays video/audio.
6. Confirm the Electron window updates the current playback position.
7. Confirm the track table shows video/audio/subtitle tracks with codec, language, and title when available.
8. Test an MKV with SRT/ASS/SSA subtitles and confirm the subtitle mode is `text`.
9. Test an MKV with PGS or VobSub and confirm the subtitle mode is `image`.

## Known limitations of this spike

- Playback is in a separate mpv window rather than embedded into the Electron content area.
- CI can verify TypeScript, tests, and the production bundle, but it cannot prove real codec/GPU behavior without a representative media file and interactive Windows desktop session.
- Unknown subtitle codecs remain explicitly classified as `unknown` rather than guessed.
- Packaging mpv with the final installer is deferred until the Windows packaging milestone.
