import { describe, expect, it } from 'vitest'
import {
  adjustedSubtitleTime,
  normalizeSubtitleDelay,
} from '../src/main/subtitles/timing'

describe('subtitle timing controls', () => {
  it('normalizes supported delay values', () => {
    expect(normalizeSubtitleDelay(0)).toBe(0)
    expect(normalizeSubtitleDelay(1.2344)).toBe(1.234)
    expect(normalizeSubtitleDelay(-2.3456)).toBe(-2.346)
  })

  it('rejects non-finite and out-of-range delays', () => {
    expect(() => normalizeSubtitleDelay(Number.NaN)).toThrow('finite')
    expect(() => normalizeSubtitleDelay(20.001)).toThrow('between -20 and 20')
    expect(() => normalizeSubtitleDelay(-20.001)).toThrow('between -20 and 20')
  })

  it('delays positive offsets and advances negative offsets', () => {
    expect(adjustedSubtitleTime(5, 1)).toBe(4)
    expect(adjustedSubtitleTime(5, -1)).toBe(6)
  })

  it('treats a missing legacy snapshot delay as zero', () => {
    expect(adjustedSubtitleTime(5, undefined)).toBe(5)
    expect(adjustedSubtitleTime(5, null)).toBe(5)
    expect(adjustedSubtitleTime(null, 1)).toBeNull()
  })
})
