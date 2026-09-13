import { useEffect, useRef, useState } from 'react'
import type { MediaTrack, PlaybackSnapshot, SubtitleToken } from '../../../../shared/media'
import { createEmptySubtitleModel } from '../../../../shared/media'
import {
  DEFAULT_TRANSLATION_SETTINGS,
  type TranslationSettingsSnapshot,
  type TranslationSettingsUpdate
} from '../../../../shared/settings'
import type { TranslationResult } from '../../../../shared/translation'
import './OverlayProbe.css'
import './Issue9Polish.css'
import {
  clampPlayerValue,
  resolvePlayerShortcut,
  subtitleRecoveryMessage
} from './playerInteraction'
import { segmentSubtitleCue } from './subtitleSegments'

const EMPTY_STATE: PlaybackSnapshot = {
  status: 'idle',
  filePath: null,
  fileName: null,
  currentTime: null,
  duration: null,
  volume: 100,
  speed: 1,
  tracks: [],
  subtitle: createEmptySubtitleModel(),
  error: null
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const TARGET_LANGUAGE_OPTIONS = [
  { code: 'my', label: 'Burmese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-cn', label: 'Chinese (Simplified)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' }
] as const

interface SelectedWord {
  cueId: string
  tokenStart: number
  text: string
  lookupTerm: string
}

type TranslationLookupState =
  | { status: 'idle' }
  | { status: 'loading'; word: string }
  | { status: 'ready'; word: string; result: TranslationResult }
  | { status: 'error'; word: string; error: string }

export function PolishedOverlay(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null)
  const [translation, setTranslation] = useState<TranslationLookupState>({ status: 'idle' })
  const [translationSettings, setTranslationSettings] = useState<TranslationSettingsSnapshot>(
    DEFAULT_TRANSLATION_SETTINGS
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [controlError, setControlError] = useState<string | null>(null)
  const currentFilePath = useRef<string | null>(null)
  const currentCueId = useRef<string | null>(null)
  const currentSubtitleTrackId = useRef<number | null>(null)
  const translationRequestVersion = useRef(0)

  const dismissTranslation = (): void => {
    translationRequestVersion.current += 1
    setSelectedWord(null)
    setTranslation({ status: 'idle' })
  }

  useEffect(() => {
    let active = true

    const applySnapshot = (snapshot: PlaybackSnapshot): void => {
      if (!active) {
        return
      }

      const nextCueId = snapshot.subtitle.activeCue?.id ?? null
      const selectionContextChanged =
        currentFilePath.current !== snapshot.filePath ||
        currentCueId.current !== nextCueId ||
        currentSubtitleTrackId.current !== snapshot.subtitle.trackId

      if (currentFilePath.current !== snapshot.filePath) {
        setControlError(null)
      }

      if (selectionContextChanged) {
        translationRequestVersion.current += 1
        setSelectedWord(null)
        setTranslation({ status: 'idle' })
      }

      currentFilePath.current = snapshot.filePath
      currentCueId.current = nextCueId
      currentSubtitleTrackId.current = snapshot.subtitle.trackId
      setState(snapshot)
    }

    void window.desktop.media.getState().then(applySnapshot)
    const unsubscribe = window.desktop.media.onState(applySnapshot)

    return () => {
      active = false
      translationRequestVersion.current += 1
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    void window.desktop.translation
      .getSettings()
      .then((settings) => {
        if (active) {
          setTranslationSettings(settings)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSettingsError(translationErrorMessage(error))
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const clearRememberedFocus = (): void => {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }
    }

    window.addEventListener('blur', clearRememberedFocus)
    return () => window.removeEventListener('blur', clearRememberedFocus)
  }, [])

  useEffect(() => {
    const handleKeyboardEntry = (event: KeyboardEvent): void => {
      if (
        event.key !== 'Tab' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !state.subtitle.activeCue
      ) {
        return
      }

      const activeElement = document.activeElement
      const startsFromDocument =
        activeElement === null || activeElement === document.body || activeElement === document.documentElement

      if (!startsFromDocument) {
        return
      }

      const words = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.subtitle-word:not(:disabled)')
      )
      const target = event.shiftKey ? words.at(-1) : words[0]
      if (!target) {
        return
      }

      event.preventDefault()
      target.focus()
    }

    window.addEventListener('keydown', handleKeyboardEntry, true)
    return () => window.removeEventListener('keydown', handleKeyboardEntry, true)
  }, [state.subtitle.activeCue])

  useEffect(() => {
    if (!selectedWord) {
      return
    }

    const handleOutsidePointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('.translation-popup') || target.closest('.subtitle-word')) {
        return
      }

      dismissTranslation()
    }

    window.addEventListener('pointerdown', handleOutsidePointerDown, true)
    return () => window.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  }, [selectedWord])

  const canControl = Boolean(state.filePath) && !['loading', 'error', 'unavailable'].includes(state.status)
  const playing = state.status === 'playing'
  const duration = state.duration ?? 0
  const currentTime = Math.min(state.currentTime ?? 0, duration || Number.MAX_SAFE_INTEGER)
  const activeCue = state.subtitle.activeCue
  const subtitleSegments = activeCue ? segmentSubtitleCue(activeCue) : []
  const subtitleTracks = state.tracks.filter((track) => track.type === 'subtitle')
  const supportedSubtitleTracks = subtitleTracks.filter(isSelectableSubtitleTrack)
  const canChangeSubtitleTrack = state.status === 'paused' && supportedSubtitleTracks.length > 0
  const subtitleMessage = activeCue
    ? null
    : subtitleRecoveryMessage(state.subtitle.status, state.subtitle.error)

  const runControl = async (action: () => Promise<void>): Promise<void> => {
    setControlError(null)
    try {
      await action()
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'The player control failed.')
    }
  }

  useEffect(() => {
    const handlePlayerShortcut = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) {
        return
      }

      const action = resolvePlayerShortcut(event.key, {
        canControl,
        interactiveTarget: isInteractiveKeyboardTarget(event.target),
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey
      })

      if (!action) {
        return
      }

      if (action.kind === 'dismiss') {
        if (selectedWord) {
          event.preventDefault()
          dismissTranslation()
          return
        }
        if (settingsOpen) {
          event.preventDefault()
          setSettingsOpen(false)
        }
        return
      }

      if (event.repeat && (action.kind === 'toggle-playback' || action.kind === 'fullscreen')) {
        return
      }

      event.preventDefault()

      if (action.kind === 'toggle-playback') {
        void runControl(() => window.desktop.media.setPaused(playing))
        return
      }

      if (action.kind === 'seek') {
        const maximum = duration > 0 ? duration : Math.max(0, currentTime + Math.abs(action.deltaSeconds))
        const nextTime = clampPlayerValue(currentTime + action.deltaSeconds, 0, maximum)
        void runControl(() => window.desktop.media.seek(nextTime))
        return
      }

      if (action.kind === 'volume') {
        const nextVolume = clampPlayerValue(state.volume + action.delta, 0, 100)
        void runControl(() => window.desktop.media.setVolume(nextVolume))
        return
      }

      void runControl(() => window.desktop.media.toggleFullscreen())
    }

    window.addEventListener('keydown', handlePlayerShortcut, true)
    return () => window.removeEventListener('keydown', handlePlayerShortcut, true)
  }, [canControl, currentTime, duration, playing, selectedWord, settingsOpen, state.volume])

  const updateTranslationSettings = async (
    update: TranslationSettingsUpdate
  ): Promise<boolean> => {
    setSettingsError(null)
    try {
      const nextSettings = await window.desktop.translation.updateSettings(update)
      setTranslationSettings(nextSettings)

      if (update.provider !== undefined || update.targetLanguage !== undefined) {
        dismissTranslation()
      }

      return true
    } catch (error) {
      setSettingsError(translationErrorMessage(error))
      return false
    }
  }

  const clearTranslationCache = async (): Promise<void> => {
    setSettingsError(null)
    try {
      const nextSettings = await window.desktop.translation.clearCache()
      setTranslationSettings(nextSettings)
    } catch (error) {
      setSettingsError(translationErrorMessage(error))
    }
  }

  const saveApiKey = async (): Promise<void> => {
    if (!apiKeyDraft.trim()) {
      return
    }
    if (await updateTranslationSettings({ apiKey: apiKeyDraft })) {
      setApiKeyDraft('')
    }
  }

  const selectWord = (cueId: string, token: SubtitleToken, context: string): void => {
    const requestVersion = ++translationRequestVersion.current
    setSelectedWord({
      cueId,
      tokenStart: token.start,
      text: token.text,
      lookupTerm: token.lookupTerm
    })
    setTranslation({ status: 'loading', word: token.text })

    if (translationSettings.autoPauseOnWordClick && state.status === 'playing') {
      void runControl(() => window.desktop.media.setPaused(true))
    }

    void window.desktop.translation
      .translateWord({
        word: token.lookupTerm,
        context
      })
      .then((result) => {
        if (translationRequestVersion.current !== requestVersion) {
          return
        }
        setTranslation({ status: 'ready', word: token.text, result })
        void refreshTranslationSettings(setTranslationSettings)
      })
      .catch((error: unknown) => {
        if (translationRequestVersion.current !== requestVersion) {
          return
        }
        setTranslation({
          status: 'error',
          word: token.text,
          error: translationErrorMessage(error)
        })
      })
  }

  return (
    <main className="overlay-probe" aria-label="Subtitle Bridge video controls">
      <div className="overlay-topline">
        <span className={`overlay-status status-${state.status}`}>{state.status}</span>
        <strong title={state.fileName ?? undefined}>{state.fileName ?? 'No video loaded'}</strong>
      </div>

      <section className="subtitle-overlay" aria-label="Interactive English subtitle" aria-live="polite">
        {activeCue ? (
          <div className="subtitle-cue" key={activeCue.id}>
            <div className="subtitle-text">
              {subtitleSegments.map((segment) => {
                if (segment.kind === 'break') {
                  return <br key={segment.key} />
                }

                if (segment.kind === 'text') {
                  return <span key={segment.key}>{segment.text}</span>
                }

                const selected =
                  selectedWord?.cueId === activeCue.id && selectedWord.tokenStart === segment.token.start

                return (
                  <button
                    key={segment.key}
                    type="button"
                    className="subtitle-word"
                    aria-pressed={selected}
                    aria-label={`Translate word ${segment.token.text}`}
                    title={`Translate: ${segment.token.lookupTerm}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      selectWord(activeCue.id, segment.token, activeCue.text)
                    }}
                  >
                    {segment.token.text}
                  </button>
                )
              })}
            </div>
            {selectedWord ? (
              <TranslationPopup
                selectedWord={selectedWord}
                translation={translation}
                popupPosition={translationSettings.popupPosition}
                targetLanguage={translationSettings.targetLanguage}
                onDismiss={dismissTranslation}
              />
            ) : null}
          </div>
        ) : subtitleMessage ? (
          <div
            className={`subtitle-transient-status ${
              state.subtitle.status === 'extracting' ? '' : 'subtitle-transient-warning'
            }`}
            role="status"
          >
            {subtitleMessage}
          </div>
        ) : null}
      </section>

      <div className="player-controls">
        {settingsOpen ? (
          <TranslationSettingsPanel
            settings={translationSettings}
            apiKeyDraft={apiKeyDraft}
            error={settingsError}
            onApiKeyDraftChange={setApiKeyDraft}
            onUpdate={(update) => {
              void updateTranslationSettings(update)
            }}
            onSaveApiKey={() => {
              void saveApiKey()
            }}
            onClearApiKey={() => {
              setApiKeyDraft('')
              void updateTranslationSettings({ apiKey: null })
            }}
            onClearCache={() => {
              void clearTranslationCache()
            }}
          />
        ) : null}

        {state.error || controlError ? (
          <div className="player-control-error" role="status">
            {controlError ?? state.error}
          </div>
        ) : null}

        <div className="timeline-row">
          <span>{formatTime(state.currentTime)}</span>
          <input
            className="timeline-slider"
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={0.1}
            value={currentTime}
            disabled={!canControl || duration <= 0}
            aria-label="Seek position"
            onChange={(event) => {
              void runControl(() => window.desktop.media.seek(Number(event.currentTarget.value)))
            }}
          />
          <span>{formatTime(state.duration)}</span>
        </div>

        <div className="control-row">
          <button
            type="button"
            className="control-button control-button-primary"
            disabled={!canControl}
            onClick={() => {
              void runControl(() => window.desktop.media.setPaused(playing))
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>

          <label className="volume-control">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(state.volume)}
              disabled={!state.filePath || ['error', 'unavailable'].includes(state.status)}
              onChange={(event) => {
                void runControl(() => window.desktop.media.setVolume(Number(event.currentTarget.value)))
              }}
            />
            <strong>{Math.round(state.volume)}%</strong>
          </label>

          <label className="subtitle-track-control" title={subtitleControlTitle(state, subtitleTracks)}>
            <span>Subtitles</span>
            <select
              aria-label="Embedded subtitle track"
              value={state.subtitle.trackId === null ? '' : String(state.subtitle.trackId)}
              disabled={!canChangeSubtitleTrack}
              onChange={(event) => {
                const trackId = Number(event.currentTarget.value)
                void runControl(() => window.desktop.media.selectSubtitleTrack(trackId))
              }}
            >
              {supportedSubtitleTracks.length === 0 ? <option value="">No text tracks</option> : null}
              {subtitleTracks.map((track) => (
                <option value={track.id} key={track.id} disabled={!isSelectableSubtitleTrack(track)}>
                  {formatSubtitleTrack(track)}
                </option>
              ))}
            </select>
          </label>

          <label className="speed-control">
            <span>Speed</span>
            <select
              value={String(state.speed)}
              disabled={!canControl}
              onChange={(event) => {
                void runControl(() => window.desktop.media.setSpeed(Number(event.currentTarget.value)))
              }}
            >
              {SPEED_OPTIONS.map((speed) => (
                <option value={speed} key={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="control-button"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((open) => !open)
            }}
          >
            Settings
          </button>

          <button
            type="button"
            className="control-button"
            disabled={!state.filePath}
            onClick={() => {
              void runControl(() => window.desktop.media.toggleFullscreen())
            }}
          >
            Fullscreen
          </button>
        </div>

        <div className="keyboard-shortcuts" aria-label="Keyboard shortcuts">
          <kbd>Space</kbd>/<kbd>K</kbd> play · <kbd>←</kbd>/<kbd>→</kbd> seek 5s · <kbd>↑</kbd>/<kbd>↓</kbd>{' '}
          volume · <kbd>F</kbd> fullscreen · <kbd>Esc</kbd> dismiss
        </div>
      </div>
    </main>
  )
}

function TranslationPopup({
  selectedWord,
  translation,
  popupPosition,
  targetLanguage,
  onDismiss
}: {
  selectedWord: SelectedWord
  translation: TranslationLookupState
  popupPosition: 'above' | 'below'
  targetLanguage: string
  onDismiss: () => void
}): React.JSX.Element {
  const resultLanguage = translation.status === 'ready' ? translation.result.targetLanguage : targetLanguage

  return (
    <div
      className={`translation-popup popup-${popupPosition} translation-${translation.status}`}
      role="status"
      aria-live="polite"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="translation-popup-header">
        <div className="translation-popup-heading">
          <strong>{selectedWord.text}</strong>
          <span>English → {languageLabel(resultLanguage)}</span>
        </div>
        <button
          type="button"
          className="translation-popup-close"
          aria-label="Close translation"
          title="Close translation (Esc)"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>

      {translation.status === 'loading' ? (
        <div className="translation-loading">Translating…</div>
      ) : null}

      {translation.status === 'ready' ? (
        <>
          <div className="translation-burmese" lang={translation.result.targetLanguage}>
            {translation.result.translation}
          </div>
          {translation.result.pronunciation ? (
            <div className="translation-pronunciation">{translation.result.pronunciation}</div>
          ) : null}
        </>
      ) : null}

      {translation.status === 'error' ? (
        <div className="translation-error">
          <strong>Translation unavailable</strong>
          <span>{translation.error}</span>
          <small>Playback and subtitles still work. Try another word or try again later.</small>
        </div>
      ) : null}
    </div>
  )
}

function TranslationSettingsPanel({
  settings,
  apiKeyDraft,
  error,
  onApiKeyDraftChange,
  onUpdate,
  onSaveApiKey,
  onClearApiKey,
  onClearCache
}: {
  settings: TranslationSettingsSnapshot
  apiKeyDraft: string
  error: string | null
  onApiKeyDraftChange: (value: string) => void
  onUpdate: (update: TranslationSettingsUpdate) => void
  onSaveApiKey: () => void
  onClearApiKey: () => void
  onClearCache: () => void
}): React.JSX.Element {
  return (
    <section className="translation-settings-panel" aria-label="Translation settings">
      <div className="translation-settings-heading">
        <strong>Translation settings</strong>
        <span>{settings.cacheEntries} cached</span>
      </div>

      {error ? <div className="translation-settings-error">{error}</div> : null}

      <div className="translation-settings-grid">
        <label>
          <span>Provider</span>
          <select
            value={settings.provider}
            onChange={(event) => {
              onUpdate({ provider: event.currentTarget.value as TranslationSettingsSnapshot['provider'] })
            }}
          >
            <option value="local-dictionary">Local dictionary (offline)</option>
            <option value="google">Google Translation (optional)</option>
          </select>
        </label>

        <label>
          <span>Target language</span>
          <select
            value={settings.targetLanguage}
            onChange={(event) => {
              onUpdate({ targetLanguage: event.currentTarget.value })
            }}
          >
            {TARGET_LANGUAGE_OPTIONS.map((language) => (
              <option value={language.code} key={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Popup position</span>
          <select
            value={settings.popupPosition}
            onChange={(event) => {
              onUpdate({ popupPosition: event.currentTarget.value as 'above' | 'below' })
            }}
          >
            <option value="below">Below subtitle</option>
            <option value="above">Above subtitle</option>
          </select>
        </label>

        <label className="translation-settings-check">
          <input
            type="checkbox"
            checked={settings.autoPauseOnWordClick}
            onChange={(event) => {
              onUpdate({ autoPauseOnWordClick: event.currentTarget.checked })
            }}
          />
          <span>Pause automatically when I click a word</span>
        </label>
      </div>

      {settings.provider === 'local-dictionary' && settings.targetLanguage !== 'my' ? (
        <div className="translation-settings-note">
          The offline dictionary currently contains Burmese only. Choose Burmese for offline lookup or use a provider that supports the selected language.
        </div>
      ) : null}

      {settings.provider === 'google' ? (
        <div className="translation-api-key-row">
          <label>
            <span>Google API key</span>
            <input
              type="password"
              value={apiKeyDraft}
              autoComplete="off"
              placeholder={settings.apiKeyConfigured ? '•••••••• saved securely' : 'Enter API key'}
              onChange={(event) => {
                onApiKeyDraftChange(event.currentTarget.value)
              }}
            />
          </label>
          <button
            type="button"
            className="control-button"
            disabled={!apiKeyDraft.trim()}
            onClick={onSaveApiKey}
          >
            Save key
          </button>
          {settings.apiKeyConfigured ? (
            <button type="button" className="control-button" onClick={onClearApiKey}>
              Clear key
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="translation-cache-row">
        <span>Session translation cache: {settings.cacheEntries} entries</span>
        <button
          type="button"
          className="control-button"
          disabled={settings.cacheEntries === 0}
          onClick={onClearCache}
        >
          Clear cache
        </button>
      </div>
    </section>
  )
}

async function refreshTranslationSettings(
  setSettings: (settings: TranslationSettingsSnapshot) => void
): Promise<void> {
  try {
    setSettings(await window.desktop.translation.getSettings())
  } catch {
    // Translation already succeeded; a settings-count refresh should not replace that result.
  }
}

function translationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Translation failed. Try the word again.'
  }

  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

function languageLabel(code: string): string {
  return TARGET_LANGUAGE_OPTIONS.find((language) => language.code === code)?.label ?? code
}

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)
}

function isSelectableSubtitleTrack(track: MediaTrack): boolean {
  return track.subtitleKind === 'text' && track.ffIndex !== null
}

function formatSubtitleTrack(track: MediaTrack): string {
  const language = track.language ?? 'und'
  const title = track.title ? ` · ${track.title}` : ''
  const codec = track.codec ?? 'unknown'
  const unsupported = isSelectableSubtitleTrack(track) ? '' : ' · unsupported'
  return `${language}${title} · ${codec}${unsupported}`
}

function subtitleControlTitle(state: PlaybackSnapshot, tracks: MediaTrack[]): string {
  if (tracks.length === 0) {
    return 'This file has no embedded subtitle tracks.'
  }
  if (state.status !== 'paused') {
    return 'Pause playback to change subtitle tracks.'
  }
  return 'Choose an embedded text subtitle track.'
}

function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '00:00'
  }

  const wholeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainingSeconds = wholeSeconds % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}
