import type { TranslationProviderId } from '../../shared/settings'
import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import { GoogleTranslationProvider } from './GoogleTranslationProvider'
import { LocalDictionaryProvider } from './LocalDictionaryProvider'
import { TranslationCache, normalizeCacheWord } from './TranslationCache'
import type { TranslationProvider } from './TranslationProvider'

export interface TranslationRuntimeSettings {
  provider: TranslationProviderId
  targetLanguage: string
  apiKey: string
}

export interface TranslationRuntimeSettingsSource {
  getRuntimeSettings(): Promise<TranslationRuntimeSettings>
}

export type TranslationProviderFactory = (
  settings: TranslationRuntimeSettings
) => TranslationProvider

export class TranslationService {
  constructor(
    private readonly settingsSource: TranslationRuntimeSettingsSource,
    private readonly cache = new TranslationCache(),
    private readonly providerFactory: TranslationProviderFactory = createProvider
  ) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const settings = await this.settingsSource.getRuntimeSettings()
    const normalizedWord = normalizeCacheWord(request.word)
    const cacheKey = {
      provider: settings.provider,
      targetLanguage: settings.targetLanguage,
      word: normalizedWord
    }
    const cached = this.cache.get(cacheKey)

    if (cached) {
      return {
        ...cached,
        originalWord: request.word.trim()
      }
    }

    const provider = this.providerFactory(settings)
    const result = await provider.translate({
      ...request,
      targetLanguage: settings.targetLanguage
    })
    this.cache.set(cacheKey, result)
    return result
  }

  clearCache(): void {
    this.cache.clear()
  }

  get cacheSize(): number {
    return this.cache.size
  }
}

function createProvider(settings: TranslationRuntimeSettings): TranslationProvider {
  if (settings.provider === 'google') {
    return new GoogleTranslationProvider(settings.apiKey)
  }

  return new LocalDictionaryProvider()
}
