import type { StremioHandoffStatus } from '../../shared/media'
import type { StremioHandoffInspection } from './HandoffService'

export function packagedStremioStatus(
  inspection: StremioHandoffInspection
): StremioHandoffStatus {
  if (inspection.repairNeeded) {
    return {
      state: 'repair',
      message:
        'One or more Stremio handoff targets need repair. Disable the existing patches first, then Enable again to rebuild the integration.',
      canEnable: false,
      canDisable: inspection.patchedTargets > 0
    }
  }

  if (inspection.enabled) {
    return {
      state: 'enabled',
      message: 'Play in Subtitle Bridge is enabled in Stremio.',
      canEnable: false,
      canDisable: inspection.patchedTargets > 0
    }
  }

  return {
    state: 'disabled',
    message: 'Play in Subtitle Bridge is not enabled in Stremio.',
    canEnable: true,
    canDisable: false
  }
}

export function developmentStremioStatus(): StremioHandoffStatus {
  return {
    state: 'unknown',
    message:
      'Stremio integration status is read-only in development. Check it from the installed Subtitle Bridge app.',
    canEnable: false,
    canDisable: false
  }
}

export function unknownPackagedStremioStatus(): StremioHandoffStatus {
  return {
    state: 'unknown',
    message: 'Could not verify the current Stremio integration state.',
    canEnable: true,
    canDisable: true
  }
}
