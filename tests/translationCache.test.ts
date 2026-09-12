import { describe, expect, it, vi } from 'vitest'
import type { TranslationProvider } from '../src/main/translation/TranslationProvider'
import {
  TranslationService,
  type TranslationRuntimeSettings
} from '../src/main/translation/TranslationService'

describe('TranslationService cache', () => {
  it('reuses a cached result for the same normalized word', async () => {
    const settings: TranslationRuntimeSettings = {
      provider: 'local-dictionary',
      targetLanguage: 'my',
      apiKey: ''
    }
    const translate = vi.fn(async (request) => ({
      originalWord: request.word,
      translation: 'ဧကရာဇ်',
      provider: 'fake',
      targetLanguage: request.targetLanguage ?? 'my'
    }))
    const provider: TranslationProvider = { id: 'fake', translate }
    const service = new TranslationService(
      { getRuntimeSettings: async () => settings },
      undefined,
      () => provider
    )

    const first = await service.translate({ word: 'Emperor' })
    const second = await service.translate({ word: '  emperor  ' })

    expect(first.translation).toBe('ဧကရာဇ်')
    expect(second.translation).toBe('ဧကရာဇ်')
    expect(second.originalWord).toBe('emperor')
    expect(translate).toHaveBeenCalledOnce()
    expect(service.cacheSize).toBe(1)
  })

  it('isolates cache entries by target language and clears on request', async () => {
    const settings: TranslationRuntimeSettings = {
      provider: 'google',
      targetLanguage: 'my',
      apiKey: 'secret'
    }
    const translate = vi.fn(async (request) => ({
      originalWord: request.word,
      translation: request.targetLanguage === 'ja' ? '皇帝' : 'ဧကရာဇ်',
      provider: 'fake',
      targetLanguage: request.targetLanguage ?? 'my'
    }))
    const provider: TranslationProvider = { id: 'fake', translate }
    const service = new TranslationService(
      { getRuntimeSettings: async () => settings },
      undefined,
      () => provider
    )

    await service.translate({ word: 'emperor' })
    settings.targetLanguage = 'ja'
    await service.translate({ word: 'emperor' })

    expect(translate).toHaveBeenCalledTimes(2)
    expect(service.cacheSize).toBe(2)

    service.clearCache()
    expect(service.cacheSize).toBe(0)
    await service.translate({ word: 'emperor' })
    expect(translate).toHaveBeenCalledTimes(3)
  })
})
