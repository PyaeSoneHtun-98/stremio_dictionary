import { describe, expect, it } from 'vitest'
import {
  LOCAL_PHRASE_DATASET,
  LOCAL_PHRASES,
  createPhraseMatcher,
  findLocalPhraseMatch
} from '../src/main/translation/PhraseMatcher'
import type { PhraseEntry } from '../src/shared/translation'

describe('PhraseMatcher', () => {
  it('loads the frozen Phrase Dictionary v1 dataset', () => {
    expect(LOCAL_PHRASE_DATASET.version).toBe(1)
    expect(LOCAL_PHRASES).toHaveLength(3000)
    expect(LOCAL_PHRASES.reduce((total, entry) => total + entry.forms.length, 0)).toBe(4827)

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
})
