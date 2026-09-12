import { useEffect, useState } from 'react'
import type { PlaybackSnapshot } from '../../../shared/media'
import './OverlayProbe.css'

const EMPTY_STATE: PlaybackSnapshot = {
  status: 'idle',
  filePath: null,
  fileName: null,
  currentTime: null,
  duration: null,
  tracks: [],
  error: null
}

export function OverlayProbe(): React.JSX.Element {
  const [state, setState] = useState<PlaybackSnapshot>(EMPTY_STATE)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)

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

  return (
    <main className="overlay-probe" aria-label="HTML subtitle overlay feasibility probe">
      <div className="overlay-probe-panel">
        <div className="overlay-probe-meta">
          <span>HTML overlay probe</span>
          <strong>{formatTime(state.currentTime)}</strong>
        </div>
        <div className="overlay-probe-line" aria-label="Clickable test subtitle">
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
          {selectedWord ? `Clicked: ${selectedWord}` : 'Resize or move this video window, then click a word.'}
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
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}
