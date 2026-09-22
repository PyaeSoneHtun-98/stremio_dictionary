import { describe, expect, it } from 'vitest'
import { appMeta } from './appMeta'

describe('appMeta', () => {
  it('identifies the Windows-first Subtitle Bridge v1.0.1 app', () => {
    expect(appMeta.name).toBe('Subtitle Bridge')
    expect(appMeta.version).toBe('1.0.1')
    expect(appMeta.platform).toBe('windows')
  })
})
