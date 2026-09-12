import { useEffect, useState } from 'react'
import type { PlaybackSnapshot } from '../../../../shared/media'
import './PlaybackProof.css'

const EMPTY_STATE: PlaybackSnapshot = {
  status: 'idle',
  filePath: null,
  fileName: null,
  currentTime: null,
  duration: null,
  tracks: [],
  error: null
}

export function PlaybackProof(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [opening, setOpening] = useState(false)

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

  const openVideo = async (): Promise<void> => {
    setOpening(true)

    try {
      await window.desktop.media.openVideo()
    } finally {
      setOpening(false)
    }
  }

  return (
    <section className="playback-proof" aria-labelledby="playback-proof-title">
      <div className="playback-proof-header">
        <div>
          <span className="eyebrow">Issue #2 proof of concept</span>
          <h2 id="playback-proof-title">MKV playback + embedded track discovery</h2>
        </div>
        <span className={`status-pill status-${state.status}`}>{state.status}</span>
      </div>

      <div className="playback-proof-actions">
        <button className="primary-action" type="button" onClick={openVideo} disabled={opening}>
          {opening ? 'Opening…' : 'Open MKV'}
        </button>
        <p>
          This spike launches mpv as the playback engine and reads its JSON IPC events. mpv must be
          available on PATH, or <code>MPV_PATH</code> must point to <code>mpv.exe</code>.
        </p>
      </div>

      {state.error ? <div className="media-error">{state.error}</div> : null}

      <div className="playback-metrics">
        <Metric label="File" value={state.fileName ?? 'No video loaded'} />
        <Metric label="Position" value={formatTime(state.currentTime)} />
        <Metric label="Duration" value={formatTime(state.duration)} />
        <Metric label="Tracks" value={String(state.tracks.length)} />
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
