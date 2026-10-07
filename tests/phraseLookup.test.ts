import { describe, expect, it } from 'vitest'
import {
  LOCAL_PHRASE_DATASET,
  LOCAL_PHRASES,
  PRODUCTION_LOCAL_PHRASES,
  LOCAL_PHRASE_EXTENSION,
  createPhraseMatcher,
  findLocalPhraseMatch
} from '../src/main/translation/PhraseMatcher'
import type { PhraseEntry } from '../src/shared/translation'
import { tokenizeSubtitleText } from '../src/main/subtitles/normalize'

describe('PhraseMatcher', () => {
  it('loads the frozen Phrase Dictionary v1 dataset', () => {
    expect(LOCAL_PHRASE_DATASET.version).toBe(1)
    expect(PRODUCTION_LOCAL_PHRASES).toHaveLength(3000)
    expect(PRODUCTION_LOCAL_PHRASES.reduce((total, entry) => total + entry.forms.length, 0)).toBe(4827)
    expect(LOCAL_PHRASE_EXTENSION).toHaveLength(1000)
    expect(LOCAL_PHRASES).toHaveLength(4000)

    const phrases = new Set(LOCAL_PHRASES.map((entry) => entry.phrase))
    expect(phrases).toContain('give up')
    expect(phrases).toContain('run out of')
    expect(phrases).toContain("what's going on")
    expect(phrases).toContain('over the moon')
  })

  it('matches a phrase added by the production v1 dataset', () => {
    expect(
      findLocalPhraseMatch({
        word: 'price',
        contextTokens: ['you', 'paid', 'the', 'price'],
        clickedTokenIndex: 3
      })
    ).toMatchObject({
      entry: {
        phrase: 'pay the price',
        burmese: ['အကျိုးဆက်ကို ခံရသည်', 'တန်ဖိုးပေးဆပ်ရသည်']
      },
      match: {
        source: 'paid the price',
        startTokenIndex: 1,
        endTokenIndex: 4
      }
    })
  })

  it('matches a phrase when any token inside it is clicked', () => {
    const request = {
      word: 'out',
      contextTokens: ['we', 'ran', 'out', 'of', 'time'],
      clickedTokenIndex: 2
    }

    expect(findLocalPhraseMatch(request)).toMatchObject({
      entry: { phrase: 'run out of' },
      match: {
        source: 'ran out of',
        startTokenIndex: 1,
        endTokenIndex: 4
      }
    })

    expect(
      findLocalPhraseMatch({
        ...request,
        word: 'of',
        clickedTokenIndex: 3
      })
    ).toMatchObject({
      entry: { phrase: 'run out of' }
    })
  })

  it('normalizes casing and edge punctuation in context tokens', () => {
    expect(
      findLocalPhraseMatch({
        word: 'OUT',
        contextTokens: ['We', 'RAN', 'OUT!', 'OF', 'time'],
        clickedTokenIndex: 2
      })
    ).toMatchObject({
      entry: { phrase: 'run out of' },
      match: { source: 'ran out of' }
    })
  })

  it('prefers the longest known phrase containing the clicked token', () => {
    const entries: PhraseEntry[] = [
      {
        phrase: 'come up',
        type: 'phrasal_verb',
        forms: [],
        burmese: ['ပေါ်လာသည်']
      },
      {
        phrase: 'come up with',
        type: 'phrasal_verb',
        forms: ['came up with'],
        burmese: ['စဉ်းစားထုတ်သည်']
      }
    ]
    const matcher = createPhraseMatcher(entries)

    expect(matcher.match(['she', 'came', 'up', 'with', 'a', 'plan'], 2)).toMatchObject({
      entry: { phrase: 'come up with' },
      match: {
        source: 'came up with',
        startTokenIndex: 1,
        endTokenIndex: 4
      }
    })
  })

  it('rejects duplicate normalized variants within one phrase entry', () => {
    expect(() =>
      createPhraseMatcher([
        {
          phrase: 'give up',
          type: 'phrasal_verb',
          forms: ['GIVE UP'],
          burmese: ['လက်လျှော့သည်']
        }
      ])
    ).toThrow('Duplicate phrase variant within give up: give up')

    expect(() =>
      createPhraseMatcher([
        {
          phrase: 'look after',
          type: 'phrasal_verb',
          forms: ['looked after', 'LOOKED AFTER'],
          burmese: ['စောင့်ရှောက်သည်']
        }
      ])
    ).toThrow('Duplicate phrase variant within look after: looked after')
  })

  it('returns null when the clicked token belongs to no known phrase', () => {
    expect(
      findLocalPhraseMatch({
        word: 'house',
        contextTokens: ['the', 'big', 'house'],
        clickedTokenIndex: 2
      })
    ).toBeNull()
  })

  it('matches hyphenated surfaces while retaining the canonical phrase and token span', () => {
    const contextTokens = tokenizeSubtitleText('Things went pear-shaped yesterday.').map(token => token.lookupTerm)
    for (const clickedTokenIndex of [1, 2, 3]) {
      expect(findLocalPhraseMatch({word: contextTokens[clickedTokenIndex], contextTokens, clickedTokenIndex})).toMatchObject({
        entry: { phrase: 'go pear-shaped' },
        match: { source: 'went pear shaped', startTokenIndex: 1, endTokenIndex: 4 },
      })
    }
  })

  it('rejects collisions introduced by subtitle tokenization', () => {
    expect(() => createPhraseMatcher([
      { phrase: 'go pear-shaped', type: 'idiom', forms: [], burmese: ['အခြေအနေ ပျက်ယွင်းသွားသည်'] },
      { phrase: 'go pear shaped', type: 'expression', forms: [], burmese: ['အခြေအနေ ပျက်ယွင်းသွားသည်'] },
    ])).toThrow('Phrase variant collision')
  })

  it('allows distinct hyphenated/open spellings to share a key under the same owner', () => {
    const matcher = createPhraseMatcher([
      { phrase: "bird's-eye view", type: 'expression', forms: ["bird's eye view"], burmese: ['အပေါ်မှ စီးမြင်ရသော မြင်ကွင်း'] },
    ])
    expect(matcher.match(["bird's", 'eye', 'view'], 1)?.entry.phrase).toBe("bird's-eye view")
  })

  it('rejects surfaces longer than the supported context after splitting hyphens', () => {
    expect(() => createPhraseMatcher([
      { phrase: 'one-two three-four five-six', type: 'expression', forms: [], burmese: ['စမ်းသပ်ချက်'] },
    ])).toThrow('2–5 subtitle tokens')
  })
})
