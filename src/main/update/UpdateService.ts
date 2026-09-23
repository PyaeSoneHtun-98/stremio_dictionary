import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { UpdateActionResult, UpdateSnapshot } from '../../shared/update'
import { diagnosticLog } from '../diagnostics'
import {
  type UpdateClient,
  type DownloadProgress,
  sha256File
} from './GithubUpdateClient'
import { SETUP_ASSET_NAME, type ReleaseCandidate } from './updatePolicy'

const AUTO_CHECK_DELAY_MS = 4_000
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface UpdateServiceDependencies {
  currentVersion: string
  updatesRoot: string
  client: UpdateClient
  isPlaybackActive: () => boolean
  launchInstaller: (installerPath: string) => Promise<void>
  quitApp: () => void
  onState: (state: UpdateSnapshot) => void
}

export class UpdateService {
  private state: UpdateSnapshot
  private release: ReleaseCandidate | null = null
  private expectedSha256: string | null = null
  private verifiedInstallerPath: string | null = null
  private autoCheckTimer: NodeJS.Timeout | null = null
  private intervalTimer: NodeJS.Timeout | null = null
  private checking: Promise<UpdateSnapshot> | null = null
  private downloading: Promise<UpdateActionResult> | null = null

  constructor(private readonly dependencies: UpdateServiceDependencies) {
    this.state = {
      status: 'idle',
      currentVersion: dependencies.currentVersion,
      latestVersion: null,
      releaseName: null,
      releaseNotes: null,
      publishedAt: null,
      downloadPercent: null,
      error: null,
      checkedAt: null
    }
  }

  start(): void {
    if (this.autoCheckTimer || this.intervalTimer) {
      return
    }

    this.autoCheckTimer = setTimeout(() => {
      this.autoCheckTimer = null
      void this.checkForUpdates()
    }, AUTO_CHECK_DELAY_MS)
    this.autoCheckTimer.unref()

    this.intervalTimer = setInterval(() => {
      if (this.state.status !== 'downloading' && this.state.status !== 'ready') {
        void this.checkForUpdates()
      }
    }, AUTO_CHECK_INTERVAL_MS)
    this.intervalTimer.unref()
  }

