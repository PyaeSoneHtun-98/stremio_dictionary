import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MediaTrack, PlaybackSnapshot, SubtitleToken } from '../../../../shared/media'
import { createEmptySubtitleModel } from '../../../../shared/media'
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
  adjustSubtitleDelay,
  clampPlayerValue,
  isInteractiveKeyboardTarget,
  isInteractiveSurfaceTarget,
  resolvePlayerShortcut,
  shouldHandleSurfacePointer,
  subtitleRecoveryMessage,
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

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
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
  const [panel, setPanel] = useState<'settings' | 'tracks' | 'help' | null>(null)
  const settingsOpen = panel === 'settings'
  const [controlsHovered, setControlsHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const panelTrigger = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const closePanel = useCallback((): void => {
    setPanel(null)
    panelTrigger.current?.focus()
  }, [])
  const togglePanel = (next: 'settings' | 'tracks' | 'help', trigger: HTMLElement): void => {
    panelTrigger.current = trigger
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
    }
  }, [])

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
  const subtitleTracks = state.tracks.filter((track) => track.type === 'subtitle')
  const supportedSubtitleTracks = subtitleTracks.filter((track) =>
    isSelectableSubtitleTrack(track, state.filePath),
  )
  const canChangeSubtitleTrack = state.status === 'paused' && supportedSubtitleTracks.length > 0
  const subtitleMessage = activeCue
    ? null
    : subtitleRecoveryMessage(state.subtitle.status, state.subtitle.error)

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
        const currentDelay = state.subtitleDelay ?? 0
        const nextDelay = adjustSubtitleDelay(currentDelay, action.deltaSeconds)

        void runControl(async () => {
          await window.desktop.media.setSubtitleDelay(nextDelay)
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
    state.subtitleDelay,
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

      <div
        className="player-controls"
        inert={!chromeVisible}
        onPointerEnter={() => setControlsHovered(true)}
        onPointerLeave={() => setControlsHovered(false)}
        onPointerDown={() => setDragging(true)}
      >
        {panel ? (
          <section
            className="player-panel"
            ref={panelRef}
            tabIndex={-1}
            aria-label={
              panel === 'tracks'
                ? 'Subtitle tracks'
                : panel === 'help'
                  ? 'Keyboard shortcuts'
                  : 'Settings'
            }
          >
            <div className="panel-heading">
              <span>
                {panel === 'tracks'
                  ? 'Subtitles'
                  : panel === 'help'
                    ? 'Keyboard shortcuts'
                    : 'Make it yours'}
              </span>
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

            {panel === 'tracks' ? (
              <>
                <p className="panel-note">{subtitleControlTitle(state, subtitleTracks)}</p>
                <label
                  className="subtitle-track-control"
                  title={subtitleControlTitle(state, subtitleTracks)}
                >
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
                    {supportedSubtitleTracks.length === 0 ? (
                      <option value="">No text tracks</option>
                    ) : null}
                    {subtitleTracks.map((track) => (
                      <option
                        value={track.id}
                        key={track.id}
                        disabled={!isSelectableSubtitleTrack(track, state.filePath)}
                      >
                        {formatSubtitleTrack(track, state.filePath)}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="panel-note">
                  Text subtitles are clickable. Image subtitles are listed as unsupported.
                </p>
              </>
            ) : null}
            {panel === 'help' ? (
              <dl className="shortcut-list">
                <div>
                  <dt>Play / pause</dt>
                  <dd>
                    click video / <kbd>Space</kbd> / <kbd>K</kbd>
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
                    earlier <kbd>G</kbd> · later <kbd>H</kbd>
                  </dd>
                </div>
                <div>
                  <dt>Fullscreen</dt>
                  <dd>
                    <kbd>F</kbd> / double-click video
                  </dd>
                </div>
                <div>
                  <dt>Navigate / select word</dt>
                  <dd>
                    <kbd>Tab</kbd> / <kbd>Enter</kbd>
                  </dd>
                </div>
                <div>
                  <dt>Dismiss popup / panel</dt>
                  <dd>
                    <kbd>Esc</kbd>
                  </dd>
                </div>
              </dl>
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
            <output className="volume-value">{Math.round(state.volume)}%</output>
          </label>

          <span className="control-spacer" />
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
            aria-label="Subtitle tracks"
            title="Subtitle tracks"
            aria-expanded={panel === 'tracks'}
            onClick={(event) => togglePanel('tracks', event.currentTarget)}
          >
            <PlayerIcon name="captions" />
          </button>
          <label className="speed-control">
            <span className="sr-only">Playback speed</span>
            <select
              value={String(state.speed)}
              disabled={!canControl}
              onChange={(event) => {
                void runControl(() =>
                  window.desktop.media.setSpeed(Number(event.currentTarget.value)),
                )
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
            className="icon-button"
            data-panel-trigger
            aria-label="Translation settings"
            title="Translation settings"
            aria-expanded={settingsOpen}
            onClick={(event) => togglePanel('settings', event.currentTarget)}
          >
            <PlayerIcon name="settings" />
          </button>
          <button
            type="button"
            className="icon-button help-button"
            data-panel-trigger
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            aria-expanded={panel === 'help'}
            onClick={(event) => togglePanel('help', event.currentTarget)}
          >
            <PlayerIcon name="keyboard" />
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
        <label>
          <span>Provider</span>
          <select
            value={settings.provider}
            onChange={(event) => {
              onUpdate({
                provider: event.currentTarget.value as TranslationSettingsSnapshot['provider'],
              })
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

function isSelectableSubtitleTrack(track: MediaTrack, filePath: string | null): boolean {
  return (
    track.subtitleKind === 'text' &&
    (track.ffIndex !== null || /^https?:\/\//i.test(filePath ?? ''))
  )
}

function formatSubtitleTrack(track: MediaTrack, filePath: string | null): string {
  const language = track.language ?? 'und'
  const title = track.title ? ` · ${track.title}` : ''
  const codec = track.codec ?? 'unknown'
  const unsupported = isSelectableSubtitleTrack(track, filePath) ? '' : ' · unsupported'
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

function formatSubtitleDelay(seconds: number): string {
  if (Math.abs(seconds) < 0.0001) {
    return '0.0 s'
  }
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(1)} s`
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
