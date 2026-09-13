import { describe, expect, it } from 'vitest'
import {
  findActiveCue,
  normalizeLookupTerm,
  parseSrtCues,
  tokenizeSubtitleText
} from '../src/main/subtitles/normalize'

const SAMPLE_SRT = `1\r\n00:00:01,250 --> 00:00:03,500\r\nHello?\r\nSecond line.\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,250\r\n<i>We're ready!</i>\r\n`

describe('parseSrtCues', () => {
  it('normalizes timing, readable line breaks, and token positions', () => {
    const cues = parseSrtCues(SAMPLE_SRT)

    expect(cues).toHaveLength(2)
    expect(cues[0]).toMatchObject({
      startTime: 1.25,
      endTime: 3.5,
      text: 'Hello?\nSecond line.',
      lines: ['Hello?', 'Second line.']
    })
    expect(cues[0].tokens.map((token) => [token.text, token.lookupTerm])).toEqual([
      ['Hello', 'hello'],
      ['Second', 'second'],
      ['line', 'line']
    ])
    expect(cues[1].text).toBe("We're ready!")
  })

  it('skips malformed or empty cues instead of throwing', () => {
    expect(parseSrtCues('bad subtitle data')).toEqual([])
    expect(parseSrtCues('1\n00:00:03,000 --> 00:00:02,000\nBackwards')).toEqual([])
  })

  it('strips ASS override tags while preserving normal dialogue', () => {
    const source = `1\n00:00:01,000 --> 00:00:03,000\n{\\an8}{\\i1}Hello{\\i0} world!`

    const cues = parseSrtCues(source)

    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Hello world!')
    expect(cues[0].tokens.map((token) => token.lookupTerm)).toEqual(['hello', 'world'])
  })

  it('drops FFmpeg-flattened ASS vector drawing payloads', () => {
    const source = `1\n00:00:01,000 --> 00:00:03,000\n{\\an2}m -2 0 b -2 0 -2 0 -2 0 l -2 1 l 6 1 l 6 0`

    expect(parseSrtCues(source)).toEqual([])
  })

  it('drops explicit ASS drawing-mode geometry but keeps text after drawing mode ends', () => {
    const source = `1\n00:00:01,000 --> 00:00:03,000\n{\\p1}m 0 0 l 10 0 l 10 10 l 0 10{\\p0}Visible dialogue`

    const cues = parseSrtCues(source)

    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Visible dialogue')
  })

  it('fails safely when an ASS override block is unterminated', () => {
    const source = `1\n00:00:01,000 --> 00:00:03,000\n{\\p1 m 0 0 l 10 0`

    expect(parseSrtCues(source)).toEqual([])
  })

  it('keeps proven dialogue before an unterminated ASS block and discards the unsafe remainder', () => {
    const source = `1\n00:00:01,000 --> 00:00:03,000\nSafe dialogue {\\p1 m 0 0 l 10 0`

    const cues = parseSrtCues(source)

    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Safe dialogue')
    expect(cues[0].tokens.map((token) => token.lookupTerm)).toEqual(['safe', 'dialogue'])
  })

  it('rejects subtitle models that exceed the configured cue limit', () => {
    expect(() =>
      parseSrtCues(SAMPLE_SRT, {
        maxCues: 1,
        maxTokens: 100,
        maxTokenMatches: 100,
        maxSourceLines: 100
      })
    ).toThrow('safe cue limit')
  })

  it('rejects subtitle models that exceed the configured token limit', () => {
    const source = '1\n00:00:01,000 --> 00:00:03,000\none two three'

    expect(() =>
      parseSrtCues(source, {
        maxCues: 10,
        maxTokens: 2,
        maxTokenMatches: 100,
        maxSourceLines: 100
      })
    ).toThrow('safe token limit')
  })

  it('counts skipped numeric matches against the tokenizer work limit', () => {
    const source = '1\n00:00:01,000 --> 00:00:03,000\n1 2 3 4 hello'

    expect(() =>
      parseSrtCues(source, {
        maxCues: 10,
        maxTokens: 100,
        maxTokenMatches: 3,
        maxSourceLines: 100
      })
    ).toThrow('safe tokenizer work limit')
  })

  it('rejects subtitle sources that exceed the configured line limit before model allocation', () => {
    expect(() =>
      parseSrtCues(SAMPLE_SRT, {
        maxCues: 100,
        maxTokens: 100,
        maxTokenMatches: 100,
        maxSourceLines: 3
      })
    ).toThrow('safe line limit')
  })
})

