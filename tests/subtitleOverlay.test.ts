import { describe, expect, it } from 'vitest'
import type { SubtitleCue } from '../src/shared/media'
import {
  buildPhraseLookupContext,
  segmentSubtitleCue
} from '../src/renderer/src/features/playback/subtitleSegments'

function makeCue(): SubtitleCue {
  return {
    id: 'cue-1',
    startTime: 1,
    endTime: 3,
    text: 'Hello, world!\nSecond line?',
    lines: ['Hello, world!', 'Second line?'],
    tokens: [
      { text: 'Hello', lookupTerm: 'hello', start: 0, end: 5 },
      { text: 'world', lookupTerm: 'world', start: 7, end: 12 },
      { text: 'Second', lookupTerm: 'second', start: 14, end: 20 },
      { text: 'line', lookupTerm: 'line', start: 21, end: 25 }
    ]
  }
}

describe('segmentSubtitleCue', () => {
  it('keeps punctuation and spaces while turning only lookup words into targets', () => {
    const segments = segmentSubtitleCue(makeCue())

    expect(
      segments.map((segment) =>
        segment.kind === 'word'
          ? `[${segment.token.text}]`
          : segment.kind === 'break'
            ? '\n'
            : segment.text
      )
    ).toEqual(['[Hello]', ', ', '[world]', '!', '\n', '[Second]', ' ', '[line]', '?'])
  })

  it('builds a bounded phrase context with a relative clicked-token index', () => {
    const cue = makeCue()
    const context = buildPhraseLookupContext(cue.tokens, cue.tokens[2])

    expect(context).toEqual({
      contextTokens: ['hello', 'world', 'second', 'line'],
      clickedTokenIndex: 2
    })
  })

  it('preserves lookup terms and character offsets for independent word selection', () => {
    const words = segmentSubtitleCue(makeCue()).filter((segment) => segment.kind === 'word')

    expect(words).toHaveLength(4)
    expect(words[0]).toMatchObject({
      kind: 'word',
      token: { text: 'Hello', lookupTerm: 'hello', start: 0, end: 5 }
    })
    expect(words[3]).toMatchObject({
      kind: 'word',
      token: { text: 'line', lookupTerm: 'line', start: 21, end: 25 }
    })
  })
})
