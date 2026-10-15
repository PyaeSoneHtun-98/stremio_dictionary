# macOS beta acceptance checklist (Issue #53)

GitHub's macOS runners have no usable GPU, so CI only proves that the packaged app starts,
loads Homebrew libmpv in-process, plays a synthetic MKV with the software OpenGL renderer,
extracts its subtitle track and quits. Everything below needs a **physical Apple Silicon Mac**.
Record each result truthfully in the PR (pass / fail / not tested), with the macOS version and
Mac model. Never paste private stream URLs, file paths or subtitle text.

About 30–40 minutes including setup (15–20 minutes of checks).

## Bring with you (prepare on Windows)

On a USB stick or cloud drive:

- the test DMG and its `.sha256` from the PR's macOS CI run (artifact `subtitle-bridge-macos-arm64`,
  or `gh run download <run-id> --name subtitle-bridge-macos-arm64`);
- an MKV with English SRT or ASS subtitles (1080p), plus a 4K file and an MP4 if you have them;
- a separate `.srt` subtitle file for the external-subtitle check;
- a direct HTTP/HTTPS video link (any public `.mp4` URL) for the stream check;
- this checklist.

## Setup on the Mac

Ask the Mac's owner first: Homebrew and mpv/FFmpeg get installed (removable afterwards, see
Clean up).

1. Note the Mac model and macOS version (Apple menu → About This Mac).
2. Install [Homebrew](https://brew.sh) if needed (its one-line Terminal command; asks for the
   Mac's password), then run `brew install mpv ffmpeg`.
3. Open the DMG and drag **Subtitle Bridge** to Applications.
4. Open it. Expected: macOS blocks the first launch (unnotarized). Use
   **System Settings → Privacy & Security → Open Anyway**. Note whether that worked.
5. Use **Cmd+Shift+5** to screen-record anything that looks wrong.

## Checks

| # | Check | Expected |
| --- | --- | --- |
| 1 | App opens | Launcher shows "English → Burmese · macOS beta" in the footer; Stremio card says Windows-only; no update banner. |
| 2 | Open a local MKV with English SRT/ASS subtitles | Video and audio play inside the player window (no separate mpv window or Dock icon). |
| 3 | Subtitles | English subtitle line appears above the video; clicking a word shows the Burmese card; a phrase (e.g. "look it up") resolves as a phrase. |
| 4 | Controls | Play/pause (click and Space), seek, volume, speed, audio track, subtitle delay/size/position all work. |
| 4b | Smoothness | Play a 1080p (and, if available, 4K) file for a minute while clicking words: no stutter, dropped audio, or lag opening the Burmese card. Note the Mac model. |
| 5 | Resize the player window | Video scales with the window; subtitles stay aligned; no black or stretched video. |
| 6 | Fullscreen (double-click or button) and back | Video fills the screen with subtitles visible; leaving fullscreen restores the window. |
| 7 | External subtitle | Load an SRT through the picker and by dragging it onto the player. |
| 8 | Stream URL | Paste an HTTP/HTTPS video URL into **Stream URL** and open it; buffering text appears, then playback. |
| 9 | Reopen | Close the player, open another video; repeat twice. No crash, no frozen window. |
| 10 | Quit | Cmd+Q quits within a few seconds; Activity Monitor shows no leftover Subtitle Bridge or mpv process. |
| 11 | Retina / external display (if available) | Video is sharp, not blurry; moving the window between displays keeps video visible. |
| 12 | Missing mpv (optional) | With mpv uninstalled (`brew uninstall mpv`), opening a video shows the `brew install mpv ffmpeg` message instead of crashing. |

If something fails, note the step and send
`~/Library/Application Support/Subtitle Bridge/diagnostics/subtitle-bridge.log`
(it is redacted: no full media paths, stream URLs or subtitle text). If the app crashed, also send
the newest `Subtitle Bridge*.ips` from `~/Library/Logs/DiagnosticReports`. In Finder use
**Go → Go to Folder…** and paste the path.

## Clean up

1. Quit Subtitle Bridge and drag it from Applications to the Trash.
2. Remove its data: Finder → Go → Go to Folder… →
   `~/Library/Application Support/Subtitle Bridge` → move to Trash.
3. If mpv/FFmpeg were installed only for this test: `brew uninstall mpv ffmpeg` then
   `brew autoremove`. Homebrew itself can stay or be removed with its official uninstall script.
