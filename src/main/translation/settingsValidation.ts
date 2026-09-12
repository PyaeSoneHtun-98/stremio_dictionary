import type {
  TranslationPopupPosition,
  TranslationProviderId,
  TranslationSettingsUpdate
} from '../../shared/settings'

const PROVIDERS = new Set<TranslationProviderId>(['local-dictionary', 'google'])
const POPUP_POSITIONS = new Set<TranslationPopupPosition>(['above', 'below'])
const MAX_API_KEY_LENGTH = 512
const MAX_LANGUAGE_CODE_LENGTH = 32

export function normalizeTranslationSettingsUpdate(value: unknown): TranslationSettingsUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid translation settings.')
  }

  const raw = value as Record<string, unknown>
  const update: TranslationSettingsUpdate = {}

  if (raw.provider !== undefined) {
    if (typeof raw.provider !== 'string' || !PROVIDERS.has(raw.provider as TranslationProviderId)) {
      throw new Error('Invalid translation provider.')
    }
    update.provider = raw.provider as TranslationProviderId
  }

  if (raw.targetLanguage !== undefined) {
    if (typeof raw.targetLanguage !== 'string') {
      throw new Error('Invalid target language.')
    }
    update.targetLanguage = normalizeTargetLanguage(raw.targetLanguage)
  }

  if (raw.popupPosition !== undefined) {
    if (
      typeof raw.popupPosition !== 'string' ||
      !POPUP_POSITIONS.has(raw.popupPosition as TranslationPopupPosition)
    ) {
      throw new Error('Invalid translation popup position.')
    }
    update.popupPosition = raw.popupPosition as TranslationPopupPosition
  }

  if (raw.autoPauseOnWordClick !== undefined) {
    if (typeof raw.autoPauseOnWordClick !== 'boolean') {
      throw new Error('Invalid automatic pause setting.')
    }
    update.autoPauseOnWordClick = raw.autoPauseOnWordClick
  }

  if (raw.apiKey !== undefined) {
    if (raw.apiKey !== null && typeof raw.apiKey !== 'string') {
      throw new Error('Invalid translation API key.')
    }
    if (typeof raw.apiKey === 'string' && raw.apiKey.length > MAX_API_KEY_LENGTH) {
      throw new Error('Translation API key is too long.')
    }
    update.apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() || null : null
  }

  return update
}

export function normalizeTargetLanguage(value: string): string {
  const language = value.trim().toLowerCase()
  if (!language || language.length > MAX_LANGUAGE_CODE_LENGTH) {
    throw new Error('Invalid target language.')
  }
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(language)) {
    throw new Error('Use a valid target language code, such as my, ja, or zh-cn.')
  }
  return language
}
