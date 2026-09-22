import { describe, expect, it } from 'vitest'
import { deriveBufferingState } from '../src/main/media/bufferingState'

describe('deriveBufferingState', () => {
  it('never labels a manual pause as buffering even when cache pause is active', () => {
    expect(deriveBufferingState({
      networkTarget: true,
      paused: true,
      pausedForCache: true,
      seekPending: false
    })).toBe(false)
  })

  it('keeps a seek while paused out of buffering until playback resumes', () => {
    expect(deriveBufferingState({
      networkTarget: true,
      paused: true,
      pausedForCache: false,
      seekPending: true
    })).toBe(false)
    expect(deriveBufferingState({
      networkTarget: true,
      paused: false,
      pausedForCache: false,
      seekPending: true
    })).toBe(true)
  })

  it('only reports network cache stalls', () => {
    expect(deriveBufferingState({
      networkTarget: true,
      paused: false,
      pausedForCache: true,
      seekPending: false
    })).toBe(true)
    expect(deriveBufferingState({
      networkTarget: false,
      paused: false,
      pausedForCache: true,
      seekPending: true
    })).toBe(false)
  })
})
