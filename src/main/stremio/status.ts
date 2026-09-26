import type { StremioHandoffStatus } from '../../shared/media'
import type { StremioHandoffInspection } from './HandoffService'

export function packagedStremioStatus(
  inspection: StremioHandoffInspection
): StremioHandoffStatus {
  if (inspection.automaticRepairBlocked) {
    return {
      state: 'unknown',
      message:
        'Subtitle Bridge cannot safely change this Stremio integration automatically because a recorded target could not be verified. Restore or update Stremio, then try again.',
      canEnable: false,
      canDisable: false
    }
  }

  if (inspection.repairNeeded) {
    return {
      state: 'repair',
      message:
        'The Stremio integration needs a safe reset. Disable the saved integration first. After cleanup, Enable can be tried again if this Stremio version is compatible.',
      canEnable: false,
      canDisable: inspection.recordedTargets > 0
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
    message:
      'Could not verify the current Stremio integration state safely. Retry after restarting Stremio or Subtitle Bridge.',
    canEnable: false,
    canDisable: false
  }
}
