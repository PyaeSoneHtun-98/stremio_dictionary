import { describe, expect, it } from 'vitest'
import { MAX_STREAM_URL_LENGTH, normalizeStreamUrl } from '../src/shared/streamUrl'
import { parseMediaTarget } from '../src/main/media/launchTarget'

describe('stream URL boundary', () => {
  it.each([
    'https://media.example/video.mkv?token=signed%2Bvalue&part=1',
    'http://127.0.0.1:11470/stream/example',
    'http://[::1]:11470/stream/example',
    'HTTPS://media.example/video.mp4',
    'https://user:password@media.example/video.mp4?token=example',
  ])('preserves the HTTP target and uses the common network parser', (url) => {
    expect(normalizeStreamUrl(`  ${url}  `)).toBe(url)
    const parsed = parseMediaTarget(normalizeStreamUrl(url) as string)
    expect(parsed.kind).toBe('network')
    expect(parsed.target).toBe(url)
    expect(parsed.displayName).not.toContain('token=')
    expect(parsed.displayName).not.toContain('password')
  })

  it('rejects invalid schemes, paths, malformed hosts, controls and overlong input', () => {
    for (const value of [
      null, 1, {}, '', ' ', 'example.com/video.mp4', 'https://', 'https://[invalid]/x',
      'file:///D:/video.mp4', 'D:\\video.mp4', 'ftp://media.example/a', 'javascript:alert(1)',
      'vlc://http://localhost/video', '--script=evil', 'https://media.example/a b',
      'https://media.example/a\nprivate', 'https://media.example/a\tprivate',
      'https://media.example/a\u0000', 'https://media.example/a\u007f',
      'https://media.example\\@other.example/a',
      `https://media.example/${'a'.repeat(MAX_STREAM_URL_LENGTH)}`,
    ]) expect(normalizeStreamUrl(value)).toBeNull()
  })
})
