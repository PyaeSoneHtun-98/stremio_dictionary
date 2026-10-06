// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DictionaryReportButton } from '../src/renderer/src/features/playback/DictionaryReportButton'
import { TranslationPopup } from '../src/renderer/src/features/playback/PolishedOverlay'
import type { DictionaryReportOutcome } from '../src/shared/dictionaryReport'

const availability = vi.fn()
const submit = vi.fn()
const missing = { term: 'unknownword', category: 'missing' as const }
const selectedWord = { cueId: 'cue', tokenStart: 0, text: 'chosen', lookupTerm: 'chosen' }
const popupProps = {
  selectedWord,
  lookupVersion: 1,
  popupPosition: 'above' as const,
  targetLanguage: 'my',
  onDismiss: vi.fn(),
}

beforeEach(() => {
  availability.mockReset().mockResolvedValue(true)
  submit.mockReset().mockResolvedValue({ ok: true })
  Object.defineProperty(window, 'desktop', {
    configurable: true,
    value: {
      translation: { getReportAvailability: availability, reportDictionaryIssue: submit },
    },
  })
})
afterEach(cleanup)

async function readyButton(): Promise<HTMLButtonElement> {
  const button = (await screen.findByRole('button', {
    name: /Report (missing translation|translation issue)/,
  })) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  return button
}

describe('icon-only dictionary reporting', () => {
  it('sends once for rapid clicks and acknowledges success without visible text', async () => {
    let resolve!: (value: DictionaryReportOutcome) => void
    submit.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    render(<DictionaryReportButton report={missing} />)
    await waitFor(() => expect(availability).toHaveBeenCalled())
    const button = await readyButton()
    expect(button.textContent).toBe('')
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith(missing)
    expect(button.disabled).toBe(true)
    await act(async () => resolve({ ok: true }))
    expect(screen.getByRole('button', { name: 'Reported' })).toBe(button)
    expect(button.disabled).toBe(true)
  })

  it('permits retries after failures, including rejected IPC promises', async () => {
    submit
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: false, reason: 'failed' })
      .mockResolvedValueOnce({ ok: true })
    render(<DictionaryReportButton report={missing} />)
    fireEvent.click(await readyButton())
    const retry = await screen.findByRole('button', { name: 'Couldn’t send. Click to retry.' })
    expect((retry as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(retry)
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
    await screen.findByRole('button', { name: 'Couldn’t send. Click to retry.' })
    fireEvent.click(retry)
    await screen.findByRole('button', { name: 'Reported' })
  })

  it('does not let an old submission update a newly opened card', async () => {
    let finishOld!: (value: DictionaryReportOutcome) => void
    submit.mockImplementationOnce(
      () =>
        new Promise((done) => {
          finishOld = done
        }),
    )
    const view = render(<DictionaryReportButton key="one" report={missing} />)
    fireEvent.click(await readyButton())
    view.rerender(
      <DictionaryReportButton key="two" report={{ term: 'newword', category: 'missing' }} />,
    )
    const newButton = await readyButton()
    await act(async () => finishOld({ ok: true }))
    expect(newButton.title).toMatch(/^Report missing translation/)
    fireEvent.click(newButton)
    await screen.findByRole('button', { name: 'Reported' })
    expect(submit).toHaveBeenLastCalledWith({ term: 'newword', category: 'missing' })
  })

  it('safely settles pending IPC after unmount and survives Strict Mode cleanup', async () => {
    let finish!: (value: DictionaryReportOutcome) => void
    submit.mockImplementation(
      () =>
        new Promise((done) => {
          finish = done
        }),
    )
    const view = render(
      <StrictMode>
        <DictionaryReportButton report={missing} />
      </StrictMode>,
    )
    fireEvent.click(await readyButton())
    view.unmount()
    await act(async () => finish({ ok: true }))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('disables reporting when the service is not configured', async () => {
    availability.mockResolvedValue(false)
    render(<DictionaryReportButton report={missing} />)
    await waitFor(() => expect(availability).toHaveBeenCalled())
    const button = screen.getByRole('button', {
      name: 'Reporting is unavailable in this build',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(submit).not.toHaveBeenCalled()
  })

  it('reports resolved headwords and phrases instead of an inflection or clicked phrase token', async () => {
    const result = {
      originalWord: 'chosen',
      translation: 'meaning',
      provider: 'local-dictionary',
      targetLanguage: 'my',
      dictionaryEntry: { word: 'choose', pronunciation: '/x/', forms: ['chosen'], meanings: [] },
    }
    const view = render(
      <TranslationPopup
        {...popupProps}
        translation={{ status: 'ready', word: 'chosen', result }}
      />,
    )
    fireEvent.click(await readyButton())
    await screen.findByRole('button', { name: 'Reported' })
    expect(submit).toHaveBeenLastCalledWith({ term: 'choose', category: 'incorrect' })
    view.rerender(
      <TranslationPopup
        {...popupProps}
        lookupVersion={2}
        translation={{
          status: 'ready',
          word: 'up',
          result: {
            ...result,
            dictionaryEntry: undefined,
            phraseEntry: {
              phrase: 'give up',
              type: 'phrasal_verb',
              forms: [],
              burmese: ['meaning'],
            },
          },
        }}
      />,
    )
    fireEvent.click(await readyButton())
    await screen.findByRole('button', { name: 'Reported' })
    expect(submit).toHaveBeenLastCalledWith({ term: 'give up', category: 'incorrect' })
  })

  it('offers missing-word reporting only for a genuine miss, not loading or general failure', async () => {
    const view = render(
      <TranslationPopup
        {...popupProps}
        translation={{ status: 'missing', word: 'chosen', error: 'Missing' }}
      />,
    )
    fireEvent.click(await readyButton())
    await screen.findByRole('button', { name: 'Reported' })
    expect(submit).toHaveBeenLastCalledWith({ term: 'chosen', category: 'missing' })
    view.rerender(
      <TranslationPopup
        {...popupProps}
        translation={{ status: 'error', word: 'chosen', error: 'Failed' }}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
    view.rerender(
      <TranslationPopup {...popupProps} translation={{ status: 'loading', word: 'chosen' }} />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('keeps reporting separate from dismissal and stops playback-surface pointer handling', async () => {
    const onDismiss = vi.fn()
    const onSurfacePointer = vi.fn()
    render(
      <div onPointerDown={onSurfacePointer}>
        <TranslationPopup
          {...popupProps}
          onDismiss={onDismiss}
          translation={{ status: 'missing', word: 'chosen', error: 'Missing' }}
        />
      </div>,
    )
    const report = await readyButton()
    fireEvent.pointerDown(report)
    fireEvent.click(report)
    await screen.findByRole('button', { name: 'Reported' })
    expect(onSurfacePointer).not.toHaveBeenCalled()
    expect(onDismiss).not.toHaveBeenCalled()
    expect(submit).toHaveBeenCalledTimes(1)
    const close = screen.getByRole('button', { name: 'Close translation' })
    fireEvent.pointerDown(close)
    fireEvent.click(close)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onSurfacePointer).not.toHaveBeenCalled()
    expect(submit).toHaveBeenCalledTimes(1)
  })
})
