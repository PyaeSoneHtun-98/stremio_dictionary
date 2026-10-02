import { describe, expect, it } from 'vitest'
import {
  audioTrackSelectionCommand,
  mpvPipePath,
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

    expect(playbackStartupUserMessage(missing)).toBe(
      'The video player runtime is missing. Reinstall Subtitle Bridge and try again.'
    )
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