  dispose(): void {
    if (this.autoCheckTimer) {
      clearTimeout(this.autoCheckTimer)
      this.autoCheckTimer = null
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
  }

  getState(): UpdateSnapshot {
    return structuredClone(this.state)
  }

  checkForUpdates(): Promise<UpdateSnapshot> {
    if (this.checking) {
      return this.checking
    }

    if (this.state.status === 'downloading' || this.state.status === 'ready') {
      return Promise.resolve(this.getState())
    }

    this.checking = this.performCheck().finally(() => {
      this.checking = null
    })
    return this.checking
  }

  downloadUpdate(): Promise<UpdateActionResult> {
    if (this.downloading) {
      return this.downloading
    }

    if (!this.release || this.state.status !== 'available') {
      return Promise.resolve({ ok: false, error: 'No update is ready to download.' })
    }

    this.downloading = this.performDownload(this.release).finally(() => {
      this.downloading = null
    })
    return this.downloading
  }

  async installUpdate(): Promise<UpdateActionResult> {
    if (
      this.state.status !== 'ready' ||
      !this.verifiedInstallerPath ||
      !this.expectedSha256 ||
      !this.release
    ) {
      return { ok: false, error: 'Download and verify the update before installing it.' }
    }

    if (this.dependencies.isPlaybackActive()) {
      return {
        ok: false,
        error: 'Finish or close the current video before installing the update.'
      }
    }

    try {
      const actualSha256 = await sha256File(this.verifiedInstallerPath)
      if (actualSha256 !== this.expectedSha256) {
        await rm(this.verifiedInstallerPath, { force: true })
        this.verifiedInstallerPath = null
        this.expectedSha256 = null
        this.patchState({
          status: 'error',
          downloadPercent: null,
          error: 'The downloaded installer no longer matches its verified checksum. Download it again.'
        })
        diagnosticLog('update.installVerificationFailed', { version: this.release.version })
        return { ok: false, error: this.state.error ?? 'Update verification failed.' }
      }

      await this.dependencies.launchInstaller(this.verifiedInstallerPath)
      diagnosticLog('update.installStarted', { version: this.release.version })
      this.dependencies.quitApp()
      return { ok: true }
    } catch {
      this.patchState({
        status: 'error',
        error: 'Could not start the verified update installer. Try downloading the update again.'
      })
      diagnosticLog('update.installLaunchFailed', { version: this.release.version })
      return { ok: false, error: this.state.error ?? 'Could not start the update installer.' }
    }
  }

  private async performCheck(): Promise<UpdateSnapshot> {
    this.patchState({ status: 'checking', error: null, downloadPercent: null })

    try {
      const release = await this.dependencies.client.fetchLatest(this.dependencies.currentVersion)
      const checkedAt = new Date().toISOString()

      if (!release) {
        this.release = null
        this.expectedSha256 = null
        this.verifiedInstallerPath = null
        this.patchState({
          status: 'up-to-date',
          latestVersion: this.dependencies.currentVersion,
          releaseName: null,
          releaseNotes: null,
          publishedAt: null,
          downloadPercent: null,
          error: null,
          checkedAt
        })
        diagnosticLog('update.checkUpToDate', { version: this.dependencies.currentVersion })
        return this.getState()
      }

      this.release = release
      this.expectedSha256 = null
      this.verifiedInstallerPath = null
      this.patchState({
        status: 'available',
        latestVersion: release.version,
        releaseName: release.name,
        releaseNotes: release.notes,
        publishedAt: release.publishedAt,
        downloadPercent: null,
        error: null,
        checkedAt
      })
      diagnosticLog('update.available', {
        currentVersion: this.dependencies.currentVersion,
        latestVersion: release.version
      })
    } catch {
      this.patchState({
        status: 'error',
        downloadPercent: null,
        error: 'Could not check for updates. Subtitle Bridge will keep working normally.'
      })
      diagnosticLog('update.checkFailed')
    }

    return this.getState()
  }

  private async performDownload(release: ReleaseCandidate): Promise<UpdateActionResult> {
    this.patchState({ status: 'downloading', downloadPercent: 0, error: null })

    const releaseDirectory = join(this.dependencies.updatesRoot, `v${release.version}`)
    const installerPath = join(releaseDirectory, SETUP_ASSET_NAME)

    try {
      await rm(releaseDirectory, { recursive: true, force: true })
      const expectedSha256 = await this.dependencies.client.fetchChecksum(release)
      let lastPercent = -1

      const result = await this.dependencies.client.downloadInstaller(
        release,
        installerPath,
        (progress) => {
          const percent = calculatePercent(progress)
          if (percent !== null && percent !== lastPercent) {
            lastPercent = percent
            this.patchState({ downloadPercent: percent })
          }
        }
      )

      if (result.sha256 !== expectedSha256) {
        await rm(releaseDirectory, { recursive: true, force: true })
        throw new Error('Downloaded update checksum mismatch.')
      }

      this.expectedSha256 = expectedSha256
      this.verifiedInstallerPath = installerPath
      this.patchState({
        status: 'ready',
        downloadPercent: 100,
        error: null
      })
      diagnosticLog('update.downloadVerified', {
        version: release.version,
        bytes: result.bytes
      })
      return { ok: true }
    } catch {
      await rm(releaseDirectory, { recursive: true, force: true }).catch(() => {})
      this.expectedSha256 = null
      this.verifiedInstallerPath = null
      this.patchState({
        status: 'error',
        downloadPercent: null,
        error: 'The update could not be downloaded and verified. Try again.'
      })
      diagnosticLog('update.downloadFailed', { version: release.version })
      return { ok: false, error: this.state.error ?? 'Update download failed.' }
    }
  }

  private patchState(patch: Partial<UpdateSnapshot>): void {
    this.state = { ...this.state, ...patch }
    this.dependencies.onState(this.getState())
  }
}

function calculatePercent(progress: DownloadProgress): number | null {
  if (!progress.totalBytes || progress.totalBytes <= 0) {
    return null
  }

  return Math.max(0, Math.min(100, Math.floor((progress.receivedBytes / progress.totalBytes) * 100)))
}
