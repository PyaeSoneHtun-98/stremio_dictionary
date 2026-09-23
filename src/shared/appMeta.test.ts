import { describe, expect, it } from 'vitest'
import { appMeta } from './appMeta'

describe('appMeta', () => {
  it('identifies Subtitle Bridge as the Windows-first desktop app', () => {
    expect(appMeta.name).toBe('Subtitle Bridge')
    expect(appMeta.platform).toBe('windows')
  })
})
