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

  it('reports disabled when no handoff target record exists', () => {
    const helperRoot = createHelperFixture()
    const statePath = join(helperRoot, 'stremio-handoff-targets.json')
    const service = new StremioHandoffService(
      helperRoot,
      'C:\\Subtitle Bridge.exe',
      vi.fn(async () => undefined),
      statePath
    )

    expect(service.inspectStatus()).toEqual({
      enabled: false,
      repairNeeded: false,
      recordedTargets: 0,
      patchedTargets: 0,
      verifiedTargets: 0
    })
  })

  it('reports enabled only when the recorded patch targets the current executable', () => {
    const helperRoot = createHelperFixture()
    const statePath = join(helperRoot, 'stremio-handoff-targets.json')
    const serverPath = join(helperRoot, 'server.js')
    const executablePath = 'C:\\Subtitle Bridge.exe'
    writeFileSync(serverPath, stremioPatch(executablePath))
    writeFileSync(
      statePath,
      `\uFEFF${JSON.stringify({
        version: 1,
        application: 'Subtitle Bridge',
        paths: [serverPath]
      })}`
    )

    const service = new StremioHandoffService(
      helperRoot,
      executablePath,
      vi.fn(async () => undefined),
      statePath
    )

    expect(service.inspectStatus()).toEqual({
      enabled: true,
      repairNeeded: false,
      recordedTargets: 1,
      patchedTargets: 1,
      verifiedTargets: 1
    })

    writeFileSync(serverPath, 'const players = {};')
    expect(service.inspectStatus()).toEqual({
      enabled: false,
      repairNeeded: false,
      recordedTargets: 1,
      patchedTargets: 0,
      verifiedTargets: 0
    })
  })

  it('marks a patch for repair when it points to an old Subtitle Bridge executable', () => {
    const helperRoot = createHelperFixture()
    const statePath = join(helperRoot, 'stremio-handoff-targets.json')
    const serverPath = join(helperRoot, 'server.js')
    writeFileSync(serverPath, stremioPatch('D:\\Old Subtitle Bridge\\Subtitle Bridge.exe'))
    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        application: 'Subtitle Bridge',
        paths: [serverPath]
      })
    )

    const service = new StremioHandoffService(
      helperRoot,
      'C:\\Subtitle Bridge.exe',
      vi.fn(async () => undefined),
      statePath
    )

    expect(service.inspectStatus()).toEqual({
      enabled: false,
      repairNeeded: true,
      recordedTargets: 1,
      patchedTargets: 1,
      verifiedTargets: 0
    })
  })

  it('rejects malformed recorded patch markers instead of reporting a false enabled state', () => {
    const helperRoot = createHelperFixture()
    const statePath = join(helperRoot, 'stremio-handoff-targets.json')
    const serverPath = join(helperRoot, 'server.js')
    writeFileSync(serverPath, '/* Subtitle Bridge external player BEGIN */\nconst players = {};')
    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        application: 'Subtitle Bridge',
        paths: [serverPath]
      })
    )

    const service = new StremioHandoffService(
      helperRoot,
      'C:\\Subtitle Bridge.exe',
      vi.fn(async () => undefined),
      statePath
    )

    expect(() => service.inspectStatus()).toThrow('malformed Subtitle Bridge patch markers')
  })

  it('fails before launching PowerShell when a packaged helper is missing', async () => {
    const helperRoot = createTemporaryDirectory()
    const runner = vi.fn(async () => undefined)
    const service = new StremioHandoffService(helperRoot, 'C:\\Subtitle Bridge.exe', runner)

    await expect(service.enable()).rejects.toThrow('helper is unavailable')
    expect(runner).not.toHaveBeenCalled()
  })
})

function stremioPatch(executablePath: string): string {
  const jsExecutable = JSON.stringify(`"${executablePath}"`)
  return [
    'const players = {};',
    '/* Subtitle Bridge external player BEGIN */',
    'players.subtitleBridge = {',
    '  title: "Subtitle Bridge",',
    '  args: [ "" ],',
    '  subArg: "",',
    '  timeArg: "",',
    '  playArg: "",',
    '  darwin: { path: [] },',
    '  linux: { path: [] },',
    `  win32: { path: [ ${jsExecutable} ] }`,
    '};',
    '/* Subtitle Bridge external player END */',
  ].join('\n')
}

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
