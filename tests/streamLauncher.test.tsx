// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackProof } from '../src/renderer/src/features/playback/PlaybackProof'
import { createEmptySubtitleModel, type OpenVideoResult } from '../src/shared/media'

const openStream = vi.fn()
const openVideo = vi.fn()
const openVideoPath = vi.fn()
const unsubscribe = vi.fn()
const url = 'http://127.0.0.1:11470/stream/example?token=synthetic'

beforeEach(() => {
  openStream.mockReset().mockResolvedValue({ cancelled: false })
  openVideo.mockReset().mockResolvedValue({ cancelled: true })
  openVideoPath.mockReset().mockResolvedValue({ cancelled: false })
  unsubscribe.mockReset()
  Object.defineProperty(window, 'desktop', { configurable: true, value: {
    media: {
      openStream, openVideo, openVideoPath, getPathForFile: () => 'D:\\Example.mp4',
      getState: async () => ({ status: 'idle', filePath: null, fileName: null, tracks: [],
        subtitle: createEmptySubtitleModel(), error: null, volume: 100, speed: 1,
        currentTime: null, duration: null }),
      onState: () => unsubscribe,
    },
    stremio: { getHandoffStatus: async () => ({ state: 'disabled', message: '', canEnable: true, canDisable: false }) },
  } })
})
afterEach(cleanup)

function enter(value = url): HTMLInputElement {
  const input = screen.getByLabelText('Stream URL') as HTMLInputElement
  fireEvent.change(input, { target: { value } })
  return input
}
function submit(): void { fireEvent.submit(screen.getByRole('form', { name: 'Open network stream' })) }

describe('main-window stream entry', () => {
  it('opens a trimmed URL by button and clears the private input on success', async () => {
    render(<StrictMode><PlaybackProof /></StrictMode>)
    const input = enter(`  ${url}  `)
    fireEvent.click(screen.getByRole('button', { name: 'Open stream' }))
    await waitFor(() => expect(input.value).toBe(''))
    expect(openStream).toHaveBeenCalledExactlyOnceWith(url)
    expect(openVideo).not.toHaveBeenCalled()
  })

  it('validates before IPC and provides accessible correction feedback', async () => {
    render(<PlaybackProof />)
    enter('ftp://media.example/video')
    submit()
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid HTTP or HTTPS stream URL.')
    expect(openStream).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Stream URL').getAttribute('aria-invalid')).toBe('true')
    enter()
    expect(screen.queryByRole('alert')).toBeNull()
    submit()
    await waitFor(() => expect(openStream).toHaveBeenCalledOnce())
  })

  it('single-flights repeated form submits and blocks the picker/drop while pending', async () => {
    let finish!: (result: OpenVideoResult) => void
    openStream.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<PlaybackProof />)
    const input = enter()
    submit()
    submit()
    expect(openStream).toHaveBeenCalledOnce()
    expect(input.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Choose video' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.drop(screen.getByRole('heading', { name: 'Choose how to play' }).closest('section') as HTMLElement,
      { dataTransfer: { files: { item: () => new File([''], 'Example.mp4') } } })
    expect(openVideoPath).not.toHaveBeenCalled()
    await act(async () => finish({ cancelled: false }))
    expect(input.disabled).toBe(false)
  })

  it('blocks stream submission while the local picker is pending and restores it on cancellation', async () => {
    let finish!: (result: OpenVideoResult) => void
    openVideo.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<PlaybackProof />)
    enter()
    fireEvent.click(screen.getByRole('button', { name: 'Choose video' }))
    submit()
    expect(openStream).not.toHaveBeenCalled()
    await act(async () => finish({ cancelled: true }))
    submit()
    await waitFor(() => expect(openStream).toHaveBeenCalledOnce())
  })

  it.each(['result', 'reject', 'cancel'])('restores controls and supports retry after %s failure without echoing errors', async (kind) => {
    if (kind === 'reject') openStream.mockRejectedValueOnce(new Error(`private ${url}`))
    else openStream.mockResolvedValueOnce(kind === 'cancel' ? { cancelled: true } : { cancelled: false, error: `private ${url}` })
    render(<PlaybackProof />)
    const input = enter()
    submit()
    const error = await screen.findByRole('alert')
    expect(error.textContent).toBe('Could not open the stream. Check the URL and try again.')
    expect(error.textContent).not.toContain(url)
    expect(input.value).toBe(url)
    expect(input.disabled).toBe(false)
    submit()
    await waitFor(() => expect(input.value).toBe(''))
    expect(openStream).toHaveBeenCalledTimes(2)
  })
})
