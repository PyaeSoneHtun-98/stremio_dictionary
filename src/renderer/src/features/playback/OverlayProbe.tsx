import { useEffect, useRef, useState } from 'react'
import type { PlaybackSnapshot, SubtitleToken } from '../../../../shared/media'
import { createEmptySubtitleModel } from '../../../../shared/media'
import './OverlayProbe.css'
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

interface SelectedWord {
  cueId: string
  tokenStart: number
  text: string
  lookupTerm: string
}

export function OverlayProbe(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null)
  const [controlError, setControlError] = useState<string | null>(null)
  const currentFilePath = useRef<string | null>(null)
  const currentCueId = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    const applySnapshot = (snapshot: PlaybackSnapshot): void => {
      if (!active) {
        return
      }

      if (currentFilePath.current !== snapshot.filePath) {
        currentFilePath.current = snapshot.filePath
        setSelectedWord(null)
        setControlError(null)
      }

      const nextCueId = snapshot.subtitle.activeCue?.id ?? null
      if (currentCueId.current !== nextCueId) {
        currentCueId.current = nextCueId
        setSelectedWord(null)
      }

      setState(snapshot)
    }

    void window.desktop.media.getState().then(applySnapshot)
    const unsubscribe = window.desktop.media.onState(applySnapshot)

    return () => {
      active = false
      unsubscribe()
    }
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

  const canControl = Boolean(state.filePath) && !['loading', 'error', 'unavailable'].includes(state.status)
  const playing = state.status === 'playing'
  const duration = state.duration ?? 0
  const currentTime = Math.min(state.currentTime ?? 0, duration || Number.MAX_SAFE_INTEGER)
  const activeCue = state.subtitle.activeCue
  const subtitleSegments = activeCue ? segmentSubtitleCue(activeCue) : []

  const runControl = async (action: () => Promise<void>): Promise<void> => {
    setControlError(null)
    try {
      await action()
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'The player control failed.')
    }
  }

  const selectWord = (cueId: string, token: SubtitleToken): void => {
    setSelectedWord({
      cueId,
      tokenStart: token.start,
      text: token.text,
      lookupTerm: token.lookupTerm
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
                    aria-label={`Select word ${segment.token.text}`}
                    title={`Lookup: ${segment.token.lookupTerm}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      selectWord(activeCue.id, segment.token)
                    }}
                  >
                    {segment.token.text}
                  </button>
                )
              })}
            </div>
            {selectedWord ? (
              <div className="selected-word-status" aria-live="polite">
                Selected: <strong>{selectedWord.text}</strong>
                <span>lookup “{selectedWord.lookupTerm}”</span>
              </div>
            ) : null}
          </div>
        ) : state.subtitle.status === 'extracting' ? (
          <div className="subtitle-transient-status">Loading subtitles…</div>
        ) : null}
      </section>

      <div className="player-controls">
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
            disabled={!state.filePath}
            onClick={() => {
              void runControl(() => window.desktop.media.toggleFullscreen())
            }}
          >
            Fullscreen
          </button>
        </div>
      </div>
    </main>
  )
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
