import { afterEach, describe, expect, it, vi } from 'vitest'
import { IdleControls } from '../src/renderer/src/features/playback/IdleControls'

afterEach(() => vi.useRealTimers())

describe('player controls inactivity', () => {
  it('hides after inactivity and restarts the deadline on input', () => {
    vi.useFakeTimers()
    const update = vi.fn()
    const idle = new IdleControls(update)
    idle.reveal()
    vi.advanceTimersByTime(2000)
    idle.reveal()
    vi.advanceTimersByTime(2000)
    expect(update).not.toHaveBeenCalledWith(false)
    vi.advanceTimersByTime(800)
    expect(update).toHaveBeenLastCalledWith(false)
    idle.reveal()
    expect(update).toHaveBeenLastCalledWith(true)
    idle.dispose()
  })

  it('keeps paused playback, panels, drag and keyboard focus visible; unpin gets a full delay', () => {
    vi.useFakeTimers()
    const update = vi.fn()
    const idle = new IdleControls(update)
    idle.reveal()
    idle.pin(true)
    vi.advanceTimersByTime(10000)
    expect(update).not.toHaveBeenCalledWith(false)
    idle.pin(false)
    vi.advanceTimersByTime(2799)
    expect(update).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(1)
    expect(update).toHaveBeenLastCalledWith(false)
    idle.reveal()
    idle.dispose()
    update.mockClear()
    vi.runAllTimers()
    expect(update).not.toHaveBeenCalled()
  })
})
