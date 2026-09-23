export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateSnapshot {
  status: UpdateStatus
  currentVersion: string
  latestVersion: string | null
  releaseName: string | null
  releaseNotes: string | null
  publishedAt: string | null
  downloadPercent: number | null
  error: string | null
  checkedAt: string | null
}

export interface UpdateActionResult {
  ok: boolean
  error?: string
}

export interface UpdateBridge {
  getState: () => Promise<UpdateSnapshot>
  check: () => Promise<UpdateSnapshot>
  download: () => Promise<UpdateActionResult>
  install: () => Promise<UpdateActionResult>
  onState: (listener: (state: UpdateSnapshot) => void) => () => void
}
