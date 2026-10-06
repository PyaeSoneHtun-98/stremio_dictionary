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

  it('uses the explicitly pinned month-end LGPL shared FFmpeg build', () => {
    expect(manifest.ffmpeg.archiveUrl).toContain(
      '/autobuild-2026-09-30-13-08/ffmpeg-n8.1.3-9-g29e619e767-win64-lgpl-shared-8.1.zip'
    )
    expect(manifest.ffmpeg.archiveSha256).toBe(
      '3e47bda1607740550141e37c0e49d1e5182b34699f15adfd137ee266d346811a'
    )
    expect(manifest.ffmpeg.provenance).toContain('month-end')
    expect(manifest.ffmpeg.provenance).toContain('two years')
  })

  it('pins mpv to the immutable stable MSVC release asset instead of the rotating git-release', () => {
    expect(manifest.mpv.archiveUrl).toBe(
      'https://github.com/mpv-player/mpv/releases/download/v0.41.0/mpv-v0.41.0-x86_64-pc-windows-msvc.zip'
    )
    expect(manifest.mpv.archiveUrl).not.toContain('/git-release/')
    expect(manifest.mpv.archiveSha256).toBe(
      '4e197f729f5071c6772f35fffd96e0f36e3e8a044bd9479b136bb09b7c6a80ff'
    )
    expect(manifest.mpv.provenance).toContain('stable v0.41.0')
  })
})
