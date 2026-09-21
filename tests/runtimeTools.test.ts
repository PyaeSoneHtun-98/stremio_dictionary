import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveFfmpegExecutable,
  resolveMpvExecutable,
  type RuntimeToolResolutionOptions
} from '../src/main/runtimeTools'

const temporaryDirectories: string[] = []

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('runtime tool resolution', () => {
  it('keeps explicit developer environment overrides ahead of managed runtimes', () => {
    const resourcesPath = createManagedRuntimeFixture()
    const options: RuntimeToolResolutionOptions = {
      environment: {
        MPV_PATH: 'D:\\DevTools\\mpv.exe',
        FFMPEG_PATH: 'D:\\DevTools\\ffmpeg.exe'
      },
      platform: 'win32',
      resourcesPath
    }

    expect(resolveMpvExecutable(options)).toEqual({
      executable: 'D:\\DevTools\\mpv.exe',
      source: 'environment'
    })
    expect(resolveFfmpegExecutable(options)).toEqual({
      executable: 'D:\\DevTools\\ffmpeg.exe',
      source: 'environment'
    })
  })

  it('prefers installer-managed app-local runtimes over PATH on Windows', () => {
    const resourcesPath = createManagedRuntimeFixture()
    const options: RuntimeToolResolutionOptions = {
      environment: {},
      platform: 'win32',
      resourcesPath
    }

    expect(resolveMpvExecutable(options)).toEqual({
      executable: join(resourcesPath, 'tools', 'mpv', 'mpv.exe'),
      source: 'managed'
    })
    expect(resolveFfmpegExecutable(options)).toEqual({
      executable: join(resourcesPath, 'tools', 'ffmpeg', 'ffmpeg.exe'),
      source: 'managed'
    })
  })

  it('falls back to PATH-compatible command names when managed tools are absent', () => {
    const resourcesPath = createTemporaryDirectory()

    expect(
      resolveMpvExecutable({ environment: {}, platform: 'win32', resourcesPath })
    ).toEqual({
      executable: 'mpv.exe',
      source: 'path'
    })
    expect(
      resolveFfmpegExecutable({ environment: {}, platform: 'win32', resourcesPath })
    ).toEqual({
      executable: 'ffmpeg.exe',
      source: 'path'
    })
    expect(
      resolveMpvExecutable({ environment: {}, platform: 'linux', resourcesPath })
    ).toEqual({
      executable: 'mpv',
      source: 'path'
    })
  })
})

function createManagedRuntimeFixture(): string {
  const resourcesPath = createTemporaryDirectory()
  const mpvDirectory = join(resourcesPath, 'tools', 'mpv')
  const ffmpegDirectory = join(resourcesPath, 'tools', 'ffmpeg')
  mkdirSync(mpvDirectory, { recursive: true })
  mkdirSync(ffmpegDirectory, { recursive: true })
  writeFileSync(join(mpvDirectory, 'mpv.exe'), '')
  writeFileSync(join(ffmpegDirectory, 'ffmpeg.exe'), '')
  return resourcesPath
}

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'subtitle-bridge-runtime-tools-'))
  temporaryDirectories.push(directory)
  return directory
}
