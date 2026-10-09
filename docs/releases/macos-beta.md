## Subtitle Bridge for macOS — beta

> **Beta, not yet tested on a real Mac.** This build is produced and smoke-tested on GitHub's
> Apple Silicon macOS runners only. Please report anything that does not work.

### Requirements

- A Mac with Apple Silicon (M1, M2, M3, M4 or newer). Intel Macs are not supported by this beta.
- [Homebrew](https://brew.sh), used to install the video player and subtitle tools:

  ```sh
  brew install mpv ffmpeg
  ```

  Subtitle Bridge finds them in Homebrew's standard location automatically.

### Install

1. Download `SubtitleBridge-macos-arm64.dmg` (optionally compare it with the `.sha256` file:
   `shasum -a 256 SubtitleBridge-macos-arm64.dmg`).
2. Open the disk image and drag **Subtitle Bridge** into **Applications**.
3. Open Subtitle Bridge from Applications. Because this beta is not notarized by Apple, macOS
   blocks the first launch:
   - open **System Settings → Privacy & Security**, scroll to the message about
     "Subtitle Bridge", click **Open Anyway**, then confirm; or
   - in Terminal run `xattr -dr com.apple.quarantine "/Applications/Subtitle Bridge.app"`
     and open the app again.

### Included in this beta

- Local MKV/MP4 playback and HTTP/HTTPS stream URLs through mpv.
- Clickable English SRT/ASS/SSA subtitles with offline English → Burmese word and phrase lookup.
- External subtitle files, subtitle delay/size/position, audio track selection, fullscreen.

### Not available on macOS yet

- **Stremio one-click "Play in Subtitle Bridge"** is Windows-only. Paste the stream URL into
  **Stream URL** instead.
- **In-app updates** are Windows-only. Download new macOS betas from GitHub Releases.
- Opening videos by dragging them onto the Dock icon; drag them onto the app window instead.

The Windows release and its in-app updater are not affected by macOS beta releases.
