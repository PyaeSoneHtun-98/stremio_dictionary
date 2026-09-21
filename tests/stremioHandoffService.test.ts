import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StremioHandoffService } from '../src/main/stremio/HandoffService'

const tempDirectories: string[] = []

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('StremioHandoffService', () => {
  it('invokes the packaged enable helper with only the app executable path', async () => {
    const helperRoot = createHelperFixture()
    const runner = vi.fn(async () => undefined)
    const executablePath = 'C:\\Users\\Test\\AppData\\Local\\Programs\\Subtitle Bridge\\Subtitle Bridge.exe'
    const service = new StremioHandoffService(helperRoot, executablePath, runner)

    await service.enable()

    expect(runner).toHaveBeenCalledWith(join(helperRoot, 'Enable-StremioHandoff.ps1'), [
      '-ExecutablePath',
      executablePath
    ])
  })

  it('invokes the packaged disable helper without renderer-controlled arguments', async () => {
    const helperRoot = createHelperFixture()
    const runner = vi.fn(async () => undefined)
    const service = new StremioHandoffService(helperRoot, 'C:\\Subtitle Bridge.exe', runner)

    await service.disable()

    expect(runner).toHaveBeenCalledWith(join(helperRoot, 'Disable-StremioHandoff.ps1'), [])
  })

  it('fails before launching PowerShell when a packaged helper is missing', async () => {
    const helperRoot = createTemporaryDirectory()
    const runner = vi.fn(async () => undefined)
    const service = new StremioHandoffService(helperRoot, 'C:\\Subtitle Bridge.exe', runner)

    await expect(service.enable()).rejects.toThrow('helper is unavailable')
    expect(runner).not.toHaveBeenCalled()
  })
})

function createHelperFixture(): string {
  const helperRoot = createTemporaryDirectory()
  writeFileSync(join(helperRoot, 'Enable-StremioHandoff.ps1'), '')
  writeFileSync(join(helperRoot, 'Disable-StremioHandoff.ps1'), '')
  return helperRoot
}

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'subtitle-bridge-stremio-service-'))
  tempDirectories.push(directory)
  return directory
}
