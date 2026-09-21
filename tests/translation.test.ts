import { describe, expect, it, vi } from 'vitest'
import { CORE_LOCAL_DICTIONARY } from '../src/main/translation/coreDictionary'
import { GoogleTranslationProvider } from '../src/main/translation/GoogleTranslationProvider'
import { LEGACY_COMPATIBILITY_ALIASES } from '../src/main/translation/legacyCompatibilityAliases'
import { LocalDictionaryProvider } from '../src/main/translation/LocalDictionaryProvider'
import {
  LOCAL_DICTIONARY,
  LOCAL_DICTIONARY_DATASET,
  PRODUCTION_LOCAL_DICTIONARY
} from '../src/main/translation/localDictionary'

describe('LocalDictionaryProvider', () => {
  it('loads the frozen 30,000-headword production corpus plus the structured core supplement', () => {
    expect(LOCAL_DICTIONARY_DATASET.version).toBe(1)
    expect(PRODUCTION_LOCAL_DICTIONARY).toHaveLength(30_000)
    expect(CORE_LOCAL_DICTIONARY).toHaveLength(16)
    expect(LOCAL_DICTIONARY).toHaveLength(30_016)

    const productionHeadwords = new Set(PRODUCTION_LOCAL_DICTIONARY.map((entry) => entry.word))
    const coreHeadwords = CORE_LOCAL_DICTIONARY.map((entry) => entry.word)

    expect(new Set(coreHeadwords).size).toBe(16)
    for (const word of coreHeadwords) {
      expect(productionHeadwords.has(word)).toBe(false)
    }
  })

  it('returns structured Burmese results from the production corpus', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'choose' })).resolves.toMatchObject({
      originalWord: 'choose',
      dictionaryEntry: {
        word: 'choose',
        pronunciation: expect.stringMatching(/^\/.+\/$/),
        meanings: expect.arrayContaining([
          expect.objectContaining({
            partOfSpeech: 'verb',
            burmese: expect.any(Array)
          })
        ])
      },
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })
  })

  it('normalizes casing and resolves a production inflected form to its canonical headword', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'CHOSEN' })).resolves.toMatchObject({
      originalWord: 'CHOSEN',
      dictionaryEntry: {
        word: 'choose'
      },
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })
  })

  it('keeps an exact production headword ahead of another entry form', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'warning' })).resolves.toMatchObject({
      dictionaryEntry: {
        word: 'warning'
      }
    })
  })

  it('provides the former legacy-only basics as structured dictionary entries', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'went' })).resolves.toMatchObject({
      originalWord: 'went',
      translation: 'သွားသည်',
      pronunciation: '/ɡoʊ/',
      dictionaryEntry: {
        word: 'go',
        forms: ['goes', 'went', 'gone', 'going'],
        meanings: [{ partOfSpeech: 'verb', burmese: ['သွားသည်'] }]
      },
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })

    await expect(provider.translate({ word: 'yes' })).resolves.toMatchObject({
      dictionaryEntry: {
        word: 'yes',
        meanings: [{ partOfSpeech: 'interjection', burmese: ['ဟုတ်ကဲ့'] }]
      }
    })
  })

  it('preserves every legacy compatibility alias that is absent from the frozen corpus forms', async () => {
    const provider = new LocalDictionaryProvider()
    const compatibilityCases = Object.entries(LEGACY_COMPATIBILITY_ALIASES).flatMap(
      ([headword, aliases]) => aliases.map((alias) => ({ alias, headword }))
    )

    expect(compatibilityCases).toHaveLength(11)

    for (const { alias, headword } of compatibilityCases) {
      await expect(provider.translate({ word: alias })).resolves.toMatchObject({
        originalWord: alias,
        dictionaryEntry: {
          word: headword
        },
        provider: 'local-dictionary',
        targetLanguage: 'my'
      })
    }
  })

  it('prefers a detected phrase over the clicked individual word', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(
      provider.translate({
        word: 'out',
        contextTokens: ['we', 'ran', 'out', 'of', 'time'],
        clickedTokenIndex: 2
      })
    ).resolves.toMatchObject({
      originalWord: 'out',
      translation: 'ကုန်သွားသည်၊ လက်ကျန်မရှိတော့သည်',
      phraseEntry: {
        phrase: 'run out of',
        type: 'phrasal_verb'
      },
      phraseMatch: {
        source: 'ran out of',
        startTokenIndex: 1,
        endTokenIndex: 4
      },
      provider: 'local-dictionary',
      targetLanguage: 'my'
    })
  })

  it('falls back to the existing word dictionary when no phrase matches', async () => {
    const provider = new LocalDictionaryProvider()
    const result = await provider.translate({
      word: 'choose',
      contextTokens: ['please', 'choose', 'one'],
      clickedTokenIndex: 1
    })

    expect(result).toMatchObject({
      dictionaryEntry: {
        word: 'choose'
      },
      provider: 'local-dictionary'
    })
    expect(result.phraseEntry).toBeUndefined()
    expect(result.phraseMatch).toBeUndefined()
  })

  it('rejects target languages not present in the offline dataset', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'choose', targetLanguage: 'ja' })).rejects.toThrow(
      'currently supports Burmese'
    )
  })

  it('returns a short readable failure for words not in the offline dictionary', async () => {
    const provider = new LocalDictionaryProvider()

    await expect(provider.translate({ word: 'zzzxqvsubtitlebridgeunknown' })).rejects.toThrow(
      'No offline Burmese translation is available'
    )
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
