import { describe, expect, it, vi } from 'vitest'
import { GoogleTranslationProvider } from '../src/main/translation/GoogleTranslationProvider'
import { LocalDictionaryProvider } from '../src/main/translation/LocalDictionaryProvider'
import { LOCAL_DICTIONARY } from '../src/main/translation/localDictionary'

describe('LocalDictionaryProvider', () => {
  it('returns a structured Burmese dictionary entry without configuration', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'charge' })).resolves.toEqual({
      originalWord: 'charge',
      translation: 'ငွေတောင်းသည်၊ စွပ်စွဲသည်၊ တာဝန်',
      pronunciation: '/tʃɑrdʒ/',
      dictionaryEntry: {
        word: 'charge',
        pronunciation: '/tʃɑrdʒ/',
        forms: ['charges', 'charged', 'charging'],
        meanings: [
          {
            partOfSpeech: 'verb',
            burmese: ['ငွေတောင်းသည်', 'စွပ်စွဲသည်']
          },
          {
            partOfSpeech: 'noun',
            burmese: ['တာဝန်']
          }
        ]
      },
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })
  })

  it('normalizes casing and resolves inflected forms to the canonical headword', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'RUNNING' })).resolves.toMatchObject({
      originalWord: 'RUNNING',
      translation: 'ပြေးသည်၊ လည်ပတ်သည်၊ စီမံခန့်ခွဲသည်',
      dictionaryEntry: {
        word: 'run'
      },
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })
    await expect(provider.translate({ word: 'treaties' })).resolves.toMatchObject({
      dictionaryEntry: {
        word: 'treaty'
      },
      translation: 'သဘောတူစာချုပ်'
    })
    await expect(provider.translate({ word: 'signed' })).resolves.toMatchObject({
      dictionaryEntry: {
        word: 'sign'
      },
      translation: 'လက်မှတ်ရေးထိုးသည်၊ အမှတ်အသား'
    })
  })

  it('rejects target languages not present in the offline dataset', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'charge', targetLanguage: 'ja' })).rejects.toThrow(
      'currently supports Burmese'
    )
  })

  it('returns a short readable failure for words not in the offline dictionary', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'photosynthesis' })).rejects.toThrow(
      'No offline Burmese translation is available'
    )
  })

  it('loads structured entries from the JSON dataset', () => {
    expect(LOCAL_DICTIONARY.length).toBeGreaterThanOrEqual(15)
    expect(LOCAL_DICTIONARY.find((entry) => entry.word === 'charge')).toMatchObject({
      pronunciation: '/tʃɑrdʒ/',
      meanings: [
        { partOfSpeech: 'verb', burmese: ['ငွေတောင်းသည်', 'စွပ်စွဲသည်'] },
        { partOfSpeech: 'noun', burmese: ['တာဝန်'] }
      ]
    })
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

  it('sends only the selected word to Google and uses the requested target language', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        q: 'emperor',
        source: 'en',
        target: 'ja',
        format: 'text'
      })

      return new Response(
        JSON.stringify({
          data: {
            translations: [{ translatedText: '皇帝' }]
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    const provider = new GoogleTranslationProvider('test-key', fetchMock as typeof fetch)

    await expect(
      provider.translate({
        word: 'emperor',
        context: 'You will be emperor.',
        targetLanguage: 'ja'
      })
    ).resolves.toEqual({
      originalWord: 'emperor',
      translation: '皇帝',
      provider: 'google',
      targetLanguage: 'ja'
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
