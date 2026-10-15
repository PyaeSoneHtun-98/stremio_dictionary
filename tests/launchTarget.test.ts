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
    'mpv://http://127.0.0.1:11470/abc/0?foo=bar',
    'mpv://http%3A%2F%2F127.0.0.1%3A11470%2Fabc%2F0%3Ffoo%3Dbar',
    'mpv://http//127.0.0.1:11470/abc/0?foo=bar',
    'MPV://http://127.0.0.1:11470/abc/0?foo=bar'
  ])('unwraps the macOS Stremio MPV external-player link %s', (wrapped) => {
    expect(parseMediaTarget(wrapped, 'darwin')).toEqual({
      target: 'http://127.0.0.1:11470/abc/0?foo=bar',
      displayName: 'Stremio stream',
      kind: 'network',
      source: 'stremio-mpv'
    })
  })

  it('keeps a remote HTTPS stream from an MPV link unchanged', () => {
    expect(parseMediaTarget('mpv://https://cdn.example.com/v.mkv?sig=a%2Bb', 'darwin')).toEqual({
      target: 'https://cdn.example.com/v.mkv?sig=a%2Bb',
      displayName: 'Network stream (cdn.example.com)',
      kind: 'network',
      source: 'stremio-mpv'
    })
  })

  it.each([
    ['mpv://file:///Users/me/secret.mkv', 'Unsupported media URL scheme: file'],
    ['mpv:///Users/me/movie.mkv', 'media stream URL is invalid'],
    ['mpv://mpv://http://127.0.0.1/a', 'Unsupported media URL scheme: mpv'],
    ['mpv://javascript:alert(1)', 'Unsupported media URL scheme: javascript'],
    ['mpv://http%3A%2F%2F%E0%A4%A', 'media stream URL is invalid']
  ])('rejects unsafe MPV link %s', (value, message) => {
    expect(() => parseMediaTarget(value, 'darwin')).toThrow(message)
  })

  it.each([
    ['D:\\Movies\\Example.mkv', 'Example.mkv'],
    ['D:\\Movies\\Example.mp4', 'Example.mp4']
  ])('accepts an absolute Windows local video path %s', (target, displayName) => {
    expect(parseMediaTarget(target, 'win32')).toEqual({
      target,
      displayName,
      kind: 'file',
      source: 'local'
    })
  })

  it.each([
    ['/Users/me/Movies/Example.mkv', 'Example.mkv'],
    ['/Volumes/External Drive/Show S01E01.MP4', 'Show S01E01.MP4']
  ])('accepts an absolute macOS local video path %s', (target, displayName) => {
    expect(parseMediaTarget(target, 'darwin')).toEqual({
      target,
      displayName,
      kind: 'file',
      source: 'local'
    })
  })

  it.each([
    ['Movies/Example.mkv', 'absolute MKV/MP4 path'],
    ['D:\\Movies\\Example.mkv', 'absolute MKV/MP4 path'],
    ['/Users/me/Movies/Example.avi', 'local MKV and MP4 files only'],
    ['file:///Users/me/Movies/Example.mkv', 'Unsupported media URL scheme: file']
  ])('rejects unsafe or unsupported macOS target %s', (value, message) => {
    expect(() => parseMediaTarget(value, 'darwin')).toThrow(message)
  })

  it.each([
    ['ftp://example.com/video.mkv', 'Unsupported media URL scheme: ftp'],
    ['vlc://file:///C:/video.mkv', 'Unsupported media URL scheme: file'],
    ['relative/video.mkv', 'absolute MKV/MP4 path'],
    ['D:\\Movies\\Example.avi', 'local MKV and MP4 files only']
  ])('rejects unsafe or unsupported target %s', (value, message) => {
    expect(() => parseMediaTarget(value, 'win32')).toThrow(message)
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
    expect(findLaunchTargetArgument(['Subtitle Bridge.exe', target], 'win32')).toBe(target)
  })

  it('finds a macOS local video launch argument after the app executable', () => {
    expect(
      findLaunchTargetArgument(
        [
          '/Applications/Subtitle Bridge.app/Contents/MacOS/Subtitle Bridge',
          '-psn_0_12345',
          '/Users/me/Movies/Example.mkv'
        ],
        'darwin'
      )
    ).toBe('/Users/me/Movies/Example.mkv')
  })

  it('returns null when there is no media target', () => {
    expect(findLaunchTargetArgument(['Subtitle Bridge.exe', '--development'])).toBeNull()
  })
})
