import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_SUBTITLE_TRACK_ID,
  type PlaybackSnapshot,
} from '../src/shared/media'
import { SubtitleSession } from '../src/main/media/SubtitleSession'
import { parseSrtCues } from '../src/main/subtitles/normalize'

const EXTERNAL_CUES = parseSrtCues(
  '1\n00:00:01,000 --> 00:00:03,000\nExternal dialogue here.\n\n2\n00:00:05,000 --> 00:00:07,000\nSecond line.',
)

function baseState(overrides: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  return {
    status: 'paused',
    filePath: 'C:\\media\\movie.mkv',
    fileName: 'movie.mkv',
    currentTime: 2,
    duration: 120,
    volume: 100,
    speed: 1,
    subtitleDelay: 0,
    tracks: [
      {
        id: 2,
        type: 'subtitle',
        codec: 'subrip',
        language: 'eng',
        title: 'English',
        selected: true,
        subtitleKind: 'text',
        ffIndex: 3,
      },
    ],
    subtitle: {
      status: 'ready',
      trackId: 2,
      trackLanguage: 'eng',
      trackTitle: 'English',
      trackCodec: 'subrip',
      cueCount: 10,
      activeCue: null,
      error: null,
    },
    error: null,
    ...overrides,
  }
}

describe('external subtitle session', () => {
  it('adds and activates one external interactive source without replacing base tracks', () => {
    const broadcasts: PlaybackSnapshot[] = []
    const session = new SubtitleSession((state) => broadcasts.push(state))

    const state = session.setExternal(baseState(), 'movie.en.srt', 'srt', EXTERNAL_CUES)

    expect(state.tracks.map((track) => track.id)).toEqual([2, EXTERNAL_SUBTITLE_TRACK_ID])
    expect(state.subtitle).toMatchObject({
      status: 'ready',
      trackId: EXTERNAL_SUBTITLE_TRACK_ID,
      trackTitle: 'movie.en.srt',
      trackCodec: 'srt',
      cueCount: 2,
    })
    expect(state.subtitle.activeCue?.text).toBe('External dialogue here.')
    expect(broadcasts.at(-1)?.subtitle.trackId).toBe(EXTERNAL_SUBTITLE_TRACK_ID)
  })

  it('uses the media subtitle delay when resolving external cues', () => {
    const session = new SubtitleSession(() => undefined)
    const state = session.setExternal(
      baseState({ currentTime: 2, subtitleDelay: 1.5 }),
      'movie.en.srt',
      'srt',
      EXTERNAL_CUES,
    )

    expect(state.subtitle.activeCue).toBeNull()
  })

  it('switches back to the base subtitle while retaining the external source for re-selection', () => {
    const session = new SubtitleSession(() => undefined)
    const base = baseState()
    session.setExternal(base, 'movie.en.srt', 'srt', EXTERNAL_CUES)

    const embedded = session.deactivateExternal(base)
    expect(embedded.subtitle.trackId).toBe(2)
    expect(embedded.tracks.some((track) => track.id === EXTERNAL_SUBTITLE_TRACK_ID)).toBe(true)

    const external = session.activateExternal(base)
    expect(external.subtitle.trackId).toBe(EXTERNAL_SUBTITLE_TRACK_ID)
  })

  it('drops the external source when a different playback target arrives', () => {
    let latest: PlaybackSnapshot | null = null
    const session = new SubtitleSession((state) => {
      latest = state
    })
    session.setExternal(baseState(), 'movie.en.srt', 'srt', EXTERNAL_CUES)

    session.handleBaseState(
      baseState({
        filePath: 'C:\\media\\other.mkv',
        fileName: 'other.mkv',
      }),
    )

    expect(latest?.tracks.some((track) => track.id === EXTERNAL_SUBTITLE_TRACK_ID)).toBe(false)
    expect(latest?.subtitle.trackId).toBe(2)
  })
})
