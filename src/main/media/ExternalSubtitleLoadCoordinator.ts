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

export class ExternalSubtitleLoadCoordinator {
  private generation = 0

  constructor(private readonly dependencies: ExternalSubtitleLoadDependencies) {}

  invalidate(): void {
    this.generation += 1
  }

  async load(filePath: string): Promise<LoadExternalSubtitleResult> {
    // Establish ordering before any async validation so a later drop always supersedes this one.
    const requestGeneration = ++this.generation
    const startingState = this.dependencies.getState()
    if (!startingState.filePath) {
      return { loaded: false, error: 'Open a video before loading an external subtitle.' }
    }

    const mediaKey = startingState.filePath

    try {
      const descriptor = await this.dependencies.validate(filePath)
      if (!this.isCurrent(requestGeneration)) {
        return supersededResult()
      }

      // Extraction mutates the shared extractor by cancelling/replacing its active child process,
      // so stale requests must never reach it.
      const cues = await this.dependencies.extract(filePath, descriptor.format)
      if (!this.isCurrent(requestGeneration)) {
        return supersededResult()
      }

      const latestState = this.dependencies.getState()
      if (latestState.filePath !== mediaKey) {
        return {
          loaded: false,
          error: 'The video changed before the subtitle finished loading. Drop the subtitle again.'
        }
      }

      if (!this.isCurrent(requestGeneration)) {
        return supersededResult()
      }

      this.dependencies.setExternal(latestState, descriptor.fileName, descriptor.format, cues)
      return { loaded: true, fileName: descriptor.fileName }
    } catch (error) {
      if (!this.isCurrent(requestGeneration)) {
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
