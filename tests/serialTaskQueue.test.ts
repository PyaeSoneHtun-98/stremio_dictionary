import { describe, expect, it } from 'vitest'
import { SerialTaskQueue } from '../src/main/media/SerialTaskQueue'

describe('SerialTaskQueue', () => {
  it('serializes concurrent media handoffs so only one task is active at a time', async () => {
    const queue = new SerialTaskQueue()
    const events: string[] = []
    let active = 0
    let maxActive = 0
    let releaseFirst: (() => void) | null = null
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = queue.run(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      events.push('first:start')
      await firstGate
      events.push('first:end')
      active -= 1
      return 'first'
    })

    const second = queue.run(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      events.push('second:start')
      events.push('second:end')
      active -= 1
      return 'second'
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['first:start'])

    releaseFirst?.()
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second'])
    expect(maxActive).toBe(1)
    expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('continues with the next handoff after an earlier task fails', async () => {
    const queue = new SerialTaskQueue()
    const first = queue.run(async () => {
      throw new Error('first failed')
    })
    const second = queue.run(async () => 'second')

    await expect(first).rejects.toThrow('first failed')
    await expect(second).resolves.toBe('second')
  })
})
