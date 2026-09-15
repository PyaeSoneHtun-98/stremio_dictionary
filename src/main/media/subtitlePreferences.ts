import {
  DEFAULT_SUBTITLE_PREFERENCES,
  type SubtitlePreferencesSnapshot,
  type SubtitlePreferencesUpdate
} from '../../shared/media'

export const MIN_SUBTITLE_FONT_SCALE = 0.7
export const MAX_SUBTITLE_FONT_SCALE = 1.6
export const MIN_SUBTITLE_VERTICAL_OFFSET = -24
export const MAX_SUBTITLE_VERTICAL_OFFSET = 240

export function applySubtitlePreferencesUpdate(
  current: SubtitlePreferencesSnapshot,
  update: SubtitlePreferencesUpdate
): SubtitlePreferencesSnapshot {
  return {
    fontScale:
      update.fontScale === undefined ? current.fontScale : normalizeFontScale(update.fontScale),
    verticalOffset:
      update.verticalOffset === undefined
        ? current.verticalOffset
        : normalizeVerticalOffset(update.verticalOffset)
  }
}

export function sanitizePersistedSubtitlePreferences(value: unknown): SubtitlePreferencesSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SUBTITLE_PREFERENCES }
  }

  const raw = value as Record<string, unknown>
  return {
    fontScale: sanitizeNumber(
      raw.fontScale,
      MIN_SUBTITLE_FONT_SCALE,
      MAX_SUBTITLE_FONT_SCALE,
      DEFAULT_SUBTITLE_PREFERENCES.fontScale
    ),
    verticalOffset: sanitizeNumber(
      raw.verticalOffset,
      MIN_SUBTITLE_VERTICAL_OFFSET,
      MAX_SUBTITLE_VERTICAL_OFFSET,
      DEFAULT_SUBTITLE_PREFERENCES.verticalOffset
    )
  }
}

function normalizeFontScale(value: number): number {
  return normalizePreferenceNumber(
    value,
    MIN_SUBTITLE_FONT_SCALE,
    MAX_SUBTITLE_FONT_SCALE,
    'Subtitle font size'
  )
}

function normalizeVerticalOffset(value: number): number {
  return normalizePreferenceNumber(
    value,
    MIN_SUBTITLE_VERTICAL_OFFSET,
    MAX_SUBTITLE_VERTICAL_OFFSET,
    'Subtitle vertical position'
  )
}

function normalizePreferenceNumber(
  value: number,
  minimum: number,
  maximum: number,
  label: string
): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is outside the supported range.`)
  }

  return Math.round(value * 1000) / 1000
}

function sanitizeNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  if (value < minimum || value > maximum) {
    return fallback
  }

  return Math.round(value * 1000) / 1000
}
