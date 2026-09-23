import { useEffect, useState } from 'react'
import type { UpdateSnapshot } from '../../../../shared/update'
import './UpdatePanel.css'

const EMPTY_UPDATE_STATE: UpdateSnapshot = {
  status: 'idle',
  currentVersion: 'unknown',
  latestVersion: null,
  releaseName: null,
  releaseNotes: null,
  publishedAt: null,
  downloadPercent: null,
  error: null,
  checkedAt: null
}

export function UpdatePanel(): React.JSX.Element | null {
  const [state, setState] = useState<UpdateSnapshot>(EMPTY_UPDATE_STATE)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true

    void window.desktop.update.getState().then((snapshot) => {
      if (active) setState(snapshot)
    })

    const unsubscribe = window.desktop.update.onState((snapshot) => {
      if (active) {
        setState(snapshot)
        if (snapshot.status !== 'error') {
          setActionError(null)
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const runAction = async (
    action: () => Promise<{ ok: boolean; error?: string }>
  ): Promise<void> => {
    setBusy(true)
    setActionError(null)
    try {
      const result = await action()
      if (!result.ok) {
        setActionError(result.error ?? 'The update action could not be completed.')
      }
    } catch {
      setActionError('The update action could not be completed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'idle' || state.status === 'up-to-date') {
    return null
  }

  if (state.status === 'checking') {
    return (
      <aside className="update-strip" aria-live="polite">
        <span className="update-strip-dot" aria-hidden="true" />
        Checking for Subtitle Bridge updates…
      </aside>
    )
  }

  if (state.status === 'error') {
    return (
      <aside className="update-strip update-strip-error" aria-live="polite">
        <div>
          <strong>Update unavailable</strong>
          <span>{actionError ?? state.error ?? 'Try again later.'}</span>
        </div>
        <button
          className="secondary-action"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setActionError(null)
            void window.desktop.update
              .check()
              .catch(() => setActionError('Could not check for updates. Try again later.'))
              .finally(() => setBusy(false))
          }}
        >
          {busy ? 'Checking…' : 'Retry'}
        </button>
      </aside>
    )
  }

  return (
    <aside className="update-panel" aria-labelledby="update-panel-title">
      <div className="update-panel-copy">
        <span className="eyebrow">
          {state.status === 'ready' ? 'Update verified' : 'Update available'}
        </span>
        <h2 id="update-panel-title">
          {state.latestVersion ? `Subtitle Bridge v${state.latestVersion}` : 'Subtitle Bridge update'}
        </h2>
        <p>
          {state.status === 'ready'
            ? 'The installer was downloaded and its SHA-256 checksum was verified.'
            : 'A newer stable Windows release is available.'}
        </p>

        {state.releaseNotes ? (
          <details className="update-release-notes">
            <summary>What’s new</summary>
            <pre>{state.releaseNotes}</pre>
          </details>
        ) : null}

        {actionError ? (
          <p className="update-action-error" aria-live="polite">
            {actionError}
          </p>
        ) : null}
      </div>

      <div className="update-panel-action">
        {state.status === 'available' ? (
          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() => void runAction(() => window.desktop.update.download())}
          >
            {busy ? 'Starting…' : 'Download update'}
          </button>
        ) : null}

        {state.status === 'downloading' ? (
          <div className="update-progress" aria-live="polite">
            <div className="update-progress-label">
              <span>Downloading verified installer</span>
              <strong>
                {state.downloadPercent === null ? '…' : `${state.downloadPercent}%`}
              </strong>
            </div>
            <progress
              max={100}
              value={state.downloadPercent === null ? undefined : state.downloadPercent}
            />
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() => void runAction(() => window.desktop.update.install())}
          >
            {busy ? 'Starting installer…' : 'Install and restart'}
          </button>
        ) : null}

        <small>
          Current version: v{state.currentVersion}
          {state.publishedAt ? ` · Released ${formatReleaseDate(state.publishedAt)}` : ''}
        </small>
      </div>
    </aside>
  )
}

function formatReleaseDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'recently'
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
