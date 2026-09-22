export interface BufferingInputs {
  networkTarget: boolean
  paused: boolean
  pausedForCache: boolean
  seekPending: boolean
}

export function deriveBufferingState({
  networkTarget,
  paused,
  pausedForCache,
  seekPending
}: BufferingInputs): boolean {
  return networkTarget && !paused && (pausedForCache || seekPending)
}
