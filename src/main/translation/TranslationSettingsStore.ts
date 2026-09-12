import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_TRANSLATION_SETTINGS,
  type TranslationPopupPosition,
  type TranslationProviderId,
  type TranslationSettingsSnapshot,
  type TranslationSettingsUpdate
} from '../../shared/settings'
import type {
  TranslationRuntimeSettings,
  TranslationRuntimeSettingsSource
} from './TranslationService'
import { normalizeTargetLanguage } from './settingsValidation'

interface PersistedTranslationSettings {
  version: 1
  provider: TranslationProviderId
  targetLanguage: string
  popupPosition: TranslationPopupPosition
  autoPauseOnWordClick: boolean
  encryptedApiKey?: string
}

interface StoredState {
  provider: TranslationProviderId
  targetLanguage: string
  popupPosition: TranslationPopupPosition
  autoPauseOnWordClick: boolean
  encryptedApiKey: string | null
}

const DEFAULT_STATE: StoredState = {
  provider: DEFAULT_TRANSLATION_SETTINGS.provider,
  targetLanguage: DEFAULT_TRANSLATION_SETTINGS.targetLanguage,
  popupPosition: DEFAULT_TRANSLATION_SETTINGS.popupPosition,
  autoPauseOnWordClick: DEFAULT_TRANSLATION_SETTINGS.autoPauseOnWordClick,
  encryptedApiKey: null
}

export class TranslationSettingsStore implements TranslationRuntimeSettingsSource {
  private readonly filePath: string
  private state: StoredState = { ...DEFAULT_STATE }
  private loadPromise: Promise<void> | null = null
  private mutationChain: Promise<void> = Promise.resolve()

  constructor(filePath = join(app.getPath('userData'), 'translation-settings.json')) {
    this.filePath = filePath
  }

  async getRuntimeSettings(): Promise<TranslationRuntimeSettings> {
    await this.ensureLoaded()
    return {
      provider: this.state.provider,
      targetLanguage: this.state.targetLanguage,
      apiKey: this.decryptApiKey()
    }
  }

  async getSnapshot(cacheEntries: number): Promise<TranslationSettingsSnapshot> {
    await this.ensureLoaded()
    return {
      provider: this.state.provider,
      targetLanguage: this.state.targetLanguage,
      popupPosition: this.state.popupPosition,
      autoPauseOnWordClick: this.state.autoPauseOnWordClick,
      apiKeyConfigured: this.state.encryptedApiKey !== null,
      cacheEntries
    }
  }

  update(update: TranslationSettingsUpdate): Promise<void> {
    const task = this.mutationChain.then(async () => {
      await this.ensureLoaded()
      await this.applyUpdate(update)
    })
    this.mutationChain = task.then(
      () => undefined,
      () => undefined
    )
    return task
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
      const parsed = JSON.parse(raw) as unknown
      this.state = sanitizePersistedSettings(parsed)
    } catch (error) {
      if (isMissingFileError(error)) {
        this.state = { ...DEFAULT_STATE }
        return
      }

      // Corrupt/unreadable settings should never prevent the player from starting.
      this.state = { ...DEFAULT_STATE }
    }
  }

  private async applyUpdate(update: TranslationSettingsUpdate): Promise<void> {
    const next: StoredState = { ...this.state }

    if (update.provider !== undefined) {
      next.provider = update.provider
    }
    if (update.targetLanguage !== undefined) {
      next.targetLanguage = normalizeTargetLanguage(update.targetLanguage)
    }
    if (update.popupPosition !== undefined) {
      next.popupPosition = update.popupPosition
    }
    if (update.autoPauseOnWordClick !== undefined) {
      next.autoPauseOnWordClick = update.autoPauseOnWordClick
    }
    if (update.apiKey !== undefined) {
      next.encryptedApiKey = update.apiKey ? this.encryptApiKey(update.apiKey) : null
    }

    await persistSettings(this.filePath, next)
    this.state = next
  }

  private encryptApiKey(apiKey: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable, so the API key was not saved.')
    }
    return safeStorage.encryptString(apiKey).toString('base64')
  }

  private decryptApiKey(): string {
    if (!this.state.encryptedApiKey || !safeStorage.isEncryptionAvailable()) {
      return ''
    }

    try {
      return safeStorage.decryptString(Buffer.from(this.state.encryptedApiKey, 'base64'))
    } catch {
      return ''
    }
  }
}

function sanitizePersistedSettings(value: unknown): StoredState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_STATE }
  }

  const raw = value as Record<string, unknown>
  const provider = raw.provider === 'google' || raw.provider === 'local-dictionary'
    ? raw.provider
    : DEFAULT_STATE.provider
  const popupPosition = raw.popupPosition === 'above' || raw.popupPosition === 'below'
    ? raw.popupPosition
    : DEFAULT_STATE.popupPosition

  let targetLanguage = DEFAULT_STATE.targetLanguage
  if (typeof raw.targetLanguage === 'string') {
    try {
      targetLanguage = normalizeTargetLanguage(raw.targetLanguage)
    } catch {
      targetLanguage = DEFAULT_STATE.targetLanguage
    }
  }

  return {
    provider,
    targetLanguage,
    popupPosition,
    autoPauseOnWordClick:
      typeof raw.autoPauseOnWordClick === 'boolean'
        ? raw.autoPauseOnWordClick
        : DEFAULT_STATE.autoPauseOnWordClick,
    encryptedApiKey:
      typeof raw.encryptedApiKey === 'string' && raw.encryptedApiKey.length <= 4096
        ? raw.encryptedApiKey
        : null
  }
}

async function persistSettings(filePath: string, state: StoredState): Promise<void> {
  const payload: PersistedTranslationSettings = {
    version: 1,
    provider: state.provider,
    targetLanguage: state.targetLanguage,
    popupPosition: state.popupPosition,
    autoPauseOnWordClick: state.autoPauseOnWordClick,
    ...(state.encryptedApiKey ? { encryptedApiKey: state.encryptedApiKey } : {})
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
