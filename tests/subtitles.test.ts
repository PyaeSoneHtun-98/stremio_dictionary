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

  it('rejects subtitle models that exceed the configured cue limit', () => {
    expect(() =>
      parseSrtCues(SAMPLE_SRT, {
        maxCues: 1,
        maxTokens: 100,
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
        maxSourceLines: 100
      })
    ).toThrow('safe token limit')
  })

  it('rejects subtitle sources that exceed the configured line limit before model allocation', () => {
    expect(() =>
      parseSrtCues(SAMPLE_SRT, {
        maxCues: 100,
        maxTokens: 100,
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
})

describe('findActiveCue', () => {
  it('keeps cue timing accurate when playback jumps by seeking', () => {
    const cues = parseSrtCues(SAMPLE_SRT)

    expect(findActiveCue(cues, 2)?.text).toContain('Hello?')
    expect(findActiveCue(cues, 4)).toBeNull()
    expect(findActiveCue(cues, 5.5)?.text).toBe("We're ready!")
    expect(findActiveCue(cues, 1.249)).toBeNull()
  })
})
