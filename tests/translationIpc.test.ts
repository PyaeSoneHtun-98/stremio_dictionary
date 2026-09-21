import { describe, expect, it } from 'vitest'
import { normalizeTranslationRequest } from '../src/main/translation/ipc'

describe('translation IPC phrase context validation', () => {
  it('accepts a bounded phrase context that matches the clicked word', () => {
    expect(
      normalizeTranslationRequest({
        word: 'UP',
        context: 'I gave up.',
        contextTokens: ['i', 'gave', 'up'],
        clickedTokenIndex: 2
      })
    ).toEqual({
      word: 'UP',
      context: 'I gave up.',
      contextTokens: ['i', 'gave', 'up'],
      clickedTokenIndex: 2
    })
  })

  it('requires context tokens and clicked index to be supplied together', () => {
    expect(() =>
      normalizeTranslationRequest({
        word: 'up',
        contextTokens: ['give', 'up']
      })
    ).toThrow('Invalid phrase lookup context.')

    expect(() =>
      normalizeTranslationRequest({
        word: 'up',
        clickedTokenIndex: 1
      })
    ).toThrow('Invalid phrase lookup context.')
  })

  it('rejects excessive phrase token count and token length', () => {
    expect(() =>
      normalizeTranslationRequest({
        word: 'word',
        contextTokens: Array.from({ length: 17 }, () => 'word'),
        clickedTokenIndex: 0
      })
    ).toThrow('Invalid phrase lookup tokens.')

    expect(() =>
      normalizeTranslationRequest({
        word: 'word',
        contextTokens: ['word', 'x'.repeat(121)],
        clickedTokenIndex: 0
      })
    ).toThrow('Invalid phrase lookup token.')
  })

  it('rejects invalid clicked token indices', () => {
    for (const clickedTokenIndex of [-1, 2, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        normalizeTranslationRequest({
          word: 'up',
          contextTokens: ['give', 'up'],
          clickedTokenIndex
        })
      ).toThrow('Invalid clicked subtitle token.')
    }
  })

  it('rejects a phrase context whose indexed token does not match the clicked word', () => {
    expect(() =>
      normalizeTranslationRequest({
        word: 'house',
        contextTokens: ['give', 'up'],
        clickedTokenIndex: 1
      })
    ).toThrow('Phrase lookup context does not match the clicked subtitle word.')
  })

  it('rejects token strings that could smuggle multiple words through one token', () => {
    expect(() =>
      normalizeTranslationRequest({
        word: 'give',
        contextTokens: ['give up', 'now'],
        clickedTokenIndex: 0
      })
    ).toThrow('Invalid phrase lookup token.')
  })
})
