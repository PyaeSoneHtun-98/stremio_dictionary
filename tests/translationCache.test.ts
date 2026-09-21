import { describe, expect, it, vi } from 'vitest'
import type { TranslationProvider } from '../src/main/translation/TranslationProvider'
import {
  TranslationService,
  type TranslationRuntimeSettings
} from '../src/main/translation/TranslationService'
import type { TranslationResult } from '../src/shared/translation'

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

  it('keeps phrase-aware cache entries separate from ordinary clicked-word lookups', async () => {
    const settings: TranslationRuntimeSettings = {
      provider: 'local-dictionary',
      targetLanguage: 'my',
      apiKey: ''
    }
    const translate = vi.fn(async (request) => ({
      originalWord: request.word,
      translation: request.contextTokens?.join(' ') ?? request.word,
      provider: 'fake',
      targetLanguage: request.targetLanguage ?? 'my'
    }))
    const provider: TranslationProvider = { id: 'fake', translate }
    const service = new TranslationService(
      { getRuntimeSettings: async () => settings },
      undefined,
      () => provider
    )

    await service.translate({
      word: 'up',
      contextTokens: ['give', 'up'],
      clickedTokenIndex: 1
    })
    await service.translate({
      word: 'up',
      contextTokens: ['look', 'up'],
      clickedTokenIndex: 1
    })

    expect(translate).toHaveBeenCalledTimes(2)
    expect(service.cacheSize).toBe(2)
  })

  it('reuses a canonical phrase cache entry across inflected phrase forms', async () => {
    const settings: TranslationRuntimeSettings = {
      provider: 'local-dictionary',
      targetLanguage: 'my',
      apiKey: ''
    }
    const translate = vi.fn(async (request) => ({
      originalWord: request.word,
      translation: 'အရှုံးပေးသည်',
      provider: 'fake',
      targetLanguage: request.targetLanguage ?? 'my'
    }))
    const provider: TranslationProvider = { id: 'fake', translate }
    const service = new TranslationService(
      { getRuntimeSettings: async () => settings },
      undefined,
      () => provider
    )

    await service.translate({
      word: 'up',
      contextTokens: ['give', 'up'],
      clickedTokenIndex: 1
    })
    await service.translate({
      word: 'up',
      contextTokens: ['gave', 'up'],
      clickedTokenIndex: 1
    })

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

  it('coalesces simultaneous lookups for the same normalized cache key', async () => {
    const settings: TranslationRuntimeSettings = {
      provider: 'local-dictionary',
      targetLanguage: 'my',
      apiKey: ''
    }
    const pending = deferred<TranslationResult>()
    const translate = vi.fn(() => pending.promise)
    const provider: TranslationProvider = { id: 'fake', translate }
    const service = new TranslationService(
      { getRuntimeSettings: async () => settings },
      undefined,
      () => provider
    )

    const firstLookup = service.translate({ word: 'Emperor' })
    const secondLookup = service.translate({ word: '  emperor  ' })

    await flushMicrotasks()
    expect(translate).toHaveBeenCalledOnce()

    pending.resolve({
      originalWord: 'Emperor',
      translation: 'ဧကရာဇ်',
      provider: 'fake',
      targetLanguage: 'my'
    })

    const [first, second] = await Promise.all([firstLookup, secondLookup])
    expect(first.originalWord).toBe('Emperor')
    expect(second.originalWord).toBe('emperor')
    expect(first.translation).toBe('ဧကရာဇ်')
    expect(second.translation).toBe('ဧကရာဇ်')
    expect(service.cacheSize).toBe(1)
  })

  it('does not repopulate the cache when it is cleared during a pending lookup', async () => {
    const settings: TranslationRuntimeSettings = {
      provider: 'local-dictionary',
      targetLanguage: 'my',
      apiKey: ''
    }
    const firstPending = deferred<TranslationResult>()
    const translate = vi
      .fn()
      .mockImplementationOnce(() => firstPending.promise)
      .mockImplementation(async (request) => ({
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

    const firstLookup = service.translate({ word: 'emperor' })
    await flushMicrotasks()
    expect(translate).toHaveBeenCalledOnce()

    service.clearCache()
    expect(service.cacheSize).toBe(0)

    firstPending.resolve({
      originalWord: 'emperor',
      translation: 'ဧကရာဇ်',
      provider: 'fake',
      targetLanguage: 'my'
    })
    await firstLookup

    expect(service.cacheSize).toBe(0)

    await service.translate({ word: 'emperor' })
    expect(translate).toHaveBeenCalledTimes(2)
    expect(service.cacheSize).toBe(1)
  })
})

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
