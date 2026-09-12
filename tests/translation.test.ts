import { describe, expect, it, vi } from 'vitest'
import { GoogleTranslationProvider } from '../src/main/translation/GoogleTranslationProvider'
import { LocalDictionaryProvider } from '../src/main/translation/LocalDictionaryProvider'
import { LOCAL_DICTIONARY } from '../src/main/translation/localDictionary'

describe('LocalDictionaryProvider', () => {
  it('translates a known English word to Burmese without configuration', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'emperor' })).resolves.toEqual({
      originalWord: 'emperor',
      translation: 'ဧကရာဇ်',
      provider: 'local-dictionary'
    })
  })

  it('normalizes casing and resolves inflected aliases', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'RUNNING' })).resolves.toMatchObject({
      originalWord: 'RUNNING',
      translation: 'ပြေးသည်',
      provider: 'local-dictionary'
    })
    await expect(provider.translate({ word: 'treaties' })).resolves.toMatchObject({
      translation: 'သဘောတူစာချုပ်'
    })
    await expect(provider.translate({ word: 'signed' })).resolves.toMatchObject({
      translation: 'လက်မှတ်ရေးထိုးသည်'
    })
  })

  it('returns a short readable failure for words not in the offline dictionary', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'photosynthesis' })).rejects.toThrow(
      'No offline Burmese translation is available'
    )
  })

  it('ships a useful starter dictionary rather than a single demo word', () => {
    expect(Object.keys(LOCAL_DICTIONARY).length).toBeGreaterThanOrEqual(75)
  })
})

describe('GoogleTranslationProvider', () => {
  it('requires an API key before making a network request', async () => {
    const fetchMock = vi.fn()
    const provider = new GoogleTranslationProvider('', fetchMock as unknown as typeof fetch)

    await expect(provider.translate({ word: 'emperor' })).rejects.toThrow(
      'Google Translation is not configured'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends only the selected word to Google and targets Burmese', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        q: 'emperor',
        source: 'en',
        target: 'my',
        format: 'text'
      })

      return new Response(
        JSON.stringify({
          data: {
            translations: [{ translatedText: 'ဧကရာဇ်' }]
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    const provider = new GoogleTranslationProvider('test-key', fetchMock as typeof fetch)

    await expect(
      provider.translate({ word: 'emperor', context: 'You will be emperor.' })
    ).resolves.toEqual({
      originalWord: 'emperor',
      translation: 'ဧကရာဇ်',
      provider: 'google'
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [requestUrl] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toContain('translation.googleapis.com/language/translate/v2')
    expect(String(requestUrl)).toContain('key=test-key')
  })

  it('reports quota failures without exposing provider response details', async () => {
    const fetchMock = vi.fn(async () => new Response('quota details', { status: 429 }))
    const provider = new GoogleTranslationProvider('test-key', fetchMock as unknown as typeof fetch)

    await expect(provider.translate({ word: 'run' })).rejects.toThrow(
      'Google Translation quota was reached'
    )
  })

  it('rejects an empty translation response', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { translations: [{ translatedText: '' }] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const provider = new GoogleTranslationProvider('test-key', fetchMock as unknown as typeof fetch)

    await expect(provider.translate({ word: 'hello' })).rejects.toThrow('returned an empty result')
  })
})
