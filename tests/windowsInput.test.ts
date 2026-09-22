import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOUBLE_CLICK_INTERVAL_MS,
  MAX_DOUBLE_CLICK_INTERVAL_MS,
  normalizeDoubleClickInterval
} from '../src/main/media/windowsInput'

describe('normalizeDoubleClickInterval', () => {
  it('preserves configured Windows timing', () => {
    expect(normalizeDoubleClickInterval('650')).toBe(650)
    expect(normalizeDoubleClickInterval(900)).toBe(900)
  })

  it('falls back or clamps invalid native values', () => {
    expect(normalizeDoubleClickInterval('bad')).toBe(DEFAULT_DOUBLE_CLICK_INTERVAL_MS)
    expect(normalizeDoubleClickInterval(0)).toBe(DEFAULT_DOUBLE_CLICK_INTERVAL_MS)
    expect(normalizeDoubleClickInterval(99_999)).toBe(MAX_DOUBLE_CLICK_INTERVAL_MS)
  })
})
