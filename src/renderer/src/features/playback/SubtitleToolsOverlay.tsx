import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SUBTITLE_PREFERENCES,
  EXTERNAL_SUBTITLE_TRACK_ID,
  type MediaTrack,
  type PlaybackSnapshot,
  type SubtitlePreferencesSnapshot,
  type SubtitlePreferencesUpdate,
} from '../../../../shared/media'
import { PlayerIcon } from './PlayerIcon'
import { usePlayerChrome } from './usePlayerChrome'
import './SubtitleToolsOverlay.css'

const SUBTITLE_EXTENSIONS = ['.srt', '.ass', '.ssa'] as const
const DELAY_STEP = 0.1

export function SubtitleToolsOverlay(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot | null>(null)
  const [preferences, setPreferences] = useState<SubtitlePreferencesSnapshot>(
    DEFAULT_SUBTITLE_PREFERENCES,
  )
  const [panelOpen, setPanelOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [loadingExternal, setLoadingExternal] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const externalLoadVersion = useRef(0)
  const chromeVisible = usePlayerChrome(panelOpen || dragActive || loadingExternal)

  useEffect(() => {
    let active = true

    void window.desktop.media.getState().then((snapshot) => {
      if (active) setState(snapshot)
    })
    const unsubscribe = window.desktop.media.onState((snapshot) => {
      if (active) setState(snapshot)
    })

    void window.desktop.media
      .getSubtitlePreferences()
      .then((snapshot) => {
        if (active) setPreferences(snapshot)
      })
      .catch((reason: unknown) => {
        if (active) setError(cleanErrorMessage(reason, 'Could not load subtitle preferences.'))
      })

    return () => {
      active = false
      externalLoadVersion.current += 1
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--subtitle-font-min', `${19 * preferences.fontScale}px`)
    root.style.setProperty('--subtitle-font-fluid', `${2.65 * preferences.fontScale}vw`)
    root.style.setProperty('--subtitle-font-max', `${34 * preferences.fontScale}px`)
    root.style.setProperty('--subtitle-position-offset', `${preferences.verticalOffset}px`)

    return () => {
      root.style.removeProperty('--subtitle-font-min')
      root.style.removeProperty('--subtitle-font-fluid')
      root.style.removeProperty('--subtitle-font-max')
      root.style.removeProperty('--subtitle-position-offset')
    }
  }, [preferences])

  const loadDroppedSubtitle = useCallback(async (file: File): Promise<void> => {
    const requestVersion = ++externalLoadVersion.current
    setError(null)
    setMessage(null)

    if (!isSupportedSubtitleFile(file.name)) {
      setLoadingExternal(false)
      setError('Choose an SRT, ASS, or SSA subtitle file.')
      return
    }

    const filePath = window.desktop.media.getPathForFile(file)
    if (!filePath) {
      setLoadingExternal(false)
      setError('Could not access the dropped subtitle. Drop it again or choose another file.')
      return
    }

    setLoadingExternal(true)
    try {
      const result = await window.desktop.media.loadExternalSubtitlePath(filePath)
      if (requestVersion !== externalLoadVersion.current) return

      if (!result.loaded) {
        setError(result.error ?? 'Could not load this subtitle file.')
        return
      }
      setMessage(`${result.fileName ?? file.name} loaded`)
    } catch (reason) {
      if (requestVersion === externalLoadVersion.current) {
        setError(cleanErrorMessage(reason, 'Could not load this subtitle file.'))
      }
    } finally {
      if (requestVersion === externalLoadVersion.current) {
        setLoadingExternal(false)
      }
    }
  }, [])

  useEffect(() => {
    const preventNavigation = (event: DragEvent): void => event.preventDefault()
    const enter = (event: DragEvent): void => {
      event.preventDefault()
      if (hasFiles(event.dataTransfer)) setDragActive(true)
    }
    const leave = (event: DragEvent): void => {
      event.preventDefault()
      if (event.relatedTarget === null) setDragActive(false)
    }
    const drop = (event: DragEvent): void => {
      event.preventDefault()
      setDragActive(false)

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      if (files.length !== 1) {
        externalLoadVersion.current += 1
        setLoadingExternal(false)
        setError('Drop one subtitle file at a time.')
        return
      }
      void loadDroppedSubtitle(files[0])
    }

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', preventNavigation)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', preventNavigation)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [loadDroppedSubtitle])

  const updatePreferences = async (update: SubtitlePreferencesUpdate): Promise<void> => {
    setError(null)
    try {
      setPreferences(await window.desktop.media.updateSubtitlePreferences(update))
    } catch (reason) {
      setError(cleanErrorMessage(reason, 'Could not save subtitle preferences.'))
    }
  }

  const updateDelay = async (value: number): Promise<void> => {
    setError(null)
    try {
      await window.desktop.media.setSubtitleDelay(roundDelay(value))
    } catch (reason) {
      setError(cleanErrorMessage(reason, 'Could not adjust subtitle timing.'))
    }
  }

  const selectTrack = async (trackId: number): Promise<void> => {
    setError(null)
    try {
      await window.desktop.media.selectSubtitleTrack(trackId)
    } catch (reason) {
      setError(cleanErrorMessage(reason, 'Could not switch subtitle source.'))
    }
  }

  const tracks = state?.tracks.filter((track) => track.type === 'subtitle') ?? []
  const selectableTracks = tracks.filter((track) => isSelectableTrack(track, state?.filePath ?? null))
  const delay = state?.subtitleDelay ?? 0
  const canControl = Boolean(state?.filePath) && !['loading', 'error', 'unavailable'].includes(state?.status ?? '')
  const canSwitch = state?.status === 'paused' && selectableTracks.length > 0

  return (
    <aside className="subtitle-tools-root" aria-label="Subtitle tools">
      <div className={`subtitle-tools-chrome${chromeVisible ? '' : ' is-hidden'}`}>
        <button
          type="button"
          className="subtitle-tools-toggle"
          aria-label="Subtitle controls"
          title="Subtitle controls"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <PlayerIcon name="captions" />
          <span>Subtitles</span>
        </button>

        {panelOpen ? (
          <section className="subtitle-tools-panel" aria-label="Subtitle controls panel">
            <div className="subtitle-tools-heading">
              <div>
                <strong>Subtitle controls</strong>
                <span>Drop SRT, ASS, or SSA anywhere on the player</span>
              </div>
              <button
                type="button"
                className="subtitle-tools-close"
                aria-label="Close subtitle controls"
                onClick={() => setPanelOpen(false)}
              >
                <PlayerIcon name="close" />
              </button>
            </div>

            <label className="subtitle-tools-field">
              <span>Subtitle source</span>
              <select
                value={state?.subtitle.trackId === null || state?.subtitle.trackId === undefined ? '' : String(state.subtitle.trackId)}
                disabled={!canSwitch}
                onChange={(event) => void selectTrack(Number(event.currentTarget.value))}
              >
                {selectableTracks.length === 0 ? <option value="">No text subtitles</option> : null}
                {tracks.map((track) => (
                  <option
                    value={track.id}
                    key={track.id}
                    disabled={!isSelectableTrack(track, state?.filePath ?? null)}
                  >
                    {formatTrack(track)}
                  </option>
                ))}
              </select>
              <small>
                {state?.status === 'paused'
                  ? 'Choose any available interactive text subtitle.'
                  : 'Pause playback before switching subtitle sources.'}
              </small>
            </label>

            <div className="subtitle-tools-control-group">
              <div className="subtitle-tools-control-heading">
                <span>Delay / sync</span>
                <output>{formatDelay(delay)}</output>
              </div>
              <div className="subtitle-tools-stepper">
                <button
                  type="button"
                  disabled={!canControl}
                  onClick={() => void updateDelay(Math.max(-10, delay - DELAY_STEP))}
                >
                  Earlier
                </button>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={DELAY_STEP}
                  value={delay}
                  disabled={!canControl}
                  aria-label="Subtitle delay"
                  onChange={(event) => void updateDelay(Number(event.currentTarget.value))}
                />
                <button
                  type="button"
                  disabled={!canControl}
                  onClick={() => void updateDelay(Math.min(10, delay + DELAY_STEP))}
                >
                  Later
                </button>
              </div>
              <button
                type="button"
                className="subtitle-tools-reset"
                disabled={!canControl || delay === 0}
                onClick={() => void updateDelay(0)}
              >
                Reset timing
              </button>
            </div>

            <label className="subtitle-tools-field">
              <span>
                Size <output>{Math.round(preferences.fontScale * 100)}%</output>
              </span>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={preferences.fontScale}
                aria-label="Subtitle font size"
                onChange={(event) =>
                  void updatePreferences({ fontScale: Number(event.currentTarget.value) })
                }
              />
            </label>

            <label className="subtitle-tools-field">
              <span>
                Vertical position <output>{formatPosition(preferences.verticalOffset)}</output>
              </span>
              <input
                type="range"
                min={-24}
                max={240}
                step={4}
                value={preferences.verticalOffset}
                aria-label="Subtitle vertical position"
                onChange={(event) =>
                  void updatePreferences({ verticalOffset: Number(event.currentTarget.value) })
                }
              />
              <small>Move left to lower subtitles or right to raise them.</small>
            </label>
          </section>
        ) : null}
      </div>

      {dragActive ? (
        <div className="subtitle-drop-feedback" role="status">
          <PlayerIcon name="captions" />
          <strong>Drop subtitle to load</strong>
          <span>SRT · ASS · SSA</span>
        </div>
      ) : null}

      {loadingExternal ? <div className="subtitle-tools-toast">Loading subtitle…</div> : null}
      {!loadingExternal && error ? (
        <div className="subtitle-tools-toast is-error" role="status">
          {error}
        </div>
      ) : null}
      {!loadingExternal && !error && message ? (
        <div className="subtitle-tools-toast" role="status">
          {message}
        </div>
      ) : null}
    </aside>
  )
}

function hasFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'))
}

function isSupportedSubtitleFile(fileName: string): boolean {
  const normalized = fileName.toLocaleLowerCase('en-US')
  return SUBTITLE_EXTENSIONS.some((extension) => normalized.endsWith(extension))
}

function isSelectableTrack(track: MediaTrack, filePath: string | null): boolean {
  if (track.subtitleKind !== 'text') return false
  if (track.id === EXTERNAL_SUBTITLE_TRACK_ID) return true
  return track.ffIndex !== null || /^https?:\/\//i.test(filePath ?? '')
}

function formatTrack(track: MediaTrack): string {
  if (track.id === EXTERNAL_SUBTITLE_TRACK_ID) {
    return `External · ${track.title ?? 'subtitle'} · ${track.codec ?? 'text'}`
  }

  const language = track.language ?? 'und'
  const title = track.title ? ` · ${track.title}` : ''
  return `${language}${title} · ${track.codec ?? 'unknown'}`
}

function roundDelay(value: number): number {
  return Math.round(value * 10) / 10
}

function formatDelay(value: number): string {
  if (Math.abs(value) < 0.0001) return '0.0 s'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} s`
}

function formatPosition(value: number): string {
  if (value === 0) return 'Default'
  return value > 0 ? `+${value}px higher` : `${Math.abs(value)}px lower`
}

function cleanErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
}
