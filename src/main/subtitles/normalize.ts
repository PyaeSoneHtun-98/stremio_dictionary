import type { SubtitleCue, SubtitleToken } from '../../shared/media'

const TIMING_LINE =
  /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})(?:\s+.*)?$/
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
const HAS_LETTER = /\p{L}/u
const ASS_OVERRIDE_BLOCK = /\{\\[^}]*\}/g
const ASS_DRAWING_COMMAND = /^[mnlbspc]$/i
const ASS_DRAWING_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/

export interface SubtitleParseLimits {
  maxCues: number
  maxTokens: number
  maxTokenMatches: number
  maxSourceLines: number
}

export const DEFAULT_SUBTITLE_PARSE_LIMITS: SubtitleParseLimits = {
  maxCues: 50_000,
  maxTokens: 1_000_000,
  maxTokenMatches: 1_000_000,
  maxSourceLines: 250_000
}

export function parseSrtCues(
  source: string,
  limits: SubtitleParseLimits = DEFAULT_SUBTITLE_PARSE_LIMITS
): SubtitleCue[] {
  validateParseLimits(limits)
  assertSourceLineLimit(source, limits.maxSourceLines)

  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) {
    return []
  }

  const cues: SubtitleCue[] = []
  let tokenCount = 0
  let tokenMatchCount = 0

  for (const block of iterateSrtBlocks(normalized)) {
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

    if (cues.length >= limits.maxCues) {
      throw new Error(`Subtitle track exceeds the safe cue limit of ${limits.maxCues}.`)
    }

    const tokenization = tokenizeSubtitleTextWithStats(
      text,
      limits.maxTokens - tokenCount,
      limits.maxTokenMatches - tokenMatchCount
    )
    tokenCount += tokenization.tokens.length
    tokenMatchCount += tokenization.matchCount

    cues.push({
      id: `${startTime.toFixed(3)}-${endTime.toFixed(3)}-${cues.length}`,
      startTime,
      endTime,
      text,
      lines: text.split('\n'),
      tokens: tokenization.tokens
    })
  }

  return cues.sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime)
}

export function tokenizeSubtitleText(
  text: string,
  maxTokens = Number.POSITIVE_INFINITY,
  maxTokenMatches = Number.POSITIVE_INFINITY
): SubtitleToken[] {
  return tokenizeSubtitleTextWithStats(text, maxTokens, maxTokenMatches).tokens
}

function tokenizeSubtitleTextWithStats(
  text: string,
  maxTokens: number,
  maxTokenMatches: number
): { tokens: SubtitleToken[]; matchCount: number } {
  if (Number.isNaN(maxTokens) || maxTokens < 0) {
    throw new Error('Subtitle token limit must be zero or greater.')
  }

  if (Number.isNaN(maxTokenMatches) || maxTokenMatches < 0) {
    throw new Error('Subtitle tokenizer work limit must be zero or greater.')
  }

  const tokens: SubtitleToken[] = []
  let matchCount = 0

  for (const match of text.matchAll(WORD_PATTERN)) {
    if (matchCount >= maxTokenMatches) {
      throw new Error('Subtitle track exceeds the safe tokenizer work limit.')
    }
    matchCount += 1

    const value = match[0]
    const start = match.index
    if (start === undefined) {
      continue
    }

    // Pure numbers are not useful dictionary targets and are common in ASS vector/effect data.
    // They still count against maxTokenMatches so skipped matches cannot bypass the CPU work cap.
    if (!HAS_LETTER.test(value)) {
      continue
    }

    const lookupTerm = normalizeLookupTerm(value)
    if (!lookupTerm) {
      continue
    }

    if (tokens.length >= maxTokens) {
      throw new Error('Subtitle track exceeds the safe token limit.')
    }

    tokens.push({
      text: value,
      lookupTerm,
      start,
      end: start + value.length
    })
  }

  return { tokens, matchCount }
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

function* iterateSrtBlocks(source: string): Generator<string> {
  const separator = /\n{2,}/g
  let start = 0
  let match = separator.exec(source)

  while (match) {
    yield source.slice(start, match.index)
    start = match.index + match[0].length
    match = separator.exec(source)
  }

  yield source.slice(start)
}

function assertSourceLineLimit(source: string, maxSourceLines: number): void {
  if (!source) {
    return
  }

  let lineCount = 1
  for (let index = 0; index < source.length; index += 1) {
    const character = source.charCodeAt(index)
    if (character === 10 || (character === 13 && source.charCodeAt(index + 1) !== 10)) {
      lineCount += 1
      if (lineCount > maxSourceLines) {
        throw new Error(`Subtitle track exceeds the safe line limit of ${maxSourceLines}.`)
      }
    }
  }
}

function validateParseLimits(limits: SubtitleParseLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`Subtitle parse limit ${name} must be a positive safe integer.`)
    }
  }
}

function timestampToSeconds(parts: string[]): number {
  const [hours, minutes, seconds, milliseconds] = parts.map(Number)
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

function stripSubtitleMarkup(value: string): string {
  const withoutAssDrawing = stripAssOverrideBlocks(value)
  const decoded = decodeBasicEntities(
    withoutAssDrawing.replace(/<\/?(?:b|i|u|s)>/gi, '').replace(/<font\b[^>]*>|<\/font>/gi, '')
  )
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')

  return looksLikeAssDrawingPayload(decoded) ? '' : decoded
}

function stripAssOverrideBlocks(value: string): string {
  let drawingMode = false
  let cursor = 0
  let output = ''

  ASS_OVERRIDE_BLOCK.lastIndex = 0
  for (const match of value.matchAll(ASS_OVERRIDE_BLOCK)) {
    const start = match.index
    if (start === undefined) {
      continue
    }

    if (!drawingMode) {
      output += value.slice(cursor, start)
    }

    for (const drawingTag of match[0].matchAll(/\\p(\d+)/gi)) {
      drawingMode = Number(drawingTag[1]) > 0
    }

    cursor = start + match[0].length
  }

  if (!drawingMode) {
    output += value.slice(cursor)
  }

  return output
}

function looksLikeAssDrawingPayload(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || !/^[mnlbspc](?:\s|$)/i.test(trimmed)) {
    return false
  }

  const tokens = trimmed.replace(/,/g, ' ').split(/\s+/)
  let commandCount = 0
  let numberCount = 0

  for (const token of tokens) {
    if (ASS_DRAWING_COMMAND.test(token)) {
      commandCount += 1
      continue
    }

    if (ASS_DRAWING_NUMBER.test(token)) {
      numberCount += 1
      continue
    }

    return false
  }

  return (commandCount >= 2 && numberCount >= 4) || (commandCount >= 1 && numberCount >= 6)
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
