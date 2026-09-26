import { win32 } from 'node:path'

const MAX_TARGET_LENGTH = 16 * 1024
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const LOCAL_VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4'])

export type MediaTargetKind = 'file' | 'network'
export type MediaTargetSource = 'local' | 'http' | 'stremio-vlc'

export interface ParsedMediaTarget {
  target: string
  displayName: string
  kind: MediaTargetKind
  source: MediaTargetSource
}

export function parseMediaTarget(value: string): ParsedMediaTarget {
  const raw = value.trim()
  if (!raw) {
    throw new Error('No media target was provided.')
  }

  if (raw.length > MAX_TARGET_LENGTH) {
    throw new Error('The media target is too long to open safely.')
  }

  if (/^vlc:\/\//i.test(raw)) {
    const unwrapped = raw.slice(raw.indexOf('://') + 3)
    const url = requireHttpUrl(unwrapped)
    return {
      target: unwrapped,
      displayName: networkDisplayName(url),
      kind: 'network',
      source: 'stremio-vlc'
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    const url = requireHttpUrl(raw)
    return {
      target: raw,
      displayName: networkDisplayName(url),
      kind: 'network',
      source: 'http'
    }
  }

  if (URL_SCHEME.test(raw)) {
    const scheme = raw.slice(0, raw.indexOf(':')).toLowerCase()
    throw new Error(`Unsupported media URL scheme: ${scheme}. Only HTTP/HTTPS streams are allowed.`)
  }

  if (!win32.isAbsolute(raw)) {
    throw new Error('The media target must be an absolute MKV/MP4 path or an HTTP/HTTPS stream URL.')
  }

  if (!LOCAL_VIDEO_EXTENSIONS.has(win32.extname(raw).toLowerCase())) {
    throw new Error('Subtitle Bridge currently supports local MKV and MP4 files only.')
  }

  return {
    target: raw,
    displayName: win32.basename(raw),
    kind: 'file',
    source: 'local'
  }
}

export function findLaunchTargetArgument(argv: readonly string[]): string | null {
  for (const argument of argv) {
    const value = argument.trim()
    if (!value || value.startsWith('--')) {
      continue
    }

    if (URL_SCHEME.test(value)) {
      return value
    }

    if (win32.isAbsolute(value) && LOCAL_VIDEO_EXTENSIONS.has(win32.extname(value).toLowerCase())) {
      return value
    }
  }

  return null
}

function requireHttpUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('The media stream URL is invalid.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    const scheme = url.protocol.replace(/:$/, '') || 'unknown'
    throw new Error(`Unsupported media URL scheme: ${scheme}. Only HTTP/HTTPS streams are allowed.`)
  }

  if (!url.hostname) {
    throw new Error('The media stream URL does not contain a valid host.')
  }

  return url
}

function networkDisplayName(url: URL): string {
  const hostname = url.hostname.toLowerCase()
  if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1') {
    return 'Stremio stream'
  }

  return `Network stream (${hostname})`
}
