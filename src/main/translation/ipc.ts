import { ipcMain } from 'electron'
import type { TranslationRequest } from '../../shared/translation'
import { TranslationService } from './TranslationService'
import { TranslationSettingsStore } from './TranslationSettingsStore'
import { normalizeTranslationSettingsUpdate } from './settingsValidation'

const TRANSLATE_WORD_CHANNEL = 'translation:translate-word'
const GET_SETTINGS_CHANNEL = 'translation:get-settings'
const UPDATE_SETTINGS_CHANNEL = 'translation:update-settings'
const CLEAR_CACHE_CHANNEL = 'translation:clear-cache'
const MAX_WORD_LENGTH = 120
const MAX_CONTEXT_LENGTH = 600
const MAX_CONTEXT_TOKENS = 16
const MAX_CONTEXT_TOKEN_LENGTH = 120

let settingsStore: TranslationSettingsStore | null = null
let service: TranslationService | null = null
let registered = false

export function registerTranslationIpc(): void {
  if (registered) {
    return
  }

  registered = true
  settingsStore = new TranslationSettingsStore()
  service = new TranslationService(settingsStore)

  ipcMain.handle(TRANSLATE_WORD_CHANNEL, async (_event, value: unknown) => {
    const request = normalizeTranslationRequest(value)
    return requireService().translate(request)
  })

  ipcMain.handle(GET_SETTINGS_CHANNEL, async () => {
    const activeService = requireService()
    return requireSettingsStore().getSnapshot(activeService.cacheSize)
  })

  ipcMain.handle(UPDATE_SETTINGS_CHANNEL, async (_event, value: unknown) => {
    const update = normalizeTranslationSettingsUpdate(value)
    const activeService = requireService()
    const store = requireSettingsStore()
    await store.update(update)

    if (
      update.provider !== undefined ||
      update.targetLanguage !== undefined ||
      update.apiKey !== undefined
    ) {
      activeService.clearCache()
    }

    return store.getSnapshot(activeService.cacheSize)
  })

  ipcMain.handle(CLEAR_CACHE_CHANNEL, async () => {
    const activeService = requireService()
    activeService.clearCache()
    return requireSettingsStore().getSnapshot(activeService.cacheSize)
  })
}

export function disposeTranslationIpc(): void {
  if (!registered) {
    return
  }

  ipcMain.removeHandler(TRANSLATE_WORD_CHANNEL)
  ipcMain.removeHandler(GET_SETTINGS_CHANNEL)
  ipcMain.removeHandler(UPDATE_SETTINGS_CHANNEL)
  ipcMain.removeHandler(CLEAR_CACHE_CHANNEL)
  service = null
  settingsStore = null
  registered = false
}

export function normalizeTranslationRequest(value: unknown): TranslationRequest {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid translation request.')
  }

  const request = value as {
    word?: unknown
    context?: unknown
    contextTokens?: unknown
    clickedTokenIndex?: unknown
  }
  if (typeof request.word !== 'string') {
    throw new Error('Invalid translation word.')
  }

  const word = request.word.trim()
  if (!word) {
    throw new Error('Choose a subtitle word to translate.')
  }
  if (word.length > MAX_WORD_LENGTH) {
    throw new Error('That subtitle word is too long to translate.')
  }

  if (request.context !== undefined && typeof request.context !== 'string') {
    throw new Error('Invalid subtitle context.')
  }

  const context = typeof request.context === 'string' ? request.context.trim() : ''
  if (context.length > MAX_CONTEXT_LENGTH) {
    throw new Error('The subtitle context is too long to use for translation.')
  }

  const hasContextTokens = request.contextTokens !== undefined
  const hasClickedTokenIndex = request.clickedTokenIndex !== undefined
  if (hasContextTokens !== hasClickedTokenIndex) {
    throw new Error('Invalid phrase lookup context.')
  }

  let contextTokens: string[] | undefined
  let clickedTokenIndex: number | undefined

  if (hasContextTokens && hasClickedTokenIndex) {
    if (
      !Array.isArray(request.contextTokens) ||
      request.contextTokens.length === 0 ||
      request.contextTokens.length > MAX_CONTEXT_TOKENS
    ) {
      throw new Error('Invalid phrase lookup tokens.')
    }

    contextTokens = request.contextTokens.map((token) => {
      if (typeof token !== 'string') {
        throw new Error('Invalid phrase lookup token.')
      }

      const normalized = token.normalize('NFKC').trim().toLocaleLowerCase('en-US')
      if (!normalized || normalized.length > MAX_CONTEXT_TOKEN_LENGTH || /\s/u.test(normalized)) {
        throw new Error('Invalid phrase lookup token.')
      }
      return normalized
    })

    if (
      typeof request.clickedTokenIndex !== 'number' ||
      !Number.isSafeInteger(request.clickedTokenIndex) ||
      request.clickedTokenIndex < 0 ||
      request.clickedTokenIndex >= contextTokens.length
    ) {
      throw new Error('Invalid clicked subtitle token.')
    }

    clickedTokenIndex = request.clickedTokenIndex
  }

  return {
    word,
    ...(context ? { context } : {}),
    ...(contextTokens && clickedTokenIndex !== undefined
      ? { contextTokens, clickedTokenIndex }
      : {})
  }
}

function requireService(): TranslationService {
  if (!service) {
    throw new Error('Translation service is unavailable. Restart Subtitle Bridge and try again.')
  }
  return service
}

function requireSettingsStore(): TranslationSettingsStore {
  if (!settingsStore) {
    throw new Error('Translation settings are unavailable. Restart Subtitle Bridge and try again.')
  }
  return settingsStore
}
