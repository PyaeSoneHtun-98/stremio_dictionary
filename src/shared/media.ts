import type { TranslationSettingsSnapshot, TranslationSettingsUpdate } from './settings'
import type { TranslationRequest, TranslationResult } from './translation'
import type { UpdateBridge } from './update'

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'
  | 'unavailable'

export type MediaTrackType = 'video' | 'audio' | 'subtitle'
export type SubtitleTrackKind = 'text' | 'image' | 'unknown'
export type SubtitleModelStatus = 'idle' | 'missing' | 'extracting' | 'ready' | 'unsupported' | 'error'

export const EXTERNAL_SUBTITLE_TRACK_ID = -1

export interface MediaTrack {
  id: number
  type: MediaTrackType
  codec: string | null
  language: string | null
  title: string | null
  selected: boolean
  subtitleKind: SubtitleTrackKind | null
  ffIndex: number | null
}

export interface SubtitleToken {
  text: string
  lookupTerm: string
  start: number
  end: number
}

export interface SubtitleCue {
  id: string
  startTime: number
  endTime: number
  text: string
  lines: string[]
  tokens: SubtitleToken[]
}

export interface SubtitleModelSnapshot {
  status: SubtitleModelStatus
  trackId: number | null
  trackLanguage: string | null
  trackTitle: string | null
  trackCodec: string | null
  cueCount: number
  activeCue: SubtitleCue | null
  error: string | null
}

export interface SubtitlePreferencesSnapshot {
  fontScale: number
  verticalOffset: number
}

export interface SubtitlePreferencesUpdate {
  fontScale?: number
  verticalOffset?: number
}

export const DEFAULT_SUBTITLE_PREFERENCES: SubtitlePreferencesSnapshot = {
  fontScale: 1,
  verticalOffset: 0
}

export interface PlaybackSnapshot {
  status: PlaybackStatus
  filePath: string | null
  fileName: string | null
  currentTime: number | null
  duration: number | null
  volume: number
  speed: number
  subtitleDelay?: number
  buffering?: boolean
  tracks: MediaTrack[]
  subtitle: SubtitleModelSnapshot
  error: string | null
}

export interface OpenVideoResult {
  cancelled: boolean
  error?: string
}

export interface LoadExternalSubtitleResult {
  loaded: boolean
  cancelled?: boolean
  fileName?: string
  error?: string
}

export type StremioHandoffState = 'enabled' | 'disabled' | 'repair' | 'unknown' | 'unavailable'

export interface StremioHandoffStatus {
  state: StremioHandoffState
  message: string
  canEnable: boolean
  canDisable: boolean
}

export interface StremioHandoffResult {
  ok: boolean
  message: string
}

export interface DesktopBridge {
  platform: string
  media: {
    openVideo: () => Promise<OpenVideoResult>
    openVideoPath: (filePath: string) => Promise<OpenVideoResult>
    getPathForFile: (file: unknown) => string
    openExternalSubtitle: () => Promise<LoadExternalSubtitleResult>
    loadExternalSubtitlePath: (filePath: string) => Promise<LoadExternalSubtitleResult>
    getState: () => Promise<PlaybackSnapshot>
    getDoubleClickInterval: () => Promise<number>
    setPaused: (paused: boolean) => Promise<void>
    seek: (seconds: number) => Promise<void>
    setVolume: (volume: number) => Promise<void>
    setSpeed: (speed: number) => Promise<void>
    setSubtitleDelay: (seconds: number) => Promise<void>
    adjustSubtitleDelay: (deltaSeconds: number) => Promise<number>
    selectSubtitleTrack: (trackId: number) => Promise<void>
    getSubtitlePreferences: () => Promise<SubtitlePreferencesSnapshot>
    updateSubtitlePreferences: (
      update: SubtitlePreferencesUpdate
    ) => Promise<SubtitlePreferencesSnapshot>
    toggleFullscreen: () => Promise<void>
    onState: (listener: (state: PlaybackSnapshot) => void) => () => void
  }
  update: UpdateBridge
  stremio: {
    getHandoffStatus: () => Promise<StremioHandoffStatus>
    enableHandoff: () => Promise<StremioHandoffResult>
    disableHandoff: () => Promise<StremioHandoffResult>
  }
  translation: {
    translateWord: (request: TranslationRequest) => Promise<TranslationResult>
    getSettings: () => Promise<TranslationSettingsSnapshot>
    updateSettings: (update: TranslationSettingsUpdate) => Promise<TranslationSettingsSnapshot>
    clearCache: () => Promise<TranslationSettingsSnapshot>
  }
}

const TEXT_SUBTITLE_CODECS = new Set([
  'ass',
  'ssa',
  'subrip',
  'srt',
  'text',
  'webvtt',
  'mov_text'
])

const IMAGE_SUBTITLE_CODECS = new Set([
  'hdmv_pgs_subtitle',
  'pgs',
  'dvd_subtitle',
  'dvdsub',
  'vobsub',
  'xsub'
])

export function createEmptySubtitleModel(): SubtitleModelSnapshot {
  return {
    status: 'idle',
    trackId: null,
    trackLanguage: null,
    trackTitle: null,
    trackCodec: null,
    cueCount: 0,
    activeCue: null,
    error: null
  }
}

export function classifySubtitleCodec(codec: string | null | undefined): SubtitleTrackKind {
  if (!codec) {
    return 'unknown'
  }

  const normalized = codec.toLowerCase()

  if (TEXT_SUBTITLE_CODECS.has(normalized)) {
    return 'text'
  }

  if (IMAGE_SUBTITLE_CODECS.has(normalized)) {
    return 'image'
  }

  return 'unknown'
}

interface MpvTrackLike {
  id?: unknown
  type?: unknown
  codec?: unknown
  lang?: unknown
  title?: unknown
  selected?: unknown
  'ff-index'?: unknown
}

export function normalizeMpvTracks(value: unknown): MediaTrack[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((rawTrack) => {
    if (!rawTrack || typeof rawTrack !== 'object') {
      return []
    }

    const track = rawTrack as MpvTrackLike
    const type = normalizeTrackType(track.type)
    const id = typeof track.id === 'number' ? track.id : null

    if (!type || id === null) {
      return []
    }

    const codec = typeof track.codec === 'string' ? track.codec : null

    return [
      {
        id,
        type,
        codec,
        language: typeof track.lang === 'string' ? track.lang : null,
        title: typeof track.title === 'string' ? track.title : null,
        selected: track.selected === true,
        subtitleKind: type === 'subtitle' ? classifySubtitleCodec(codec) : null,
        ffIndex: typeof track['ff-index'] === 'number' ? track['ff-index'] : null
      }
    ]
  })
}

function normalizeTrackType(type: unknown): MediaTrackType | null {
  if (type === 'video' || type === 'audio') {
    return type
  }

  if (type === 'sub' || type === 'subtitle') {
    return 'subtitle'
  }

  return null
}
