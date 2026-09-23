import { describe, expect, it } from 'vitest'
import {
  assertAllowedUpdateUrl,
  compareStableVersions,
  parseInstallerChecksum,
  parseLatestRelease
} from '../src/main/update/updatePolicy'

function releaseFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tag_name: 'v1.0.3',
    name: 'Subtitle Bridge v1.0.3',
    body: 'Update notes',
    published_at: '2026-09-24T00:00:00Z',
    draft: false,
    prerelease: false,
    assets: [
      {
        name: 'SubtitleBridge-Setup-x64.exe',
        browser_download_url:
          'https://github.com/PyaeSoneHtun-98/stremio_dictionary/releases/download/v1.0.3/SubtitleBridge-Setup-x64.exe'
      },
      {
        name: 'SubtitleBridge-Setup-x64.exe.sha256',
        browser_download_url:
          'https://github.com/PyaeSoneHtun-98/stremio_dictionary/releases/download/v1.0.3/SubtitleBridge-Setup-x64.exe.sha256'
      }
    ],
    ...overrides
  }
}

describe('updater release policy', () => {
  it('compares only stable semantic versions', () => {
    expect(compareStableVersions('1.0.3', '1.0.2')).toBe(1)
    expect(compareStableVersions('1.0.2', '1.0.2')).toBe(0)
    expect(compareStableVersions('1.0.1', '1.0.2')).toBe(-1)
    expect(() => compareStableVersions('1.0.3-beta.1', '1.0.2')).toThrow()
    expect(() => compareStableVersions('01.0.3', '1.0.2')).toThrow()
    expect(() => compareStableVersions('1.0.3 ', '1.0.2')).toThrow()
  })

  it('rejects noncanonical release tags even when their numeric value is newer', () => {
    for (const tag_name of ['v01.0.3', 'v1.00.3', 'v1.0.03', ' v1.0.3', 'v1.0.3 ', '1.0.3']) {
      expect(() => parseLatestRelease(releaseFixture({ tag_name }), '1.0.2')).toThrow(
        'canonical stable semantic-version tag'
      )
    }
  })

  it('accepts a newer stable release only when both exact Windows assets exist', () => {
    expect(parseLatestRelease(releaseFixture(), '1.0.2')).toMatchObject({
      version: '1.0.3',
      tag: 'v1.0.3',
      name: 'Subtitle Bridge v1.0.3'
    })

    expect(() =>
      parseLatestRelease(
        releaseFixture({
          assets: [
            {
              name: 'SubtitleBridge-Setup-x64.exe',
              browser_download_url:
                'https://github.com/PyaeSoneHtun-98/stremio_dictionary/releases/download/v1.0.3/SubtitleBridge-Setup-x64.exe'
            }
          ]
        }),
        '1.0.2'
      )
    ).toThrow('required Windows update assets')
  })

  it('ignores drafts, prereleases, and versions that are not newer', () => {
    expect(parseLatestRelease(releaseFixture({ draft: true }), '1.0.2')).toBeNull()
    expect(parseLatestRelease(releaseFixture({ prerelease: true }), '1.0.2')).toBeNull()
    const incomplete = releaseFixture()
    delete incomplete.draft
    expect(parseLatestRelease(incomplete, '1.0.2')).toBeNull()
    expect(parseLatestRelease(releaseFixture({ tag_name: 'v1.0.2' }), '1.0.2')).toBeNull()
    expect(parseLatestRelease(releaseFixture({ tag_name: 'v1.0.1' }), '1.0.2')).toBeNull()
  })

  it('rejects release assets outside the exact official repository path', () => {
    const assets = releaseFixture().assets as Array<Record<string, unknown>>
    expect(() =>
      parseLatestRelease(
        releaseFixture({
          assets: assets.map((asset, index) =>
            index === 0
              ? {
                  ...asset,
                  browser_download_url:
                    'https://github.com/other/repository/releases/download/v1.0.3/SubtitleBridge-Setup-x64.exe'
                }
              : asset
          )
        }),
        '1.0.2'
      )
    ).toThrow('official repository')
  })

  it('strictly parses the generated installer checksum format', () => {
    const digest = 'a'.repeat(64)
    expect(parseInstallerChecksum(`${digest}  SubtitleBridge-Setup-x64.exe\r\n`)).toBe(digest)
    expect(() => parseInstallerChecksum(`${digest} SubtitleBridge-Setup-x64.exe`)).toThrow()
    expect(() => parseInstallerChecksum(`${digest}  other.exe`)).toThrow()
  })

  it('allows only HTTPS GitHub update hosts', () => {
    expect(assertAllowedUpdateUrl('https://api.github.com/repos/a/b').hostname).toBe('api.github.com')
    expect(
      assertAllowedUpdateUrl('https://release-assets.githubusercontent.com/file?token=opaque').hostname
    ).toBe('release-assets.githubusercontent.com')
    expect(() => assertAllowedUpdateUrl('http://github.com/file')).toThrow()
    expect(() => assertAllowedUpdateUrl('https://example.com/file')).toThrow()
  })
})
