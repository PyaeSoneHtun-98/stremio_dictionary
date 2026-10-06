import { describe, expect, it } from 'vitest'
import { validateDictionaryDocument } from '../scripts/dictionary-lib.mjs'
import { tokenizeSubtitleText } from '../src/main/subtitles/normalize'
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
} from '../src/shared/dictionaryReport'

describe('integrated dictionary extension', () => {
  const provider = new LocalDictionaryProvider()

  it('has a valid combined schema, unique headwords and no ambiguous form ownership', () => {
    expect(() =>
      validateDictionaryDocument({ version: 1, entries: LOCAL_DICTIONARY }),
    ).not.toThrow()
    expect(new Set(LOCAL_DICTIONARY.map((entry) => entry.word)).size).toBe(35_014)
    const frozenKeys = new Set(
      PRODUCTION_LOCAL_DICTIONARY.flatMap((entry) => [entry.word, ...entry.forms]),
    )
    for (const entry of LOCAL_DICTIONARY_EXTENSION_DATASET.entries) {
      for (const key of [entry.word, ...entry.forms]) expect(frozenKeys.has(key)).toBe(false)
    }
  })

  it('resolves all 8,783 upstream keys after real subtitle tokenization and accepts canonical reports', async () => {
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
    expect(checked).toBe(8_783)
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

  it('preserves phrase-first matching for all 7,827 canonical/form variants', async () => {
    let checked = 0
    for (const entry of LOCAL_PHRASES) {
      for (const variant of [entry.phrase, ...entry.forms]) {
        const contextTokens = variant.split(' ')
        const result = await provider.translate({
          word: contextTokens[0],
          contextTokens,
          clickedTokenIndex: 0,
        })
        expect(result.phraseEntry?.phrase).toBe(entry.phrase)
        checked++
      }
    }
    expect(checked).toBe(7_827)
  }, 15_000)

  it('identifies the extension/correction snapshot using the existing backend version contract', () => {
    expect(REPORT_DICTIONARY_VERSION).toBe('1.0-ext.061-070.1')
    expect(REPORT_DICTIONARY_VERSION.length).toBeLessThanOrEqual(32)
    expect(REPORT_DICTIONARY_VERSION).toMatch(/^\d+\.\d+(?:\.\d+)?(?:-[a-z0-9.-]+)?$/i)
  })
})
