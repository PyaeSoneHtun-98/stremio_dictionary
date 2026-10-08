export const MAX_STREAM_URL_LENGTH = 16 * 1024
export const INVALID_STREAM_URL_MESSAGE = 'Enter a valid HTTP or HTTPS stream URL.'

// Keep the original escaped path/query intact: rewriting a URL can break signed streams.
export function normalizeStreamUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_STREAM_URL_LENGTH) return null
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code < 32 || code === 127) return null
  }
  const target = value.trim()
  if (
    !target || target.length > MAX_STREAM_URL_LENGTH ||
    !/^https?:\/\//i.test(target) || /\s|\\/u.test(target)
  ) return null
  try {
    const url = new URL(target)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname
      ? target
      : null
  } catch {
    return null
  }
}
