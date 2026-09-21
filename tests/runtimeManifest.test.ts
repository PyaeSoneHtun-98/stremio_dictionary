import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

interface RuntimeDefinition {
  displayName: string
  archiveUrl: string
  archiveSha256: string
  executableName: string
  provenance: string
  sourceUrl: string
}

interface RuntimeManifest {
  version: number
  mpv: RuntimeDefinition
  ffmpeg: RuntimeDefinition
}

const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../packaging/runtime-manifest.json', import.meta.url)),
    'utf8'
  )
) as RuntimeManifest

describe('Windows runtime manifest', () => {
  it('pins runtime downloads to HTTPS artifacts with explicit SHA-256 digests', () => {
    expect(manifest.version).toBe(1)

    for (const runtime of [manifest.mpv, manifest.ffmpeg]) {
      expect(runtime.archiveUrl).toMatch(/^https:\/\//)
      expect(runtime.archiveUrl).not.toContain('/latest/')
      expect(runtime.archiveSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(runtime.executableName).toMatch(/\.exe$/)
      expect(runtime.provenance.trim()).not.toBe('')
      expect(runtime.sourceUrl).toMatch(/^https:\/\//)
    }
  })

  it('uses the explicitly pinned LGPL shared FFmpeg build', () => {
    expect(manifest.ffmpeg.archiveUrl).toContain(
      '/autobuild-2026-09-20-13-11/ffmpeg-n8.1.2-267-gb2f422d306-win64-lgpl-shared-8.1.zip'
    )
    expect(manifest.ffmpeg.archiveSha256).toBe(
      '170e3f1dd7a2099c3e9bccc47958610fe6ea3a75e84e5c46e576af4163ab10bf'
    )
  })

  it('pins the mpv artifact by commit-named archive and hash', () => {
    expect(manifest.mpv.archiveUrl).toContain(
      'mpv-v0.41.0-dev-g0b7ed670f-34806151888-x86_64-w64-mingw32.zip'
    )
    expect(manifest.mpv.archiveSha256).toBe(
      '456318b7cbd4f8186ba8a68e9469048bd72ad9f8d474a0a1602b293fff430982'
    )
  })
})
