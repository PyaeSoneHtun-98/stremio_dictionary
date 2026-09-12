import { describe, expect, it } from 'vitest'
import { appMeta } from './appMeta'

describe('appMeta', () => {
  it('identifies the Windows-first Subtitle Bridge app', () => {
    expect(appMeta.name).toBe('Subtitle Bridge')
    expect(appMeta.platform).toBe('windows')
  })
})
