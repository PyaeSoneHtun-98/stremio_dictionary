import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayerIcon } from './PlayerIcon'
import './SubtitleToolsOverlay.css'

const SUBTITLE_EXTENSIONS = ['.srt', '.ass', '.ssa'] as const
const SUCCESS_TOAST_MS = 3000
const ERROR_TOAST_MS = 5000

export function SubtitleToolsOverlay(): React.JSX.Element {
  const [dragActive, setDragActive] = useState(false)
  const [loadingExternal, setLoadingExternal] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const externalLoadVersion = useRef(0)

  useEffect(() => {
    return () => {
      externalLoadVersion.current += 1
    }
  }, [])

  useEffect(() => {
    if (loadingExternal || (!message && !error)) return

    const timeoutId = window.setTimeout(
      () => {
        setMessage(null)
        setError(null)
      },
      error ? ERROR_TOAST_MS : SUCCESS_TOAST_MS,
    )

    return () => window.clearTimeout(timeoutId)
  }, [error, loadingExternal, message])

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

  return (
    <aside className="subtitle-tools-root" aria-label="Subtitle file drop support">
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

function cleanErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
}
