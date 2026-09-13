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

  it('accepts an absolute Windows MKV path', () => {
    expect(parseMediaTarget('D:\\Movies\\Example.mkv')).toEqual({
      target: 'D:\\Movies\\Example.mkv',
      displayName: 'Example.mkv',
      kind: 'file',
      source: 'local'
    })
  })

  it.each([
    ['ftp://example.com/video.mkv', 'Unsupported media URL scheme: ftp'],
    ['vlc://file:///C:/video.mkv', 'Unsupported media URL scheme: file'],
    ['relative/video.mkv', 'absolute MKV path'],
    ['D:\\Movies\\Example.mp4', 'local MKV files only']
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

  it('finds a local MKV launch argument', () => {
    expect(findLaunchTargetArgument(['Subtitle Bridge.exe', 'D:\\Movies\\Example.mkv'])).toBe(
      'D:\\Movies\\Example.mkv'
    )
  })

  it('returns null when there is no media target', () => {
    expect(findLaunchTargetArgument(['Subtitle Bridge.exe', '--development'])).toBeNull()
  })
})
