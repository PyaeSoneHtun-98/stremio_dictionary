import type { PlaybackStatus, SubtitleModelStatus } from '../../../../shared/media'

export type PlayerShortcut =
  | { kind: 'dismiss' }
  | { kind: 'toggle-playback' }
  | { kind: 'seek'; deltaSeconds: number }
  | { kind: 'volume'; delta: number }
  | { kind: 'subtitle-delay'; deltaSeconds: number }
  | { kind: 'fullscreen' }

export interface PlayerShortcutOptions {
  canControl: boolean
  interactiveTarget: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export interface SurfacePlaybackState {
  status: PlaybackStatus
  filePath: string | null
}

export interface SurfacePointerOptions {
  button: number
  isPrimary: boolean
  interactiveTarget: boolean
  canControl: boolean
}

interface ClosestCapableTarget {
  tagName: string
  isContentEditable?: boolean
  closest: (selector: string) => unknown
}

export const SURFACE_INTERACTIVE_SELECTOR =
  '.player-controls, .player-panel, .translation-popup, .subtitle-overlay, .overlay-topline'

export class SurfaceGestureCoordinator {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly getState: () => SurfacePlaybackState,
    private readonly togglePlayback: (paused: boolean) => void
  ) {}

  schedule(delayMs: number): boolean {
    if (this.timer !== null) {
      return false
    }

    const startingState = this.getState()
    if (!isSurfaceControllable(startingState)) {
      return false
    }

    const mediaKey = startingState.filePath
    this.timer = setTimeout(() => {
      this.timer = null
      const currentState = this.getState()
      if (currentState.filePath !== mediaKey || !isSurfaceControllable(currentState)) {
        return
      }

      this.togglePlayback(currentState.status === 'playing')
    }, Math.max(0, delayMs))

    return true
  }

  handleStateTransition(previous: SurfacePlaybackState, next: SurfacePlaybackState): void {
    if (previous.filePath !== next.filePath || previous.status !== next.status) {
      this.cancelPending()
    }
  }

  cancelPending(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

export function shouldHandleSurfacePointer(options: SurfacePointerOptions): boolean {
  return (
    options.button === 0 &&
    options.isPrimary &&
    options.canControl &&
    !options.interactiveTarget
  )
}

export function isInteractiveSurfaceTarget(target: EventTarget | null): boolean {
  const element = asClosestCapableTarget(target)
  if (!element) {
    return false
  }

  return (
    isInteractiveKeyboardTarget(target) || Boolean(element.closest(SURFACE_INTERACTIVE_SELECTOR))
  )
}

export function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  const element = asClosestCapableTarget(target)
  if (!element) {
    return false
  }

  if (element.isContentEditable || element.closest('.player-panel')) {
    return true
  }

  return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(element.tagName)
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
    case 'g':
    case 'G':
      return { kind: 'subtitle-delay', deltaSeconds: -0.1 }
    case 'h':
    case 'H':
      return { kind: 'subtitle-delay', deltaSeconds: 0.1 }
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

export function adjustSubtitleDelay(currentSeconds: number, deltaSeconds: number): number {
  const clamped = clampPlayerValue(currentSeconds + deltaSeconds, -10, 10)
  return Math.round(clamped * 10) / 10
}

export function subtitleRecoveryMessage(
  status: SubtitleModelStatus,
  error: string | null
): string | null {
  if (status === 'extracting') {
    return 'Loading subtitles…'
  }

  if (status === 'missing') {
    return 'No usable embedded text subtitles were found. Playback still works; try another subtitle track or load an external subtitle file.'
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

function asClosestCapableTarget(target: EventTarget | null): ClosestCapableTarget | null {
  if (!target || typeof target !== 'object') {
    return null
  }

  const candidate = target as unknown as Partial<ClosestCapableTarget>
  if (typeof candidate.tagName !== 'string' || typeof candidate.closest !== 'function') {
    return null
  }

  return candidate as ClosestCapableTarget
}

function isSurfaceControllable(state: SurfacePlaybackState): boolean {
  return Boolean(state.filePath) && !['loading', 'error', 'unavailable'].includes(state.status)
}
