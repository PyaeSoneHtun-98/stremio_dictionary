import type { SubtitleModelStatus } from '../../../../shared/media'

export type PlayerShortcut =
  | { kind: 'dismiss' }
  | { kind: 'toggle-playback' }
  | { kind: 'seek'; deltaSeconds: number }
  | { kind: 'volume'; delta: number }
  | { kind: 'fullscreen' }

export interface PlayerShortcutOptions {
  canControl: boolean
  interactiveTarget: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export function resolvePlayerShortcut(
  key: string,
  options: PlayerShortcutOptions
): PlayerShortcut | null {
  if (key === 'Escape') {
    return { kind: 'dismiss' }
  }

  if (
    options.altKey ||
    options.ctrlKey ||
    options.metaKey ||
    options.interactiveTarget ||
    !options.canControl
  ) {
    return null
  }

  switch (key) {
    case ' ':
    case 'k':
    case 'K':
      return { kind: 'toggle-playback' }
    case 'ArrowLeft':
      return { kind: 'seek', deltaSeconds: -5 }
    case 'ArrowRight':
      return { kind: 'seek', deltaSeconds: 5 }
    case 'ArrowDown':
      return { kind: 'volume', delta: -5 }
    case 'ArrowUp':
      return { kind: 'volume', delta: 5 }
    case 'f':
    case 'F':
      return { kind: 'fullscreen' }
    default:
      return null
  }
}

export function clampPlayerValue(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function subtitleRecoveryMessage(
  status: SubtitleModelStatus,
  error: string | null
): string | null {
  if (status === 'extracting') {
    return 'Loading subtitles…'
  }

  if (status === 'missing') {
    return 'No usable embedded text subtitles were found. Playback still works; try another subtitle track or another MKV.'
  }

  if (status === 'unsupported') {
    return 'These embedded subtitles are image-based or unsupported for word selection. Playback still works normally.'
  }

  if (status === 'error') {
    const detail = error?.trim() || 'Subtitles could not be loaded.'
    return `${detail} Playback still works; try another text subtitle track or another video.`
  }

  return null
}
