import { describe, expect, it } from 'vitest'
import { DEFAULT_SUBTITLE_PREFERENCES } from '../src/shared/media'
import {
  applySubtitlePreferencesUpdate,
  sanitizePersistedSubtitlePreferences,
} from '../src/main/media/subtitlePreferences'

describe('subtitle appearance preferences', () => {
  it('applies supported size and position updates', () => {
    expect(
      applySubtitlePreferencesUpdate(DEFAULT_SUBTITLE_PREFERENCES, {
        fontScale: 1.25,
        verticalOffset: 80,
      }),
    ).toEqual({ fontScale: 1.25, verticalOffset: 80 })
  })

  it('preserves fields that are not part of an update', () => {
    expect(
      applySubtitlePreferencesUpdate({ fontScale: 1.2, verticalOffset: 40 }, { fontScale: 1.4 }),
    ).toEqual({ fontScale: 1.4, verticalOffset: 40 })
  })

  it('rejects unsupported preference ranges', () => {
    expect(() =>
      applySubtitlePreferencesUpdate(DEFAULT_SUBTITLE_PREFERENCES, { fontScale: 1.61 }),
    ).toThrow('outside the supported range')
    expect(() =>
      applySubtitlePreferencesUpdate(DEFAULT_SUBTITLE_PREFERENCES, { verticalOffset: 241 }),
    ).toThrow('outside the supported range')
  })

  it('sanitizes malformed persisted values back to defaults', () => {
    expect(sanitizePersistedSubtitlePreferences(null)).toEqual(DEFAULT_SUBTITLE_PREFERENCES)
    expect(
      sanitizePersistedSubtitlePreferences({ fontScale: 99, verticalOffset: 'high' }),
    ).toEqual(DEFAULT_SUBTITLE_PREFERENCES)
  })

  it('keeps valid persisted values independently', () => {
    expect(
      sanitizePersistedSubtitlePreferences({ fontScale: 1.15, verticalOffset: 120 }),
    ).toEqual({ fontScale: 1.15, verticalOffset: 120 })
  })
})
