import { describe, expect, it } from 'vitest'
import { classifySubtitleCodec, normalizeMpvTracks } from '../src/shared/media'

describe('classifySubtitleCodec', () => {
  it('recognizes common text subtitle codecs', () => {
    expect(classifySubtitleCodec('subrip')).toBe('text')
    expect(classifySubtitleCodec('ass')).toBe('text')
    expect(classifySubtitleCodec('ssa')).toBe('text')
  })

  it('recognizes common image subtitle codecs', () => {
    expect(classifySubtitleCodec('hdmv_pgs_subtitle')).toBe('image')
    expect(classifySubtitleCodec('dvd_subtitle')).toBe('image')
  })

  it('keeps unknown codecs explicit', () => {
    expect(classifySubtitleCodec('something-new')).toBe('unknown')
    expect(classifySubtitleCodec(null)).toBe('unknown')
  })
})

describe('normalizeMpvTracks', () => {
  it('maps mpv track-list entries into renderer-safe track metadata', () => {
    expect(
      normalizeMpvTracks([
        { id: 1, type: 'video', codec: 'h264', selected: true, 'ff-index': 0 },
        { id: 2, type: 'audio', codec: 'aac', lang: 'eng', title: 'Stereo', 'ff-index': 1 },
        { id: 3, type: 'sub', codec: 'ass', lang: 'eng', title: 'English', 'ff-index': 2 },
        { id: 4, type: 'sub', codec: 'hdmv_pgs_subtitle', lang: 'jpn', 'ff-index': 3 }
      ])
    ).toEqual([
      {
        id: 1,
        type: 'video',
        codec: 'h264',
        language: null,
        title: null,
        selected: true,
        subtitleKind: null,
        ffIndex: 0
      },
      {
        id: 2,
        type: 'audio',
        codec: 'aac',
        language: 'eng',
        title: 'Stereo',
        selected: false,
        subtitleKind: null,
        ffIndex: 1
      },
      {
        id: 3,
        type: 'subtitle',
        codec: 'ass',
        language: 'eng',
        title: 'English',
        selected: false,
        subtitleKind: 'text',
        ffIndex: 2
      },
      {
        id: 4,
        type: 'subtitle',
        codec: 'hdmv_pgs_subtitle',
        language: 'jpn',
        title: null,
        selected: false,
        subtitleKind: 'image',
        ffIndex: 3
      }
    ])
  })

  it('keeps a missing FFmpeg index explicit', () => {
    expect(normalizeMpvTracks([{ id: 1, type: 'sub', codec: 'ass' }])[0]?.ffIndex).toBeNull()
  })

  it('ignores malformed track entries', () => {
    expect(normalizeMpvTracks([null, {}, { id: '1', type: 'video' }])).toEqual([])
  })
})
