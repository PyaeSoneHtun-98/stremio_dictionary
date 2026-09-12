import { ipcMain } from 'electron'
import type { TranslationRequest } from '../../shared/translation'
import { GoogleTranslationProvider } from './GoogleTranslationProvider'
import type { TranslationProvider } from './TranslationProvider'

const TRANSLATE_WORD_CHANNEL = 'translation:translate-word'
const MAX_WORD_LENGTH = 120
const MAX_CONTEXT_LENGTH = 600

let provider: TranslationProvider | null = null
let registered = false

export function registerTranslationIpc(): void {
  if (registered) {
    return
  }

  registered = true
  provider = new GoogleTranslationProvider()

  ipcMain.handle(TRANSLATE_WORD_CHANNEL, async (_event, value: unknown) => {
    const request = normalizeTranslationRequest(value)
    const activeProvider = provider
    if (!activeProvider) {
      throw new Error('Translation service is unavailable. Restart Subtitle Bridge and try again.')
    }

    return activeProvider.translate(request)
  })
}

export function disposeTranslationIpc(): void {
  if (!registered) {
    return
  }

  ipcMain.removeHandler(TRANSLATE_WORD_CHANNEL)
  provider = null
  registered = false
}

export function normalizeTranslationRequest(value: unknown): TranslationRequest {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid translation request.')
  }

  const request = value as { word?: unknown; context?: unknown }
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

  return context ? { word, context } : { word }
}
