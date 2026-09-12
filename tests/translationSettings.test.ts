import { describe, expect, it } from 'vitest'
import {
  normalizeTargetLanguage,
  normalizeTranslationSettingsUpdate
} from '../src/main/translation/settingsValidation'

describe('translation settings validation', () => {
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

  it('turns a blank API key into an explicit clear operation', () => {
    expect(normalizeTranslationSettingsUpdate({ apiKey: '   ' })).toEqual({ apiKey: null })
  })
})
