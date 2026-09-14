import { describe, expect, it } from 'vitest'
import {
  mergeDictionaryBatches,
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

  it('rejects lookup collisions across separate batches', () => {
    const batch1 = {
      version: 1,
      batch: 1,
      entries: [validEntry]
    }
    const batch2 = {
      version: 1,
      batch: 2,
      entries: [
        {
          word: 'charged',
          pronunciation: '/tʃɑrdʒd/',
          forms: [],
          meanings: [{ partOfSpeech: 'adjective', burmese: ['စွဲချက်တင်ခံထားရသော'] }]
        }
      ]
    }

    expect(() =>
      mergeDictionaryBatches([
        { source: 'batch-1', document: batch1 },
        { source: 'batch-2', document: batch2 }
      ])
    ).toThrow('Lookup collision')
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
