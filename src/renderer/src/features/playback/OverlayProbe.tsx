import { useEffect, useRef, useState } from 'react'
import type { PlaybackSnapshot } from '../../../../shared/media'
import { createEmptySubtitleModel } from '../../../../shared/media'
import './OverlayProbe.css'

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

export function OverlayProbe(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [controlError, setControlError] = useState<string | null>(null)
  const currentFilePath = useRef<string | null>(null)

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

      setState(snapshot)
    }

    void window.desktop.media.getState().then(applySnapshot)
    const unsubscribe = window.desktop.media.onState(applySnapshot)

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const canControl = Boolean(state.filePath) && !['loading', 'error', 'unavailable'].includes(state.status)
  const playing = state.status === 'playing'
  const duration = state.duration ?? 0
  const currentTime = Math.min(state.currentTime ?? 0, duration || Number.MAX_SAFE_INTEGER)

  const runControl = async (action: () => Promise<void>): Promise<void> => {
    setControlError(null)
    try {
      await action()
    } catch (error) {
      setControlError(error instanceof Error ? error.message : 'The player control failed.')
    }
  }

  return (
    <main className="overlay-probe" aria-label="Subtitle Bridge video controls">
      <div className="overlay-topline">
        <span className={`overlay-status status-${state.status}`}>{state.status}</span>
        <strong title={state.fileName ?? undefined}>{state.fileName ?? 'No video loaded'}</strong>
      </div>

      <div className="overlay-probe-panel">
        <div className="overlay-probe-meta">
          <span>Interactive subtitle layer</span>
          <strong>{formatTime(state.currentTime)}</strong>
        </div>
        <div className="overlay-probe-line">
          <span>Click a word:</span>
          {['interactive', 'subtitle', 'works'].map((word) => (
            <button
              key={word}
              type="button"
              className="overlay-word"
              aria-pressed={selectedWord === word}
              onClick={() => setSelectedWord(word)}
            >
              {word}
            </button>
          ))}
        </div>
        <div className="overlay-probe-result" aria-live="polite">
          {selectedWord ? `Clicked: ${selectedWord}` : 'Clickable subtitle words will appear here.'}
        </div>
      </div>

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
