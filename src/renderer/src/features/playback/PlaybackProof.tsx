import { useCallback, useEffect, useState } from 'react'
import type {
  OpenVideoResult,
  PlaybackSnapshot,
  StremioHandoffStatus,
} from '../../../../shared/media'
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
  buffering: false,
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
  const [stremioStatus, setStremioStatus] = useState<StremioHandoffStatus | null>(null)

  const refreshStremioStatus = useCallback(async (): Promise<void> => {
    try {
      setStremioStatus(await window.desktop.stremio.getHandoffStatus())
    } catch {
      setStremioStatus({
        state: 'unknown',
        message: 'Could not verify the current Stremio integration state.',
        canEnable: false,
        canDisable: false,
      })
    }
  }, [])

  useEffect(() => {
    void refreshStremioStatus()
  }, [refreshStremioStatus])

  useEffect(() => {
    let active = true

    void window.desktop.media.getState().then((snapshot) => {
      if (active) setState(snapshot)
    })

    const unsubscribe = window.desktop.media.onState((snapshot) => {
      if (active) setState(snapshot)
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
    if (result.error) setLocalError(result.error)
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
      if (!isSupportedLocalVideo(file.name)) {
        setLocalError('Subtitle Bridge currently supports MKV and MP4 files.')
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
      if (result.ok) {
        await refreshStremioStatus()
      }
    } catch {
      setStremioMessage('Could not update the Stremio integration. Try again.')
    } finally {
      setStremioBusy(false)
    }
  }

  const displayStatus = state.buffering ? 'buffering' : state.status

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
        if (file) void openDroppedFile(file)
      }}
    >
      <div className="launcher-panel-heading">
        <div>
          <span className="eyebrow">Start watching</span>
          <h2 id="playback-proof-title">Choose how to play</h2>
        </div>
        <span className={`status-pill status-${displayStatus}`}>
          <span className="status-indicator" aria-hidden="true" />
          {displayStatus}
        </span>
      </div>

      <div className="launcher-action-grid">
        <section className="launch-card launch-card-primary">
          <div className="launch-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <title>Local video</title>
              <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h4l2 2H18a2 2 0 0 1 2 2v8.5A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
              <path d="m10 10 5 3-5 3z" />
            </svg>
          </div>
          <div className="launch-card-copy">
            <span className="launch-card-kicker">Local video</span>
            <h3>{dragActive ? 'Drop your video here' : 'Open a video'}</h3>
            <p>Play an MKV or MP4 with clickable English subtitles and Burmese lookup.</p>
          </div>
          <button className="primary-action" type="button" onClick={openVideo} disabled={opening}>
            {opening ? 'Opening…' : 'Choose video'}
          </button>
          <span className="drop-hint">or drag and drop an MKV or MP4 anywhere on this panel</span>
        </section>

        <section className="launch-card">
          <div className="launch-card-icon stremio-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <title>Stremio streaming</title>
              <path d="m8 5 10 7-10 7z" />
            </svg>
          </div>
          <div className="launch-card-copy">
            <div className="launch-card-kicker-row">
              <span className="launch-card-kicker">Stremio</span>
              <span
                className={`integration-state integration-${stremioStatus?.state ?? 'checking'}`}
                title={stremioStatus?.message ?? 'Checking Stremio integration…'}
              >
                <span aria-hidden="true" />
                {stremioStatus ? formatStremioState(stremioStatus.state) : 'Checking'}
              </span>
            </div>
            <h3>Play from Stremio</h3>
            <p>
              {stremioStatus?.state === 'enabled'
                ? 'Handoff is ready. Choose Play in Subtitle Bridge from Stremio.'
                : stremioStatus?.state === 'repair'
                  ? 'Handoff needs repair. Disable the existing patches, then Enable again to rebuild it.'
                  : stremioStatus &&
                      !stremioStatus.canEnable &&
                      !stremioStatus.canDisable &&
                      stremioStatus.state === 'unknown'
                    ? 'Status is read-only in development. Check it from the installed app.'
                    : 'Enable once, restart Stremio, then choose Play in Subtitle Bridge.'}
            </p>
          </div>
          <div className="stremio-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={
                stremioBusy || stremioStatus === null || !stremioStatus.canEnable
              }
              onClick={() => void updateStremioHandoff(true)}
            >
              {stremioBusy ? 'Working…' : 'Enable'}
            </button>
            <button
              className="secondary-action secondary-action-quiet"
              type="button"
              disabled={
                stremioBusy || stremioStatus === null || !stremioStatus.canDisable
              }
              onClick={() => void updateStremioHandoff(false)}
            >
              Disable
            </button>
            {stremioMessage ? (
              <span className="stremio-feedback" aria-live="polite">
                {stremioMessage}
              </span>
            ) : null}
          </div>
        </section>
      </div>

      {state.fileName ? (
        <section className="current-session">
          <div className="current-session-state">
            <span className={`session-dot status-${displayStatus}`} aria-hidden="true" />
            <div>
              <span aria-live="polite">
                {displayStatus === 'buffering' ? 'Buffering stream' : displayStatus}
              </span>
              <strong title={state.fileName}>{state.fileName}</strong>
            </div>
          </div>

          <div className="session-stats">
            <span>
              <small>Position</small>
              <strong>{formatTime(state.currentTime)}</strong>
            </span>
            <span>
              <small>Duration</small>
              <strong>{formatTime(state.duration)}</strong>
            </span>
            <span>
              <small>Subtitles</small>
              <strong>{state.subtitle.status}</strong>
            </span>
          </div>
        </section>
      ) : null}

      {state.error || localError ? (
        <div className="media-error">{localError ?? state.error}</div>
      ) : null}

      {state.filePath || state.error ? (
        <details className="media-details">
          <summary>Technical playback details{state.fileName ? ` · ${state.fileName}` : ''}</summary>

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
              </div>
            ) : (
              <div className="empty-subtitle-state">
                {state.subtitle.status === 'ready'
                  ? 'No subtitle cue is active at the current playback position.'
                  : (state.subtitle.error ?? 'Open a video with an embedded text subtitle track.')}
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
                        {track.type === 'subtitle' && state.subtitle.trackId === track.id ? 'yes' : '—'}
                      </td>
                      <td>{track.ffIndex ?? '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="empty-table-cell">
                      Open a video to inspect its tracks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  )
}

function formatStremioState(state: StremioHandoffStatus['state']): string {
  switch (state) {
    case 'enabled':
      return 'Enabled'
    case 'disabled':
      return 'Disabled'
    case 'repair':
      return 'Repair needed'
    case 'unavailable':
      return 'Unavailable'
    default:
      return 'Unknown'
  }
}

function isSupportedLocalVideo(fileName: string): boolean {
  const normalized = fileName.toLocaleLowerCase('en-US')
  return normalized.endsWith('.mkv') || normalized.endsWith('.mp4')
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
  if (state.subtitle.trackId === null) return 'No text subtitle track selected'

  const parts = [
    `Track ${state.subtitle.trackId}`,
    state.subtitle.trackLanguage,
    state.subtitle.trackTitle,
    state.subtitle.trackCodec,
  ].filter((value): value is string => Boolean(value))

  return parts.join(' · ')
}

function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'

  const wholeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainingSeconds = wholeSeconds % 60
  const clock = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${clock}` : clock
}
