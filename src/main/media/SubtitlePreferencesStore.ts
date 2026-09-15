import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_SUBTITLE_PREFERENCES,
  type SubtitlePreferencesSnapshot,
  type SubtitlePreferencesUpdate
} from '../../shared/media'
import {
  applySubtitlePreferencesUpdate,
  sanitizePersistedSubtitlePreferences
} from './subtitlePreferences'

interface PersistedSubtitlePreferences extends SubtitlePreferencesSnapshot {
  version: 1
}

export class SubtitlePreferencesStore {
  private readonly filePath: string
  private state: SubtitlePreferencesSnapshot = { ...DEFAULT_SUBTITLE_PREFERENCES }
  private loadPromise: Promise<void> | null = null
  private mutationChain: Promise<void> = Promise.resolve()

  constructor(filePath = join(app.getPath('userData'), 'subtitle-preferences.json')) {
    this.filePath = filePath
  }

  async getSnapshot(): Promise<SubtitlePreferencesSnapshot> {
    await this.ensureLoaded()
    return { ...this.state }
  }

  update(update: SubtitlePreferencesUpdate): Promise<SubtitlePreferencesSnapshot> {
    let result: SubtitlePreferencesSnapshot = { ...this.state }
    const task = this.mutationChain.then(async () => {
      await this.ensureLoaded()
      const next = applySubtitlePreferencesUpdate(this.state, update)
      await persistPreferences(this.filePath, next)
      this.state = next
      result = { ...next }
    })

    this.mutationChain = task.then(
      () => undefined,
      () => undefined
    )

    return task.then(() => result)
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.load()
    }
    await this.loadPromise
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      this.state = sanitizePersistedSubtitlePreferences(JSON.parse(raw) as unknown)
    } catch (error) {
      if (!isMissingFileError(error)) {
        this.state = { ...DEFAULT_SUBTITLE_PREFERENCES }
        return
      }
      this.state = { ...DEFAULT_SUBTITLE_PREFERENCES }
    }
  }
}

async function persistPreferences(
  filePath: string,
  state: SubtitlePreferencesSnapshot
): Promise<void> {
  const payload: PersistedSubtitlePreferences = {
    version: 1,
    ...state
  }

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
  )
}
