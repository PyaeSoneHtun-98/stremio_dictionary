import { useEffect, useState } from 'react'
import type { OpenVideoResult, PlaybackSnapshot } from '../../../../shared/media'
import './PlaybackProof.css'

const EMPTY_STATE: PlaybackSnapshot = {
  status: 'idle',
  filePath: null,
  fileName: null,
  currentTime: null,
  duration: null,
  volume: 100,
  speed: 1,
  tracks: [],
  error: null
}

export function PlaybackProof(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [opening, setOpening] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void window.desktop.media.getState().then((snapshot) => {
      if (active) {
        setState(snapshot)
      }
    })

    const unsubscribe = window.desktop.media.onState((snapshot) => {
      if (active) {
        setState(snapshot)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent): void => event.preventDefault()
    window.addEventListener('dragover', preventFileNavigation)
    window.addEventListener('drop', preventFileNavigation)

    return () => {
      window.removeEventListener('dragover', preventFileNavigation)
      window.removeEventListener('drop', preventFileNavigation)
    }
  }, [])

  const applyOpenResult = (result: OpenVideoResult): void => {
    if (result.error) {
      setLocalError(result.error)
    }
  }

  const openVideo = async (): Promise<void> => {
    setOpening(true)
    setLocalError(null)

    try {
      applyOpenResult(await window.desktop.media.openVideo())
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not open the video.')
    } finally {
      setOpening(false)
    }
  }

  const openDroppedFile = async (file: File): Promise<void> => {
    setOpening(true)
    setLocalError(null)

    try {
      if (!file.name.toLowerCase().endsWith('.mkv')) {
        setLocalError('Subtitle Bridge currently supports MKV files only.')
        return
      }

      const filePath = window.desktop.media.getPathForFile(file)
      if (!filePath) {
        setLocalError('Could not read the dropped file path. Use Open video instead.')
        return
      }

      applyOpenResult(await window.desktop.media.openVideoPath(filePath))
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not open the dropped video.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <section
      className={`playback-proof${dragActive ? ' is-dragging' : ''}`}
      aria-labelledby="playback-proof-title"
      onDragEnter={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragActive(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        const file = event.dataTransfer.files.item(0)
        if (file) {
          void openDroppedFile(file)
        }
      }}
    >
      <div className="playback-proof-header">
        <div>
          <span className="eyebrow">Issue #3 player workflow</span>
          <h2 id="playback-proof-title">Open a local MKV and control playback</h2>
        </div>
        <span className={`status-pill status-${state.status}`}>{state.status}</span>
      </div>

      <div className="video-dropzone">
        <div>
          <strong>{dragActive ? 'Drop the MKV to open it' : 'Drag an MKV anywhere onto this panel'}</strong>
          <span>or choose a local file with the picker</span>
        </div>
        <button className="primary-action" type="button" onClick={openVideo} disabled={opening}>
          {opening ? 'Opening…' : 'Open video'}
        </button>
      </div>

      <p className="playback-help">
        Playback controls live on the video surface: play/pause, seek, volume, speed, and fullscreen.
        Opening another MKV safely resets its position, duration, tracks, and subtitle test state.
      </p>

      {state.error || localError ? <div className="media-error">{localError ?? state.error}</div> : null}

      <div className="playback-metrics">
        <Metric label="File" value={state.fileName ?? 'No video loaded'} />
        <Metric label="Position" value={formatTime(state.currentTime)} />
        <Metric label="Duration" value={formatTime(state.duration)} />
        <Metric label="Tracks" value={String(state.tracks.length)} />
        <Metric label="Volume" value={`${Math.round(state.volume)}%`} />
        <Metric label="Speed" value={`${state.speed}×`} />
      </div>

      <div className="track-table-wrap">
        <table className="track-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Language</th>
              <th>Title</th>
              <th>Codec</th>
              <th>Subtitle mode</th>
            </tr>
          </thead>
          <tbody>
            {state.tracks.length > 0 ? (
              state.tracks.map((track) => (
                <tr key={`${track.type}-${track.id}`}>
                  <td>{track.id}</td>
                  <td>{track.type}</td>
                  <td>{track.language ?? '—'}</td>
                  <td>{track.title ?? '—'}</td>
                  <td>{track.codec ?? 'unknown'}</td>
                  <td>{track.subtitleKind ?? '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty-table-cell">
                  Open an MKV file to inspect its embedded tracks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  )
}

function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '—'
  }

  const wholeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainingSeconds = wholeSeconds % 60

  const clock = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}
