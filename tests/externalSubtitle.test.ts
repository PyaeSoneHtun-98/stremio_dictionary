import { describe, expect, it } from 'vitest'
import {
  describeExternalSubtitle,
  MAX_EXTERNAL_SUBTITLE_BYTES,
  validateExternalSubtitleSize,
} from '../src/main/subtitles/externalSubtitle'

describe('external subtitle validation', () => {
  it('accepts supported subtitle extensions case-insensitively and exposes basename only', () => {
    expect(describeExternalSubtitle('C:\\private\\movie.en.SRT')).toEqual({
      fileName: 'movie.en.SRT',
      format: 'srt',
    })
    expect(describeExternalSubtitle('C:\\private\\dialogue.ass').format).toBe('ass')
    expect(describeExternalSubtitle('C:\\private\\dialogue.SSA').format).toBe('ssa')
  })

  it('rejects unsupported or missing extensions', () => {
    expect(() => describeExternalSubtitle('C:\\private\\movie.vtt')).toThrow('SRT, ASS, or SSA')
    expect(() => describeExternalSubtitle('C:\\private\\movie.mkv')).toThrow('SRT, ASS, or SSA')
    expect(() => describeExternalSubtitle('C:\\private\\subtitle')).toThrow('SRT, ASS, or SSA')
  })

  it('accepts the size boundary and rejects oversized files', () => {
    expect(() => validateExternalSubtitleSize(MAX_EXTERNAL_SUBTITLE_BYTES)).not.toThrow()
    expect(() => validateExternalSubtitleSize(MAX_EXTERNAL_SUBTITLE_BYTES + 1)).toThrow('too large')
    expect(() => validateExternalSubtitleSize(-1)).toThrow('could not be validated')
  })
})
