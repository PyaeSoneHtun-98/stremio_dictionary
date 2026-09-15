export const MIN_SUBTITLE_DELAY_SECONDS = -10
export const MAX_SUBTITLE_DELAY_SECONDS = 10

export function normalizeSubtitleDelay(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Subtitle delay must be a finite number.')
  }

  if (value < MIN_SUBTITLE_DELAY_SECONDS || value > MAX_SUBTITLE_DELAY_SECONDS) {
    throw new Error(
      `Subtitle delay must be between ${MIN_SUBTITLE_DELAY_SECONDS} and ${MAX_SUBTITLE_DELAY_SECONDS} seconds.`
    )
  }

  return Math.round(value * 1000) / 1000
}

export function adjustedSubtitleTime(
  playbackTime: number | null,
  delaySeconds: number | null | undefined
): number | null {
  if (playbackTime === null || !Number.isFinite(playbackTime)) {
    return null
  }

  const delay =
    typeof delaySeconds === 'number' && Number.isFinite(delaySeconds) ? delaySeconds : 0
  return playbackTime - delay
}
