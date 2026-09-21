import type { TranslationProviderId } from '../../shared/settings'
import type { TranslationRequest, TranslationResult } from '../../shared/translation'
import { GoogleTranslationProvider } from './GoogleTranslationProvider'
import { LocalDictionaryProvider } from './LocalDictionaryProvider'
import {
  TranslationCache,
  normalizeCacheWord,
  serializeTranslationCacheKey
} from './TranslationCache'
import type { TranslationProvider } from './TranslationProvider'
import { findLocalPhraseMatch, type ResolvedPhraseMatch } from './PhraseMatcher'

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

interface PendingLookup {
  generation: number
  promise: Promise<TranslationResult>
}

export class TranslationService {
  private readonly pendingLookups = new Map<string, PendingLookup>()

  constructor(
    private readonly settingsSource: TranslationRuntimeSettingsSource,
    private readonly cache = new TranslationCache(),
    private readonly providerFactory: TranslationProviderFactory = createProvider
  ) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const settings = await this.settingsSource.getRuntimeSettings()
    const phraseMatch =
      settings.provider === 'local-dictionary' ? findLocalPhraseMatch(request) : null
    const normalizedWord = resolveCacheLookupWord(settings.provider, request, phraseMatch)
    const cacheKey = {
      provider: settings.provider,
      targetLanguage: settings.targetLanguage,
      word: normalizedWord
    }
    const cached = this.cache.get(cacheKey)

    if (cached) {
      return adaptResultToRequest(cached, request, phraseMatch)
    }

    const generation = this.cache.generation
    const pendingKey = serializeTranslationCacheKey(cacheKey)
    const existingPending = this.pendingLookups.get(pendingKey)

    if (existingPending?.generation === generation) {
      const result = await existingPending.promise
      return adaptResultToRequest(result, request, phraseMatch)
    }

    const provider = this.providerFactory(settings)
    let lookupPromise: Promise<TranslationResult>
    lookupPromise = provider
      .translate({
        ...request,
        targetLanguage: settings.targetLanguage
      })
      .then((result) => {
        this.cache.setIfCurrent(cacheKey, cacheStableResult(result), generation)
        return result
      })
      .finally(() => {
        const currentPending = this.pendingLookups.get(pendingKey)
        if (currentPending?.promise === lookupPromise) {
          this.pendingLookups.delete(pendingKey)
        }
      })

    this.pendingLookups.set(pendingKey, { generation, promise: lookupPromise })

    const result = await lookupPromise
    return adaptResultToRequest(result, request, phraseMatch)
  }

  clearCache(): void {
    this.cache.clear()
    this.pendingLookups.clear()
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


function resolveCacheLookupWord(
  provider: TranslationProviderId,
  request: TranslationRequest,
  phraseMatch: ResolvedPhraseMatch | null
): string {
  if (provider === 'local-dictionary' && phraseMatch) {
    return `phrase:${normalizeCacheWord(phraseMatch.entry.phrase)}`
  }

  return `word:${normalizeCacheWord(request.word)}`
}

function cacheStableResult(result: TranslationResult): TranslationResult {
  if (!result.phraseMatch) {
    return result
  }

  const { phraseMatch: _requestSpecificMatch, ...stableResult } = result
  return stableResult
}

function adaptResultToRequest(
  result: TranslationResult,
  request: TranslationRequest,
  phraseMatch: ResolvedPhraseMatch | null
): TranslationResult {
  const adapted = {
    ...result,
    originalWord: request.word.trim()
  }

  if (!phraseMatch) {
    return adapted
  }

  return {
    ...adapted,
    phraseEntry: phraseMatch.entry,
    phraseMatch: phraseMatch.match
  }
}
