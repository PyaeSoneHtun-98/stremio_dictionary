import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SUBTITLE_PREFERENCES,
  EXTERNAL_SUBTITLE_TRACK_ID,
  createEmptySubtitleModel,
  type MediaTrack,
  type PlaybackSnapshot,
  type SubtitlePreferencesSnapshot,
  type SubtitlePreferencesUpdate,
  type SubtitleToken,
} from '../../../../shared/media'
import {
  DEFAULT_TRANSLATION_SETTINGS,
  type TranslationSettingsSnapshot,
  type TranslationSettingsUpdate,
} from '../../../../shared/settings'
import type { TranslationResult } from '../../../../shared/translation'
import './Player.css'
import { PlayerIcon } from './PlayerIcon'
import { usePlayerChrome } from './usePlayerChrome'
import {
  clampPlayerValue,
  isInteractiveKeyboardTarget,
  isInteractiveSurfaceTarget,
  resolvePlayerShortcut,
  shouldHandleSurfacePointer,
  subtitleRecoveryMessage,
  subtitleRecoveryNoticeDuration,
  SubtitleRecoveryNoticeCoordinator,
  SurfaceGestureCoordinator,
} from './playerInteraction'
import { buildPhraseLookupContext, segmentSubtitleCue } from './subtitleSegments'

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
  error: null,
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2]
const MIN_SUBTITLE_DELAY = -20
const MAX_SUBTITLE_DELAY = 20
const SUBTITLE_DELAY_STEP = 0.1
const MIN_SUBTITLE_FONT_SCALE = 0.7
const MAX_SUBTITLE_FONT_SCALE = 1.6
const SUBTITLE_FONT_SCALE_STEP = 0.05
const MIN_SUBTITLE_VERTICAL_OFFSET = -24
const MAX_SUBTITLE_VERTICAL_OFFSET = 240
const SUBTITLE_VERTICAL_OFFSET_STEP = 4
const SUBTITLE_DELAY_NOTICE_MS = 1600
const TARGET_LANGUAGE_OPTIONS = [
  { code: 'my', label: 'Burmese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-cn', label: 'Chinese (Simplified)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
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
    DEFAULT_TRANSLATION_SETTINGS,
  )
  const [subtitlePreferences, setSubtitlePreferences] = useState<SubtitlePreferencesSnapshot>(
    DEFAULT_SUBTITLE_PREFERENCES,
  )
  const [loadingExternalSubtitle, setLoadingExternalSubtitle] = useState(false)
  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<'speed' | 'shortcuts' | null>(null)
  const [panel, setPanel] = useState<'settings' | 'tracks' | null>(null)
  const settingsOpen = panel === 'settings'
  const [controlsHovered, setControlsHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const panelTrigger = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const closePanel = useCallback((): void => {
    setSubtitleSettingsOpen(false)
    setSettingsSection(null)
    setPanel(null)
    panelTrigger.current?.focus()
  }, [])
  const togglePanel = (next: 'settings' | 'tracks', trigger: HTMLElement): void => {
    panelTrigger.current = trigger
    if (next !== 'tracks' || panel === 'tracks') {
      setSubtitleSettingsOpen(false)
    }
    if (next !== 'settings' || panel === 'settings') {
      setSettingsSection(null)
    }
    setPanel((current) => (current === next ? null : next))
  }
  useEffect(() => {
    if (!panel) return
    panelRef.current?.focus()
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Element &&
        !event.target.closest('.player-panel, [data-panel-trigger]')
      ) {
        setSubtitleSettingsOpen(false)
        setSettingsSection(null)
        setPanel(null)
      }
    }
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [panel])
  useEffect(() => {
    const release = (): void => setDragging(false)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
    }
  }, [])
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [controlError, setControlError] = useState<string | null>(null)
  const [doubleClickIntervalMs, setDoubleClickIntervalMs] = useState(500)
  const [subtitleDelayNotice, setSubtitleDelayNotice] = useState<number | null>(null)
  const subtitleDelayNoticeTimer = useRef<number | null>(null)
  const [subtitleRecoveryNoticeVisible, setSubtitleRecoveryNoticeVisible] = useState(false)
  const subtitleRecoveryNoticeCoordinator = useMemo(
    () => new SubtitleRecoveryNoticeCoordinator(setSubtitleRecoveryNoticeVisible),
    [],
  )

  const showSubtitleDelayNotice = useCallback((value: number): void => {
    setSubtitleDelayNotice(value)
    if (subtitleDelayNoticeTimer.current !== null) {
      window.clearTimeout(subtitleDelayNoticeTimer.current)
    }
    subtitleDelayNoticeTimer.current = window.setTimeout(() => {
      subtitleDelayNoticeTimer.current = null
      setSubtitleDelayNotice(null)
    }, SUBTITLE_DELAY_NOTICE_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (subtitleDelayNoticeTimer.current !== null) {
        window.clearTimeout(subtitleDelayNoticeTimer.current)
      }
      subtitleRecoveryNoticeCoordinator.dispose()
    }
  }, [subtitleRecoveryNoticeCoordinator])

  const runControl = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setControlError(null)
    try {
      await action()
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'The player control failed.')
    }
  }, [])
  const currentFilePath = useRef<string | null>(null)
  const currentCueId = useRef<string | null>(null)
  const currentSubtitleTrackId = useRef<number | null>(null)
  const translationRequestVersion = useRef(0)
  const stateRef = useRef<PlaybackSnapshot>(EMPTY_STATE)
  const surfaceGestureCoordinator = useMemo(
    () =>
      new SurfaceGestureCoordinator(
        () => stateRef.current,
        (paused) => {
          void runControl(() => window.desktop.media.setPaused(paused))
        },
      ),
    [runControl],
  )

  const dismissTranslation = useCallback((): void => {
    translationRequestVersion.current += 1
    setSelectedWord(null)
    setTranslation({ status: 'idle' })
  }, [])

  useEffect(() => {
    let active = true

    const applySnapshot = (snapshot: PlaybackSnapshot): void => {
      if (!active) {
        return
      }

      surfaceGestureCoordinator.handleStateTransition(stateRef.current, snapshot)
      stateRef.current = snapshot

      const nextCueId = snapshot.subtitle.activeCue?.id ?? null
      const selectionContextChanged =
        currentFilePath.current !== snapshot.filePath ||
        currentCueId.current !== nextCueId ||
        currentSubtitleTrackId.current !== snapshot.subtitle.trackId

      if (currentFilePath.current !== snapshot.filePath) {
        setControlError(null)
        setSubtitleDelayNotice(null)
        if (subtitleDelayNoticeTimer.current !== null) {
          window.clearTimeout(subtitleDelayNoticeTimer.current)
          subtitleDelayNoticeTimer.current = null
        }
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
      surfaceGestureCoordinator.cancelPending()
      unsubscribe()
    }
  }, [surfaceGestureCoordinator])

  useEffect(() => {
    let active = true

    void window.desktop.media
      .getDoubleClickInterval()
      .then((interval) => {
        if (active) {
          setDoubleClickIntervalMs(interval)
        }
      })
      .catch(() => {
        // Keep the Windows default fallback if the native timing query fails.
      })

    return () => {
      active = false
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
    let active = true

    void window.desktop.media
      .getSubtitlePreferences()
      .then((preferences) => {
        if (active) {
          setSubtitlePreferences(preferences)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setControlError(controlErrorMessage(error, 'Could not load subtitle preferences.'))
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--subtitle-font-min', `${19 * subtitlePreferences.fontScale}px`)
    root.style.setProperty('--subtitle-font-fluid', `${2.65 * subtitlePreferences.fontScale}vw`)
    root.style.setProperty('--subtitle-font-max', `${34 * subtitlePreferences.fontScale}px`)
    root.style.setProperty('--subtitle-position-offset', `${subtitlePreferences.verticalOffset}px`)

    return () => {
      root.style.removeProperty('--subtitle-font-min')
      root.style.removeProperty('--subtitle-font-fluid')
      root.style.removeProperty('--subtitle-font-max')
      root.style.removeProperty('--subtitle-position-offset')
    }
  }, [subtitlePreferences])

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
        activeElement === null ||
        activeElement === document.body ||
        activeElement === document.documentElement

      if (!startsFromDocument) {
        return
      }

      const words = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.subtitle-word:not(:disabled)'),
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
  }, [dismissTranslation, selectedWord])

  const chromeVisible = usePlayerChrome(
    state.status !== 'playing' ||
      Boolean(panel) ||
      Boolean(selectedWord) ||
      Boolean(controlError || state.error) ||
      Boolean(state.buffering) ||
      controlsHovered ||
      dragging,
  )

  const canControl =
    Boolean(state.filePath) && !['loading', 'error', 'unavailable'].includes(state.status)
  const canToggleFullscreen =
    Boolean(state.filePath) && !['error', 'unavailable'].includes(state.status)
  const buffering = state.status === 'loading' || Boolean(state.buffering)
  const playing = state.status === 'playing'
  const duration = state.duration ?? 0
  const currentTime = Math.min(state.currentTime ?? 0, duration || Number.MAX_SAFE_INTEGER)
  const activeCue = state.subtitle.activeCue
  const subtitleSegments = activeCue ? segmentSubtitleCue(activeCue) : []
  const audioTracks = state.tracks.filter((track) => track.type === 'audio')
  const selectedAudioTrack = audioTracks.find((track) => track.selected) ?? null
  const subtitleTracks = state.tracks.filter((track) => track.type === 'subtitle')
  const supportedSubtitleTracks = subtitleTracks.filter((track) =>
    isSelectableSubtitleTrack(track, state.filePath),
  )
  const canChangeAudioTrack = canControl && audioTracks.length > 0
  const canChangeSubtitleTrack = state.status === 'paused' && supportedSubtitleTracks.length > 0
  const canOpenExternalSubtitle = canControl && !loadingExternalSubtitle
  const subtitleDelay = state.subtitleDelay ?? 0
  const subtitleMessage = activeCue
    ? null
    : subtitleRecoveryMessage(state.subtitle.status, state.subtitle.error)
  const subtitleRecoveryNoticeDurationMs = subtitleRecoveryNoticeDuration(state.subtitle.status)
  const subtitleRecoveryNoticeKey = subtitleMessage
    ? `${state.filePath ?? 'no-media'}\u0000${state.subtitle.status}\u0000${state.subtitle.error ?? ''}`
    : null

  useEffect(() => {
    subtitleRecoveryNoticeCoordinator.update(
      subtitleRecoveryNoticeKey,
      subtitleRecoveryNoticeDurationMs,
    )
  }, [
    subtitleRecoveryNoticeCoordinator,
    subtitleRecoveryNoticeDurationMs,
    subtitleRecoveryNoticeKey,
  ])

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
        metaKey: event.metaKey,
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
        if (panel) {
          event.preventDefault()
          closePanel()
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
        const maximum =
          duration > 0 ? duration : Math.max(0, currentTime + Math.abs(action.deltaSeconds))
        const nextTime = clampPlayerValue(currentTime + action.deltaSeconds, 0, maximum)
        void runControl(() => window.desktop.media.seek(nextTime))
        return
      }

      if (action.kind === 'volume') {
        const nextVolume = clampPlayerValue(state.volume + action.delta, 0, 100)
        void runControl(() => window.desktop.media.setVolume(nextVolume))
        return
      }

      if (action.kind === 'subtitle-delay') {
        void runControl(async () => {
          const nextDelay = await window.desktop.media.adjustSubtitleDelay(action.deltaSeconds)
          showSubtitleDelayNotice(nextDelay)
        })
        return
      }

      void runControl(() => window.desktop.media.toggleFullscreen())
    }

    window.addEventListener('keydown', handlePlayerShortcut, true)
    return () => window.removeEventListener('keydown', handlePlayerShortcut, true)
  }, [
    canControl,
    currentTime,
    dismissTranslation,
    duration,
    playing,
    runControl,
    selectedWord,
    panel,
    closePanel,
    state.volume,
    showSubtitleDelayNotice,
  ])

  const updateTranslationSettings = async (update: TranslationSettingsUpdate): Promise<boolean> => {
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

  const updateSubtitlePreferences = async (
    update: SubtitlePreferencesUpdate,
  ): Promise<void> => {
    setControlError(null)
    try {
      setSubtitlePreferences(await window.desktop.media.updateSubtitlePreferences(update))
    } catch (error) {
      setControlError(controlErrorMessage(error, 'Could not save subtitle preferences.'))
    }
  }

  const openExternalSubtitleFile = async (): Promise<void> => {
    setControlError(null)
    setLoadingExternalSubtitle(true)
    try {
      const result = await window.desktop.media.openExternalSubtitle()
      if (result.cancelled) {
        return
      }
      if (!result.loaded) {
        throw new Error(result.error ?? 'Could not load this subtitle file.')
      }
    } catch (error) {
      setControlError(controlErrorMessage(error, 'Could not open this subtitle file.'))
    } finally {
      setLoadingExternalSubtitle(false)
    }
  }

  const selectWord = (
    cueId: string,
    token: SubtitleToken,
    context: string,
    cueTokens: readonly SubtitleToken[],
  ): void => {
    const requestVersion = ++translationRequestVersion.current
    const phraseContext = buildPhraseLookupContext(cueTokens, token)
    setSelectedWord({
      cueId,
      tokenStart: token.start,
      text: token.text,
      lookupTerm: token.lookupTerm,
    })
    setTranslation({ status: 'loading', word: token.text })

    if (translationSettings.autoPauseOnWordClick && state.status === 'playing') {
      void runControl(() => window.desktop.media.setPaused(true))
    }

    void window.desktop.translation
      .translateWord({
        word: token.lookupTerm,
        context,
        ...(phraseContext ?? {}),
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
          error: translationErrorMessage(error),
        })
      })
  }

  return (
    <main
      className={`overlay-probe${chromeVisible ? '' : ' chrome-hidden'}`}
      aria-label="Subtitle Bridge video controls"
      onPointerUp={(event) => {
        if (
          !shouldHandleSurfacePointer({
            button: event.button,
            isPrimary: event.isPrimary,
            interactiveTarget: isInteractiveSurfaceTarget(event.target),
            canControl,
          })
        ) {
          return
        }

        surfaceGestureCoordinator.schedule(doubleClickIntervalMs)
      }}
      onDoubleClick={(event) => {
        surfaceGestureCoordinator.cancelPending()

        if (
          event.button !== 0 ||
          !canToggleFullscreen ||
          isInteractiveSurfaceTarget(event.target)
        ) {
          return
        }

        event.preventDefault()
        void runControl(() => window.desktop.media.toggleFullscreen())
      }}
    >
      <div className="overlay-topline" inert={!chromeVisible}>
        <span className={`overlay-status status-${state.buffering ? 'buffering' : state.status}`}>
          <span className="status-dot" />
          {state.buffering ? 'buffering' : state.status}
        </span>
        <strong title={state.fileName ?? undefined}>{state.fileName ?? 'No video loaded'}</strong>
      </div>

      {buffering ? (
        <div className="player-buffering-layer" role="status" aria-live="polite">
          <span className="player-buffering-spinner" aria-hidden="true" />
          <strong>{state.status === 'loading' ? 'Opening video…' : 'Buffering…'}</strong>
          <span>{state.buffering ? 'Waiting for stream data' : 'Preparing playback'}</span>
        </div>
      ) : null}

      {subtitleDelayNotice !== null ? (
        <div className="subtitle-delay-osd" role="status" aria-live="polite">
          Subtitle delay: <strong>{formatSubtitleDelay(subtitleDelayNotice)}</strong>
        </div>
      ) : null}

      <section
        className="subtitle-overlay"
        aria-label="Interactive English subtitle"
        aria-live="polite"
      >
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
                  selectedWord?.cueId === activeCue.id &&
                  selectedWord.tokenStart === segment.token.start

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
                      selectWord(activeCue.id, segment.token, activeCue.text, activeCue.tokens)
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
        ) : subtitleMessage && subtitleRecoveryNoticeVisible ? (
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

      <div
        className="player-controls"
        inert={!chromeVisible}
        onPointerEnter={() => setControlsHovered(true)}
        onPointerLeave={() => setControlsHovered(false)}
        onPointerDown={() => setDragging(true)}
      >
        {panel ? (
          <section
            className={`player-panel${panel === 'tracks' ? ' compact-tracks-panel' : ''}`}
            ref={panelRef}
            tabIndex={-1}
            aria-label={panel === 'tracks' ? 'Audio and subtitle tracks' : 'Settings'}
          >
            {panel !== 'tracks' ? (
              <div className="panel-heading">
                <span>Settings</span>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Close panel"
                  title="Close (Esc)"
                  onClick={closePanel}
                >
                  <PlayerIcon name="close" />
                </button>
              </div>
            ) : null}
            {settingsOpen ? (
              <>
                <section className="compact-settings-menu" aria-label="Player settings">
                  <button
                    type="button"
                    className="compact-menu-button"
                    aria-expanded={settingsSection === 'speed'}
                    onClick={() =>
                      setSettingsSection((current) => (current === 'speed' ? null : 'speed'))
                    }
                  >
                    <span>Playback speed</span>
                    <span>{state.speed}×</span>
                  </button>

                  {settingsSection === 'speed' ? (
                    <div className="playback-speed-menu">
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          type="button"
                          key={speed}
                          className={Math.abs(state.speed - speed) < 0.001 ? 'is-selected' : ''}
                          aria-pressed={Math.abs(state.speed - speed) < 0.001}
                          disabled={!canControl}
                          onClick={() => void runControl(() => window.desktop.media.setSpeed(speed))}
                        >
                          {speed}×
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="compact-menu-button"
                    aria-expanded={settingsSection === 'shortcuts'}
                    onClick={() =>
                      setSettingsSection((current) => (current === 'shortcuts' ? null : 'shortcuts'))
                    }
                  >
                    <span>Keyboard shortcuts</span>
                    <span aria-hidden="true">{settingsSection === 'shortcuts' ? '−' : '+'}</span>
                  </button>

                  {settingsSection === 'shortcuts' ? (
                    <dl className="shortcut-list compact-shortcut-list">
                      <div>
                        <dt>Play / pause</dt>
                        <dd>
                          <kbd>Space</kbd> / <kbd>K</kbd>
                        </dd>
                      </div>
                      <div>
                        <dt>Seek 5 seconds</dt>
                        <dd>
                          <kbd>←</kbd> <kbd>→</kbd>
                        </dd>
                      </div>
                      <div>
                        <dt>Volume</dt>
                        <dd>
                          <kbd>↑</kbd> <kbd>↓</kbd>
                        </dd>
                      </div>
                      <div>
                        <dt>Subtitle delay</dt>
                        <dd>
                          <kbd>G</kbd> / <kbd>H</kbd>
                        </dd>
                      </div>
                      <div>
                        <dt>Fullscreen</dt>
                        <dd>
                          <kbd>F</kbd>
                        </dd>
                      </div>
                      <div>
                        <dt>Select word</dt>
                        <dd>
                          <kbd>Tab</kbd> / <kbd>Enter</kbd>
                        </dd>
                      </div>
                      <div>
                        <dt>Close</dt>
                        <dd>
                          <kbd>Esc</kbd>
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </section>

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
              </>
            ) : null}

            {panel === 'tracks' ? (
              <>
                <section className="compact-tracks-section" aria-label="Subtitle controls">
                  <div className="compact-section-title">Subtitles</div>

                  <div className="compact-track-control">
                    <AppSelect
                      ariaLabel="Embedded subtitle track"
                      value={state.subtitle.trackId === null ? '' : String(state.subtitle.trackId)}
                      disabled={!canChangeSubtitleTrack}
                      options={
                        subtitleTracks.length === 0
                          ? [{ value: '', label: 'No text tracks', disabled: true }]
                          : [
                              ...(state.subtitle.trackId === null
                                ? [{ value: '', label: 'Select subtitle track', disabled: true }]
                                : []),
                              ...subtitleTracks.map((track) => ({
                                value: String(track.id),
                                label: formatSubtitleTrack(track, state.filePath),
                                disabled: !isSelectableSubtitleTrack(track, state.filePath),
                              })),
                            ]
                      }
                      onChange={(value) => {
                        const trackId = Number(value)
                        void runControl(() => window.desktop.media.selectSubtitleTrack(trackId))
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="compact-menu-button"
                    disabled={!canOpenExternalSubtitle}
                    onClick={() => void openExternalSubtitleFile()}
                  >
                    {loadingExternalSubtitle ? 'Loading subtitle…' : 'Choose subtitle file'}
                  </button>

                  <button
                    type="button"
                    className="compact-menu-button compact-subtitle-settings-toggle"
                    aria-expanded={subtitleSettingsOpen}
                    onClick={() => setSubtitleSettingsOpen((open) => !open)}
                  >
                    <span>Subtitle settings</span>
                    <span aria-hidden="true">{subtitleSettingsOpen ? '−' : '+'}</span>
                  </button>

                  {subtitleSettingsOpen ? (
                    <div className="compact-subtitle-settings">
                      <div className="compact-stepper-row">
                        <span>Delay</span>
                        <div className="compact-stepper">
                          <button
                            type="button"
                            aria-label="Decrease subtitle delay"
                            disabled={!canControl || subtitleDelay <= MIN_SUBTITLE_DELAY}
                            onClick={() =>
                              void runControl(() =>
                                window.desktop.media.setSubtitleDelay(
                                  roundSubtitleDelay(
                                    Math.max(
                                      MIN_SUBTITLE_DELAY,
                                      subtitleDelay - SUBTITLE_DELAY_STEP,
                                    ),
                                  ),
                                ),
                              )
                            }
                          >
                            −
                          </button>
                          <output aria-label="Subtitle delay">
                            {formatSubtitleDelay(subtitleDelay)}
                          </output>
                          <button
                            type="button"
                            aria-label="Increase subtitle delay"
                            disabled={!canControl || subtitleDelay >= MAX_SUBTITLE_DELAY}
                            onClick={() =>
                              void runControl(() =>
                                window.desktop.media.setSubtitleDelay(
                                  roundSubtitleDelay(
                                    Math.min(
                                      MAX_SUBTITLE_DELAY,
                                      subtitleDelay + SUBTITLE_DELAY_STEP,
                                    ),
                                  ),
                                ),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="compact-stepper-row">
                        <span>Size</span>
                        <div className="compact-stepper">
                          <button
                            type="button"
                            aria-label="Decrease subtitle size"
                            disabled={
                              subtitlePreferences.fontScale <= MIN_SUBTITLE_FONT_SCALE
                            }
                            onClick={() =>
                              void updateSubtitlePreferences({
                                fontScale: roundSubtitlePreference(
                                  Math.max(
                                    MIN_SUBTITLE_FONT_SCALE,
                                    subtitlePreferences.fontScale - SUBTITLE_FONT_SCALE_STEP,
                                  ),
                                ),
                              })
                            }
                          >
                            −
                          </button>
                          <output aria-label="Subtitle font size">
                            {Math.round(subtitlePreferences.fontScale * 100)}%
                          </output>
                          <button
                            type="button"
                            aria-label="Increase subtitle size"
                            disabled={
                              subtitlePreferences.fontScale >= MAX_SUBTITLE_FONT_SCALE
                            }
                            onClick={() =>
                              void updateSubtitlePreferences({
                                fontScale: roundSubtitlePreference(
                                  Math.min(
                                    MAX_SUBTITLE_FONT_SCALE,
                                    subtitlePreferences.fontScale + SUBTITLE_FONT_SCALE_STEP,
                                  ),
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="compact-stepper-row">
                        <span>Position</span>
                        <div className="compact-stepper">
                          <button
                            type="button"
                            aria-label="Move subtitles lower"
                            disabled={
                              subtitlePreferences.verticalOffset <=
                              MIN_SUBTITLE_VERTICAL_OFFSET
                            }
                            onClick={() =>
                              void updateSubtitlePreferences({
                                verticalOffset: Math.max(
                                  MIN_SUBTITLE_VERTICAL_OFFSET,
                                  subtitlePreferences.verticalOffset -
                                    SUBTITLE_VERTICAL_OFFSET_STEP,
                                ),
                              })
                            }
                          >
                            −
                          </button>
                          <output aria-label="Subtitle vertical position">
                            {formatSubtitlePosition(subtitlePreferences.verticalOffset)}
                          </output>
                          <button
                            type="button"
                            aria-label="Move subtitles higher"
                            disabled={
                              subtitlePreferences.verticalOffset >=
                              MAX_SUBTITLE_VERTICAL_OFFSET
                            }
                            onClick={() =>
                              void updateSubtitlePreferences({
                                verticalOffset: Math.min(
                                  MAX_SUBTITLE_VERTICAL_OFFSET,
                                  subtitlePreferences.verticalOffset +
                                    SUBTITLE_VERTICAL_OFFSET_STEP,
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="compact-tracks-section compact-audio-section" aria-label="Audio controls">
                  <div className="compact-section-title">Audio</div>
                  <div className="compact-track-control">
                    <AppSelect
                      ariaLabel="Audio track"
                      value={selectedAudioTrack ? String(selectedAudioTrack.id) : ''}
                      disabled={!canChangeAudioTrack}
                      options={
                        audioTracks.length === 0
                          ? [{ value: '', label: 'No audio tracks', disabled: true }]
                          : [
                              ...(!selectedAudioTrack
                                ? [{ value: '', label: 'Select audio track', disabled: true }]
                                : []),
                              ...audioTracks.map((track) => ({
                                value: String(track.id),
                                label: formatAudioTrack(track),
                              })),
                            ]
                      }
                      onChange={(value) => {
                        const trackId = Number(value)
                        void runControl(() => window.desktop.media.selectAudioTrack(trackId))
                      }}
                    />
                  </div>
                </section>
              </>
            ) : null}
          </section>
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
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            style={
              {
                '--seek-progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              } as React.CSSProperties
            }
            onChange={(event) => {
              void runControl(() => window.desktop.media.seek(Number(event.currentTarget.value)))
            }}
          />
          <span>{formatTime(state.duration)}</span>
        </div>

        <div className="control-row">
          <div className="control-left-controls">
            <label className="volume-control" title="Volume">
              <PlayerIcon name="volume" />
              <span className="sr-only">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(state.volume)}
                aria-label="Volume"
                disabled={!state.filePath || ['error', 'unavailable'].includes(state.status)}
                onChange={(event) => {
                  void runControl(() =>
                    window.desktop.media.setVolume(Number(event.currentTarget.value)),
                  )
                }}
              />
            </label>
          </div>

          <div className="playback-center-controls">
            <button
              type="button"
              className="icon-button skip-button"
              disabled={!canControl}
              aria-label="Back 5 seconds"
              title="Back 5 seconds (←)"
              onClick={() =>
                void runControl(() => window.desktop.media.seek(Math.max(0, currentTime - 5)))
              }
            >
              <PlayerIcon name="back" />
              <small>5</small>
            </button>
            <button
              type="button"
              className="icon-button play-button"
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
              disabled={!canControl}
              onClick={() => {
                void runControl(() => window.desktop.media.setPaused(playing))
              }}
            >
              <PlayerIcon name={playing ? 'pause' : 'play'} />
            </button>
            <button
              type="button"
              className="icon-button skip-button"
              disabled={!canControl}
              aria-label="Forward 5 seconds"
              title="Forward 5 seconds (→)"
              onClick={() =>
                void runControl(() =>
                  window.desktop.media.seek(
                    Math.min(duration || Number.MAX_SAFE_INTEGER, currentTime + 5),
                  ),
                )
              }
            >
              <PlayerIcon name="forward" />
              <small>5</small>
            </button>
          </div>

          <div className="control-right-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Open video"
              title="Open video"
              onClick={() =>
                void runControl(async () => {
                  const result = await window.desktop.media.openVideo()
                  if (result.error) throw new Error(result.error)
                })
              }
            >
              <PlayerIcon name="folder" />
            </button>
            <button
              type="button"
              className="icon-button"
              data-panel-trigger
              aria-label="Audio and subtitle tracks"
              title="Audio and subtitle tracks"
              aria-expanded={panel === 'tracks'}
              onClick={(event) => togglePanel('tracks', event.currentTarget)}
            >
              <PlayerIcon name="keyboard" />
            </button>
            <button
              type="button"
              className="icon-button"
              data-panel-trigger
              aria-label="Settings"
              title="Settings"
              aria-expanded={settingsOpen}
              onClick={(event) => togglePanel('settings', event.currentTarget)}
            >
              <PlayerIcon name="settings" />
            </button>
            <button
              type="button"
              className="icon-button"
              disabled={!state.filePath}
              aria-label="Toggle fullscreen"
              title="Fullscreen (F)"
              onClick={() => void runControl(() => window.desktop.media.toggleFullscreen())}
            >
              <PlayerIcon name="fullscreen" />
            </button>
          </div>
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
  onDismiss,
}: {
  selectedWord: SelectedWord
  translation: TranslationLookupState
  popupPosition: 'above' | 'below'
  targetLanguage: string
  onDismiss: () => void
}): React.JSX.Element {
  const resultLanguage =
    translation.status === 'ready' ? translation.result.targetLanguage : targetLanguage
  const dictionaryEntry =
    translation.status === 'ready' ? translation.result.dictionaryEntry : undefined
  const phraseEntry = translation.status === 'ready' ? translation.result.phraseEntry : undefined
  const phraseMatch = translation.status === 'ready' ? translation.result.phraseMatch : undefined
  const headingWord = phraseEntry?.phrase ?? dictionaryEntry?.word ?? selectedWord.text
  const resolvedFromForm =
    dictionaryEntry !== undefined &&
    selectedWord.lookupTerm.normalize('NFKC').trim().toLocaleLowerCase('en-US') !==
      dictionaryEntry.word.normalize('NFKC').trim().toLocaleLowerCase('en-US')

  return (
    <div
      className={`translation-popup popup-${popupPosition} translation-${translation.status}`}
      role="status"
      aria-live="polite"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="translation-popup-header">
        <div className="translation-popup-heading">
          <strong>{headingWord}</strong>
          <span>
            {phraseEntry
              ? `Detected phrase · ${phraseTypeLabel(phraseEntry.type)}`
              : resolvedFromForm
                ? `${selectedWord.text} → ${dictionaryEntry?.word}`
                : `English → ${languageLabel(resultLanguage)}`}
          </span>
        </div>
        <button
          type="button"
          className="translation-popup-close"
          aria-label="Close translation"
          title="Close translation (Esc)"
          onClick={onDismiss}
        >
          <PlayerIcon name="close" />
        </button>
      </div>

      {translation.status === 'loading' ? (
        <div className="translation-loading">Translating…</div>
      ) : null}

      {translation.status === 'ready' ? (
        phraseEntry ? (
          <>
            <div className="translation-phrase-detected">
              Detected phrase: <strong>{phraseEntry.phrase}</strong>
              {phraseMatch && phraseMatch.source !== phraseEntry.phrase ? (
                <small>
                  {phraseMatch.source} → {phraseEntry.phrase}
                </small>
              ) : null}
            </div>
            <div className="translation-dictionary-meanings" lang="my">
              <section className="translation-dictionary-sense">
                <span className="translation-part-of-speech">
                  {phraseTypeLabel(phraseEntry.type)}
                </span>
                <div className="translation-dictionary-burmese">
                  {phraseEntry.burmese.join('၊ ')}
                </div>
              </section>
            </div>
          </>
        ) : dictionaryEntry ? (
          <>
            <div className="translation-pronunciation">{dictionaryEntry.pronunciation}</div>
            <div className="translation-dictionary-meanings" lang="my">
              {dictionaryEntry.meanings.map((meaning) => (
                <section className="translation-dictionary-sense" key={meaning.partOfSpeech}>
                  <span className="translation-part-of-speech">{meaning.partOfSpeech}</span>
                  <div className="translation-dictionary-burmese">
                    {meaning.burmese.join('၊ ')}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="translation-burmese" lang={translation.result.targetLanguage}>
              {translation.result.translation}
            </div>
            {translation.result.pronunciation ? (
              <div className="translation-pronunciation">{translation.result.pronunciation}</div>
            ) : null}
          </>
        )
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

interface AppSelectOption {
  value: string
  label: string
  disabled?: boolean
}

function AppSelect({
  ariaLabel,
  value,
  options,
  disabled = false,
  onChange,
}: {
  ariaLabel: string
  value: string
  options: AppSelectOption[]
  disabled?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="app-select" ref={rootRef}>
      <button
        type="button"
        className="app-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{selected?.label ?? 'Select'}</span>
        <span className="app-select-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="app-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'is-selected' : ''}
              disabled={option.disabled}
              key={option.value || option.label}
              onClick={() => {
                if (option.disabled) return
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <span className="app-select-check">✓</span> : null}
            </button>
          ))}
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
  onClearCache,
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
        <div className="translation-settings-field">
          <span>Provider</span>
          <AppSelect
            ariaLabel="Translation provider"
            value={settings.provider}
            options={[
              { value: 'local-dictionary', label: 'Local dictionary (offline)' },
              { value: 'google', label: 'Google Translation (optional)' },
            ]}
            onChange={(value) => {
              onUpdate({
                provider: value as TranslationSettingsSnapshot['provider'],
              })
            }}
          />
        </div>

        <div className="translation-settings-field">
          <span>Target language</span>
          <AppSelect
            ariaLabel="Target language"
            value={settings.targetLanguage}
            options={TARGET_LANGUAGE_OPTIONS.map((language) => ({
              value: language.code,
              label: language.label,
            }))}
            onChange={(value) => {
              onUpdate({ targetLanguage: value })
            }}
          />
        </div>

        <label className="translation-popup-position-setting">
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
          The offline dictionary currently contains Burmese only. Choose Burmese for offline lookup
          or use a provider that supports the selected language.
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
  setSettings: (settings: TranslationSettingsSnapshot) => void,
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

function phraseTypeLabel(type: 'phrasal_verb' | 'idiom' | 'expression'): string {
  if (type === 'phrasal_verb') {
    return 'phrasal verb'
  }
  return type
}

function languageLabel(code: string): string {
  return TARGET_LANGUAGE_OPTIONS.find((language) => language.code === code)?.label ?? code
}

function formatAudioTrack(track: MediaTrack): string {
  const language = track.language ?? 'und'
  const title = track.title ? ` · ${track.title}` : ''
  const codec = track.codec ?? 'unknown'
  return `${language}${title} · ${codec}`
}

function isSelectableSubtitleTrack(track: MediaTrack, filePath: string | null): boolean {
  if (track.subtitleKind !== 'text') {
    return false
  }
  if (track.id === EXTERNAL_SUBTITLE_TRACK_ID) {
    return true
  }
  return track.ffIndex !== null || /^https?:\/\//i.test(filePath ?? '')
}

function formatSubtitleTrack(track: MediaTrack, filePath: string | null): string {
  if (track.id === EXTERNAL_SUBTITLE_TRACK_ID) {
    return `External · ${track.title ?? 'subtitle'} · ${track.codec ?? 'text'}`
  }

  const language = track.language ?? 'und'
  const title = track.title ? ` · ${track.title}` : ''
  const codec = track.codec ?? 'unknown'
  const unsupported = isSelectableSubtitleTrack(track, filePath) ? '' : ' · unsupported'
  return `${language}${title} · ${codec}${unsupported}`
}

function formatSubtitleDelay(seconds: number): string {
  if (Math.abs(seconds) < 0.0001) {
    return '0.0 s'
  }
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(1)} s`
}

function roundSubtitleDelay(value: number): number {
  return Math.round(value * 10) / 10
}

function roundSubtitlePreference(value: number): number {
  return Math.round(value * 100) / 100
}

function formatSubtitlePosition(value: number): string {
  if (value === 0) {
    return 'Default'
  }
  return value > 0 ? `+${value}px higher` : `${Math.abs(value)}px lower`
}

function controlErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }
  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
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
