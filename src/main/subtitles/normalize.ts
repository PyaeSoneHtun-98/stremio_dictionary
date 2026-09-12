import type { SubtitleCue, SubtitleToken } from '../../shared/media'

const TIMING_LINE =
  /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})(?:\s+.*)?$/
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu

export function parseSrtCues(source: string): SubtitleCue[] {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) {
    return []
  }

  const cues: SubtitleCue[] = []
  const blocks = normalized.split(/\n{2,}/)

  for (const block of blocks) {
    const lines = block.split('\n')
    const timingIndex = lines.findIndex((line) => TIMING_LINE.test(line.trim()))
    if (timingIndex < 0) {
      continue
    }

    const match = TIMING_LINE.exec(lines[timingIndex].trim())
    if (!match) {
      continue
    }

    const startTime = timestampToSeconds(match.slice(1, 5))
    const endTime = timestampToSeconds(match.slice(5, 9))
    if (endTime <= startTime) {
      continue
    }

    const readableLines = lines
      .slice(timingIndex + 1)
      .map((line) => stripSubtitleMarkup(line).trimEnd())
      .filter((line, index, all) => line.length > 0 || (index > 0 && index < all.length - 1))

    const text = readableLines.join('\n').trim()
    if (!text) {
      continue
    }

    cues.push({
      id: `${startTime.toFixed(3)}-${endTime.toFixed(3)}-${cues.length}`,
      startTime,
      endTime,
      text,
      lines: text.split('\n'),
      tokens: tokenizeSubtitleText(text)
    })
  }

  return cues.sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime)
}

export function tokenizeSubtitleText(text: string): SubtitleToken[] {
  const tokens: SubtitleToken[] = []

  for (const match of text.matchAll(WORD_PATTERN)) {
    const value = match[0]
    const start = match.index
    if (start === undefined) {
      continue
    }

    const lookupTerm = normalizeLookupTerm(value)
    if (!lookupTerm) {
      continue
    }

    tokens.push({
      text: value,
      lookupTerm,
      start,
      end: start + value.length
    })
  }

  return tokens
}

export function normalizeLookupTerm(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

export function findActiveCue(cues: SubtitleCue[], time: number | null): SubtitleCue | null {
  if (time === null || !Number.isFinite(time) || cues.length === 0) {
    return null
  }

  let low = 0
  let high = cues.length - 1
  let candidate = -1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (cues[middle].startTime <= time) {
      candidate = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  for (let index = candidate; index >= 0; index -= 1) {
    const cue = cues[index]
    if (cue.startTime > time) {
      continue
    }
    if (cue.endTime > time) {
      return cue
    }
    if (time - cue.startTime > 30) {
      break
    }
  }

  return null
}

function timestampToSeconds(parts: string[]): number {
  const [hours, minutes, seconds, milliseconds] = parts.map(Number)
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

function stripSubtitleMarkup(value: string): string {
  return decodeBasicEntities(value.replace(/<\/?(?:b|i|u|s)>/gi, '').replace(/<font\b[^>]*>|<\/font>/gi, ''))
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}
