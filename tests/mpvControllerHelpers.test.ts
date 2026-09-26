import { describe, expect, it } from 'vitest'
import {
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
})
