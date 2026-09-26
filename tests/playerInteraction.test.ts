import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adjustSubtitleDelay,
  clampPlayerValue,
  isInteractiveSurfaceTarget,
  resolvePlayerShortcut,
  shouldHandleSurfacePointer,
  subtitleRecoveryMessage,
  SurfaceGestureCoordinator
} from '../src/renderer/src/features/playback/playerInteraction'

describe('player keyboard shortcuts', () => {
  it('keeps Escape available for dismissing overlays even from interactive controls', () => {
    expect(resolvePlayerShortcut('Escape', { canControl: false, interactiveTarget: true })).toEqual({
      kind: 'dismiss'
    })
  })

  it('ignores playback shortcuts while the user is typing or operating a control', () => {
    expect(resolvePlayerShortcut(' ', { canControl: true, interactiveTarget: true })).toBeNull()
  })

  it('maps common media-player shortcuts when playback can be controlled', () => {
    const options = { canControl: true, interactiveTarget: false }
    expect(resolvePlayerShortcut(' ', options)).toEqual({ kind: 'toggle-playback' })
    expect(resolvePlayerShortcut('ArrowLeft', options)).toEqual({ kind: 'seek', deltaSeconds: -5 })
    expect(resolvePlayerShortcut('ArrowRight', options)).toEqual({ kind: 'seek', deltaSeconds: 5 })
    expect(resolvePlayerShortcut('ArrowDown', options)).toEqual({ kind: 'volume', delta: -5 })
    expect(resolvePlayerShortcut('ArrowUp', options)).toEqual({ kind: 'volume', delta: 5 })
    expect(resolvePlayerShortcut('g', options)).toEqual({
      kind: 'subtitle-delay',
      deltaSeconds: -0.1,
    })
    expect(resolvePlayerShortcut('H', options)).toEqual({
      kind: 'subtitle-delay',
      deltaSeconds: 0.1,
    })
    expect(resolvePlayerShortcut('f', options)).toEqual({ kind: 'fullscreen' })
  })

  it('does not trigger subtitle-delay shortcuts while a control is focused or modifiers are held', () => {
    expect(
      resolvePlayerShortcut('g', { canControl: true, interactiveTarget: true }),
    ).toBeNull()
    expect(
      resolvePlayerShortcut('h', { canControl: true, interactiveTarget: false, ctrlKey: true }),
    ).toBeNull()
  })

  it('adjusts subtitle delay in 0.1 second steps and clamps at the supported bounds', () => {
    expect(adjustSubtitleDelay(0, -0.1)).toBe(-0.1)
    expect(adjustSubtitleDelay(0.2, 0.1)).toBe(0.3)
    expect(adjustSubtitleDelay(-19.95, -0.1)).toBe(-20)
    expect(adjustSubtitleDelay(19.95, 0.1)).toBe(20)
  })

  it('clamps seek and volume values to their valid range', () => {
    expect(clampPlayerValue(-3, 0, 100)).toBe(0)
    expect(clampPlayerValue(103, 0, 100)).toBe(100)
    expect(clampPlayerValue(42, 0, 100)).toBe(42)
  })
})

describe('video-surface gestures', () => {
  afterEach(() => vi.useRealTimers())

  it('reads current playback state when a deferred single-click executes', () => {
    vi.useFakeTimers()
    let state = { status: 'playing' as const, filePath: 'https://stream/video' as string | null }
    const toggles: boolean[] = []
    const coordinator = new SurfaceGestureCoordinator(() => state, (paused) => toggles.push(paused))

    coordinator.schedule(500)
    state = { ...state, status: 'paused' }
    vi.advanceTimersByTime(500)

    expect(toggles).toEqual([false])
  })

  it('cancels pending work on state transitions and double-click arbitration', () => {
    vi.useFakeTimers()
    let state = { status: 'playing' as const, filePath: 'https://stream/video' as string | null }
    const toggles: boolean[] = []
    const coordinator = new SurfaceGestureCoordinator(() => state, (paused) => toggles.push(paused))

    coordinator.schedule(500)
    const previous = state
    state = { ...state, status: 'paused' }
    coordinator.handleStateTransition(previous, state)
    vi.advanceTimersByTime(500)
    expect(toggles).toEqual([])

    state = { ...state, status: 'playing' }
    coordinator.schedule(500)
    coordinator.cancelPending()
    vi.advanceTimersByTime(500)
    expect(toggles).toEqual([])
  })

  it('accepts only the primary pointer on the non-interactive surface', () => {
    expect(shouldHandleSurfacePointer({
      button: 0, isPrimary: true, interactiveTarget: false, canControl: true
    })).toBe(true)
    expect(shouldHandleSurfacePointer({
      button: 1, isPrimary: true, interactiveTarget: false, canControl: true
    })).toBe(false)
    expect(shouldHandleSurfacePointer({
      button: 0, isPrimary: true, interactiveTarget: true, canControl: true
    })).toBe(false)
  })

  it('treats top chrome and SVG descendants of controls as interactive', () => {
    expect(isInteractiveSurfaceTarget(fakeTarget('DIV', ['.overlay-topline']))).toBe(true)
    expect(isInteractiveSurfaceTarget(fakeTarget('svg', ['.player-controls']))).toBe(true)
    expect(isInteractiveSurfaceTarget(fakeTarget('DIV', []))).toBe(false)
  })
})

describe('subtitle recovery copy', () => {
  it('keeps missing and unsupported subtitle states actionable without implying playback failed', () => {
    expect(subtitleRecoveryMessage('missing', null)).toContain('Playback still works')
    expect(subtitleRecoveryMessage('unsupported', null)).toContain('Playback still works')
  })

  it('preserves a useful extraction error and adds a recovery path', () => {
    expect(subtitleRecoveryMessage('error', 'FFmpeg could not read this track.')).toBe(
      'FFmpeg could not read this track. Playback still works; try another text subtitle track or another video.'
    )
  })
})

function fakeTarget(tagName: string, matchingSelectors: string[]): EventTarget {
  return {
    tagName,
    isContentEditable: false,
    closest: (selector: string) =>
      matchingSelectors.some((candidate) => selector.includes(candidate)) ? {} : null
  } as unknown as EventTarget
}
