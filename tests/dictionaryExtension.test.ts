import { describe, expect, it } from 'vitest'
import { validateDictionaryDocument } from '../scripts/dictionary-lib.mjs'
import { tokenizeSubtitleText } from '../src/main/subtitles/normalize'
import { buildPhraseLookupContext } from '../src/renderer/src/features/playback/subtitleSegments'
import { CORE_LOCAL_DICTIONARY } from '../src/main/translation/coreDictionary'
import { LEGACY_COMPATIBILITY_ALIASES } from '../src/main/translation/legacyCompatibilityAliases'
import { LocalDictionaryProvider } from '../src/main/translation/LocalDictionaryProvider'
import {
  LOCAL_DICTIONARY,
  LOCAL_DICTIONARY_EXTENSION,
  LOCAL_DICTIONARY_EXTENSION_DATASET,
  PRODUCTION_LOCAL_DICTIONARY,
} from '../src/main/translation/localDictionary'
import { LOCAL_PHRASES } from '../src/main/translation/PhraseMatcher'
import {
  normalizeDictionaryReport,
  REPORT_DICTIONARY_VERSION,
  REPORT_PHRASE_DICTIONARY_VERSION,
} from '../src/shared/dictionaryReport'

describe('integrated dictionary extension', () => {
  const provider = new LocalDictionaryProvider()

  it('has a valid combined schema, unique headwords and no ambiguous form ownership', () => {
    expect(() =>
      validateDictionaryDocument({ version: 1, entries: LOCAL_DICTIONARY }),
    ).not.toThrow()
    expect(new Set(LOCAL_DICTIONARY.map((entry) => entry.word)).size).toBe(40_011)
    const frozenKeys = new Set(
      PRODUCTION_LOCAL_DICTIONARY.flatMap((entry) => [entry.word, ...entry.forms]),
    )
    for (const entry of LOCAL_DICTIONARY_EXTENSION_DATASET.entries) {
      for (const key of [entry.word, ...entry.forms]) expect(frozenKeys.has(key)).toBe(false)
    }
  })

  it('resolves all 16,361 upstream keys after real subtitle tokenization and accepts canonical reports', async () => {
    let checked = 0
    const effectiveByWord = new Map(LOCAL_DICTIONARY_EXTENSION.map((entry) => [entry.word, entry]))
    for (const entry of LOCAL_DICTIONARY_EXTENSION_DATASET.entries) {
      for (const key of [entry.word, ...entry.forms]) {
        const tokens = tokenizeSubtitleText(`"${key.toUpperCase()}!"`)
        expect(tokens).toHaveLength(1)
        expect(tokens[0].lookupTerm).toBe(key)
        const result = await provider.translate({ word: tokens[0].lookupTerm })
        expect(result.dictionaryEntry).toEqual(effectiveByWord.get(entry.word))
        expect(result.translation).toBe(
          effectiveByWord
            .get(entry.word)
            ?.meanings.flatMap((meaning) => meaning.burmese)
            .join('၊ '),
        )
        checked++
      }
      expect(normalizeDictionaryReport({ term: entry.word, category: 'incorrect' })).not.toBeNull()
    }
    expect(checked).toBe(16_361)
  }, 15_000)

  it('retains every frozen canonical/form lookup and all app-only core/compatibility keys', async () => {
    const baselineHeads = new Set(
      [...PRODUCTION_LOCAL_DICTIONARY, ...CORE_LOCAL_DICTIONARY].map((entry) => entry.word),
    )
    for (const entry of PRODUCTION_LOCAL_DICTIONARY) {
      for (const key of [entry.word, ...entry.forms]) {
        const result = await provider.translate({ word: key })
        expect(result.dictionaryEntry?.word).toBe(baselineHeads.has(key) ? key : entry.word)
      }
    }
    const extensionHeads = new Set(LOCAL_DICTIONARY_EXTENSION.map((entry) => entry.word))
    for (const entry of CORE_LOCAL_DICTIONARY) {
      for (const key of [entry.word, ...entry.forms]) {
        const result = await provider.translate({ word: key })
        expect(result.dictionaryEntry?.word).toBe(extensionHeads.has(key) ? key : entry.word)
      }
    }
    for (const [headword, aliases] of Object.entries(LEGACY_COMPATIBILITY_ALIASES)) {
      for (const alias of aliases) {
        expect((await provider.translate({ word: alias })).dictionaryEntry?.word).toBe(
          extensionHeads.has(alias) ? alias : headword,
        )
      }
    }
  }, 15_000)

  it('keeps ordinary subtitle meanings for every overlapping core/alias key', async () => {
    const cases = [
      ['going', 'သွားသည်'],
      ['go', 'သွားသည်'],
      ['goes', 'သွားသည်'],
      ['went', 'သွားသည်'],
      ['gone', 'သွားသည်'],
      ['run', 'ပြေးသည်'],
      ['runs', 'လည်ပတ်သည်'],
      ['ran', 'စီမံခန့်ခွဲသည်'],
      ['see', 'မြင်သည်'],
      ['sees', 'မြင်သည်'],
      ['saw', 'မြင်သည်'],
      ['seen', 'မြင်သည်'],
      ['love', 'ချစ်သည်'],
      ['loves', 'ချစ်သည်'],
      ['loved', 'ချစ်ခဲ့သည်'],
      ['loving', 'ချစ်သည်'],
      ['running', 'ပြေးသည်'],
      ['running', 'လည်ပတ်သည်'],
      ['running', 'စီမံခန့်ခွဲသည်'],
      ['saying', 'ပြောသည်'],
      ['seeing', 'မြင်သည်'],
      ['signed', 'လက်မှတ်ရေးထိုးသည်'],
      ['signing', 'လက်မှတ်ရေးထိုးသည်'],
      ['wait', 'စောင့်သည်'],
      ['waits', 'စောင့်သည်'],
      ['waited', 'စောင့်သည်'],
      ['waiting', 'စောင့်သည်'],
    ]
    for (const [word, meaning] of cases) {
      const result = await provider.translate({ word })
      expect(result.dictionaryEntry?.meanings.flatMap((group) => group.burmese)).toContain(meaning)
    }
    expect((await provider.translate({ word: 'waited' })).dictionaryEntry?.word).toBe('wait')
    expect((await provider.translate({ word: 'running' })).dictionaryEntry?.word).toBe('running')
  })

  it.each([
    ['I can swim.', 'can', 'modal', 'နိုင်သည်'],
    ['I do not want to die.', 'die', 'verb', 'သေဆုံးသည်'],
    ['Let me explain.', 'let', 'verb', 'ခွင့်ပြုသည်'],
    ['It is in the room.', 'in', 'preposition', 'အထဲ၌'],
    ['That costs a lot.', 'lot', 'noun', 'များပြားသောပမာဏ'],
  ])('retains the common subtitle sense in %s', async (text, word, partOfSpeech, meaning) => {
    const tokens = tokenizeSubtitleText(text)
    const token = tokens.find((token) => token.lookupTerm === word)
    expect(token).toBeDefined()
    if (!token) return
    const result = await provider.translate({
      word: token.lookupTerm,
      ...buildPhraseLookupContext(tokens, token),
    })
    expect(result.dictionaryEntry?.meanings).toContainEqual({
      partOfSpeech,
      burmese: expect.arrayContaining([meaning]),
    })
  })

  it('preserves phrase-first matching for all 11,509 variants from every real subtitle token', async () => {
    let checked = 0
    for (const entry of LOCAL_PHRASES) {
      for (const variant of [entry.phrase, ...entry.forms]) {
        const tokens = tokenizeSubtitleText(`"${variant.toUpperCase()}!"`)
        for (const token of tokens) {
          const result = await provider.translate({
            word: token.lookupTerm,
            ...buildPhraseLookupContext(tokens, token),
          })
          expect(result.phraseEntry).toEqual(entry)
          expect(normalizeDictionaryReport({ term: result.phraseEntry?.phrase, category: 'incorrect' })).not.toBeNull()
        }
        checked++
      }
    }
    expect(checked).toBe(11_509)
  }, 15_000)

  it('identifies the extension/correction snapshot using the existing backend version contract', () => {
    expect(REPORT_DICTIONARY_VERSION).toBe('1.0-ext.061-080.2')
    expect(REPORT_DICTIONARY_VERSION.length).toBeLessThanOrEqual(32)
    expect(REPORT_DICTIONARY_VERSION).toMatch(/^\d+\.\d+(?:\.\d+)?(?:-[a-z0-9.-]+)?$/i)
    expect(REPORT_PHRASE_DICTIONARY_VERSION).toBe('1.0-ext.013-016.1')
    expect(REPORT_PHRASE_DICTIONARY_VERSION.length).toBeLessThanOrEqual(32)
    expect(REPORT_PHRASE_DICTIONARY_VERSION).toMatch(/^\d+\.\d+(?:\.\d+)?(?:-[a-z0-9.-]+)?$/i)
  })
})
