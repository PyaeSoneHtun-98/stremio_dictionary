# macOS beta acceptance checklist (Issue #53)

GitHub's macOS runners have no usable GPU, so CI only proves that the packaged app starts,
loads Homebrew libmpv in-process, plays a synthetic MKV with the software OpenGL renderer,
extracts its subtitle track and quits. Everything below needs a **physical Apple Silicon Mac**.
Record each result truthfully in the PR (pass / fail / not tested), with the macOS version and
Mac model. Never paste private stream URLs, file paths or subtitle text.

About 15–20 minutes.

## Setup

1. Install [Homebrew](https://brew.sh) if needed, then run `brew install mpv ffmpeg`.
2. Download the test DMG from the PR's macOS CI run (artifact `subtitle-bridge-macos-arm64`)
   or the beta prerelease, open it and drag **Subtitle Bridge** to Applications.
3. Open it. Expected: macOS blocks the first launch (unnotarized). Use
   **System Settings → Privacy & Security → Open Anyway**. Note whether that worked.

## Checks

| # | Check | Expected |
| --- | --- | --- |
| 1 | App opens | Launcher shows "English → Burmese · macOS beta" in the footer; Stremio card says Windows-only; no update banner. |
| 2 | Open a local MKV with English SRT/ASS subtitles | Video and audio play inside the player window (no separate mpv window or Dock icon). |
| 3 | Subtitles | English subtitle line appears above the video; clicking a word shows the Burmese card; a phrase (e.g. "look it up") resolves as a phrase. |
| 4 | Controls | Play/pause (click and Space), seek, volume, speed, audio track, subtitle delay/size/position all work. |
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
the newest `Subtitle Bridge*.ips` from `~/Library/Logs/DiagnosticReports`.
