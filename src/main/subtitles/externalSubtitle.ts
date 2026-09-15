import path from 'node:path'

export type ExternalSubtitleFormat = 'srt' | 'ass' | 'ssa'

export const MAX_EXTERNAL_SUBTITLE_BYTES = 32 * 1024 * 1024

export interface ExternalSubtitleDescriptor {
  fileName: string
  format: ExternalSubtitleFormat
}

export function describeExternalSubtitle(filePath: string): ExternalSubtitleDescriptor {
  const fileName = path.basename(filePath)
  const extension = path.extname(fileName).toLocaleLowerCase('en-US')

  if (extension !== '.srt' && extension !== '.ass' && extension !== '.ssa') {
    throw new Error('Choose an SRT, ASS, or SSA subtitle file.')
  }

  return {
    fileName,
    format: extension.slice(1) as ExternalSubtitleFormat
  }
}

export function validateExternalSubtitleSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error('The subtitle file size could not be validated.')
  }

  if (size > MAX_EXTERNAL_SUBTITLE_BYTES) {
    throw new Error('The subtitle file is too large to process safely.')
  }
}
