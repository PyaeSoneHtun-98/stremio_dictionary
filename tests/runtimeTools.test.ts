import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveFfmpegExecutable,
  resolveLibmpv,
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

  it('finds Homebrew mpv and FFmpeg on macOS without relying on the shell PATH', () => {
    const appleSilicon = createTemporaryDirectory()
    const intel = createTemporaryDirectory()
    writeFileSync(join(appleSilicon, 'mpv'), '')
    writeFileSync(join(intel, 'mpv'), '')
    writeFileSync(join(intel, 'ffmpeg'), '')
    const options: RuntimeToolResolutionOptions = {
      environment: {},
      platform: 'darwin',
      resourcesPath: createManagedRuntimeFixture(),
      homebrewDirectories: [appleSilicon, intel]
    }

    expect(resolveMpvExecutable(options)).toEqual({
      executable: join(appleSilicon, 'mpv'),
      source: 'homebrew'
    })
    expect(resolveFfmpegExecutable(options)).toEqual({
      executable: join(intel, 'ffmpeg'),
      source: 'homebrew'
    })
  })

  it('keeps macOS developer overrides first and falls back to PATH names', () => {
    const homebrew = createTemporaryDirectory()
    writeFileSync(join(homebrew, 'mpv'), '')

    expect(
      resolveMpvExecutable({
        environment: { MPV_PATH: '/Users/dev/mpv' },
        platform: 'darwin',
        homebrewDirectories: [homebrew]
      })
    ).toEqual({ executable: '/Users/dev/mpv', source: 'environment' })
    expect(
      resolveFfmpegExecutable({
        environment: {},
        platform: 'darwin',
        resourcesPath: null,
        homebrewDirectories: [homebrew]
      })
    ).toEqual({ executable: 'ffmpeg', source: 'path' })
  })

  it('finds Homebrew libmpv for in-process macOS playback', () => {
    const appleSilicon = createTemporaryDirectory()
    const intel = createTemporaryDirectory()
    writeFileSync(join(intel, 'libmpv.2.dylib'), '')

    expect(resolveLibmpv({ environment: {}, homebrewDirectories: [appleSilicon, intel] })).toEqual({
      path: join(intel, 'libmpv.2.dylib'),
      source: 'homebrew'
    })

    writeFileSync(join(appleSilicon, 'libmpv.2.dylib'), '')
    expect(
      resolveLibmpv({ environment: {}, homebrewDirectories: [appleSilicon, intel] })?.path
    ).toBe(join(appleSilicon, 'libmpv.2.dylib'))
  })

  it('prefers a developer libmpv override and reports a missing library', () => {
    const empty = createTemporaryDirectory()

    expect(
      resolveLibmpv({
        environment: { MPV_LIBRARY_PATH: '/Users/dev/libmpv.2.dylib' },
        homebrewDirectories: [empty]
      })
    ).toEqual({ path: '/Users/dev/libmpv.2.dylib', source: 'environment' })
    expect(resolveLibmpv({ environment: {}, homebrewDirectories: [empty] })).toBeNull()
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
