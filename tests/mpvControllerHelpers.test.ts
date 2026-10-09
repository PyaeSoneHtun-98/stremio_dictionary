import { describe, expect, it } from 'vitest'
import {
  audioTrackSelectionCommand,
  buildMpvArguments,
  isSupportedPlaybackPlatform,
  mpvPipePath,
  mpvSocketPath,
  playbackStartupUserMessage,
} from '../src/main/media/MpvController'

describe('mpv controller safety helpers', () => {
  it('uses a unique IPC pipe for each playback generation', () => {
    const first = mpvPipePath(1)
    const second = mpvPipePath(2)

    expect(first).not.toBe(second)
    expect(first).toContain(`subtitle-bridge-mpv-${process.pid}-1`)
    expect(second).toContain(`subtitle-bridge-mpv-${process.pid}-2`)
  })

  it('keeps the Windows mpv embedding arguments unchanged', () => {
    expect(
      buildMpvArguments({
        windowId: '123456',
        ipcPath: mpvPipePath(1),
      })
    ).toEqual([
      '--no-config',
      '--idle=yes',
      '--keep-open=yes',
      '--sid=no',
      '--sub-visibility=no',
      '--no-terminal',
      '--no-osc',
      '--vo=gpu',
      '--gpu-api=d3d11',
      '--gpu-context=d3d11',
      '--hwdec=no',
      '--wid=123456',
      `--input-ipc-server=${mpvPipePath(1)}`,
    ])
  })

  it('uses a unique short Unix socket per playback generation on macOS', () => {
    const directory = '/var/folders/zz/abcdefghijklmnopqrstuvwxyz/T/sb-mpv-AbC123'
    const first = mpvSocketPath(directory, 1)

    expect(first).not.toBe(mpvSocketPath(directory, 2))
    expect(first.endsWith('mpv-1.sock')).toBe(true)
    // macOS limits Unix socket paths to 104 bytes including the terminator.
    expect(Buffer.byteLength(first)).toBeLessThan(104)
    expect(() => mpvSocketPath(directory, -1)).toThrow('Invalid mpv playback generation.')
  })

  it('supports playback on Windows and macOS only', () => {
    expect(isSupportedPlaybackPlatform('win32')).toBe(true)
    expect(isSupportedPlaybackPlatform('darwin')).toBe(true)
    expect(isSupportedPlaybackPlatform('linux')).toBe(false)
  })

  it('does not expose raw spawn or IPC startup details to users', () => {
    const raw = new Error('connect ENOENT \\\\.\\pipe\\subtitle-bridge-secret-user-path')
    expect(playbackStartupUserMessage(raw)).toBe(
      'Could not start the video player. Reopen the video or restart Subtitle Bridge and try again.'
    )
    expect(playbackStartupUserMessage(raw)).not.toContain('pipe')
    expect(playbackStartupUserMessage(raw)).not.toContain('secret-user-path')
  })

  it('uses a specific safe message for a missing runtime', () => {
    const missing = Object.assign(new Error('spawn C:\\private\\mpv.exe ENOENT'), {
      code: 'ENOENT',
    })

    expect(playbackStartupUserMessage(missing, 'win32')).toBe(
      'The video player runtime is missing. Reinstall Subtitle Bridge and try again.'
    )
  })

  it('tells macOS users how to install a missing mpv runtime', () => {
    const missing = Object.assign(new Error('spawn /opt/homebrew/bin/mpv ENOENT'), {
      code: 'ENOENT',
    })

    const message = playbackStartupUserMessage(missing, 'darwin')
    expect(message).toBe(
      'mpv was not found. Install it with Homebrew (brew install mpv ffmpeg), then reopen the video.'
    )
    expect(message).not.toContain('/opt/homebrew')
  })

  it('builds an mpv aid command only for a current audio track', () => {
    const tracks = [
      {
        id: 1,
        type: 'video' as const,
        codec: 'h264',
        language: null,
        title: null,
        selected: true,
        subtitleKind: null,
        ffIndex: 0,
      },
      {
        id: 2,
        type: 'audio' as const,
        codec: 'aac',
        language: 'eng',
        title: 'English',
        selected: true,
        subtitleKind: null,
        ffIndex: 1,
      },
      {
        id: 3,
        type: 'audio' as const,
        codec: 'aac',
        language: 'jpn',
        title: 'Japanese',
        selected: false,
        subtitleKind: null,
        ffIndex: 2,
      },
      {
        id: 4,
        type: 'subtitle' as const,
        codec: 'ass',
        language: 'eng',
        title: 'English',
        selected: false,
        subtitleKind: 'text' as const,
        ffIndex: 3,
      },
    ]

    expect(audioTrackSelectionCommand(tracks, 3)).toEqual(['set_property', 'aid', 3])
    expect(() => audioTrackSelectionCommand(tracks, 4)).toThrow(
      'That audio track is no longer available.',
    )
    expect(() => audioTrackSelectionCommand(tracks, 99)).toThrow(
      'That audio track is no longer available.',
    )
  })

  it('rejects non-integer audio track ids before sending them to mpv', () => {
    expect(() => audioTrackSelectionCommand([], 1.5)).toThrow('Invalid audio track.')
    expect(() => audioTrackSelectionCommand([], Number.NaN)).toThrow('Invalid audio track.')
  })
})
