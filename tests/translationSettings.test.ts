import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATION_SETTINGS } from '../src/shared/settings'
import {
  normalizeTargetLanguage,
  normalizeTargetLanguageForProvider,
  normalizeTranslationSettingsUpdate,
  releaseTranslationScope
} from '../src/main/translation/settingsValidation'

describe('translation settings validation', () => {
  it('defaults automatic pause on word click to enabled', () => {
    expect(DEFAULT_TRANSLATION_SETTINGS.autoPauseOnWordClick).toBe(true)
  })

  it('accepts and normalizes supported settings fields', () => {
    expect(
      normalizeTranslationSettingsUpdate({
        provider: 'local-dictionary',
        targetLanguage: 'ZH-CN',
        popupPosition: 'above',
        autoPauseOnWordClick: true,
        apiKey: '  secret-value  '
      })
    ).toEqual({
      provider: 'local-dictionary',
      targetLanguage: 'zh-cn',
      popupPosition: 'above',
      autoPauseOnWordClick: true,
      apiKey: 'secret-value'
    })
  })

  it('rejects invalid provider and popup values', () => {
    expect(() => normalizeTranslationSettingsUpdate({ provider: 'unknown' })).toThrow(
      'Invalid translation provider'
    )
    expect(() => normalizeTranslationSettingsUpdate({ popupPosition: 'left' })).toThrow(
      'Invalid translation popup position'
    )
  })

  it('normalizes target language codes and rejects unsafe values', () => {
    expect(normalizeTargetLanguage(' MY ')).toBe('my')
    expect(normalizeTargetLanguage('zh-CN')).toBe('zh-cn')
    expect(() => normalizeTargetLanguage('../secret')).toThrow('valid target language code')
  })

  it('forces the offline dictionary target language to Burmese', () => {
    expect(normalizeTargetLanguageForProvider('local-dictionary', 'ja')).toBe('my')
    expect(normalizeTargetLanguageForProvider('local-dictionary', 'zh-cn')).toBe('my')
    expect(normalizeTargetLanguageForProvider('google', 'JA')).toBe('ja')
  })

  it('forces the v1.0.7 effective translation scope to offline Burmese', () => {
    expect(releaseTranslationScope()).toEqual({
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })
  })

  it('turns a blank API key into an explicit clear operation', () => {
    expect(normalizeTranslationSettingsUpdate({ apiKey: '   ' })).toEqual({ apiKey: null })
  })
})
