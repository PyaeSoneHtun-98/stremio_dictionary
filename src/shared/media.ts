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

export interface MediaTrack {
  id: number
  type: MediaTrackType
  codec: string | null
  language: string | null
  title: string | null
  selected: boolean
  subtitleKind: SubtitleTrackKind | null
}

export interface PlaybackSnapshot {
  status: PlaybackStatus
  filePath: string | null
  fileName: string | null
  currentTime: number | null
  duration: number | null
  volume: number
  speed: number
  tracks: MediaTrack[]
  error: string | null
}

export interface OpenVideoResult {
  cancelled: boolean
  error?: string
}

export interface DesktopBridge {
  platform: string
  media: {
    openVideo: () => Promise<OpenVideoResult>
    openVideoPath: (filePath: string) => Promise<OpenVideoResult>
    getPathForFile: (file: unknown) => string
    getState: () => Promise<PlaybackSnapshot>
    setPaused: (paused: boolean) => Promise<void>
    seek: (seconds: number) => Promise<void>
    setVolume: (volume: number) => Promise<void>
    setSpeed: (speed: number) => Promise<void>
    toggleFullscreen: () => Promise<void>
    onState: (listener: (state: PlaybackSnapshot) => void) => () => void
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
        subtitleKind: type === 'subtitle' ? classifySubtitleCodec(codec) : null
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
