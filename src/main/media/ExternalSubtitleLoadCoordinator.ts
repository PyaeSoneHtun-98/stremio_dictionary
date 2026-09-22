import type {
  LoadExternalSubtitleResult,
  PlaybackSnapshot,
  SubtitleCue
} from '../../shared/media'
import type {
  ExternalSubtitleDescriptor,
  ExternalSubtitleFormat
} from '../subtitles/externalSubtitle'

interface ExternalSubtitleLoadDependencies {
  getState: () => PlaybackSnapshot
  validate: (filePath: string) => Promise<ExternalSubtitleDescriptor>
  extract: (filePath: string, format: ExternalSubtitleFormat) => Promise<SubtitleCue[]>
  setExternal: (
    state: PlaybackSnapshot,
    fileName: string,
    format: ExternalSubtitleFormat,
    cues: SubtitleCue[]
  ) => void
}

export interface ExternalSubtitleLoadRequest {
  generation: number
  mediaKey: string
}

export class ExternalSubtitleLoadCoordinator {
  private generation = 0

  constructor(private readonly dependencies: ExternalSubtitleLoadDependencies) {}

  invalidate(): void {
    this.generation += 1
  }

  beginLoadRequest(): ExternalSubtitleLoadRequest | null {
    const state = this.dependencies.getState()
    if (!state.filePath) {
      return null
    }

    return {
      generation: ++this.generation,
      mediaKey: state.filePath
    }
  }

  async load(filePath: string): Promise<LoadExternalSubtitleResult> {
    const request = this.beginLoadRequest()
    if (!request) {
      return { loaded: false, error: 'Open a video before loading an external subtitle.' }
    }

    return this.loadRequested(filePath, request)
  }

  async loadRequested(
    filePath: string,
    request: ExternalSubtitleLoadRequest
  ): Promise<LoadExternalSubtitleResult> {
    if (!this.isCurrent(request.generation)) {
      return supersededResult()
    }

    if (this.dependencies.getState().filePath !== request.mediaKey) {
      return mediaChangedResult()
    }

    try {
      const descriptor = await this.dependencies.validate(filePath)
      if (!this.isCurrent(request.generation)) {
        return supersededResult()
      }

      if (this.dependencies.getState().filePath !== request.mediaKey) {
        return mediaChangedResult()
      }

      const cues = await this.dependencies.extract(filePath, descriptor.format)
      if (!this.isCurrent(request.generation)) {
        return supersededResult()
      }

      const latestState = this.dependencies.getState()
      if (latestState.filePath !== request.mediaKey) {
        return mediaChangedResult()
      }

      this.dependencies.setExternal(latestState, descriptor.fileName, descriptor.format, cues)
      return { loaded: true, fileName: descriptor.fileName }
    } catch (error) {
      if (!this.isCurrent(request.generation)) {
        return supersededResult()
      }

      return {
        loaded: false,
        error: error instanceof Error ? error.message : 'Could not load this subtitle file.'
      }
    }
  }

  private isCurrent(requestGeneration: number): boolean {
    return requestGeneration === this.generation
  }
}

function supersededResult(): LoadExternalSubtitleResult {
  return {
    loaded: false,
    error: 'A newer subtitle load replaced this request.'
  }
}

function mediaChangedResult(): LoadExternalSubtitleResult {
  return {
    loaded: false,
    error: 'The video changed before the subtitle was selected or loaded. Choose the subtitle again.'
  }
}
