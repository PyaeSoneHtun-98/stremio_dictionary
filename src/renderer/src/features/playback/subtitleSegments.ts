import type { SubtitleCue, SubtitleToken } from '../../../../shared/media'

export type SubtitleSegment =
  | { kind: 'text'; text: string; key: string }
  | { kind: 'word'; token: SubtitleToken; key: string }
  | { kind: 'break'; key: string }

export function segmentSubtitleCue(cue: SubtitleCue): SubtitleSegment[] {
  const segments: SubtitleSegment[] = []
  const tokens = [...cue.tokens].sort((left, right) => left.start - right.start)
  let cursor = 0
  let textIndex = 0

  for (const token of tokens) {
    if (token.start < cursor || token.end <= token.start || token.end > cue.text.length) {
      continue
    }

    pushTextSegments(segments, cue.text.slice(cursor, token.start), cursor, () => textIndex++)
    segments.push({ kind: 'word', token, key: `word-${token.start}-${token.end}` })
    cursor = token.end
  }

  pushTextSegments(segments, cue.text.slice(cursor), cursor, () => textIndex++)
  return segments
}

function pushTextSegments(
  segments: SubtitleSegment[],
  text: string,
  absoluteStart: number,
  nextTextIndex: () => number
): void {
  if (!text) {
    return
  }

  let chunkStart = 0

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\n') {
      continue
    }

    if (index > chunkStart) {
      const chunk = text.slice(chunkStart, index)
      segments.push({
        kind: 'text',
        text: chunk,
        key: `text-${absoluteStart + chunkStart}-${nextTextIndex()}`
      })
    }

    segments.push({ kind: 'break', key: `break-${absoluteStart + index}` })
    chunkStart = index + 1
  }

  if (chunkStart < text.length) {
    segments.push({
      kind: 'text',
      text: text.slice(chunkStart),
      key: `text-${absoluteStart + chunkStart}-${nextTextIndex()}`
    })
  }
}


export interface PhraseLookupContext {
  contextTokens: string[]
  clickedTokenIndex: number
}

const PHRASE_CONTEXT_RADIUS = 4

export function buildPhraseLookupContext(
  tokens: readonly SubtitleToken[],
  selectedToken: SubtitleToken
): PhraseLookupContext | null {
  const orderedTokens = [...tokens].sort((left, right) => left.start - right.start)
  const selectedIndex = orderedTokens.findIndex(
    (token) => token.start === selectedToken.start && token.end === selectedToken.end
  )

  if (selectedIndex < 0) {
    return null
  }

  const start = Math.max(0, selectedIndex - PHRASE_CONTEXT_RADIUS)
  const end = Math.min(orderedTokens.length, selectedIndex + PHRASE_CONTEXT_RADIUS + 1)
  const contextTokens = orderedTokens.slice(start, end).map((token) => token.lookupTerm)

  return {
    contextTokens,
    clickedTokenIndex: selectedIndex - start
  }
}
