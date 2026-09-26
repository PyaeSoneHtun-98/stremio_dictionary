import { describe, expect, it } from 'vitest'
import { findLaunchTargetArgument, parseMediaTarget } from '../src/main/media/launchTarget'

describe('parseMediaTarget', () => {
  it('accepts raw HTTP and HTTPS stream URLs without rewriting them', () => {
    const target = 'https://media.example.com/video.mkv?token=abc123'
    expect(parseMediaTarget(target)).toEqual({
      target,
      displayName: 'Network stream (media.example.com)',
      kind: 'network',
      source: 'http'
    })
  })

  it('unwraps the Windows Stremio VLC compatibility handoff', () => {
    const wrapped = 'vlc://http://127.0.0.1:11470/stream/test.mkv?foo=bar'
    expect(parseMediaTarget(wrapped)).toEqual({
      target: 'http://127.0.0.1:11470/stream/test.mkv?foo=bar',
      displayName: 'Stremio stream',
      kind: 'network',
      source: 'stremio-vlc'
    })
  })

  it.each([
    ['D:\\Movies\\Example.mkv', 'Example.mkv'],
    ['D:\\Movies\\Example.mp4', 'Example.mp4']
  ])('accepts an absolute Windows local video path %s', (target, displayName) => {
    expect(parseMediaTarget(target)).toEqual({
      target,
      displayName,
      kind: 'file',
      source: 'local'
    })
  })

  it.each([
    ['ftp://example.com/video.mkv', 'Unsupported media URL scheme: ftp'],
    ['vlc://file:///C:/video.mkv', 'Unsupported media URL scheme: file'],
    ['relative/video.mkv', 'absolute MKV/MP4 path'],
    ['D:\\Movies\\Example.avi', 'local MKV and MP4 files only']
  ])('rejects unsafe or unsupported target %s', (value, message) => {
    expect(() => parseMediaTarget(value)).toThrow(message)
  })
})

describe('findLaunchTargetArgument', () => {
  it('finds a Stremio protocol argument after Electron arguments', () => {
    expect(
      findLaunchTargetArgument([
        'C:\\Program Files\\Subtitle Bridge\\Subtitle Bridge.exe',
        '--some-electron-flag',
        'vlc://https://example.com/video.mkv'
      ])
    ).toBe('vlc://https://example.com/video.mkv')
  })

  it.each([
    'D:\\Movies\\Example.mkv',
    'D:\\Movies\\Example.mp4'
  ])('finds a supported local video launch argument %s', (target) => {
    expect(findLaunchTargetArgument(['Subtitle Bridge.exe', target])).toBe(target)
  })

  it('returns null when there is no media target', () => {
    expect(findLaunchTargetArgument(['Subtitle Bridge.exe', '--development'])).toBeNull()
  })
})
