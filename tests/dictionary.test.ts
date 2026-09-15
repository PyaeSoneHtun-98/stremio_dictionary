import { describe, expect, it } from 'vitest'
import {
  mergeDictionaryBatches,
  validateDictionaryBatchFile,
  validateDictionaryBatchNames,
  validateDictionaryBatchSequence,
  validateDictionaryDocument
} from '../scripts/dictionary-lib.mjs'

const validEntry = {
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
}

function createBatchEntries(count: number): Array<{
  word: string
  pronunciation: string
  forms: string[]
  meanings: Array<{ partOfSpeech: string; burmese: string[] }>
}> {
  return Array.from({ length: count }, (_, index) => ({
    word: `word${index}`,
    pronunciation: '/wɝd/',
    forms: [],
    meanings: [{ partOfSpeech: 'noun', burmese: ['စကားလုံး'] }]
  }))
}

describe('dictionary validation', () => {
  it('accepts the agreed v1 schema', () => {
    const document = {
      version: 1,
      batch: 1,
      entries: [validEntry]
    }

    expect(() =>
      validateDictionaryDocument(document, { source: 'batch-1', requireBatch: true })
    ).not.toThrow()
  })

  it('requires contiguous batches with 500 entries and matching filenames', () => {
    const validBatch = {
      version: 1,
      batch: 1,
      entries: createBatchEntries(500)
    }

    expect(() =>
      validateDictionaryBatchNames(['README.md', 'dictionary_batch_001.json'])
    ).not.toThrow()
    expect(() =>
      validateDictionaryBatchNames(['dictionary_batch_001.json', 'dictionary_batch_02.json'])
    ).toThrow('Malformed dictionary batch filename')
    expect(() => validateDictionaryBatchNames(['dictionary_batch_001.JSON'])).toThrow(
      'Malformed dictionary batch filename'
    )

    expect(() =>
      validateDictionaryBatchSequence(['dictionary_batch_001.json', 'dictionary_batch_002.json'])
    ).not.toThrow()
    expect(() =>
      validateDictionaryBatchSequence(['dictionary_batch_001.json', 'dictionary_batch_003.json'])
    ).toThrow('must be contiguous')

    expect(() =>
      validateDictionaryBatchFile('dictionary_batch_001.json', validBatch)
    ).not.toThrow()

    expect(() =>
      validateDictionaryBatchFile('dictionary_batch_002.json', validBatch)
    ).toThrow('filename declares batch 2')

    expect(() =>
      validateDictionaryBatchFile('dictionary_batch_001.json', {
        ...validBatch,
        entries: createBatchEntries(499)
      })
    ).toThrow('expected exactly 500 entries')
  })

  it('rejects more than three Burmese semantic meanings per headword', () => {
    const document = {
      version: 1,
      entries: [
        {
          ...validEntry,
          meanings: [
            {
              partOfSpeech: 'verb',
              burmese: ['တစ်', 'နှစ်', 'သုံး', 'လေး']
            }
          ]
        }
      ]
    }

    expect(() => validateDictionaryDocument(document)).toThrow('maximum 3 Burmese')
  })

  it('rejects repeated part-of-speech groups instead of silently duplicating labels', () => {
    const document = {
      version: 1,
      entries: [
        {
          ...validEntry,
          meanings: [
            { partOfSpeech: 'verb', burmese: ['ငွေတောင်းသည်'] },
            { partOfSpeech: 'verb', burmese: ['စွပ်စွဲသည်'] }
          ]
        }
      ]
    }

    expect(() => validateDictionaryDocument(document)).toThrow('group same-POS meanings together')
  })

  it('allows an exact headword to overlap another entry form', () => {
    const document = {
      version: 1,
      entries: [
        {
          word: 'warn',
          pronunciation: '/wɔrn/',
          forms: ['warns', 'warned', 'warning'],
          meanings: [{ partOfSpeech: 'verb', burmese: ['သတိပေးသည်'] }]
        },
        {
          word: 'warning',
          pronunciation: '/ˈwɔrnɪŋ/',
          forms: ['warnings'],
          meanings: [{ partOfSpeech: 'noun', burmese: ['သတိပေးချက်'] }]
        }
      ]
    }

    expect(() => validateDictionaryDocument(document)).not.toThrow()
  })

  it('rejects one form owned by two different headwords', () => {
    const batch1 = {
      version: 1,
      batch: 1,
      entries: [
        {
          word: 'alpha',
          pronunciation: '/ˈælfə/',
          forms: ['sharedform'],
          meanings: [{ partOfSpeech: 'noun', burmese: ['အယ်လ်ဖာ'] }]
        }
      ]
    }
    const batch2 = {
      version: 1,
      batch: 2,
      entries: [
        {
          word: 'beta',
          pronunciation: '/ˈbeɪtə/',
          forms: ['sharedform'],
          meanings: [{ partOfSpeech: 'noun', burmese: ['ဘီတာ'] }]
        }
      ]
    }

    expect(() =>
      mergeDictionaryBatches([
        { source: 'batch-1', document: batch1 },
        { source: 'batch-2', document: batch2 }
      ])
    ).toThrow('Form collision')
  })

  it('allows headword/form overlap across separate batches regardless of order', () => {
    const batch1 = {
      version: 1,
      batch: 1,
      entries: [
        {
          word: 'warn',
          pronunciation: '/wɔrn/',
          forms: ['warning'],
          meanings: [{ partOfSpeech: 'verb', burmese: ['သတိပေးသည်'] }]
        }
      ]
    }
    const batch2 = {
      version: 1,
      batch: 2,
      entries: [
        {
          word: 'warning',
          pronunciation: '/ˈwɔrnɪŋ/',
          forms: ['warnings'],
          meanings: [{ partOfSpeech: 'noun', burmese: ['သတိပေးချက်'] }]
        }
      ]
    }

    expect(() =>
      mergeDictionaryBatches([
        { source: 'batch-1', document: batch1 },
        { source: 'batch-2', document: batch2 }
      ])
    ).not.toThrow()
  })

  it('merges valid batches deterministically by headword', () => {
    const merged = mergeDictionaryBatches([
      {
        source: 'batch-2',
        document: {
          version: 1,
          batch: 2,
          entries: [
            {
              word: 'betray',
              pronunciation: '/bɪˈtreɪ/',
              forms: ['betrays', 'betrayed', 'betraying'],
              meanings: [{ partOfSpeech: 'verb', burmese: ['သစ္စာဖောက်သည်'] }]
            }
          ]
        }
      },
      {
        source: 'batch-1',
        document: {
          version: 1,
          batch: 1,
          entries: [validEntry]
        }
      }
    ])

    expect(merged.entries.map((entry: { word: string }) => entry.word)).toEqual([
      'betray',
      'charge'
    ])
  })
})
