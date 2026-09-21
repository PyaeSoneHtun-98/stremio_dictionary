import { useEffect, useState } from 'react'
import type { OpenVideoResult, PlaybackSnapshot } from '../../../../shared/media'
import { createEmptySubtitleModel } from '../../../../shared/media'
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
  subtitle: createEmptySubtitleModel(),
  error: null,
}

export function PlaybackProof(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [opening, setOpening] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [stremioBusy, setStremioBusy] = useState(false)
  const [stremioMessage, setStremioMessage] = useState<string | null>(null)

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

  const updateStremioHandoff = async (enabled: boolean): Promise<void> => {
    setStremioBusy(true)
    setStremioMessage(null)

    try {
      const result = enabled
        ? await window.desktop.stremio.enableHandoff()
        : await window.desktop.stremio.disableHandoff()
      setStremioMessage(result.message)
    } catch {
      setStremioMessage('Could not update the Stremio integration. Try again.')
    } finally {
      setStremioBusy(false)
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
          <span className="eyebrow">Your next watch</span>
          <h2 id="playback-proof-title">Settle in. Press play.</h2>
        </div>
        <span className={`status-pill status-${state.status}`}>{state.status}</span>
      </div>

      <div className="video-dropzone">
        <div>
          <strong>{dragActive ? 'Drop the MKV to open it' : 'Drop your movie here'}</strong>
          <span>Choose an MKV file to start watching</span>
        </div>
        <button className="primary-action" type="button" onClick={openVideo} disabled={opening}>
          {opening ? 'Opening…' : 'Open video'}
        </button>
      </div>

      <div className="stremio-integration">
        <div>
          <strong>Watching with Stremio?</strong>
          <span>
            Enable the optional handoff, restart Stremio, then choose{' '}
            <strong>Play in Subtitle Bridge</strong> from its player menu.
          </span>
        </div>
        <div className="stremio-actions">
          <button
            className="secondary-action"
            type="button"
            disabled={stremioBusy}
            onClick={() => void updateStremioHandoff(true)}
          >
            {stremioBusy ? 'Working…' : 'Enable Stremio'}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={stremioBusy}
            onClick={() => void updateStremioHandoff(false)}
          >
            Disable
          </button>
        </div>
      </div>

      {stremioMessage ? (
        <p className="playback-help" aria-live="polite">
          {stremioMessage}
        </p>
      ) : null}

      {state.error || localError ? (
        <div className="media-error">{localError ?? state.error}</div>
      ) : null}

      <details className="media-details">
        <summary>Playback details{state.fileName ? ` · ${state.fileName}` : ''}</summary>
        <div className="playback-metrics">
          <Metric label="File" value={state.fileName ?? 'No video loaded'} />
          <Metric label="Position" value={formatTime(state.currentTime)} />
          <Metric label="Duration" value={formatTime(state.duration)} />
          <Metric label="Tracks" value={String(state.tracks.length)} />
          <Metric label="Subtitle cues" value={String(state.subtitle.cueCount)} />
          <Metric label="Subtitle state" value={state.subtitle.status} />
        </div>

        <div className="subtitle-diagnostic" aria-live="polite">
          <div className="subtitle-diagnostic-header">
            <div>
              <span className="eyebrow">Selected subtitle model</span>
              <strong>{subtitleTrackLabel(state)}</strong>
            </div>
            <span className={`status-pill subtitle-status-${state.subtitle.status}`}>
              {state.subtitle.status}
            </span>
          </div>

          {state.subtitle.error ? <div className="media-error">{state.subtitle.error}</div> : null}

          {state.subtitle.activeCue ? (
            <div className="active-cue-card">
              <div className="active-cue-time">
                {formatTime(state.subtitle.activeCue.startTime)} →{' '}
                {formatTime(state.subtitle.activeCue.endTime)}
              </div>
              <div className="active-cue-text">{state.subtitle.activeCue.text}</div>
              <div className="token-preview">
                {state.subtitle.activeCue.tokens.map((token) => (
                  <span className="token-chip" key={`${token.start}-${token.end}`}>
                    <strong>{token.text}</strong>
                    <small>{token.lookupTerm}</small>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-subtitle-state">
              {state.subtitle.status === 'ready'
                ? 'No subtitle cue is active at the current playback position.'
                : (state.subtitle.error ?? 'Open an MKV with an embedded text subtitle track.')}
            </div>
          )}
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
                <th>App selected</th>
                <th>FFmpeg index</th>
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
                    <td>
                      {track.type === 'subtitle' && state.subtitle.trackId === track.id
                        ? 'yes'
                        : '—'}
                    </td>
                    <td>{track.ffIndex ?? '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    Open an MKV file to inspect its embedded tracks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
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

function subtitleTrackLabel(state: PlaybackSnapshot): string {
  if (state.subtitle.trackId === null) {
    return 'No text subtitle track selected'
  }

  const parts = [
    `Track ${state.subtitle.trackId}`,
    state.subtitle.trackLanguage,
    state.subtitle.trackTitle,
    state.subtitle.trackCodec,
  ].filter((value): value is string => Boolean(value))

  return parts.join(' · ')
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
