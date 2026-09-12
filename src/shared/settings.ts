export type TranslationProviderId = 'local-dictionary' | 'google'
export type TranslationPopupPosition = 'above' | 'below'

export interface TranslationSettingsSnapshot {
  provider: TranslationProviderId
  targetLanguage: string
  popupPosition: TranslationPopupPosition
  autoPauseOnWordClick: boolean
  apiKeyConfigured: boolean
  cacheEntries: number
}

export interface TranslationSettingsUpdate {
  provider?: TranslationProviderId
  targetLanguage?: string
  popupPosition?: TranslationPopupPosition
  autoPauseOnWordClick?: boolean
  apiKey?: string | null
}

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettingsSnapshot = {
  provider: 'local-dictionary',
  targetLanguage: 'my',
  popupPosition: 'below',
  autoPauseOnWordClick: false,
  apiKeyConfigured: false,
  cacheEntries: 0
}