describe('lookup normalization', () => {
  it('resolves hello and hello? to the same lookup term while punctuation remains display text', () => {
    expect(normalizeLookupTerm('hello')).toBe('hello')
    expect(normalizeLookupTerm('hello?')).toBe('hello')

    const tokens = tokenizeSubtitleText('hello?')
    expect(tokens).toEqual([{ text: 'hello', lookupTerm: 'hello', start: 0, end: 5 }])
    expect('hello?'.slice(tokens[0].end)).toBe('?')
  })

  it('skips pure numbers while keeping mixed letter-number terms selectable', () => {
    expect(tokenizeSubtitleText('123 H264 1080p hello').map((token) => token.text)).toEqual([
      'H264',
      '1080p',
      'hello'
    ])
  })
})

describe('findActiveCue', () => {
  it('keeps cue timing accurate when playback jumps by seeking', () => {
    const cues = parseSrtCues(SAMPLE_SRT)

    expect(findActiveCue(cues, 2)?.text).toContain('Hello?')
    expect(findActiveCue(cues, 4)).toBeNull()
    expect(findActiveCue(cues, 5.5)?.text).toBe("We're ready!")
    expect(findActiveCue(cues, 1.249)).toBeNull()
  })

  it('keeps the English dialogue visible over overlapping one-character ASS karaoke effects', () => {
    const source = `1\n00:00:01,000 --> 00:00:05,000\nThrow the lonely courage into the torrent\n\n2\n00:00:02,000 --> 00:00:02,600\n孤\n\n3\n00:00:02,600 --> 00:00:03,200\n勇`
    const cues = parseSrtCues(source)

    expect(findActiveCue(cues, 2.2, 'en', true)?.text).toBe(
      'Throw the lonely courage into the torrent'
    )
    expect(findActiveCue(cues, 2.8, 'English', true)?.text).toBe(
      'Throw the lonely courage into the torrent'
    )
  })

  it('suppresses non-English micro-cues when the selected ASS track is English', () => {
    const source = `1\n00:00:01,000 --> 00:00:01,600\n孤`
    const cues = parseSrtCues(source)

    expect(findActiveCue(cues, 1.2, 'eng', true)).toBeNull()
  })

  it('does not suppress a legitimate one-word English ASS cue when it is the only active cue', () => {
    const source = `1\n00:00:01,000 --> 00:00:01,600\nRun!`
    const cues = parseSrtCues(source)

    expect(findActiveCue(cues, 1.2, 'en', true)?.text).toBe('Run!')
  })

  it('prefers a stable English line over an overlapping one-word transient ASS effect', () => {
    const source = `1\n00:00:01,000 --> 00:00:05,000\nTraveling through time and space with the wind\n\n2\n00:00:02,000 --> 00:00:02,500\nwind`
    const cues = parseSrtCues(source)

    expect(findActiveCue(cues, 2.2, 'en', true)?.text).toBe(
      'Traveling through time and space with the wind'
    )
  })

  it('keeps normal newest-cue behavior for overlapping SRT subtitles', () => {
    const source = `1\n00:00:01,000 --> 00:00:05,000\nKeep moving forward.\n\n2\n00:00:02,000 --> 00:00:02,600\nRun!`
    const cues = parseSrtCues(source)

    expect(findActiveCue(cues, 2.2, 'en')?.text).toBe('Run!')
  })
})
