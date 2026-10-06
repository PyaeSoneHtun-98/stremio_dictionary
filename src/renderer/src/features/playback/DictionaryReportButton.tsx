import { useEffect, useRef, useState } from 'react'
import type { DictionaryReportRequest } from '../../../../shared/dictionaryReport'
import { PlayerIcon } from './PlayerIcon'

// The parent keys this component by lookup version, so a new card owns fresh state.
export function DictionaryReportButton({
  report,
}: {
  report: DictionaryReportRequest
}): React.JSX.Element {
  const [available, setAvailable] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'reported' | 'failed' | 'limited'>(
    'idle',
  )
  const pending = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    let active = true
    mounted.current = true
    void window.desktop.translation
      .getReportAvailability()
      .then((value) => {
        if (active) setAvailable(value)
      })
      .catch(() => {})
    return () => {
      active = false
      mounted.current = false
    }
  }, [])

  const submit = async (): Promise<void> => {
    if (pending.current || status === 'reported' || !available) return
    pending.current = true
    setStatus('sending')
    try {
      const result = await window.desktop.translation.reportDictionaryIssue(report)
      if (!mounted.current) return
      setStatus(result.ok ? 'reported' : result.reason === 'rate-limited' ? 'limited' : 'failed')
    } catch {
      if (mounted.current) setStatus('failed')
    } finally {
      pending.current = false
    }
  }

  const tooltip = !available
    ? 'Reporting is unavailable in this build'
    : status === 'sending'
      ? 'Sending report…'
      : status === 'reported'
        ? 'Reported'
        : status === 'limited'
          ? 'Report limit reached. Try again later.'
          : status === 'failed'
            ? 'Couldn’t send. Click to retry.'
            : `${report.category === 'missing' ? 'Report missing translation' : 'Report translation issue'} — sends this term to the developer`

  return (
    <button
      type="button"
      className="translation-report-button"
      title={tooltip}
      aria-label={tooltip}
      aria-busy={status === 'sending'}
      disabled={!available || status === 'sending' || status === 'reported'}
      onClick={() => void submit()}
    >
      <PlayerIcon name={status === 'reported' ? 'check' : 'flag'} />
    </button>
  )
}
