import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { appMeta } from '../src/shared/appMeta'

describe('application version metadata', () => {
  it('keeps the renderer version badge synchronized with package.json', () => {
    const packagePath = fileURLToPath(new URL('../package.json', import.meta.url))
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string }

    expect(appMeta.version).toBe(packageJson.version)
  })
})
