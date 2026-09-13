import { describe, expect, it } from 'vitest'
import {
  clampPlayerValue,
  resolvePlayerShortcut,
  subtitleRecoveryMessage
} from '../src/renderer/src/features/playback/playerInteraction'

describe('player keyboard shortcuts', () => {
  it('keeps Escape available for dismissing overlays even from interactive controls', () => {
    expect(
      resolvePlayerShortcut('Escape', {
        canControl: false,
        interactiveTarget: true
      })
    ).toEqual({ kind: 'dismiss' })
  })

  it('ignores playback shortcuts while the user is typing or operating a control', () => {
    expect(
      resolvePlayerShortcut(' ', {
        canControl: true,
        interactiveTarget: true
      })
    ).toBeNull()
  })

  it('maps common media-player shortcuts when playback can be controlled', () => {
    const options = { canControl: true, interactiveTarget: false }

    expect(resolvePlayerShortcut(' ', options)).toEqual({ kind: 'toggle-playback' })
    expect(resolvePlayerShortcut('ArrowLeft', options)).toEqual({
      kind: 'seek',
      deltaSeconds: -5
    })
    expect(resolvePlayerShortcut('ArrowRight', options)).toEqual({
      kind: 'seek',
      deltaSeconds: 5
    })
    expect(resolvePlayerShortcut('ArrowDown', options)).toEqual({ kind: 'volume', delta: -5 })
    expect(resolvePlayerShortcut('ArrowUp', options)).toEqual({ kind: 'volume', delta: 5 })
    expect(resolvePlayerShortcut('f', options)).toEqual({ kind: 'fullscreen' })
  })

  it('clamps seek and volume values to their valid range', () => {
    expect(clampPlayerValue(-3, 0, 100)).toBe(0)
    expect(clampPlayerValue(103, 0, 100)).toBe(100)
    expect(clampPlayerValue(42, 0, 100)).toBe(42)
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
