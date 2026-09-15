import { describe, expect, it } from 'vitest'
import type { PlaybackSnapshot, SubtitleCue } from '../src/shared/media'
import { ExternalSubtitleLoadCoordinator } from '../src/main/media/ExternalSubtitleLoadCoordinator'
import type { ExternalSubtitleDescriptor } from '../src/main/subtitles/externalSubtitle'
import { parseSrtCues } from '../src/main/subtitles/normalize'

const CUES = parseSrtCues('1\n00:00:01,000 --> 00:00:03,000\nDialogue.')

function baseState(): PlaybackSnapshot {
  return {
    status: 'paused',
    filePath: 'C:\\media\\movie.mkv',
    fileName: 'movie.mkv',
    currentTime: 2,
    duration: 120,
    volume: 100,
    speed: 1,
    subtitleDelay: 0,
    tracks: [],
    subtitle: {
      status: 'unavailable',
      trackId: null,
      trackLanguage: null,
      trackTitle: null,
      trackCodec: null,
      cueCount: 0,
      activeCue: null,
      error: null,
    },
    error: null,
  }
}

function descriptor(fileName: string): ExternalSubtitleDescriptor {
  return { fileName, format: 'ass' }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('ExternalSubtitleLoadCoordinator', () => {
  it('prevents an older request from starting extraction when its validation finishes last', async () => {
    const firstValidation = deferred<ExternalSubtitleDescriptor>()
    const secondValidation = deferred<ExternalSubtitleDescriptor>()
    const secondExtraction = deferred<SubtitleCue[]>()
    const extractedPaths: string[] = []
    const activatedFiles: string[] = []

    const coordinator = new ExternalSubtitleLoadCoordinator({
      getState: baseState,
      validate: (filePath) =>
        filePath.endsWith('first.ass') ? firstValidation.promise : secondValidation.promise,
      extract: (filePath) => {
        extractedPaths.push(filePath)
        return secondExtraction.promise
      },
      setExternal: (_state, fileName) => {
        activatedFiles.push(fileName)
      },
    })

    const firstLoad = coordinator.load('C:\\subs\\first.ass')
    const secondLoad = coordinator.load('C:\\subs\\second.ass')

    secondValidation.resolve(descriptor('second.ass'))
    await Promise.resolve()
    firstValidation.resolve(descriptor('first.ass'))
    await Promise.resolve()

    expect(extractedPaths).toEqual(['C:\\subs\\second.ass'])

    secondExtraction.resolve(CUES)
    await expect(secondLoad).resolves.toEqual({ loaded: true, fileName: 'second.ass' })
    await expect(firstLoad).resolves.toMatchObject({ loaded: false })
    expect(activatedFiles).toEqual(['second.ass'])
  })

  it('prevents an older extraction from activating after a newer request starts', async () => {
    const firstValidation = deferred<ExternalSubtitleDescriptor>()
    const secondValidation = deferred<ExternalSubtitleDescriptor>()
    const firstExtraction = deferred<SubtitleCue[]>()
    const secondExtraction = deferred<SubtitleCue[]>()
    const activatedFiles: string[] = []

    const coordinator = new ExternalSubtitleLoadCoordinator({
      getState: baseState,
      validate: (filePath) =>
        filePath.endsWith('first.ass') ? firstValidation.promise : secondValidation.promise,
      extract: (filePath) =>
        filePath.endsWith('first.ass') ? firstExtraction.promise : secondExtraction.promise,
      setExternal: (_state, fileName) => {
        activatedFiles.push(fileName)
      },
    })

    const firstLoad = coordinator.load('C:\\subs\\first.ass')
    firstValidation.resolve(descriptor('first.ass'))
    await Promise.resolve()

    const secondLoad = coordinator.load('C:\\subs\\second.ass')
    firstExtraction.resolve(CUES)
    await Promise.resolve()

    expect(activatedFiles).toEqual([])

    secondValidation.resolve(descriptor('second.ass'))
    await Promise.resolve()
    secondExtraction.resolve(CUES)

    await expect(secondLoad).resolves.toEqual({ loaded: true, fileName: 'second.ass' })
    await expect(firstLoad).resolves.toMatchObject({ loaded: false })
    expect(activatedFiles).toEqual(['second.ass'])
  })
})
