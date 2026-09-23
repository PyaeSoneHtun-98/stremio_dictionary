import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  DownloadProgress,
  InstallerDownloadResult,
  UpdateClient
} from '../src/main/update/GithubUpdateClient'
import { UpdateService } from '../src/main/update/UpdateService'
import type { ReleaseCandidate } from '../src/main/update/updatePolicy'

const RELEASE: ReleaseCandidate = {
  version: '1.0.3',
  tag: 'v1.0.3',
  name: 'Subtitle Bridge v1.0.3',
  notes: 'Release notes',
  publishedAt: '2026-09-24T00:00:00Z',
  installerUrl:
    'https://github.com/PyaeSoneHtun-98/stremio_dictionary/releases/download/v1.0.3/SubtitleBridge-Setup-x64.exe',
  checksumUrl:
    'https://github.com/PyaeSoneHtun-98/stremio_dictionary/releases/download/v1.0.3/SubtitleBridge-Setup-x64.exe.sha256'
}

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('UpdateService', () => {
  it('reports the current version as up to date without making update actions available', async () => {
    const fixture = await createFixture(new FakeClient(null))
    const state = await fixture.service.checkForUpdates()

    expect(state.status).toBe('up-to-date')
    expect(state.latestVersion).toBe('1.0.2')
    await expect(fixture.service.downloadUpdate()).resolves.toMatchObject({ ok: false })
  })

  it('surfaces a simulated newer stable release and its notes', async () => {
    const fixture = await createFixture(new FakeClient(RELEASE))
    const state = await fixture.service.checkForUpdates()

    expect(state).toMatchObject({
      status: 'available',
      currentVersion: '1.0.2',
      latestVersion: '1.0.3',
      releaseName: 'Subtitle Bridge v1.0.3',
      releaseNotes: 'Release notes'
    })
  })

  it('never reaches ready when the downloaded installer hash differs from the checksum', async () => {
    const content = Buffer.from('installer bytes')
    const actual = sha256(content)
    const fixture = await createFixture(
      new FakeClient(RELEASE, {
        content,
        expectedSha256: 'a'.repeat(64),
        reportedSha256: actual
      })
    )

    await fixture.service.checkForUpdates()
    const result = await fixture.service.downloadUpdate()

    expect(result.ok).toBe(false)
    expect(fixture.service.getState().status).toBe('error')
  })

  it('blocks installation during playback and launches only the verified installer afterward', async () => {
    const content = Buffer.from('verified installer bytes')
    const digest = sha256(content)
    let playbackActive = true
    const launched: string[] = []
    let quitCount = 0

    const fixture = await createFixture(
      new FakeClient(RELEASE, {
        content,
        expectedSha256: digest,
        reportedSha256: digest
      }),
      {
        isPlaybackActive: () => playbackActive,
        launchInstaller: async (path) => {
          launched.push(path)
        },
        quitApp: () => {
          quitCount += 1
        }
      }
    )

    await fixture.service.checkForUpdates()
    await expect(fixture.service.downloadUpdate()).resolves.toEqual({ ok: true })
    expect(fixture.service.getState().status).toBe('ready')

    await expect(fixture.service.installUpdate()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('current video')
    })
    expect(launched).toEqual([])
    expect(quitCount).toBe(0)

    playbackActive = false
    await expect(fixture.service.installUpdate()).resolves.toEqual({ ok: true })
    expect(launched).toHaveLength(1)
    expect(launched[0]).toContain('SubtitleBridge-Setup-x64.exe')
    expect(quitCount).toBe(1)
  })

  it('re-hashes the installer at install time and rejects post-download tampering', async () => {
    const content = Buffer.from('verified installer bytes')
    const digest = sha256(content)
    const fixture = await createFixture(
      new FakeClient(RELEASE, {
        content,
        expectedSha256: digest,
        reportedSha256: digest
      })
    )

    await fixture.service.checkForUpdates()
    await fixture.service.downloadUpdate()

    const installerPath = join(
      fixture.root,
      'v1.0.3',
      'SubtitleBridge-Setup-x64.exe'
    )
    await writeFile(installerPath, 'tampered bytes')

    const result = await fixture.service.installUpdate()
    expect(result.ok).toBe(false)
    expect(fixture.service.getState().status).toBe('error')
    expect(fixture.launched).toEqual([])
  })
})

interface FakeDownloadOptions {
  content?: Buffer
  expectedSha256?: string
  reportedSha256?: string
}

class FakeClient implements UpdateClient {
  constructor(
    private readonly release: ReleaseCandidate | null,
    private readonly options: FakeDownloadOptions = {}
  ) {}

  async fetchLatest(): Promise<ReleaseCandidate | null> {
    return this.release
  }

  async fetchChecksum(): Promise<string> {
    return this.options.expectedSha256 ?? 'a'.repeat(64)
  }

  async downloadInstaller(
    _release: ReleaseCandidate,
    destination: string,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<InstallerDownloadResult> {
    const content = this.options.content ?? Buffer.from('installer')
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, content)
    onProgress({ receivedBytes: content.length, totalBytes: content.length })
    return {
      sha256: this.options.reportedSha256 ?? sha256(content),
      bytes: content.length
    }
  }
}

async function createFixture(
  client: UpdateClient,
  overrides: Partial<{
    isPlaybackActive: () => boolean
    launchInstaller: (path: string) => Promise<void>
    quitApp: () => void
  }> = {}
): Promise<{
  service: UpdateService
  root: string
  launched: string[]
}> {
  const root = await mkdtemp(join(tmpdir(), 'subtitle-bridge-update-'))
  tempDirectories.push(root)
  const launched: string[] = []

  const service = new UpdateService({
    currentVersion: '1.0.2',
    updatesRoot: root,
    client,
    isPlaybackActive: overrides.isPlaybackActive ?? (() => false),
    launchInstaller:
      overrides.launchInstaller ??
      (async (path) => {
        launched.push(path)
      }),
    quitApp: overrides.quitApp ?? (() => {}),
    onState: () => {}
  })

  return { service, root, launched }
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}
