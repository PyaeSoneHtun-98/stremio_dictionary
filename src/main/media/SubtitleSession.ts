import {
  EXTERNAL_SUBTITLE_TRACK_ID,
  type MediaTrack,
  type PlaybackSnapshot,
  type SubtitleCue
} from '../../shared/media'
import type { ExternalSubtitleFormat } from '../subtitles/externalSubtitle'
import { findActiveCue } from '../subtitles/normalize'
import { adjustedSubtitleTime } from '../subtitles/timing'

interface ExternalSubtitleState {
  mediaKey: string
  fileName: string
  format: ExternalSubtitleFormat
  cues: SubtitleCue[]
}

export class SubtitleSession {
  private external: ExternalSubtitleState | null = null
  private externalActive = false
  private lastMediaKey: string | null = null

  constructor(private readonly onState: (state: PlaybackSnapshot) => void) {}

  handleBaseState(state: PlaybackSnapshot): void {
    if (state.filePath !== this.lastMediaKey) {
      this.lastMediaKey = state.filePath
      if (this.external && this.external.mediaKey !== state.filePath) {
        this.external = null
        this.externalActive = false
      }
    }

    this.onState(this.compose(state))
  }

  getState(baseState: PlaybackSnapshot): PlaybackSnapshot {
    return this.compose(baseState)
  }

  setExternal(
    baseState: PlaybackSnapshot,
    fileName: string,
    format: ExternalSubtitleFormat,
    cues: SubtitleCue[]
  ): PlaybackSnapshot {
    if (!baseState.filePath) {
      throw new Error('Open a video before loading an external subtitle.')
    }

    this.lastMediaKey = baseState.filePath
    this.external = {
      mediaKey: baseState.filePath,
      fileName,
      format,
      cues
    }
    this.externalActive = true

    const state = this.compose(baseState)
    this.onState(state)
    return state
  }

  activateExternal(baseState: PlaybackSnapshot): PlaybackSnapshot {
    if (!this.external || this.external.mediaKey !== baseState.filePath) {
      throw new Error('The external subtitle is no longer available for this video.')
    }

    this.externalActive = true
    const state = this.compose(baseState)
    this.onState(state)
    return state
  }

  deactivateExternal(baseState: PlaybackSnapshot): PlaybackSnapshot {
    this.externalActive = false
    const state = this.compose(baseState)
    this.onState(state)
    return state
  }

  clear(baseState: PlaybackSnapshot): PlaybackSnapshot {
    this.external = null
    this.externalActive = false
    const state = this.compose(baseState)
    this.onState(state)
    return state
  }

  isExternalTrack(trackId: number): boolean {
    return trackId === EXTERNAL_SUBTITLE_TRACK_ID
  }

  private compose(baseState: PlaybackSnapshot): PlaybackSnapshot {
    const external =
      this.external && this.external.mediaKey === baseState.filePath ? this.external : null

    if (!external) {
      return baseState
    }

    const externalTrack: MediaTrack = {
      id: EXTERNAL_SUBTITLE_TRACK_ID,
      type: 'subtitle',
      codec: external.format,
      language: null,
      title: external.fileName,
      selected: this.externalActive,
      subtitleKind: 'text',
      // Negative sentinel: this track is parsed from its own file, not an embedded FFmpeg stream.
      // Existing renderer track-selection logic only treats null as unavailable.
      ffIndex: EXTERNAL_SUBTITLE_TRACK_ID
    }

    const tracks = [
      ...baseState.tracks.filter((track) => track.id !== EXTERNAL_SUBTITLE_TRACK_ID),
      externalTrack
    ]

    if (!this.externalActive) {
      return { ...baseState, tracks }
    }

    const delayedTime = adjustedSubtitleTime(baseState.currentTime, baseState.subtitleDelay)
    const activeCue = ['error', 'unavailable'].includes(baseState.status)
      ? null
      : findActiveCue(
          external.cues,
          delayedTime,
          null,
          external.format === 'ass' || external.format === 'ssa'
        )

    return {
      ...baseState,
      tracks,
      subtitle: {
        status: 'ready',
        trackId: EXTERNAL_SUBTITLE_TRACK_ID,
        trackLanguage: null,
        trackTitle: external.fileName,
        trackCodec: external.format,
        cueCount: external.cues.length,
        activeCue,
        error: null
      }
    }
  }
}
